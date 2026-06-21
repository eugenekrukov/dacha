package ru.dachakalend.app.ui.today

import androidx.compose.animation.core.*
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.text.TextStyle
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.items as lazyRowItems
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.GenericShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import ru.dachakalend.app.data.model.ActionLog
import ru.dachakalend.app.data.model.ForecastDay
import ru.dachakalend.app.data.model.Planting
import ru.dachakalend.app.data.model.Recommendation
import ru.dachakalend.app.data.model.TodayTask
import ru.dachakalend.app.data.model.WeatherSummary
import androidx.compose.foundation.BorderStroke
import ru.dachakalend.app.ui.actions.ActionLogBottomSheet
import ru.dachakalend.app.ui.actions.careTaskActionType
import ru.dachakalend.app.ui.actions.treatmentNote
import ru.dachakalend.app.ui.onboarding.CoachMarkController
import ru.dachakalend.app.ui.onboarding.coachMarkSteps
import ru.dachakalend.app.ui.onboarding.coachTarget
import ru.dachakalend.app.ui.onboarding.coachTargetUnion
import ru.dachakalend.app.ui.theme.HeroGradientEnd
import ru.dachakalend.app.ui.theme.HeroGradientStart
import ru.dachakalend.app.ui.theme.NunitoFamily
import ru.dachakalend.app.ui.theme.taskColor

// ─── Форма диагонального среза hero (polygon-clip) ────────────────────────
private val DiagonalBottomShape = GenericShape { size, _ ->
    moveTo(0f, 0f)
    lineTo(size.width, 0f)
    lineTo(size.width, size.height * 0.88f)
    lineTo(0f, size.height)
    close()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TodayScreen(
    showOnboardingHint: Boolean = false,
    coachMarkController: CoachMarkController? = null,
    showCoachMark: Boolean = false,
    onEditGarden: () -> Unit = {},
    onOpenSettings: () -> Unit = {},
    onOpenJournal: () -> Unit = {},
    onAddPlanting: () -> Unit = {},
    viewModel: TodayViewModel = hiltViewModel()
) {
    val uiState       by viewModel.uiState.collectAsState()
    val dismissedRecs by viewModel.dismissedRecs.collectAsState()
    val deletedRecs   by viewModel.deletedRecs.collectAsState()
    val snoozedTasks  by viewModel.snoozedTasks.collectAsState()
    val deletedTasks  by viewModel.deletedTasks.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(showOnboardingHint) {
        if (showOnboardingHint) {
            val result = snackbarHostState.showSnackbar(
                message     = "Участок создан! Добавьте первую культуру",
                actionLabel = "К культурам",
                duration    = SnackbarDuration.Long
            )
            if (result == SnackbarResult.ActionPerformed) onAddPlanting()
        }
    }

    LaunchedEffect(Unit) {
        if (showCoachMark && coachMarkController != null) {
            kotlinx.coroutines.delay(800)
            coachMarkController.showOnce()
        }
    }

    // Перечитываем при возврате на экран — чтобы действия, записанные на «Посадках»,
    // сразу появлялись в «Сделано сегодня» (без перезапуска приложения).
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) viewModel.loadToday(silent = true)
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    Scaffold(snackbarHost = { SnackbarHost(snackbarHostState) }) { _ ->
        when (val state = uiState) {
            is TodayUiState.Loading -> LoadingScreen()
            is TodayUiState.Error   -> ErrorScreen(state.message) { viewModel.loadToday() }
            is TodayUiState.Success -> {
                val hiddenRecKeys = dismissedRecs + deletedRecs
                val queueSize by viewModel.queueSize.collectAsState()
                TodayContent(
                    offline       = state.data.offline,
                    cachedAt      = state.data.cachedAt,
                    queueSize     = queueSize,
                    weather       = state.data.today.weather,
                    forecast      = state.data.today.forecast,
                    tasks         = state.data.today.tasks.filterNot { task ->
                        val key = taskSnoozeKey(task)
                        key in snoozedTasks || key in deletedTasks
                    },
                    recommendations = state.data.recommendations.filterNot {
                        recKey(it) in hiddenRecKeys
                    },
                    plantings     = state.data.plantings,
                    todayActions  = state.data.todayActions,
                    onDeleteAction  = { action -> viewModel.deleteAction(action.id, action.clientId) },
                    onSnoozeRec     = { rec -> viewModel.snoozeRec(recKey(rec)) },
                    onDeleteRec     = { rec -> viewModel.deleteRec(recKey(rec)) },
                    onSnoozeTask    = { task -> viewModel.snoozeTask(taskSnoozeKey(task)) },
                    onDeleteTask    = { task -> viewModel.deleteTask(taskSnoozeKey(task)) },
                    coachMarkController = coachMarkController,
                    onRefresh     = { viewModel.loadToday() },
                    onEditGarden  = onEditGarden,
                    onOpenSettings = onOpenSettings,
                    onOpenJournal = onOpenJournal,
                    onAddPlanting = onAddPlanting
                )
            }
        }
    }
}

