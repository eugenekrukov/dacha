package ru.dachakalend.app.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Insights
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import ru.dachakalend.app.data.api.mediaUrl
import ru.dachakalend.app.ui.actions.ACTION_TYPES
import ru.dachakalend.app.ui.feed.ActionFeedCard
import ru.dachakalend.app.ui.feed.FeedMonthHeader
import ru.dachakalend.app.ui.feed.FeedThumb
import ru.dachakalend.app.ui.feed.MilestoneFeedRow
import ru.dachakalend.app.ui.feed.PhotoActionsBar
import ru.dachakalend.app.ui.feed.PhotoFeedRow
import ru.dachakalend.app.ui.settings.AccountSection
import ru.dachakalend.app.ui.theme.NunitoFamily

// Ярлык действия для подписи фото — единый источник с шторкой записи действия.
private val ACTION_LABELS = ACTION_TYPES.toMap()

private fun feedDateShort(iso: String): String = try {
    val d = java.time.OffsetDateTime.parse(iso)
    "%02d.%02d.%02d".format(d.dayOfMonth, d.monthValue, d.year % 100)
} catch (_: Exception) {
    try {
        val d = java.time.LocalDate.parse(iso.take(10))
        "%02d.%02d.%02d".format(d.dayOfMonth, d.monthValue, d.year % 100)
    } catch (_: Exception) { iso.take(10) }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    onOpenAnalytics: () -> Unit,
    onOpenJournal: () -> Unit,
    onOpenPlanting: (Int) -> Unit,
    onEditGarden: () -> Unit,
    onLogout: () -> Unit,
    onVerifyEmail: (email: String?) -> Unit,
    viewModel: FeedViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsState()
    var tab by remember { mutableIntStateOf(0) }
    val tabs = listOf("Лента", "Статистика", "Аккаунт")

    // Рефреш ленты при входе/возврате на вкладку — новые фото/действия подхватываются без рестарта.
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) viewModel.load()
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        contentWindowInsets = WindowInsets(0),
    ) { padding ->
        Column(modifier = Modifier.padding(padding)) {
            ProfileHeader(state.gardenName, state.gardenRegion)
            TabRow(selectedTabIndex = tab, containerColor = MaterialTheme.colorScheme.background) {
                tabs.forEachIndexed { i, t ->
                    Tab(selected = tab == i, onClick = { tab = i },
                        text = { Text(t, fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, softWrap = false) })
                }
            }
            when (tab) {
                0 -> FeedList(
                    state = state,
                    onOpenPlanting = onOpenPlanting,
                    onLoadMore = viewModel::loadMore,
                    onDeletePhoto = viewModel::deletePhoto,
                    onDeleteAction = viewModel::deleteAction,
                    onReplace = { pid, photoId, actionId, bytes -> viewModel.replacePhoto(pid, photoId, actionId, bytes) },
                )
                1 -> HubTab(
                    listOf(
                        HubEntry(Icons.Default.Insights, "Статистика", "Серия дней, активность, экспорт в CSV", onOpenAnalytics),
                        HubEntry(Icons.AutoMirrored.Filled.MenuBook, "Журнал действий", "История действий с заметками и фото", onOpenJournal),
                    )
                )
                2 -> AccountSection(
                    gardenName = state.gardenName,
                    gardenRegion = state.gardenRegion,
                    onVerifyEmail = onVerifyEmail,
                    onEditGarden = onEditGarden,
                    onLogout = onLogout,
                )
            }
        }
    }
}

