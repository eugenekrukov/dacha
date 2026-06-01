package ru.dachakalend.app.ui.today

import androidx.compose.animation.core.*
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.text.TextStyle
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
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
import ru.dachakalend.app.data.model.ActionLog
import ru.dachakalend.app.data.model.Planting
import ru.dachakalend.app.data.model.Recommendation
import ru.dachakalend.app.data.model.TodayTask
import ru.dachakalend.app.data.model.WeatherSummary
import androidx.compose.foundation.BorderStroke
import ru.dachakalend.app.ui.actions.ActionLogBottomSheet
import ru.dachakalend.app.ui.theme.HeroGradientEnd
import ru.dachakalend.app.ui.theme.HeroGradientStart
import ru.dachakalend.app.ui.theme.NunitoFamily
import ru.dachakalend.app.ui.theme.RussoOneFamily
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
    onEditGarden: () -> Unit = {},
    onOpenSettings: () -> Unit = {},
    onOpenJournal: () -> Unit = {},
    onAddPlanting: () -> Unit = {},
    viewModel: TodayViewModel = hiltViewModel()
) {
    val uiState       by viewModel.uiState.collectAsState()
    val dismissedRecs by viewModel.dismissedRecs.collectAsState()
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

    Scaffold(snackbarHost = { SnackbarHost(snackbarHostState) }) { _ ->
        when (val state = uiState) {
            is TodayUiState.Loading -> LoadingScreen()
            is TodayUiState.Error   -> ErrorScreen(state.message) { viewModel.loadToday() }
            is TodayUiState.Success -> TodayContent(
                weather       = state.data.today.weather,
                tasks         = state.data.today.tasks,
                recommendations = state.data.recommendations.filterNot {
                    "${it.type}:${it.cropName}:${it.message.take(30)}" in dismissedRecs
                },
                plantings     = state.data.plantings,
                todayActions  = state.data.todayActions,
                onRefresh     = { viewModel.loadToday() },
                onDismissRec  = { rec ->
                    viewModel.dismissRecommendation("${rec.type}:${rec.cropName}:${rec.message.take(30)}")
                },
                onEditGarden  = onEditGarden,
                onOpenSettings = onOpenSettings,
                onOpenJournal = onOpenJournal,
                onAddPlanting = onAddPlanting
            )
        }
    }
}

