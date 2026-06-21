package ru.dachakalend.app.ui.plantings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Spa
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.dachakalend.app.data.local.TokenStorage
import ru.dachakalend.app.data.model.Planting
import ru.dachakalend.app.ui.actions.ActionLogBottomSheet
import ru.dachakalend.app.ui.actions.careTaskActionType
import ru.dachakalend.app.ui.actions.treatmentNote
import ru.dachakalend.app.ui.theme.NunitoFamily
import java.time.LocalDate
import java.time.format.DateTimeFormatter

val STAGE_LABELS = mapOf(
    "sowing"      to "Посеяно",
    "transplanted" to "Высажено в грунт",
    "growing"     to "Растёт",
    "flowering"   to "Цветёт",
    "harvesting"  to "Созревает",
    "done"        to "Завершено"
)

val STAGE_ORDER = listOf("sowing", "transplanted", "growing", "flowering", "harvesting", "done")

private fun formatIsoDate(iso: String): String = try {
    val date = java.time.OffsetDateTime.parse(iso)
    "%02d.%02d.%02d".format(date.dayOfMonth, date.monthValue, date.year % 100)
} catch (_: Exception) {
    try {
        val date = LocalDate.parse(iso.take(10))
        "%02d.%02d.%02d".format(date.dayOfMonth, date.monthValue, date.year % 100)
    } catch (_: Exception) { iso }
}

// ─── Screen ──────────────────────────────────────────────────────────────────