// ─── Main content ──────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TodayContent(
    weather: WeatherSummary?,
    forecast: List<ForecastDay> = emptyList(),
    tasks: List<TodayTask>,
    recommendations: List<Recommendation>,
    plantings: List<Planting>,
    todayActions: List<ActionLog> = emptyList(),
    offline: Boolean = false,
    cachedAt: Long? = null,
    queueSize: Int = 0,
    onDeleteAction: (ActionLog) -> Unit = {},
    onSnoozeRec: (Recommendation) -> Unit = {},
    onDeleteRec: (Recommendation) -> Unit = {},
    onSnoozeTask: (TodayTask) -> Unit = {},
    onDeleteTask: (TodayTask) -> Unit = {},
    coachMarkController: CoachMarkController? = null,
    onRefresh: () -> Unit,
    onEditGarden: () -> Unit = {},
    onOpenSettings: () -> Unit = {},
    onOpenJournal: () -> Unit = {},
    onAddPlanting: () -> Unit = {}
) {
    // Запись действия из карточки задачи дня (тип/заметка преднастроены по задаче)
    var quickActionType  by remember { mutableStateOf<String?>(null) }
    var quickActionNotes by remember { mutableStateOf<String?>(null) }  // для care_task_due
    var selectedPlanting by remember { mutableStateOf<Planting?>(null) }
    // Групповая care-задача → мульти-посадочное действие (без адресной посадки).
    var multiTask by remember { mutableStateOf<TodayTask?>(null) }
    var recsExpanded by remember { mutableStateOf(false) }  // «Советы дня»: первые 3 + «показать ещё»

    if (selectedPlanting != null && quickActionType != null) {
        ActionLogBottomSheet(
            planting        = selectedPlanting!!,
            preselectedType = quickActionType,
            initialNotes    = quickActionNotes,
            onDismiss       = {
                selectedPlanting = null
                quickActionType  = null
                quickActionNotes = null
                onRefresh()
            }
        )
    }

    multiTask?.let { task ->
        ru.dachakalend.app.ui.actions.MultiActionLogBottomSheet(
            title           = task.careTaskName ?: task.title,
            targets         = task.cropNamesWithIds ?: emptyList(),
            preselectedType = careTaskActionType(task.careTaskName),
            initialNotes    = treatmentNote(task.careTaskName, task.product),
            onDismiss       = {
                multiTask = null
                onRefresh()
            }
        )
    }

    val lazyListState = androidx.compose.foundation.lazy.rememberLazyListState()

    val currentTasks  = tasks.filter { (it.daysUntil ?: 0) == 0 }
    val upcomingTasks = tasks.filter { (it.daysUntil ?: 0) > 0 }

    // Compute stable LazyColumn indices for coach mark scroll targets
    val weatherVisible = weather != null || forecast.isNotEmpty()
    val recsVisible    = recommendations.isNotEmpty()
    val coachScrollIdx = remember(weatherVisible, currentTasks.size, upcomingTasks.size, recsVisible) {
        var i = 0
        buildMap {
            if (weatherVisible) { put("weather", i); i++ }
            if (currentTasks.isNotEmpty()) {
                put("tasks", i)
                i += 1 + currentTasks.size
            } else if (plantings.isEmpty()) i++   // empty card
            if (upcomingTasks.isNotEmpty()) i += 1 + upcomingTasks.size
            if (recsVisible) { put("recs", i) }
        }
    }

    // Scroll LazyColumn to the current coach step target
    val coachKey = if (coachMarkController?.isVisible == true) coachMarkController.currentKey else null
    LaunchedEffect(coachKey) {
        val key = coachKey ?: return@LaunchedEffect
        val idx = coachScrollIdx[key] ?: return@LaunchedEffect
        coachMarkController?.resetBounds(key)
        lazyListState.scrollToItem(idx)
    }

    // ── Экран: Hero вне LazyColumn, чтобы clip не срезался скроллом ──
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        // ── Hero ──
        SunnyHero(
            weather       = weather,
            onEditGarden  = onEditGarden,
            onOpenSettings = onOpenSettings
        )

        // ── Остальное — скролируемый список ──
        LazyColumn(
            state               = lazyListState,
            contentPadding      = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            modifier            = Modifier.weight(1f).fillMaxWidth()
        ) {
            // F1: баннер офлайна / очереди неотправленных действий
            if (offline || queueSize > 0) {
                item { OfflineBanner(offline = offline, cachedAt = cachedAt, queueSize = queueSize) }
            }

            // Погодные детали + 7-дневный прогноз
            if (weather != null || forecast.isNotEmpty()) {
                item {
                    WeatherDetailsCard(
                        weather  = weather,
                        forecast = forecast,
                        modifier = Modifier.coachTarget(coachMarkController, "weather"),
                    )
                }
            }

            // Задачи на сегодня
            if (currentTasks.isNotEmpty()) {
                item {
                    SectionTitle(
                        icon     = Icons.Default.Spa,
                        title    = "Задачи на сегодня",
                        modifier = Modifier.coachTargetUnion(coachMarkController, "tasks"),
                    )
                }
                items(currentTasks, key = { taskSnoozeKey(it) }) { task ->
                    val taskPlanting = task.plantingId?.let { id -> plantings.find { it.id == id } }
                    // Групповая care-задача: адресной посадки нет, но есть список посадок для мульти-действия.
                    val isGrouped = task.plantingId == null && !task.cropNamesWithIds.isNullOrEmpty()
                    Box(Modifier.coachTargetUnion(coachMarkController, "tasks")) {
                        SwipeActionsBox(
                            itemLabel = task.cropName ?: task.type,
                            onSnooze  = { onSnoozeTask(task) },
                            onDelete  = { onDeleteTask(task) }
                        ) {
                            SunnyTaskCard(
                                task    = task,
                                onClick = when {
                                    taskPlanting != null -> {
                                        {
                                            selectedPlanting = taskPlanting
                                            quickActionNotes = when (task.type) {
                                                "fertilizing_due" -> task.careTaskName?.let { "Подкормка - $it" }
                                                "care_task_due"   -> treatmentNote(task.careTaskName, task.product)
                                                else              -> null
                                            }
                                            quickActionType  = when (task.type) {
                                                "watering_due"    -> "watering"
                                                "fertilizing_due" -> "fertilizing"
                                                "transplant_due"  -> "transplanting"
                                                "care_task_due"   -> careTaskActionType(task.careTaskName)
                                                else              -> "other"
                                            }
                                        }
                                    }
                                    isGrouped -> {
                                        { multiTask = task }
                                    }
                                    else -> null
                                }
                            )
                        }
                    }
                }
            } else if (plantings.isEmpty()) {
                // Нет посадок — показываем промпт добавить
                item {
                    EmptyTasksCard(
                        hasPlantings  = false,
                        onAddPlanting = onAddPlanting
                    )
                }
            }
            // Если посадки есть, но текущих задач нет — ничего не показываем (нормальный день)

            // Скоро (care-задачи через 1–3 дня, только просмотр)
            if (upcomingTasks.isNotEmpty()) {
                item {
                    SectionTitle(
                        icon     = Icons.Default.CalendarMonth,
                        title    = "Скоро",
                        modifier = Modifier.padding(top = if (currentTasks.isNotEmpty()) 8.dp else 0.dp)
                    )
                }
                items(upcomingTasks, key = { taskSnoozeKey(it) }) { task ->
                    SwipeActionsBox(
                        itemLabel = task.cropName ?: task.type,
                        onSnooze  = { onSnoozeTask(task) },
                        onDelete  = { onDeleteTask(task) }
                    ) {
                        SunnyTaskCard(task = task, onClick = null)
                    }
                }
            }

            // Рекомендации
            if (recommendations.isNotEmpty()) {
                item {
                    SectionTitle(
                        icon     = Icons.Default.Lightbulb,
                        title    = "Советы дня",
                        modifier = Modifier
                            .padding(top = 8.dp)
                            .coachTargetUnion(coachMarkController, "recs"),
                    )
                }
                val visibleRecs = if (recsExpanded) recommendations else recommendations.take(3)
                items(
                    visibleRecs,
                    key = { recKey(it) }
                ) { rec ->
                    Box(Modifier.coachTargetUnion(coachMarkController, "recs")) {
                        SwipeActionsBox(
                            itemLabel    = rec.cropName ?: REC_TYPE_LABELS[rec.type] ?: rec.type,
                            onSnooze     = { onSnoozeRec(rec) },
                            onDelete     = { onDeleteRec(rec) }
                        ) {
                            SunnyRecommendationCard(rec)
                        }
                    }
                }
                if (recommendations.size > 3) {
                    item {
                        TextButton(
                            onClick = { recsExpanded = !recsExpanded },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = if (recsExpanded) "Свернуть"
                                       else "Показать ещё (${recommendations.size - 3})",
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                }
            }

            // Журнал сегодня
            if (todayActions.isNotEmpty()) {
                item {
                    Row(
                        modifier              = Modifier.fillMaxWidth().padding(top = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment     = Alignment.CenterVertically
                    ) {
                        // Inline заголовок — без weight(1f) внутри, чтобы не давить на кнопку
                        Row(
                            verticalAlignment     = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(
                                Icons.Default.History,
                                contentDescription = null,
                                tint     = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(16.dp)
                            )
                            Text(
                                "Сделано сегодня",
                                fontFamily = NunitoFamily,
                                fontWeight = FontWeight.Black,
                                fontSize      = 14.sp,
                                color         = MaterialTheme.colorScheme.onBackground,
                                letterSpacing = 0.3.sp
                            )
                        }
                        TextButton(onClick = onOpenJournal) {
                            Text(
                                "Весь журнал →",
                                style = MaterialTheme.typography.labelLarge,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                }
                items(todayActions) { action -> TodayActionRow(action, onDeleteAction) }
            } else {
                item {
                    TextButton(onClick = onOpenJournal) {
                        Text(
                            "Журнал действий →",
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }
        }
    }
}

// ─── F1: баннер офлайна / очереди ─────────────────────────────────────────

@Composable
private fun OfflineBanner(offline: Boolean, cachedAt: Long?, queueSize: Int) {
    val text = when {
        offline && cachedAt != null -> {
            val time = java.text.SimpleDateFormat("HH:mm", java.util.Locale.getDefault())
                .format(java.util.Date(cachedAt))
            if (queueSize > 0) "Нет связи · данные от $time · $queueSize в очереди"
            else "Нет связи · данные от $time"
        }
        offline -> "Нет связи · показаны сохранённые данные"
        else    -> "$queueSize ${plural(queueSize, "действие", "действия", "действий")} ${plural(queueSize, "ждёт", "ждут", "ждут")} отправки"
    }
    Surface(
        color = MaterialTheme.colorScheme.secondaryContainer,
        shape = MaterialTheme.shapes.medium,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(12.dp)) {
            Icon(Icons.Default.CloudOff, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text(text, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

private fun plural(n: Int, one: String, few: String, many: String): String {
    val mod10 = n % 10; val mod100 = n % 100
    return when {
        mod10 == 1 && mod100 != 11 -> one
        mod10 in 2..4 && mod100 !in 12..14 -> few
        else -> many
    }
}

// ─── Hero с диагональным срезом ───────────────────────────────────────────

@Composable
private fun SunnyHero(
    weather: WeatherSummary?,
    onEditGarden: () -> Unit,
    onOpenSettings: () -> Unit
) {
    // Анимация подсолнуха — покачивание
    val infiniteTransition = rememberInfiniteTransition(label = "sunflower")
    val sunflowerRotation by infiniteTransition.animateFloat(
        initialValue   = -5f,
        targetValue    = 5f,
        animationSpec  = infiniteRepeatable(
            animation = tween(3000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "rotation"
    )
    val sunflowerScale by infiniteTransition.animateFloat(
        initialValue   = 1f,
        targetValue    = 1.06f,
        animationSpec  = infiniteRepeatable(
            animation = tween(4000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "scale"
    )

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .wrapContentHeight()
            .clip(DiagonalBottomShape)
            .background(
                Brush.linearGradient(
                    colors = listOf(HeroGradientStart, HeroGradientEnd)
                )
            )
    ) {
        // Polka-dot texture overlay — matchParentSize чтобы не растягивать родителя
        Box(
            modifier = Modifier
                .matchParentSize()
                .background(
                    Brush.radialGradient(
                        colors  = listOf(Color.White.copy(alpha = .1f), Color.Transparent),
                        radius  = 600f
                    )
                )
        )

        // Реальная дата в формате "ПОНЕДЕЛЬНИК · 2 ИЮНЯ"
        val today = remember { java.time.LocalDate.now() }
        val locale = java.util.Locale("ru")
        val dateText = remember {
            val day = today.dayOfWeek
                .getDisplayName(java.time.format.TextStyle.FULL, locale)
                .uppercase(locale)
            val d = today.dayOfMonth
            val month = today.month
                .getDisplayName(java.time.format.TextStyle.FULL_STANDALONE, locale)
                .uppercase(locale)
            "$day · $d $month"
        }

        Column(modifier = Modifier.padding(start = 22.dp, end = 22.dp, top = 16.dp, bottom = 24.dp)) {
            // Status-bar row: дата + иконки
            Row(
                modifier              = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment     = Alignment.CenterVertically
            ) {
                Text(
                    text          = dateText,
                    fontFamily    = NunitoFamily,
                    fontWeight    = FontWeight.ExtraBold,
                    // a11y: крупнее + полностью белый + тень для читаемости на оранжевом (аудитория 50+)
                    fontSize      = 13.sp,
                    color         = Color.White,
                    letterSpacing = 1.5.sp,
                    style         = TextStyle(
                        shadow = Shadow(
                            color      = Color(0x55000000),
                            offset     = Offset(0f, 1f),
                            blurRadius = 6f
                        )
                    )
                )
                Row {
                    IconButton(onClick = onEditGarden, modifier = Modifier.size(44.dp)) {
                        Icon(Icons.Default.Edit, "Изменить участок",
                            tint = Color.White,
                            modifier = Modifier.size(20.dp))
                    }
                    IconButton(onClick = onOpenSettings, modifier = Modifier.size(44.dp)) {
                        Icon(Icons.Default.Settings, "Настройки",
                            tint = Color.White,
                            modifier = Modifier.size(20.dp))
                    }
                }
            }

            Spacer(Modifier.height(6.dp))

            // Title + sunflower
            Box(modifier = Modifier.fillMaxWidth()) {
                Column {
                    Text(
                        text       = "Сегодня\nна даче",
                        fontFamily = NunitoFamily,
                        fontWeight = FontWeight.Black,
                        fontSize   = 44.sp,
                        lineHeight = 46.sp,
                        color      = Color.White,
                        letterSpacing = (-0.5).sp,
                        style      = TextStyle(
                            shadow = Shadow(
                                color      = Color(0x50960000),
                                offset     = Offset(0f, 3f),
                                blurRadius = 14f
                            )
                        )
                    )
                }
                // Animated sunflower — top-right
                Text(
                    text     = "🌻",
                    fontSize = 80.sp,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .offset(x = 12.dp, y = (-8).dp)
                        .graphicsLayer {
                            rotationZ    = sunflowerRotation
                            scaleX       = sunflowerScale
                            scaleY       = sunflowerScale
                            transformOrigin = androidx.compose.ui.graphics.TransformOrigin(.5f, .9f)
                        }
                )
            }

            Spacer(Modifier.height(14.dp))

            // Weather row
            Row(
                verticalAlignment     = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Temperature
                Text(
                    text       = if (weather?.tempMin != null && weather.tempMax != null)
                        "${weather.tempMin.toInt()}° / ${weather.tempMax.toInt()}°"
                    else if (weather?.tempC != null) "${weather.tempC.toInt()}°"
                    else "—",
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.Black,
                    fontSize   = 26.sp,
                    color      = Color.White,
                    // a11y: тень для читаемости белого на оранжевом (как у заголовка/даты)
                    style      = TextStyle(
                        shadow = Shadow(
                            color      = Color(0x55000000),
                            offset     = Offset(0f, 1f),
                            blurRadius = 6f
                        )
                    )
                )

                // Humidity chip
                weather?.humidity?.let {
                    HeroChip(text = "💧 $it%", style = HeroChipStyle.Subtle)
                }

                // Frost alert
                if (weather?.frostRisk == true) {
                    HeroChip(text = "❄ Заморозки", style = HeroChipStyle.Alert)
                }
            }
        }
    }
}

private enum class HeroChipStyle { Subtle, Alert }

@Composable
private fun HeroChip(text: String, style: HeroChipStyle) {
    // Subtle: тёмная полупрозрачная подложка (а не светлая) — иначе белый текст на светлом
    // оранжевом hero даёт контраст ниже AA. Тёмный фон поднимает контраст до читаемого.
    val bg    = if (style == HeroChipStyle.Alert) Color.White.copy(alpha = .92f)
                else Color.Black.copy(alpha = .22f)
    val color = if (style == HeroChipStyle.Alert) Color(0xFF0D47A1)
                else Color.White
    val border = if (style == HeroChipStyle.Subtle) Color.White.copy(alpha = .35f)
                 else Color.Transparent

    Surface(
        color  = bg,
        shape  = CircleShape,
        border = if (style == HeroChipStyle.Subtle) BorderStroke(1.dp, border) else null
    ) {
        Text(
            text       = text,
            style      = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.ExtraBold,
            color      = color,
            softWrap   = false,
            modifier   = Modifier.padding(horizontal = 12.dp, vertical = 5.dp)
        )
    }
}

// ─── Section title ─────────────────────────────────────────────────────────

@Composable
private fun SectionTitle(
    icon: ImageVector,
    title: String,
    modifier: Modifier = Modifier
) {
    Row(
        modifier          = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Icon(
            imageVector        = icon,
            contentDescription = null,
            tint               = MaterialTheme.colorScheme.primary,
            modifier           = Modifier.size(16.dp)
        )
        Text(
            text       = title,
            fontFamily = NunitoFamily,
            fontWeight = FontWeight.Black,
            fontSize   = 14.sp,
            color      = MaterialTheme.colorScheme.onBackground,
            letterSpacing = 0.3.sp
        )
        // Gradient line
        Box(
            modifier = Modifier
                .weight(1f)
                .height(2.dp)
                .clip(RoundedCornerShape(1.dp))
                .background(
                    Brush.horizontalGradient(
                        colors = listOf(
                            MaterialTheme.colorScheme.primary.copy(alpha = .3f),
                            Color.Transparent
                        )
                    )
                )
        )
    }
}

// ─── Weather details + 7-day forecast ─────────────────────────────────────

@Composable
private fun WeatherDetailsCard(
    weather: WeatherSummary?,
    forecast: List<ForecastDay>,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier  = modifier.fillMaxWidth(),
        shape     = RoundedCornerShape(22.dp),
        colors    = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {

            // Строка с доп. метеоданными
            if (weather != null) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally)
                ) {
                    weather.precipProbPct?.let {
                        WeatherChip(
                            icon  = "🌧",
                            label = "Дождь $it%",
                            tint  = if (it >= 70) Color(0xFF1565C0) else Color(0xFF666666)
                        )
                    }
                    weather.soilTempC?.let {
                        WeatherChip(
                            icon  = "🌱",
                            label = "Почва ${it.toInt()}°",
                            tint  = if (it >= 10.0) Color(0xFF2E7D32) else Color(0xFFBF360C)
                        )
                    }
                }

                // Предупреждение о холодной почве
                if ((weather.soilTempC ?: 99.0) < 10.0) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color(0xFFFFF3E0))
                            .padding(10.dp)
                    ) {
                        Text("⚠️", fontSize = 14.sp)
                        Text(
                            "Почва холодная — посев не рекомендуется",
                            fontFamily = NunitoFamily,
                            fontWeight = FontWeight.SemiBold,
                            fontSize   = 12.sp,
                            color      = Color(0xFFBF360C)
                        )
                    }
                }

                // Предупреждение об ожидаемом дожде
                if ((weather.precipProbPct ?: 0) >= 70) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color(0xFFE3F2FD))
                            .padding(10.dp)
                    ) {
                        Text("🌧", fontSize = 14.sp)
                        Text(
                            "Ожидается дождь — задачи полива скрыты",
                            fontFamily = NunitoFamily,
                            fontWeight = FontWeight.SemiBold,
                            fontSize   = 12.sp,
                            color      = Color(0xFF1565C0)
                        )
                    }
                }
            }

            // 7-дневный прогноз — свёрнут по умолчанию (редко нужен ежедневно), тап разворачивает
            if (forecast.isNotEmpty()) {
                var forecastExpanded by rememberSaveable { mutableStateOf(false) }
                HorizontalDivider(color = Color(0xFFEEEEEE))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .clickable { forecastExpanded = !forecastExpanded }
                        .padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        "Прогноз на 7 дней",
                        fontFamily = NunitoFamily,
                        fontWeight = FontWeight.Black,
                        fontSize   = 13.sp,
                        color      = Color(0xFF888888)
                    )
                    Icon(
                        if (forecastExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                        contentDescription = if (forecastExpanded) "Свернуть прогноз" else "Показать прогноз",
                        tint = Color(0xFF888888)
                    )
                }
                if (forecastExpanded) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        forecast.forEach { day -> ForecastDayChip(day) }
                    }
                }
            }
        }
    }
}

@Composable
private fun WeatherChip(icon: String, label: String, tint: Color) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        modifier = Modifier
            .clip(RoundedCornerShape(100.dp))
            .background(Color(0xFFF5F5F5))
            .padding(horizontal = 10.dp, vertical = 5.dp)
    ) {
        Text(icon, fontSize = 13.sp)
        Text(label, fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = tint)
    }
}