@Composable
private fun ProfileHeader(name: String?, region: String?) {
    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp)) {
        Text(
            name?.takeIf { it.isNotBlank() } ?: "Мой участок",
            fontFamily = NunitoFamily, fontWeight = FontWeight.Black, fontSize = 26.sp,
            color = MaterialTheme.colorScheme.onBackground
        )
        region?.takeIf { it.isNotBlank() }?.let {
            Text(it, fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold, fontSize = 13.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

// Цель полноэкранного просмотра — конкретное фото (у action-записи их несколько).
private data class PhotoViewerTarget(
    val photoId: Int,
    val url: String?,
    val actionId: Int?,
    val plantingId: Int?,
    val dateIso: String,
    val cropName: String?,
    val caption: String?,
)

@Composable
private fun FeedList(
    state: FeedUiState,
    onOpenPlanting: (Int) -> Unit,
    onLoadMore: () -> Unit,
    onDeletePhoto: (Int) -> Unit,
    onDeleteAction: (Int) -> Unit,
    onReplace: (plantingId: Int, photoId: Int, actionId: Int?, bytes: ByteArray) -> Unit,
) {
    var viewer by remember { mutableStateOf<PhotoViewerTarget?>(null) }

    when {
        state.isLoading && state.items.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
        }
        state.error != null -> Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
            Text(state.error, fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        state.items.isEmpty() -> Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
            Text(
                "Лента пуста. Снимайте посадки и отмечайте действия — соберётся история роста.",
                fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        else -> {
            val listState = rememberLazyListState()
            // Догрузка следующей страницы при подходе к концу списка.
            val shouldLoadMore by remember {
                derivedStateOf {
                    val last = listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
                    last >= listState.layoutInfo.totalItemsCount - 3
                }
            }
            LaunchedEffect(shouldLoadMore) { if (shouldLoadMore) onLoadMore() }

            // items уже отсортированы по дате убыв. на бэкенде → группировка по месяцу сохраняет порядок.
            val grouped = state.items.groupBy { it.date.take(7) }
            LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                grouped.forEach { (monthKey, monthItems) ->
                    item(key = "m_$monthKey") { FeedMonthHeader(monthKey) }
                    items(monthItems, key = { "${it.type}_${it.actionId ?: it.photoId ?: it.kind}_${it.plantingId}_${it.date}" }) { item ->
                        when (item.type) {
                            "action" -> ActionFeedCard(
                                actionType = item.actionType ?: "other",
                                actionLabel = item.actionType?.let { ACTION_LABELS[it] ?: it } ?: "Действие",
                                note = item.note,
                                dateLabel = feedDateShort(item.date),
                                cropName = item.cropName,
                                thumbs = item.photos.map { ph ->
                                    FeedThumb(thumbUrl = ph.thumbUrl) {
                                        viewer = PhotoViewerTarget(
                                            photoId = ph.photoId, url = ph.url, actionId = item.actionId,
                                            plantingId = item.plantingId, dateIso = item.date,
                                            cropName = item.cropName, caption = item.note,
                                        )
                                    }
                                },
                            )
                            "photo" -> PhotoFeedRow(
                                thumbUrl = item.thumbUrl,
                                dateLabel = feedDateShort(item.date),
                                caption = item.caption,
                                cropName = item.cropName,
                                onOpen = {
                                    item.photoId?.let { pid ->
                                        viewer = PhotoViewerTarget(
                                            photoId = pid, url = item.url, actionId = null,
                                            plantingId = item.plantingId, dateIso = item.date,
                                            cropName = item.cropName, caption = item.caption,
                                        )
                                    }
                                }
                            )
                            else -> MilestoneFeedRow(
                                kind = item.kind ?: "",
                                cropName = item.cropName,
                                weightKg = item.weightKg,
                                dateLabel = feedDateShort(item.date),
                                onOpen = { item.plantingId?.let(onOpenPlanting) }
                            )
                        }
                    }
                }
                if (state.loadingMore) {
                    item(key = "more") {
                        Box(Modifier.fillMaxWidth().padding(12.dp), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(modifier = Modifier.size(22.dp), strokeWidth = 2.dp)
                        }
                    }
                }
            }
        }
    }

    viewer?.let { target ->
        FeedPhotoViewer(
            target = target,
            onDismiss = { viewer = null },
            onDeletePhoto = { onDeletePhoto(target.photoId); viewer = null },
            onReplace = { bytes ->
                target.plantingId?.let { onReplace(it, target.photoId, target.actionId, bytes) }; viewer = null
            },
            onDeleteRecord = { target.actionId?.let { onDeleteAction(it) }; viewer = null },
        )
    }
}

@Composable
private fun FeedPhotoViewer(
    target: PhotoViewerTarget,
    onDismiss: () -> Unit,
    onDeletePhoto: () -> Unit,
    onReplace: (ByteArray) -> Unit,
    onDeleteRecord: () -> Unit,
) {
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Box(Modifier.fillMaxSize().background(Color(0xE6000000))) {
            AsyncImage(
                model = mediaUrl(target.url.orEmpty()),
                contentDescription = "Фото посадки",
                contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxSize().padding(24.dp).align(Alignment.Center)
            )
            // Верхняя панель: действия слева, «Закрыть» справа (низ диалога перекрыт навигацией).
            Row(
                modifier = Modifier.align(Alignment.TopCenter).fillMaxWidth()
                    .background(Color(0x99000000)).statusBarsPadding().padding(horizontal = 4.dp, vertical = 2.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                PhotoActionsBar(
                    hasAction = target.actionId != null,
                    onReplaceBytes = onReplace,
                    onDeletePhoto = onDeletePhoto,
                    onDeleteRecord = onDeleteRecord,
                )
                IconButton(onClick = onDismiss) {
                    Icon(Icons.Default.Close, contentDescription = "Закрыть", tint = Color.White)
                }
            }
            Column(
                modifier = Modifier.align(Alignment.BottomCenter).fillMaxWidth()
                    .navigationBarsPadding().padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                // Культура — заметно (как на карточке записи), затем дата и текст заметки.
                target.cropName?.takeIf { it.isNotBlank() }?.let {
                    Text(it, color = Color.White, fontFamily = NunitoFamily, fontWeight = FontWeight.Black, fontSize = 18.sp)
                }
                Text(feedDateShort(target.dateIso), color = Color(0xCCFFFFFF), fontFamily = NunitoFamily,
                    fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                target.caption?.takeIf { it.isNotBlank() }?.let {
                    Text(it, color = Color(0xE6FFFFFF), fontFamily = NunitoFamily, fontSize = 14.sp)
                }
            }
        }
    }
}

private data class HubEntry(val icon: ImageVector, val title: String, val subtitle: String, val onClick: () -> Unit)

@Composable
private fun HubTab(entries: List<HubEntry>) {
    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        entries.forEach { e ->
            Card(
                modifier = Modifier.fillMaxWidth().clickable(onClick = e.onClick),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                Row(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(e.icon, contentDescription = null, modifier = Modifier.size(24.dp), tint = MaterialTheme.colorScheme.primary)
                    Spacer(Modifier.width(14.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(e.title, fontFamily = NunitoFamily, fontWeight = FontWeight.Black, fontSize = 16.sp,
                            color = MaterialTheme.colorScheme.onBackground)
                        Text(e.subtitle, fontFamily = NunitoFamily, fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}