@Composable
fun PlantingsScreen(
    onAddCrop: () -> Unit,
    onCropDetail: (Int) -> Unit = {},
    onOpenCropDetail: (Int) -> Unit = onCropDetail,
    onOpenHarvest: () -> Unit = {},
    onOpenPlantingInfo: (Int) -> Unit = {},
    viewModel: PlantingsViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) viewModel.loadPlantings(silent = true)
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    LaunchedEffect(state.successMessage) {
        state.successMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearMessage()
        }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        // Внешний Scaffold (MainActivity) уже отступает под нав-бар; не добавляем инсет повторно,
        // иначе снизу появляется пустой отступ.
        contentWindowInsets = WindowInsets(0),
        floatingActionButton = {
            FloatingActionButton(
                onClick = onAddCrop,
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = Color.White
            ) {
                Icon(Icons.Default.Add, contentDescription = "Добавить посадку")
            }
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { padding ->
        when {
            state.isLoading -> Box(
                Modifier.fillMaxSize().padding(padding),
                contentAlignment = Alignment.Center
            ) { CircularProgressIndicator(color = MaterialTheme.colorScheme.primary) }

            state.plantings.isEmpty() -> Box(
                Modifier
                    .fillMaxSize()
                    .background(MaterialTheme.colorScheme.background)
                    .padding(padding),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        "Посадок пока нет",
                        fontFamily = NunitoFamily,
                        fontWeight = FontWeight.Black,
                        fontSize = 18.sp,
                        color = MaterialTheme.colorScheme.onBackground
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "Нажмите + чтобы добавить первую культуру",
                        fontFamily = NunitoFamily,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            else -> LazyColumn(
                modifier = Modifier
                    .background(MaterialTheme.colorScheme.background)
                    .padding(padding),
                contentPadding = PaddingValues(bottom = 16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                item {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(MaterialTheme.colorScheme.background)
                            .padding(horizontal = 16.dp, vertical = 16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            "Посадки",
                            fontFamily = NunitoFamily,
                            fontWeight = FontWeight.Black,
                            fontSize = 28.sp,
                            color = MaterialTheme.colorScheme.onBackground
                        )
                        TextButton(onClick = onOpenHarvest) {
                            Icon(
                                Icons.Default.Spa,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(Modifier.width(4.dp))
                            Text(
                                "Урожай",
                                fontFamily = NunitoFamily,
                                fontWeight = FontWeight.Black,
                                softWrap = false
                            )
                        }
                    }
                }
                item {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        item {
                            FilterChip(
                                selected = state.stageFilter == null,
                                onClick = { viewModel.setStageFilter(null) },
                                shape = RoundedCornerShape(100.dp),
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = MaterialTheme.colorScheme.primary,
                                    selectedLabelColor = Color.White
                                ),
                                label = {
                                    Text(
                                        "Все",
                                        fontFamily = NunitoFamily,
                                        fontWeight = FontWeight.Bold,
                                        softWrap = false
                                    )
                                }
                            )
                        }
                        items(STAGE_ORDER.dropLast(1)) { stage ->
                            FilterChip(
                                selected = state.stageFilter == stage,
                                onClick = {
                                    viewModel.setStageFilter(if (state.stageFilter == stage) null else stage)
                                },
                                shape = RoundedCornerShape(100.dp),
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = MaterialTheme.colorScheme.primary,
                                    selectedLabelColor = Color.White
                                ),
                                label = {
                                    Text(
                                        STAGE_LABELS[stage] ?: stage,
                                        fontFamily = NunitoFamily,
                                        fontWeight = FontWeight.Bold,
                                        softWrap = false
                                    )
                                }
                            )
                        }
                        // Архив завершённых сезонов — отдельный чип, только если есть что показывать
                        if (state.hasArchived) {
                            item {
                                FilterChip(
                                    selected = state.stageFilter == "done",
                                    onClick = {
                                        viewModel.setStageFilter(if (state.stageFilter == "done") null else "done")
                                    },
                                    shape = RoundedCornerShape(100.dp),
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = MaterialTheme.colorScheme.primary,
                                        selectedLabelColor = Color.White
                                    ),
                                    label = {
                                        Text(
                                            "Завершённые",
                                            fontFamily = NunitoFamily,
                                            fontWeight = FontWeight.Bold,
                                            softWrap = false
                                        )
                                    }
                                )
                            }
                        }
                    }
                }
                if (state.datesNeedCheck) {
                    item(key = "dates_check_banner") {
                        DateCheckBanner(onDismiss = { viewModel.dismissDatesNeedCheck() })
                    }
                }
                items(state.filteredPlantings, key = { it.id }) { planting ->
                    PlantingCard(
                        planting         = planting,
                        pendingAction    = state.pendingTasks[planting.id],
                        snoozedTaskKeys  = state.snoozedTaskKeys,
                        onLogAction      = { viewModel.openActionSheet(planting) },
                        onEditInfo       = { viewModel.openEditSheet(planting) },
                        onDelete         = { viewModel.requestDelete(planting) },
                        onFinishSeason = { viewModel.requestFinishSeason(planting) },
                        onInfo         = { onOpenPlantingInfo(planting.id) }
                    )
                }
            }
        }
    }

    // Шторка журнала действий
    state.showActionSheet?.let { planting ->
        // Преселект типа действия (как на «Сегодня»): если у посадки есть просроченный
        // уход или pending-задача — сразу подставляем нужный тип и заметку, чтобы
        // пользователь записал именно то действие, что закрывает задачу.
        val pending = state.pendingTasks[planting.id]
        val overdue = planting.overdueCareTask
        val preselectedType = when {
            overdue != null                    -> careTaskActionType(overdue.name)
            pending?.type == "watering_due"    -> "watering"
            pending?.type == "fertilizing_due" -> "fertilizing"
            pending?.type == "transplant_due"  -> "transplanting"
            pending?.type == "care_task_due"   -> careTaskActionType(pending.careTaskName)
            else                               -> null
        }
        // Заметка: название действия не пишем. Для подкормки — пример удобрения,
        // для «Обработки» — «от чего». Прочее — пусто.
        val preselectedNotes = when {
            overdue != null                    -> overdue.product ?: treatmentNote(overdue.name)
            pending?.type == "fertilizing_due" -> pending.careTaskName
            pending?.type == "care_task_due"   -> treatmentNote(pending.careTaskName)
            else                               -> null
        }
        ActionLogBottomSheet(
            planting = planting,
            preselectedType = preselectedType,
            initialNotes = preselectedNotes,
            onActionLogged = { type -> viewModel.onActionLogged(planting.id, type) },
            onDismiss = { viewModel.closeActionSheet() }
        )
    }

    // Шторка настройки новой посадки
    state.pendingCropId?.let { cropId ->
        PlantingSetupBottomSheet(
            defaultSeedling = state.pendingCropTransplantDays != null,
            onConfirm = { date, qty, cond, method, variety -> viewModel.confirmPlanting(cropId, date, qty, cond, method, variety) },
            onDismiss = { viewModel.dismissSetupSheet() }
        )
    }

    // Диалог подтверждения удаления
    state.confirmDeletePlanting?.let { planting ->
        AlertDialog(
            onDismissRequest = { viewModel.dismissDelete() },
            title = {
                Text(
                    "Удалить посадку?",
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.Black
                )
            },
            text = {
                Text(
                    "«${planting.cropName ?: "Посадка"}» будет удалена без возможности восстановления.",
                    fontFamily = NunitoFamily
                )
            },
            confirmButton = {
                TextButton(onClick = { viewModel.confirmDelete(planting.id) }) {
                    Text("Удалить", color = MaterialTheme.colorScheme.error, fontFamily = NunitoFamily, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.dismissDelete() }) {
                    Text("Отмена", fontFamily = NunitoFamily)
                }
            }
        )
    }

    // Диалог подтверждения завершения сезона
    state.confirmFinishSeason?.let { planting ->
        AlertDialog(
            onDismissRequest = { viewModel.dismissFinishSeason() },
            title = {
                Text(
                    "Завершить сезон?",
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.Black
                )
            },
            text = {
                Text(
                    "«${planting.cropName ?: "Посадка"}» будет переведена в архив. Данные сохранятся.",
                    fontFamily = NunitoFamily
                )
            },
            confirmButton = {
                TextButton(onClick = { viewModel.confirmFinishSeason(planting.id) }) {
                    Text("Завершить", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.dismissFinishSeason() }) {
                    Text("Отмена", fontFamily = NunitoFamily)
                }
            }
        )
    }

    // Шторка редактирования существующей посадки
    state.editingPlanting?.let { planting ->
        PlantingEditBottomSheet(
            planting = planting,
            onConfirm = { date, qty, cond, method, variety -> viewModel.saveEditedInfo(planting.id, date, qty, cond, method, variety) },
            onDismiss = { viewModel.dismissEditSheet() }
        )
    }
}