@Composable
private fun ForecastDayChip(day: ForecastDay) {
    val conditionIcon = when (day.condition) {
        "rain"   -> "🌧"
        "snow"   -> "❄️"
        "storm"  -> "⛈"
        "cloudy" -> "☁️"
        else     -> "☀️"
    }
    val dayLabel = try {
        val date = java.time.LocalDate.parse(day.date)
        val ruDow = when (date.dayOfWeek) {
            java.time.DayOfWeek.MONDAY    -> "Пн"
            java.time.DayOfWeek.TUESDAY   -> "Вт"
            java.time.DayOfWeek.WEDNESDAY -> "Ср"
            java.time.DayOfWeek.THURSDAY  -> "Чт"
            java.time.DayOfWeek.FRIDAY    -> "Пт"
            java.time.DayOfWeek.SATURDAY  -> "Сб"
            java.time.DayOfWeek.SUNDAY    -> "Вс"
            else -> ""
        }
        "$ruDow ${date.dayOfMonth}"
    } catch (_: Exception) { day.date.takeLast(5) }

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
        modifier = Modifier
            .clip(RoundedCornerShape(16.dp))
            .background(Color(0xFFF5F5F5))
            .padding(horizontal = 10.dp, vertical = 8.dp)
            .width(54.dp)
    ) {
        Text(dayLabel, fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, fontSize = 11.sp, color = Color(0xFF888888), maxLines = 1)
        Text(conditionIcon, fontSize = 18.sp)
        Text("${day.maxTempC?.toInt() ?: "—"}°", fontFamily = NunitoFamily, fontWeight = FontWeight.Black, fontSize = 14.sp, color = Color(0xFF333333))
        Text("${day.minTempC?.toInt() ?: "—"}°", fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold, fontSize = 11.sp, color = Color(0xFF888888))
        day.precipProbPct?.let { prob ->
            if (prob > 0) Text("$prob%", fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold, fontSize = 10.sp, color = Color(0xFF1565C0))
        }
    }
}

