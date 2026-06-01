package ru.dachakalend.app.ui.today

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.clickable
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items as lazyRowItems
import androidx.hilt.navigation.compose.hiltViewModel
import ru.dachakalend.app.data.model.ActionLog
import ru.dachakalend.app.data.model.Planting
import ru.dachakalend.app.data.model.Recommendation
import ru.dachakalend.app.data.model.TodayTask
import ru.dachakalend.app.data.model.WeatherSummary
import ru.dachakalend.app.ui.actions.ActionLogBottomSheet
import ru.dachakalend.app.ui.theme.taskColor

@Composable
fun TodayScreen(
    showOnboardingHint: Boolean = false,
    onEditGarden: () -> Unit = {},
    onOpenSettings: () -> Unit = {},
    onOpenJournal: () -> Unit = {},
    onAddPlanting: () -> Unit = {},
    viewModel: TodayViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    // Показать подсказку онбординга один раз
    LaunchedEffect(showOnboardingHint) {
        if (showOnboardingHint) {
            val result = snackbarHostState.showSnackbar(
                message = "Участок создан! Добавьте первую культуру",
                actionLabel = "К культурам",
                duration = SnackbarDuration.Long
            )
            if (result == SnackbarResult.ActionPerformed) {
                onAddPlanting()
            }
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { _ ->
        when (val state = uiState) {
            is TodayUiState.Loading -> LoadingScreen()
            is TodayUiState.Error   -> ErrorScreen(state.message) { viewModel.loadToday() }
            is TodayUiState.Success -> TodayContent(
                weather = state.data.today.weather,
                tasks = state.data.today.tasks,
                recommendations = state.data.recommendations,
                plantings = state.data.plantings,
                todayActions = state.data.todayActions,
                onRefresh = { viewModel.loadToday() },
                onEditGarden = onEditGarden,
                onOpenSettings = onOpenSettings,
                onOpenJournal = onOpenJournal,
                onAddPlanting = onAddPlanting
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TodayContent(
    weather: WeatherSummary?,
    tasks: List<TodayTask>,
    recommendations: List<Recommendation>,
    plantings: List<Planting>,
    todayActions: List<ActionLog> = emptyList(),
    onRefresh: () -> Unit,
    onEditGarden: () -> Unit = {},
    onOpenSettings: () -> Unit = {},
    onOpenJournal: () -> Unit = {},
    onAddPlanting: () -> Unit = {}
) {
    // Состояния для быстрых действий и клика по задаче
    var quickActionType by remember { mutableStateOf<String?>(null) }
    var selectedPlanting by remember { mutableStateOf<Planting?>(null) }
    var showPlantingPicker by remember { mutableStateOf(false) }

    // Запрос быстрого действия: тип задаётся, посадку выбираем или сразу открываем шит
    fun onQuickAction(type: String) {
        quickActionType = type
        when {
            plantings.isEmpty() -> { /* ничего — кнопка задизейблена */ }
            plantings.size == 1 -> selectedPlanting = plantings.first()
            else                -> showPlantingPicker = true
        }
    }

    // Шит выбора посадки (если > 1)
    if (showPlantingPicker) {
        PlantingPickerBottomSheet(
            plantings = plantings,
            onSelect = { planting ->
                selectedPlanting = planting
                showPlantingPicker = false
            },
            onDismiss = {
                showPlantingPicker = false
                quickActionType = null
            }
        )
    }

    // Шит записи действия
    if (selectedPlanting != null && quickActionType != null) {
        ActionLogBottomSheet(
            planting = selectedPlanting!!,
            preselectedType = quickActionType,
            onDismiss = {
                selectedPlanting = null
                quickActionType = null
                onRefresh()   // ← Фикс 1: обновить задачи и рекомендации
            }
        )
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Сегодня",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(bottom = 4.dp)
                )
                Row {
                    IconButton(onClick = onEditGarden) {
                        Icon(
                            imageVector = Icons.Default.Edit,
                            contentDescription = "Редактировать участок",
                            tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                        )
                    }
                    IconButton(onClick = onOpenSettings) {
                        Icon(
                            imageVector = Icons.Default.Settings,
                            contentDescription = "Настройки",
                            tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                        )
                    }
                }
            }
        }

        // Погодная карточка
        item {
            WeatherCard(weather)
        }

        // Заголовок задач
        if (tasks.isNotEmpty()) {
            item {
                Text(
                    text = "Задачи на сегодня",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
            items(tasks) { task ->
                // Фикс 3: клик по задаче открывает ActionLog для нужной посадки
                val taskPlanting = task.plantingId?.let { id -> plantings.find { it.id == id } }
                TaskCard(
                    task = task,
                    onClick = if (taskPlanting != null) {
                        {
                            selectedPlanting = taskPlanting
                            quickActionType = when (task.type) {
                                "watering_due"     -> "watering"
                                "fertilizing_due"  -> "fertilizing"
                                "transplant_due",
                                "care_task_due"    -> "other"
                                else               -> null
                            }
                        }
                    } else null
                )
            }
        } else {
            item {
                EmptyTasksCard(
                    hasPlantings = plantings.isNotEmpty(),
                    onAddPlanting = onAddPlanting
                )
            }
        }

        // Рекомендации
        if (recommendations.isNotEmpty()) {
            item {
                Text(
                    text = "Рекомендации",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
            items(recommendations) { rec ->
                RecommendationCard(rec)
            }
        }

        // Быстрые действия
        item {
            QuickActionsRow(
                enabled = plantings.isNotEmpty(),
                onAction = { type -> onQuickAction(type) }
            )
        }

        // Сводный журнал сегодняшних действий
        if (todayActions.isNotEmpty()) {
            item {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Сделано сегодня",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                    TextButton(onClick = onOpenJournal) { Text("Весь журнал") }
                }
            }
            items(todayActions) { action ->
                TodayActionRow(action)
            }
        } else {
            item {
                TextButton(onClick = onOpenJournal) { Text("Журнал действий →") }
            }
        }
    }
}

@Composable
private fun WeatherCard(weather: WeatherSummary?) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        )
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            if (weather != null) {
                Column {
                    Text(
                        text = if (weather.tempMin != null && weather.tempMax != null)
                            "${weather.tempMin.toInt()}° / ${weather.tempMax.toInt()}°"
                        else if (weather.tempC != null) "${weather.tempC.toInt()}°"
                        else "—",
                        style = MaterialTheme.typography.headlineLarge,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                    Text(
                        text = weather.conditionText ?: weather.condition ?: "—",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                    weather.humidity?.let {
                        Text(
                            text = "Влажность $it%",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                        )
                    }
                }
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    if (weather.frostRisk == true) {
                        Surface(
                            color = MaterialTheme.colorScheme.error,
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text(
                                text = "⚠ Заморозки",
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp
                            )
                        }
                    }
                    if (weather.heatRisk == true) {
                        Surface(
                            color = Color(0xFFE65100),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text(
                                text = "🌡 Жара",
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp
                            )
                        }
                    }
                }
            } else {
                Text(
                    text = "Погода недоступна",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }
        }
    }
}

@Composable
private fun TaskCard(task: TodayTask, onClick: (() -> Unit)? = null) {
    val color = taskColor(task.type)
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(color.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = taskIcon(task.type),
                    contentDescription = null,
                    tint = color,
                    modifier = Modifier.size(24.dp)
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = task.title,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = task.description,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                )
            }
            if ((task.daysOverdue ?: 0) > 0) {
                Text(
                    text = "+${task.daysOverdue}д",
                    color = MaterialTheme.colorScheme.error,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold
                )
            }
            if (onClick != null) {
                Icon(
                    imageVector = Icons.Default.ChevronRight,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f),
                    modifier = Modifier.size(18.dp)
                )
            }
        }
    }
}