// ─── Баннер «проверьте даты посадки» (после онбординга) ──────────────────────

@Composable
private fun DateCheckBanner(onDismiss: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                "⚠️ Проверьте даты посадки",
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.Black,
                fontSize = 16.sp,
                color = MaterialTheme.colorScheme.onPrimaryContainer
            )
            Spacer(Modifier.height(4.dp))
            Text(
                "Для культур из онбординга мы поставили сегодняшнюю дату. " +
                    "Откройте посадку (⋮ → «Изменить») и укажите, когда вы посадили — " +
                    "так прогноз и напоминания будут точнее.",
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.SemiBold,
                fontSize = 13.sp,
                color = MaterialTheme.colorScheme.onPrimaryContainer
            )
            Spacer(Modifier.height(8.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                TextButton(onClick = onDismiss) {
                    Text(
                        "Понятно",
                        fontFamily = NunitoFamily,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
            }
        }
    }
}

// ─── Карточка посадки ────────────────────────────────────────────────────────

private val PENDING_ACTION_LABELS = mapOf(
    "watering_due"    to "Требуется полив",
    "fertilizing_due" to "Требуется подкормка",
    "transplant_due"  to "Требуется пересадка",
    "harvest_due"     to "Пора собирать урожай",
    "care_task_due"   to "Требует ухода",
    "frost_alert"     to "Угроза заморозков"
)