// ─── Swipe actions wrapper ─────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SwipeActionsBox(
    itemLabel: String,
    onSnooze: () -> Unit,
    onDelete: () -> Unit,
    content: @Composable () -> Unit
) {
    var pendingSnooze by remember { mutableStateOf(false) }
    var pendingDelete by remember { mutableStateOf(false) }

    val dismissState = rememberSwipeToDismissBoxState(
        confirmValueChange = { value ->
            when (value) {
                SwipeToDismissBoxValue.StartToEnd -> { pendingSnooze = true; false }
                SwipeToDismissBoxValue.EndToStart -> { pendingDelete = true; false }
                else -> false
            }
        }
    )

    if (pendingSnooze) {
        AlertDialog(
            onDismissRequest = { pendingSnooze = false },
            title = { Text("Напомнить завтра?", fontFamily = NunitoFamily, fontWeight = FontWeight.Black) },
            text  = { Text("«$itemLabel» снова появится в списке завтра.", fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold) },
            confirmButton = {
                TextButton(onClick = { pendingSnooze = false; onSnooze() }) {
                    Text("Отложить", fontFamily = NunitoFamily, fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.primary)
                }
            },
            dismissButton = {
                TextButton(onClick = { pendingSnooze = false }) {
                    Text("Отмена", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold)
                }
            }
        )
    }

    if (pendingDelete) {
        AlertDialog(
            onDismissRequest = { pendingDelete = false },
            title = { Text("Удалить навсегда?", fontFamily = NunitoFamily, fontWeight = FontWeight.Black) },
            text  = { Text("«$itemLabel» больше не будет показываться.", fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold) },
            confirmButton = {
                TextButton(onClick = { pendingDelete = false; onDelete() }) {
                    Text("Удалить", fontFamily = NunitoFamily, fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { pendingDelete = false }) {
                    Text("Отмена", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold)
                }
            }
        )
    }

    SwipeToDismissBox(
        state                    = dismissState,
        enableDismissFromStartToEnd = true,
        enableDismissFromEndToStart = true,
        backgroundContent = {
            val isSnooze = dismissState.targetValue == SwipeToDismissBoxValue.StartToEnd
            val bgColor  = if (isSnooze) MaterialTheme.colorScheme.primary
                           else MaterialTheme.colorScheme.errorContainer
            val icon     = if (isSnooze) Icons.Default.Notifications else Icons.Default.Delete
            val tint     = if (isSnooze) MaterialTheme.colorScheme.onPrimary
                           else MaterialTheme.colorScheme.onErrorContainer
            val align    = if (isSnooze) Alignment.CenterStart else Alignment.CenterEnd
            val label    = if (isSnooze) "Отложить" else "Удалить"
            Box(
                modifier         = Modifier
                    .fillMaxSize()
                    .clip(RoundedCornerShape(20.dp))
                    .background(bgColor),
                contentAlignment = align
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.padding(horizontal = 20.dp)
                ) {
                    Icon(icon, contentDescription = label, tint = tint)
                    Text(label, fontFamily = NunitoFamily, fontWeight = FontWeight.Bold,
                        fontSize = 11.sp, color = tint)
                }
            }
        }
    ) {
        content()
    }
}