@Composable
private fun QuickActionsRow(
    enabled: Boolean,
    onAction: (type: String) -> Unit
) {
    // type → (icon, label, tint)
    val actions = listOf(
        Triple("watering",    Pair(Icons.Default.WaterDrop, "Полил"),    MaterialTheme.colorScheme.primary),
        Triple("fertilizing", Pair(Icons.Default.Spa,       "Подкормил"), Color(0xFF8D6E63)),
        Triple("treatment",   Pair(Icons.Default.BugReport, "Обработал"), Color(0xFFE53935))
    )

    Text(
        text = "Быстрые действия",
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier.padding(top = 4.dp, bottom = 8.dp)
    )
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        actions.forEach { (type, iconLabel, tint) ->
            val (icon, label) = iconLabel
            OutlinedButton(
                onClick = { onAction(type) },
                enabled = enabled,
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 10.dp)
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(icon, contentDescription = label, tint = if (enabled) tint else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f), modifier = Modifier.size(20.dp))
                    Spacer(Modifier.height(2.dp))
                    Text(label, fontSize = 12.sp)
                }
            }
        }
    }
    if (!enabled) {
        Text(
            text = "Добавьте посадку, чтобы фиксировать действия",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
            modifier = Modifier.padding(top = 4.dp)
        )
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
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                text = "Для какой культуры?",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 8.dp)
            )
            plantings.forEach { planting ->
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onSelect(planting) },
                    shape = RoundedCornerShape(10.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Text("🌱", fontSize = 20.sp)
                        Column {
                            Text(
                                text = planting.cropName ?: "Посадка #${planting.id}",
                                style = MaterialTheme.typography.bodyLarge,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                text = STAGE_LABELS[planting.stage] ?: planting.stage,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
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
private fun RecommendationCard(rec: Recommendation) {
    data class RecStyle(val bg: Color, val icon: ImageVector, val tint: Color)

    val style = when (rec.type) {
        "frost_alert"  -> RecStyle(Color(0xFFE3F2FD), Icons.Default.AcUnit,      Color(0xFF1565C0))
        "watering"     -> RecStyle(Color(0xFFE1F5FE), Icons.Default.WaterDrop,   Color(0xFF0277BD))
        "harvest_ready",
        "harvest_soon" -> RecStyle(Color(0xFFF1F8E9), Icons.Default.Spa,         Color(0xFF2E7D32))
        "fertilizing"  -> RecStyle(Color(0xFFF3E5F5), Icons.Default.Eco,         Color(0xFF6A1B9A))
        "heat_stress"  -> RecStyle(Color(0xFFFFF3E0), Icons.Default.WbSunny,     Color(0xFFE65100))
        "weather_tip"  -> RecStyle(Color(0xFFE8F5E9), Icons.Default.Cloud,       Color(0xFF388E3C))
        "lunar_tip"    -> RecStyle(Color(0xFFEDE7F6), Icons.Default.NightlightRound, Color(0xFF4527A0))
        "seasonal_tip" -> RecStyle(Color(0xFFE8F5E9), Icons.Default.CalendarMonth,  Color(0xFF2E7D32))
        "stage_tip"    -> RecStyle(Color(0xFFFFF8E1), Icons.Default.Grass,       Color(0xFF558B2F))
        "lifehack"     -> RecStyle(Color(0xFFFFF8E1), Icons.Default.Lightbulb,   Color(0xFFF57F17))
        else           -> RecStyle(Color(0xFFFAFAFA), Icons.Default.Info,        Color(0xFF757575))
    }

    val priorityColor = when (rec.priority) {
        "critical" -> MaterialTheme.colorScheme.error
        "high"     -> Color(0xFFE65100)
        "medium"   -> Color(0xFFF9A825)
        else       -> MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f)
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = style.bg),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.Top,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Icon(
                imageVector = style.icon,
                contentDescription = null,
                tint = style.tint,
                modifier = Modifier.size(26.dp).padding(top = 2.dp)
            )
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                rec.cropName?.let {
                    Text(
                        text = it,
                        style = MaterialTheme.typography.labelMedium,
                        color = priorityColor,
                        fontWeight = FontWeight.SemiBold
                    )
                }
                Text(
                    text = rec.message,
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }
    }
}

private val STAGE_LABELS = mapOf(
    "sowing"     to "Посев",
    "sprouted"   to "Всходы",
    "growing"    to "Рост",
    "flowering"  to "Цветение",
    "harvesting" to "Сбор урожая",
    "done"       to "Завершено"
)

private val ACTION_TYPE_LABELS = mapOf(
    "watering"    to "💧 Полив",
    "fertilizing" to "🌿 Подкормка",
    "treatment"   to "🧴 Обработка",
    "transplant"  to "🌱 Пересадка",
    "other"       to "📝 Другое"
)

@Composable
private fun TodayActionRow(action: ActionLog) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "${ACTION_TYPE_LABELS[action.type] ?: action.type}${action.cropName?.let { " — $it" } ?: ""}",
                style = MaterialTheme.typography.bodyMedium
            )
            if (!action.notes.isNullOrBlank()) {
                Text(
                    text = action.notes,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
    HorizontalDivider(modifier = Modifier.padding(vertical = 2.dp), thickness = 0.5.dp)
}

@Composable
private fun EmptyTasksCard(
    hasPlantings: Boolean = true,
    onAddPlanting: () -> Unit = {}
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(
            modifier = Modifier.padding(24.dp).fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            if (hasPlantings) {
                Text("🌱", fontSize = 32.sp)
                Spacer(Modifier.height(8.dp))
                Text(
                    "Всё в порядке! Задач нет",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                )
            } else {
                Text("🌱", fontSize = 32.sp)
                Spacer(Modifier.height(8.dp))
                Text(
                    "У вас пока нет посадок",
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    "Добавьте первую культуру, чтобы получать задачи и рекомендации",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                )
                Spacer(Modifier.height(16.dp))
                Button(onClick = onAddPlanting) {
                    Text("Добавить посадку")
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
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(message, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.error)
            Spacer(Modifier.height(16.dp))
            Button(onClick = onRetry) { Text("Повторить") }
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
