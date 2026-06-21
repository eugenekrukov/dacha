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
import androidx.compose.material.icons.filled.HealthAndSafety
import androidx.compose.material.icons.filled.Insights
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
import ru.dachakalend.app.data.model.FeedItem
import ru.dachakalend.app.ui.actions.ACTION_TYPES
import ru.dachakalend.app.ui.feed.FeedMonthHeader
import ru.dachakalend.app.ui.feed.MilestoneFeedRow
import ru.dachakalend.app.ui.feed.PhotoFeedRow
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
    onOpenCrops: () -> Unit,
    onOpenGuide: () -> Unit,
    onOpenAnalytics: () -> Unit,
    onOpenPlanting: (Int) -> Unit,
    viewModel: FeedViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsState()
    var tab by remember { mutableIntStateOf(0) }
    val tabs = listOf("Лента", "Статистика", "Справочник")

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
                0 -> FeedList(state, onOpenPlanting, viewModel::loadMore)
                1 -> HubTab(
                    listOf(HubEntry(Icons.Default.Insights, "Статистика", "Серия дней, активность, экспорт в CSV", onOpenAnalytics))
                )
                2 -> HubTab(
                    listOf(
                        HubEntry(Icons.AutoMirrored.Filled.MenuBook, "Справочник культур", "Сроки, полив, болезни, соседство", onOpenCrops),
                        HubEntry(Icons.Default.HealthAndSafety, "Болезни и дефициты", "Дефициты микроэлементов, болезни, вредители", onOpenGuide),
                    )
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

@Composable
private fun FeedList(
    state: FeedUiState,
    onOpenPlanting: (Int) -> Unit,
    onLoadMore: () -> Unit,
) {
    var viewer by remember { mutableStateOf<FeedItem?>(null) }

    when {
        state.isLoading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
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
                    items(monthItems, key = { "${it.type}_${it.photoId ?: it.kind}_${it.plantingId}_${it.date}" }) { item ->
                        if (item.type == "photo") {
                            PhotoFeedRow(
                                thumbUrl = item.thumbUrl,
                                dateLabel = feedDateShort(item.date),
                                actionLabel = item.actionType?.let { ACTION_LABELS[it] ?: it },
                                caption = item.caption,
                                onOpen = { viewer = item }
                            )
                        } else {
                            MilestoneFeedRow(
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

    viewer?.let { item -> FeedPhotoViewer(item, onDismiss = { viewer = null }) }
}

@Composable
private fun FeedPhotoViewer(item: FeedItem, onDismiss: () -> Unit) {
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Box(Modifier.fillMaxSize().background(Color(0xE6000000))) {
            AsyncImage(
                model = mediaUrl(item.url.orEmpty()),
                contentDescription = "Фото посадки",
                contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxSize().padding(24.dp).align(Alignment.Center)
            )
            IconButton(onClick = onDismiss, modifier = Modifier.align(Alignment.TopEnd).padding(8.dp)) {
                Icon(Icons.Default.Close, contentDescription = "Закрыть", tint = Color.White)
            }
            Column(modifier = Modifier.align(Alignment.BottomStart).padding(16.dp)) {
                Text(feedDateShort(item.date), color = Color.White, fontFamily = NunitoFamily, fontWeight = FontWeight.Bold)
                item.cropName?.let { Text(it, color = Color(0xCCFFFFFF), fontFamily = NunitoFamily, fontSize = 13.sp) }
                item.caption?.let { Text(it, color = Color(0xB3FFFFFF), fontFamily = NunitoFamily, fontSize = 13.sp) }
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