// ─── Task card ─────────────────────────────────────────────────────────────

@Composable
private fun SunnyTaskCard(task: TodayTask, onClick: (() -> Unit)? = null) {
    val color = taskColor(task.type)

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier),
        shape  = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
    ) {
        Row(
            modifier          = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Colored icon box
            Box(
                modifier         = Modifier
                    .size(52.dp)
                    .clip(RoundedCornerShape(18.dp))
                    .background(color.copy(alpha = .22f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector        = taskIcon(task.type),
                    contentDescription = null,
                    tint               = color,
                    modifier           = Modifier.size(26.dp)
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text       = task.title,
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize   = 14.sp,
                    color      = MaterialTheme.colorScheme.onSurface,
                    maxLines   = 2,
                    overflow   = TextOverflow.Ellipsis,
                    lineHeight = 18.sp
                )
                Text(
                    text       = task.description,
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.Bold,
                    fontSize   = 12.sp,
                    color      = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines   = 1,
                    overflow   = TextOverflow.Ellipsis
                )
            }
            // Overdue badge
            if ((task.daysOverdue ?: 0) > 0) {
                Surface(
                    color  = MaterialTheme.colorScheme.error,
                    shape  = CircleShape
                ) {
                    Text(
                        text       = "+${task.daysOverdue}д",
                        fontFamily = NunitoFamily,
                        fontWeight = FontWeight.Black,
                        fontSize   = 11.sp,
                        color      = Color.White,
                        modifier   = Modifier.padding(horizontal = 9.dp, vertical = 3.dp),
                        softWrap   = false
                    )
                }
            }
            if (onClick != null) {
                Icon(
                    Icons.Default.ChevronRight,
                    contentDescription = null,
                    tint               = MaterialTheme.colorScheme.outline,
                    modifier           = Modifier.size(18.dp)
                )
            }
        }
    }
}