@Composable
private fun PlantingCard(
    planting: Planting,
    pendingAction: TokenStorage.PendingTaskInfo? = null,
    snoozedTaskKeys: Set<String> = emptySet(),
    onLogAction: () -> Unit,
    onEditInfo: () -> Unit,
    onDelete: () -> Unit,
    onFinishSeason: () -> Unit,
    onInfo: () -> Unit
) {
    var menuExpanded by remember { mutableStateOf(false) }

    // Просрочка ухода (care) приходит с сервера и не зависит от обрезанного/сгруппированного
    // кэша «Сегодня» — поэтому показывается на «Посадках» всегда. Ключ снуза совпадает с «Сегодня».
    val overdueCare = planting.overdueCareTask
    val careSnoozed = overdueCare != null && run {
        val key = "care_task_due:${planting.id}:${planting.cropName}:${overdueCare.name}"
        key in snoozedTaskKeys
    }
    val careUrgent = overdueCare != null && !careSnoozed

    // pendingAction (кэш «Сегодня») оставляем только для НЕ-care задач — care идёт с сервера.
    val nonCarePending = pendingAction?.takeIf { it.type != "care_task_due" }
    val nonCareSnoozed = nonCarePending != null && run {
        val key = "${nonCarePending.type}:${planting.id}:${planting.cropName}:${nonCarePending.careTaskName}"
        key in snoozedTaskKeys
    }
    val nonCareUrgent = nonCarePending != null && !nonCareSnoozed

    val isUrgent = careUrgent || nonCareUrgent

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color.White,
            disabledContainerColor = Color.White
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // ── Верхний ряд: имя + бейдж стадии + меню ──
            Row(
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    // Имя культуры
                    Text(
                        planting.cropName ?: "Культура #${planting.cropId}",
                        fontFamily = NunitoFamily,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 17.sp,
                        color = MaterialTheme.colorScheme.onBackground,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    // Компактная мета: дата посева · кол-во
                    val metaParts = buildList {
                        planting.sownAt?.let { add(formatIsoDate(it)) }
                        planting.quantity?.let { if (it > 1) add("$it раст.") }
                        planting.variety?.takeIf { it.isNotBlank() }?.let { add("сорт «$it»") }
                    }
                    if (metaParts.isNotEmpty()) {
                        Text(
                            metaParts.joinToString(" · "),
                            fontFamily = NunitoFamily,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    // Последнее действие
                    planting.lastActionAt?.let {
                        Text(
                            "Последнее действие: ${formatIsoDate(it)}",
                            fontFamily = NunitoFamily,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    // Требует ухода — просроченная/наступившая care-задача (источник: сервер)
                    if (overdueCare != null) {
                        val base = buildString {
                            append("Требуется: ${overdueCare.name}")
                            if (overdueCare.daysOverdue > 0) append(" · просрочено ${overdueCare.daysOverdue} дн.")
                        }
                        Text(
                            text = if (careSnoozed) "$base (отложено)" else base,
                            fontFamily = NunitoFamily,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            color = if (careSnoozed)
                                MaterialTheme.colorScheme.onSurfaceVariant
                            else
                                MaterialTheme.colorScheme.error
                        )
                        // Подсказка «чем обрабатывать» — рекомендованный препарат
                        overdueCare.product?.let { prod ->
                            Text(
                                text = "Препарат: $prod",
                                fontFamily = NunitoFamily,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                    // Прочие pending-задачи (полив/подкормка/пересадка/урожай/заморозки) — кэш «Сегодня»
                    if (nonCarePending != null) {
                        val baseLabel = when (nonCarePending.type) {
                            "fertilizing_due" ->
                                // careTaskName для fertilizing_due бэкенд не передаёт — fallback на ярлык
                                nonCarePending.careTaskName?.let { "Требуется подкормка: $it" }
                                    ?: PENDING_ACTION_LABELS[nonCarePending.type]
                                    ?: nonCarePending.type
                            else ->
                                PENDING_ACTION_LABELS[nonCarePending.type] ?: nonCarePending.type
                        }
                        Text(
                            text = if (nonCareSnoozed) "$baseLabel (отложено)" else baseLabel,
                            fontFamily = NunitoFamily,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            color = if (nonCareSnoozed)
                                MaterialTheme.colorScheme.onSurfaceVariant
                            else
                                MaterialTheme.colorScheme.error
                        )
                    }
                    // Следующая задача
                    planting.nextCareTask?.let { next ->
                        val whenText = when {
                            next.daysUntil <= 0 -> "сегодня"
                            next.daysUntil == 1 -> "завтра"
                            else                -> "через ${next.daysUntil} дн."
                        }
                        Text(
                            text = "→ ${next.name}: $whenText",
                            fontFamily = NunitoFamily,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.tertiary,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
                // Правая колонка: бейдж стадии + меню
                Column(
                    horizontalAlignment = Alignment.End,
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    // Pill-бейдж стадии
                    Surface(
                        shape = CircleShape,
                        color = if (isUrgent)
                            MaterialTheme.colorScheme.errorContainer
                        else
                            MaterialTheme.colorScheme.primaryContainer
                    ) {
                        Text(
                            text = if (isUrgent) "Уход!" else (STAGE_LABELS[planting.stage] ?: planting.stage),
                            fontFamily = NunitoFamily,
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp,
                            color = if (isUrgent)
                                MaterialTheme.colorScheme.error
                            else
                                MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                            softWrap = false
                        )
                    }
                    Box {
                        IconButton(
                            onClick = { menuExpanded = true },
                            modifier = Modifier.size(32.dp)
                        ) {
                            Icon(Icons.Default.MoreVert, contentDescription = "Меню", modifier = Modifier.size(18.dp))
                        }
                        DropdownMenu(
                            expanded = menuExpanded,
                            onDismissRequest = { menuExpanded = false }
                        ) {
                            DropdownMenuItem(
                                text = { Text("Информация о посадке", fontFamily = NunitoFamily) },
                                onClick = { menuExpanded = false; onInfo() }
                            )
                            DropdownMenuItem(
                                text = { Text("Редактировать информацию", fontFamily = NunitoFamily) },
                                onClick = { menuExpanded = false; onEditInfo() }
                            )
                            DropdownMenuItem(
                                text = { Text("Завершить сезон", fontFamily = NunitoFamily) },
                                onClick = { menuExpanded = false; onFinishSeason() }
                            )
                            DropdownMenuItem(
                                text = { Text("Удалить посадку", fontFamily = NunitoFamily, color = MaterialTheme.colorScheme.error) },
                                onClick = { menuExpanded = false; onDelete() }
                            )
                        }
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
            Button(
                onClick = onLogAction,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(16.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Edit,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    text = "Записать действие",
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.Black,
                    softWrap = false,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

// ─── Шторка: настройка новой посадки ────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PlantingSetupBottomSheet(
    defaultSeedling: Boolean,
    onConfirm: (date: String, quantity: Int, conditions: String, sowingMethod: String, variety: String?) -> Unit,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var date by remember { mutableStateOf(LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)) }
    var dateDisplay by remember { mutableStateOf(LocalDate.now().format(DateTimeFormatter.ofPattern("dd.MM.yyyy"))) }
    var quantity by remember { mutableStateOf("1") }
    var variety by remember { mutableStateOf("") }
    var conditions by remember { mutableStateOf("soil") }
    var sowingMethod by remember(defaultSeedling) { mutableStateOf(if (defaultSeedling) "seedling" else "direct") }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = MaterialTheme.colorScheme.surface,
        windowInsets = WindowInsets(0)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp)
                .padding(bottom = 32.dp)
                .navigationBarsPadding()
                .imePadding(),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                "Параметры посадки",
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.Black,
                fontSize = 20.sp,
                color = MaterialTheme.colorScheme.onBackground
            )

            OutlinedTextField(
                value = dateDisplay,
                onValueChange = { input ->
                    dateDisplay = input
                    runCatching {
                        val parts = input.split(".")
                        if (parts.size == 3) {
                            val d = parts[0].toInt(); val m = parts[1].toInt(); val y = parts[2].toInt()
                            date = LocalDate.of(y, m, d).format(DateTimeFormatter.ISO_LOCAL_DATE)
                        }
                    }
                },
                label = { Text("Дата посадки", fontFamily = NunitoFamily) },
                placeholder = { Text("ДД.ММ.ГГГГ", fontFamily = NunitoFamily) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = RoundedCornerShape(12.dp)
            )

            OutlinedTextField(
                value = quantity,
                onValueChange = { if (it.all(Char::isDigit)) quantity = it },
                label = { Text("Количество растений", fontFamily = NunitoFamily) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = RoundedCornerShape(12.dp)
            )

            OutlinedTextField(
                value = variety,
                onValueChange = { if (it.length <= 120) variety = it },
                label = { Text("Сорт (необязательно)", fontFamily = NunitoFamily) },
                placeholder = { Text("Например: Бычье сердце", fontFamily = NunitoFamily) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = RoundedCornerShape(12.dp)
            )

            Text(
                "Место посадки",
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.Black,
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onBackground
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = conditions == "soil",
                    onClick = { conditions = "soil" },
                    shape = RoundedCornerShape(100.dp),
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = MaterialTheme.colorScheme.primary,
                        selectedLabelColor = Color.White
                    ),
                    label = { Text("Грунт", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, softWrap = false) }
                )
                FilterChip(
                    selected = conditions == "greenhouse",
                    onClick = { conditions = "greenhouse" },
                    shape = RoundedCornerShape(100.dp),
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = MaterialTheme.colorScheme.primary,
                        selectedLabelColor = Color.White
                    ),
                    label = { Text("Теплица", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, softWrap = false) }
                )
            }

            Text(
                "Способ посадки",
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.Black,
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onBackground
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = sowingMethod == "direct",
                    onClick = { sowingMethod = "direct" },
                    shape = RoundedCornerShape(100.dp),
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = MaterialTheme.colorScheme.primary,
                        selectedLabelColor = Color.White
                    ),
                    label = { Text("Сразу в грунт", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, softWrap = false) }
                )
                FilterChip(
                    selected = sowingMethod == "seedling",
                    onClick = { sowingMethod = "seedling" },
                    shape = RoundedCornerShape(100.dp),
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = MaterialTheme.colorScheme.primary,
                        selectedLabelColor = Color.White
                    ),
                    label = { Text("Через рассаду", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, softWrap = false) }
                )
            }

            Spacer(Modifier.height(8.dp))
            Button(
                onClick = {
                    onConfirm(date, quantity.toIntOrNull() ?: 1, conditions, sowingMethod, variety.trim().ifEmpty { null })
                },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(16.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Spa,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    text = "Посадить",
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.Black,
                    softWrap = false
                )
            }
        }
    }
}

// ─── Шторка: редактирование существующей посадки ─────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PlantingEditBottomSheet(
    planting: Planting,
    onConfirm: (date: String, quantity: Int, conditions: String, sowingMethod: String, variety: String?) -> Unit,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    val initialDate = planting.sownAt?.take(10) ?: LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
    val initialDateDisplay = runCatching {
        val ld = LocalDate.parse(initialDate)
        ld.format(DateTimeFormatter.ofPattern("dd.MM.yyyy"))
    }.getOrElse { initialDate }

    var date by remember { mutableStateOf(initialDate) }
    var dateDisplay by remember { mutableStateOf(initialDateDisplay) }
    var quantity by remember { mutableStateOf((planting.quantity ?: 1).toString()) }
    var variety by remember { mutableStateOf(planting.variety ?: "") }
    var conditions by remember { mutableStateOf(planting.conditions ?: "soil") }
    var sowingMethod by remember { mutableStateOf(if (planting.sowingMethod == "direct") "direct" else "seedling") }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = MaterialTheme.colorScheme.surface,
        windowInsets = WindowInsets(0)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp)
                .padding(bottom = 32.dp)
                .navigationBarsPadding()
                .imePadding(),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                "Редактировать: ${planting.cropName ?: "посадку"}",
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.Black,
                fontSize = 20.sp,
                color = MaterialTheme.colorScheme.onBackground
            )

            OutlinedTextField(
                value = dateDisplay,
                onValueChange = { input ->
                    dateDisplay = input
                    runCatching {
                        val parts = input.split(".")
                        if (parts.size == 3) {
                            val d = parts[0].toInt(); val m = parts[1].toInt(); val y = parts[2].toInt()
                            date = LocalDate.of(y, m, d).format(DateTimeFormatter.ISO_LOCAL_DATE)
                        }
                    }
                },
                label = { Text("Дата посадки", fontFamily = NunitoFamily) },
                placeholder = { Text("ДД.ММ.ГГГГ", fontFamily = NunitoFamily) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = RoundedCornerShape(12.dp)
            )

            OutlinedTextField(
                value = quantity,
                onValueChange = { if (it.all(Char::isDigit)) quantity = it },
                label = { Text("Количество растений", fontFamily = NunitoFamily) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = RoundedCornerShape(12.dp)
            )

            OutlinedTextField(
                value = variety,
                onValueChange = { if (it.length <= 120) variety = it },
                label = { Text("Сорт (необязательно)", fontFamily = NunitoFamily) },
                placeholder = { Text("Например: Бычье сердце", fontFamily = NunitoFamily) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = RoundedCornerShape(12.dp)
            )

            Text(
                "Место посадки",
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.Black,
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onBackground
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = conditions == "soil",
                    onClick = { conditions = "soil" },
                    shape = RoundedCornerShape(100.dp),
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = MaterialTheme.colorScheme.primary,
                        selectedLabelColor = Color.White
                    ),
                    label = { Text("Грунт", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, softWrap = false) }
                )
                FilterChip(
                    selected = conditions == "greenhouse",
                    onClick = { conditions = "greenhouse" },
                    shape = RoundedCornerShape(100.dp),
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = MaterialTheme.colorScheme.primary,
                        selectedLabelColor = Color.White
                    ),
                    label = { Text("Теплица", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, softWrap = false) }
                )
            }

            Text(
                "Способ посадки",
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.Black,
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onBackground
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = sowingMethod == "direct",
                    onClick = { sowingMethod = "direct" },
                    shape = RoundedCornerShape(100.dp),
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = MaterialTheme.colorScheme.primary,
                        selectedLabelColor = Color.White
                    ),
                    label = { Text("Сразу в грунт", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, softWrap = false) }
                )
                FilterChip(
                    selected = sowingMethod == "seedling",
                    onClick = { sowingMethod = "seedling" },
                    shape = RoundedCornerShape(100.dp),
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = MaterialTheme.colorScheme.primary,
                        selectedLabelColor = Color.White
                    ),
                    label = { Text("Через рассаду", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, softWrap = false) }
                )
            }

            Spacer(Modifier.height(8.dp))
            Button(
                onClick = { onConfirm(date, quantity.toIntOrNull() ?: 1, conditions, sowingMethod, variety.trim().ifEmpty { null }) },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(16.dp)
            ) {
                Text(
                    "Сохранить",
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.Black,
                    softWrap = false
                )
            }
        }
    }
}