// ─── Main content ──────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TodayContent(
    weather: WeatherSummary?,
    tasks: List<TodayTask>,
    recommendations: List<Recommendation>,
    plantings: List<Planting>,
    todayActions: List<ActionLog> = emptyList(),
    onRefresh: () -> Unit,
    onDismissRec: (Recommendation) -> Unit = {},
    onEditGarden: () -> Unit = {},
    onOpenSettings: () -> Unit = {},
    onOpenJournal: () -> Unit = {},
    onAddPlanting: () -> Unit = {}
) {
    var quickActionType  by remember { mutableStateOf<String?>(null) }
    var quickActionNotes by remember { mutableStateOf<String?>(null) }  // для care_task_due
    var selectedPlanting by remember { mutableStateOf<Planting?>(null) }
    var showPlantingPicker by remember { mutableStateOf(false) }

    fun onQuickAction(type: String, notes: String? = null) {
        quickActionType  = type
        quickActionNotes = notes
        when {
            plantings.isEmpty() -> {}
            plantings.size == 1 -> selectedPlanting = plantings.first()
            else                -> showPlantingPicker = true
        }
    }

    if (showPlantingPicker) {
        PlantingPickerBottomSheet(
            plantings = plantings,
            onSelect  = { planting ->
                selectedPlanting = planting
                showPlantingPicker = false
            },
            onDismiss = {
                showPlantingPicker = false
                quickActionType = null
            }
        )
    }

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
            contentPadding      = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            modifier            = Modifier.weight(1f).fillMaxWidth()
        ) {
            // Задачи
            if (tasks.isNotEmpty()) {
                item {
                    SectionTitle(
                        icon  = Icons.Default.Spa,
                        title = "Задачи на сегодня"
                    )
                }
                items(tasks) { task ->
                    val taskPlanting = task.plantingId?.let { id -> plantings.find { it.id == id } }
                    SunnyTaskCard(
                        task    = task,
                        onClick = if (taskPlanting != null) {
                            {
                                // Напрямую — без onQuickAction, чтобы не открылся picker
                                selectedPlanting = taskPlanting
                                quickActionNotes = if (task.type == "care_task_due") task.title else null
                                quickActionType  = when (task.type) {
                                    "watering_due"    -> "watering"
                                    "fertilizing_due" -> "fertilizing"
                                    else              -> "other"
                                }
                            }
                        } else null
                    )
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
            // Если посадки есть, но задач нет — ничего не показываем (нормальный день)

            // Быстрые действия
            item { Spacer(Modifier.height(8.dp)) }
            item {
                SunnyQuickActions(
                    enabled  = plantings.isNotEmpty(),
                    onAction = { type -> onQuickAction(type) }
                )
            }

            // Рекомендации
            if (recommendations.isNotEmpty()) {
                item {
                    SectionTitle(
                        icon  = Icons.Default.Lightbulb,
                        title = "Советы дня",
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
                items(
                    recommendations,
                    key = { "${it.type}:${it.cropName}:${it.message.take(30)}" }
                ) { rec ->
                    val dismissState = rememberSwipeToDismissBoxState(
                        confirmValueChange = { value ->
                            if (value != SwipeToDismissBoxValue.Settled) {
                                onDismissRec(rec); true
                            } else false
                        }
                    )
                    SwipeToDismissBox(
                        state             = dismissState,
                        backgroundContent = {
                            Box(
                                modifier           = Modifier
                                    .fillMaxSize()
                                    .clip(RoundedCornerShape(20.dp))
                                    .background(MaterialTheme.colorScheme.errorContainer),
                                contentAlignment   = Alignment.CenterEnd
                            ) {
                                Icon(
                                    Icons.Default.Delete,
                                    contentDescription = "Удалить",
                                    tint               = MaterialTheme.colorScheme.onErrorContainer,
                                    modifier           = Modifier.padding(end = 24.dp)
                                )
                            }
                        }
                    ) {
                        SunnyRecommendationCard(rec)
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
                items(todayActions) { action -> TodayActionRow(action) }
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
                    fontSize      = 11.sp,
                    color         = Color.White.copy(alpha = .80f),
                    letterSpacing = 1.5.sp
                )
                Row {
                    IconButton(onClick = onEditGarden, modifier = Modifier.size(36.dp)) {
                        Icon(Icons.Default.Edit, null,
                            tint = Color.White.copy(alpha = .85f),
                            modifier = Modifier.size(18.dp))
                    }
                    IconButton(onClick = onOpenSettings, modifier = Modifier.size(36.dp)) {
                        Icon(Icons.Default.Settings, null,
                            tint = Color.White.copy(alpha = .85f),
                            modifier = Modifier.size(18.dp))
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
                    color      = Color.White
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
    val bg    = if (style == HeroChipStyle.Alert) Color.White.copy(alpha = .92f)
                else Color.White.copy(alpha = .2f)
    val color = if (style == HeroChipStyle.Alert) Color(0xFF0D47A1)
                else Color.White.copy(alpha = .9f)
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
                    fontSize   = 15.sp,
                    color      = MaterialTheme.colorScheme.onSurface,
                    maxLines   = 1,
                    overflow   = TextOverflow.Ellipsis
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

// ─── Quick actions ─────────────────────────────────────────────────────────

@Composable
private fun SunnyQuickActions(enabled: Boolean, onAction: (String) -> Unit) {
    Column {
        SectionTitle(
            icon  = Icons.Default.Bolt,
            title = "Быстрые действия"
        )
        Spacer(Modifier.height(10.dp))
        Row(
            modifier              = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            SunnyActionButton(
                modifier    = Modifier.weight(1f),
                label       = "Полил",
                icon        = Icons.Default.WaterDrop,
                gradient    = Brush.linearGradient(listOf(Color(0xFF42B3F5), Color(0xFF1565C0))),
                shadowColor = Color(0xFF1565C0),
                enabled     = enabled,
                onClick     = { onAction("watering") }
            )
            SunnyActionButton(
                modifier    = Modifier.weight(1f),
                label       = "Подкормил",
                icon        = Icons.Default.Spa,
                gradient    = Brush.linearGradient(listOf(Color(0xFFFFD54F), Color(0xFFE65100))),
                shadowColor = Color(0xFFE65100),
                enabled     = enabled,
                onClick     = { onAction("fertilizing") }
            )
            SunnyActionButton(
                modifier    = Modifier.weight(1f),
                label       = "Обработал",
                icon        = Icons.Default.HealthAndSafety,
                gradient    = Brush.linearGradient(listOf(Color(0xFFA5D6A7), Color(0xFF2E7D32))),
                shadowColor = Color(0xFF2E7D32),
                enabled     = enabled,
                onClick     = { onAction("treatment") }
            )
        }
        if (!enabled) {
            Spacer(Modifier.height(6.dp))
            Text(
                text       = "Добавьте посадку, чтобы фиксировать действия",
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.Bold,
                fontSize   = 12.sp,
                color      = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun SunnyActionButton(
    modifier: Modifier,
    label: String,
    icon: ImageVector,
    gradient: Brush,
    shadowColor: Color,
    enabled: Boolean,
    onClick: () -> Unit
) {
    val alpha = if (enabled) 1f else 0.45f
    Box(
        modifier = modifier
            .aspectRatio(1f)          // квадратные кнопки как на макете
            .shadow(
                elevation = if (enabled) 8.dp else 0.dp,
                shape     = RoundedCornerShape(20.dp),
                ambientColor = shadowColor.copy(alpha = .35f),
                spotColor    = shadowColor.copy(alpha = .35f)
            )
            .clip(RoundedCornerShape(20.dp))
            .background(if (enabled) gradient else Brush.linearGradient(listOf(Color.Gray, Color.Gray)))
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment   = Alignment.CenterHorizontally,
            verticalArrangement   = Arrangement.spacedBy(6.dp)
        ) {
            // Icon in frosted pill
            Box(
                modifier         = Modifier
                    .size(38.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color.White.copy(alpha = .22f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector        = icon,
                    contentDescription = label,
                    tint               = Color.White.copy(alpha = alpha),
                    modifier           = Modifier.size(22.dp)
                )
            }
            Text(
                text       = label,
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.Black,
                fontSize   = 12.sp,
                color      = Color.White.copy(alpha = alpha),
                softWrap   = false,
                maxLines   = 1,
                overflow   = TextOverflow.Ellipsis
            )
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

private val STAGE_LABELS = mapOf(
    "sowing" to "Посев", "sprouted" to "Всходы", "growing" to "Рост",
    "flowering" to "Цветение", "harvesting" to "Сбор урожая", "done" to "Завершено"
)

private val ACTION_TYPE_LABELS = mapOf(
    "watering"    to "Полив",
    "fertilizing" to "Подкормка",
    "treatment"   to "Обработка",
    "transplant"  to "Пересадка",
    "other"       to "Уход"
)

@Composable
private fun TodayActionRow(action: ActionLog) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column(modifier = Modifier.weight(1f)) {
            // Для "other" показываем notes (там хранится название задачи: Прополка, Рыхление и т.д.)
            val actionLabel = if (action.type == "other" && !action.notes.isNullOrBlank())
                action.notes
            else
                "${ACTION_TYPE_LABELS[action.type] ?: action.type}${action.cropName?.let { " — $it" } ?: ""}"
            Text(
                text       = actionLabel,
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.SemiBold,
                fontSize   = 14.sp,
                color      = MaterialTheme.colorScheme.onSurface,
                maxLines   = 1,
                overflow   = TextOverflow.Ellipsis
            )
            if (!action.notes.isNullOrBlank()) {
                Text(
                    text       = action.notes,
                    fontFamily = NunitoFamily,
                    fontSize   = 12.sp,
                    color      = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines   = 1,
                    overflow   = TextOverflow.Ellipsis
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PlantingPickerBottomSheet(
    plantings: List<Planting>,
    onSelect: (Planting) -> Unit,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(
                "Для какой культуры?",
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.Black,
                fontSize   = 18.sp,
                modifier   = Modifier.padding(bottom = 4.dp)
            )
            plantings.forEach { planting ->
                Surface(
                    modifier = Modifier.fillMaxWidth().clickable { onSelect(planting) },
                    shape    = RoundedCornerShape(16.dp),
                    color    = MaterialTheme.colorScheme.surfaceVariant
                ) {
                    Row(
                        modifier              = Modifier.padding(14.dp),
                        verticalAlignment     = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Text("🌱", fontSize = 20.sp)
                        Column {
                            Text(
                                planting.cropName ?: "Посадка #${planting.id}",
                                fontFamily = NunitoFamily,
                                fontWeight = FontWeight.ExtraBold,
                                fontSize   = 15.sp,
                                maxLines   = 1,
                                overflow   = TextOverflow.Ellipsis
                            )
                            Text(
                                STAGE_LABELS[planting.stage] ?: planting.stage,
                                fontFamily = NunitoFamily,
                                fontSize   = 12.sp,
                                color      = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
            Spacer(Modifier.height(8.dp))
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
    "watering_due"   -> Icons.Default.WaterDrop
    "harvest_due"    -> Icons.Default.Spa
    "care_task_due"  -> Icons.Default.Eco
    else             -> Icons.Default.Notifications
}