// ─── Recommendation card ───────────────────────────────────────────────────

@Composable
private fun SunnyRecommendationCard(rec: Recommendation) {
    data class Style(val bg: Color, val border: Color, val icon: ImageVector, val tint: Color)

    val style = when (rec.type) {
        "frost_alert"                -> Style(Color(0xFFE3F2FD), Color(0xFF1565C0).copy(.18f), Icons.Default.AcUnit,          Color(0xFF1565C0))
        "watering"                   -> Style(Color(0xFFE3F2FD), Color(0xFF1E88E5).copy(.18f), Icons.Default.WaterDrop,       Color(0xFF1E88E5))
        "harvest_ready","harvest_soon"->Style(Color(0xFFF1F8E9), Color(0xFF33691E).copy(.18f), Icons.Default.Spa,             Color(0xFF33691E))
        "fertilizing"                -> Style(Color(0xFFFFF8E1), Color(0xFFE65100).copy(.18f), Icons.Default.Eco,             Color(0xFFE65100))
        "heat_stress"                -> Style(Color(0xFFFFF3E0), Color(0xFFBF360C).copy(.18f), Icons.Default.WbSunny,         Color(0xFFBF360C))
        "lifehack"                   -> Style(Color(0xFFFFF9C4), Color(0xFFF57F17).copy(.18f), Icons.Default.Lightbulb,       Color(0xFFF57F17))
        "lunar_tip"                  -> Style(Color(0xFFEDE7F6), Color(0xFF4527A0).copy(.18f), Icons.Default.NightlightRound, Color(0xFF4527A0))
        "weather_tip"                -> Style(Color(0xFFE8F5E9), Color(0xFF388E3C).copy(.18f), Icons.Default.Cloud,           Color(0xFF388E3C))
        "seasonal_tip","sowing_season","sowing_soon"
                                     -> Style(Color(0xFFE8F5E9), Color(0xFF2E7D32).copy(.18f), Icons.Default.CalendarMonth,   Color(0xFF2E7D32))
        "stage_tip"                  -> Style(Color(0xFFFFF8E1), Color(0xFF558B2F).copy(.18f), Icons.Default.Grass,           Color(0xFF558B2F))
        "transplant_tip"             -> Style(Color(0xFFF3E5F5), Color(0xFF6A1B9A).copy(.18f), Icons.Default.Spa,             Color(0xFF6A1B9A))
        else                         -> Style(Color(0xFFFFF8EB), Color(0xFFFF7B00).copy(.15f), Icons.Default.Lightbulb,       Color(0xFFFF7B00))
    }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape    = RoundedCornerShape(20.dp),
        color    = style.bg,
        border   = BorderStroke(1.5.dp, style.border)
    ) {
        Row(
            modifier          = Modifier.padding(14.dp),
            verticalAlignment = Alignment.Top,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box(
                modifier         = Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(style.tint.copy(alpha = .25f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(style.icon, null, tint = style.tint, modifier = Modifier.size(24.dp))
            }
            Column(
                modifier              = Modifier.weight(1f),
                verticalArrangement   = Arrangement.spacedBy(4.dp)
            ) {
                rec.cropName?.let {
                    Text(
                        text       = it,
                        fontFamily = NunitoFamily,
                        fontWeight = FontWeight.Black,
                        fontSize   = 13.sp,
                        color      = style.tint,
                        maxLines   = 1,
                        overflow   = TextOverflow.Ellipsis
                    )
                }
                Text(
                    text       = rec.message,
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.Bold,
                    fontSize   = 13.sp,
                    color      = MaterialTheme.colorScheme.onBackground,
                    lineHeight = 18.sp
                )
            }
        }
    }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

private val REC_TYPE_LABELS = mapOf(
    "frost_alert"    to "Заморозки",
    "watering"       to "Полив",
    "harvest_ready"  to "Урожай готов",
    "harvest_soon"   to "Скоро урожай",
    "fertilizing"    to "Подкормка",
    "heat_stress"    to "Жара",
    "lifehack"       to "Лайфхак",
    "lunar_tip"      to "Лунный совет",
    "weather_tip"    to "Погодный совет",
    "seasonal_tip"   to "Сезонный совет",
    "sowing_season"  to "Время посева",
    "sowing_soon"    to "Скоро посев",
    "stage_tip"      to "Совет по стадии",
    "transplant_tip" to "Пересадка"
)

private val STAGE_LABELS = mapOf(
    "sowing"       to "Посеяно",
    "transplanted" to "Высажено в грунт",
    "growing"      to "Растёт",
    "flowering"    to "Цветёт",
    "harvesting"   to "Созревает",
    "done"         to "Завершено"
)

private val ACTION_TYPE_LABELS = mapOf(
    "watering"      to "Полив",
    "fertilizing"   to "Подкормка",
    "treatment"     to "Обработка",
    "transplanting" to "Высадка",
    "tying"         to "Подвязка",
    "pinching"      to "Пасынкование",
    "hilling"       to "Окучивание",
    "pruning"       to "Обрезка",
    "weeding"       to "Прополка",
    "loosening"     to "Рыхление",
    "other"         to "Другое"
)

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun TodayActionRow(action: ActionLog, onDelete: (ActionLog) -> Unit) {
    var showConfirm by remember { mutableStateOf(false) }

    if (showConfirm) {
        val label = ACTION_TYPE_LABELS[action.type] ?: action.type
        val crop  = action.cropName?.let { " — $it" } ?: ""
        AlertDialog(
            onDismissRequest = { showConfirm = false },
            title = {
                Text("Удалить запись?", fontFamily = NunitoFamily, fontWeight = FontWeight.Black)
            },
            text = {
                Text(
                    "«$label$crop» будет удалено без возможности восстановления.",
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.SemiBold
                )
            },
            confirmButton = {
                TextButton(onClick = { showConfirm = false; onDelete(action) }) {
                    Text("Удалить", color = MaterialTheme.colorScheme.error,
                        fontFamily = NunitoFamily, fontWeight = FontWeight.Black)
                }
            },
            dismissButton = {
                TextButton(onClick = { showConfirm = false }) {
                    Text("Отмена", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold)
                }
            }
        )
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .combinedClickable(onClick = {}, onLongClick = { showConfirm = true })
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column(modifier = Modifier.weight(1f)) {
            val actionLabel = "${ACTION_TYPE_LABELS[action.type] ?: action.type}${action.cropName?.let { " — $it" } ?: ""}"
            Text(
                text       = actionLabel,
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.SemiBold,
                fontSize   = 14.sp,
                color      = MaterialTheme.colorScheme.onSurface,
                maxLines   = 1,
                overflow   = TextOverflow.Ellipsis
            )
            val userNote = action.notes?.takeIf { it.isNotBlank() && !action.auto }
            if (userNote != null) {
                Text(
                    text       = userNote,
                    fontFamily = NunitoFamily,
                    fontSize   = 12.sp,
                    color      = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines   = 1,
                    overflow   = TextOverflow.Ellipsis
                )
            }
            if (action.pending) {
                Text(
                    "↑ ждёт отправки",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.outline,
                )
            }
        }
    }
    HorizontalDivider(thickness = 0.5.dp, color = MaterialTheme.colorScheme.outlineVariant)
}

@Composable
private fun EmptyTasksCard(hasPlantings: Boolean, onAddPlanting: () -> Unit) {
    Card(
        modifier  = Modifier.fillMaxWidth(),
        shape     = RoundedCornerShape(22.dp),
        colors    = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier            = Modifier.padding(28.dp).fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text("🌱", fontSize = 36.sp)
            if (hasPlantings) {
                Text(
                    "Всё в порядке! Задач нет",
                    fontFamily  = NunitoFamily,
                    fontWeight  = FontWeight.Bold,
                    fontSize    = 15.sp,
                    color       = MaterialTheme.colorScheme.onSurface.copy(alpha = .6f)
                )
            } else {
                Text(
                    "Нет посадок",
                    fontFamily  = NunitoFamily,
                    fontWeight  = FontWeight.Black,
                    fontSize    = 16.sp,
                    color       = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    "Добавьте первую культуру — получайте задачи и советы каждый день",
                    fontFamily  = NunitoFamily,
                    fontSize    = 13.sp,
                    color       = MaterialTheme.colorScheme.onSurface.copy(alpha = .6f),
                    textAlign   = TextAlign.Center,
                    lineHeight  = 18.sp
                )
                Spacer(Modifier.height(4.dp))
                Button(
                    onClick = onAddPlanting,
                    shape   = RoundedCornerShape(16.dp),
                    modifier = Modifier.height(48.dp)
                ) {
                    Text("Добавить посадку", fontFamily = NunitoFamily, fontWeight = FontWeight.Black, softWrap = false)
                }
            }
        }
    }
}

@Composable
private fun LoadingScreen() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
    }
}

@Composable
private fun ErrorScreen(message: String, onRetry: () -> Unit) {
    Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(message, color = MaterialTheme.colorScheme.error)
            Button(onClick = onRetry, shape = RoundedCornerShape(16.dp)) {
                Text("Повторить", fontFamily = NunitoFamily, fontWeight = FontWeight.Black, softWrap = false)
            }
        }
    }
}

private fun taskIcon(type: String): ImageVector = when (type) {
    "frost_alert"    -> Icons.Default.AcUnit
    "transplant_due" -> Icons.Default.Grass
    "watering_due"    -> Icons.Default.WaterDrop
    "fertilizing_due" -> Icons.Default.Eco
    "harvest_due"     -> Icons.Default.Spa
    "care_task_due"   -> Icons.Default.Eco
    else              -> Icons.Default.Notifications
}


