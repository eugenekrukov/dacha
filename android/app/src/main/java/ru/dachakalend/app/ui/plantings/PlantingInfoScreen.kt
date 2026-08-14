package ru.dachakalend.app.ui.plantings

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.DialogWindowProvider
import androidx.core.view.WindowCompat
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import ru.dachakalend.app.data.api.mediaUrl
import ru.dachakalend.app.data.model.ActionLog
import ru.dachakalend.app.data.model.CareTask
import ru.dachakalend.app.data.model.PlantingPhoto
import ru.dachakalend.app.ui.actions.careTaskActionType
import ru.dachakalend.app.ui.common.effectivePlanted
import ru.dachakalend.app.ui.common.rememberPhotoPickers
import ru.dachakalend.app.ui.common.taskDayOffset
import ru.dachakalend.app.ui.crops.CropCareSection
import ru.dachakalend.app.ui.crops.CropNeighborsSection
import ru.dachakalend.app.ui.feed.ActionFeedCard
import ru.dachakalend.app.ui.feed.FeedMonthHeader
import ru.dachakalend.app.ui.feed.FeedThumb
import ru.dachakalend.app.ui.feed.PhotoActionsBar
import ru.dachakalend.app.ui.feed.PhotoFeedRow
import ru.dachakalend.app.ui.guide.ProblemList
import ru.dachakalend.app.ui.theme.NunitoFamily
import java.time.LocalDate

private val ACTION_LABELS = mapOf(
    "watering" to "Полив", "fertilizing" to "Подкормка", "treatment" to "Обработка",
    "pricking_out" to "Пикировка", "transplanting" to "Высадка", "tying" to "Подвязка",
    "pinching" to "Пасынкование", "hilling" to "Окучивание", "pruning" to "Обрезка",
    "weeding" to "Прополка", "loosening" to "Рыхление", "thinning" to "Прореживание",
    "runner_removal" to "Удаление усов", "bolt_removal" to "Удаление стрелок",
    "deflowering" to "Удаление цветков", "staking" to "Установка опоры",
    "harvest" to "Сбор урожая", "other" to "Заметки"
)

private fun formatShort(iso: String): String = try {
    val d = java.time.OffsetDateTime.parse(iso)
    "%02d.%02d.%02d".format(d.dayOfMonth, d.monthValue, d.year % 100)
} catch (_: Exception) {
    try { val d = LocalDate.parse(iso.take(10)); "%02d.%02d.%02d".format(d.dayOfMonth, d.monthValue, d.year % 100) }
    catch (_: Exception) { iso }
}

private fun plantedDate(sownAt: String?): LocalDate? = sownAt?.let { runCatching { LocalDate.parse(it.take(10)) }.getOrNull() }
private fun fmtDate(d: LocalDate): String = "%02d.%02d.%02d".format(d.dayOfMonth, d.monthValue, d.year % 100)
private fun actionLocalDate(iso: String): LocalDate? =
    runCatching { java.time.OffsetDateTime.parse(iso).toLocalDate() }.getOrNull()
        ?: runCatching { LocalDate.parse(iso.take(10)) }.getOrNull()

private enum class SchedStatus { DONE, MISSED, UPCOMING, NEUTRAL }
private data class SchedRow(val name: String, val dateStr: String, val date: LocalDate, val status: SchedStatus)

private fun rowActionTypes(name: String): Set<String>? = when {
    name.contains("Пересадка", true) || name.contains("пикировк", true) -> setOf("transplanting", "pricking_out")
    name.contains("урожай", true) -> null
    else -> careTaskActionType(name).let { if (it == "other") null else setOf(it) }
}

// Расписание работ: повторяющиеся задачи и полив схлопнуты до одной актуальной строки
// «(каждые N дн.)» — без «стены» однотипных действий через день (порт web buildSchedule).
// createdAt — когда посадка реально добавлена в приложение (planting.createdAt). Для
// ретро-посадок (planted в прошлом) отсекаем строки расписания раньше этой даты — их всё
// равно уже не выполнить, у многолетников (обрезка/подвязка «раз в год») иначе копится мёртвый лог.
private fun buildSchedule(
    transplantDays: Int?, careTasks: List<CareTask>?, harvestDays: Int?, wateringFreqDays: Int?,
    conditions: String?, sowingMethod: String?, planted: LocalDate, actions: List<ActionLog>, today: LocalDate,
    createdAt: LocalDate? = null, isPerennial: Boolean = false,
    seasonStart: Int? = null, seasonEnd: Int? = null
): List<SchedRow> {
    val rows = mutableListOf<SchedRow>()
    // Длина сезона — для перевода осенних задач (anchor="end") в отсчёт от начала.
    val seasonLength = if (seasonStart != null && seasonEnd != null) seasonEnd - seasonStart else null
    // Разовая пересадка сеянцев (transplantDays) якорю не подчиняется — она была один раз
    // в начале жизни растения, считаем от planted; остальное — от anchor.
    val anchor = effectivePlanted(planted, isPerennial, today, seasonStart)
    fun statusOf(name: String, date: LocalDate, next: LocalDate?): SchedStatus {
        val types = rowActionTypes(name) ?: return SchedStatus.NEUTRAL
        val done = actions.any { a ->
            a.type in types && actionLocalDate(a.loggedAt)?.let { d -> !d.isBefore(date) && (next == null || d.isBefore(next)) } == true
        }
        return when { done -> SchedStatus.DONE; date.isBefore(today) -> SchedStatus.MISSED; else -> SchedStatus.UPCOMING }
    }
    if (sowingMethod != "direct") transplantDays?.let {
        val d = planted.plusDays(it.toLong())
        rows += SchedRow("Пересадка/пикировка", fmtDate(d), d, statusOf("Пересадка", d, null))
    }
    val limit = harvestDays ?: 120
    careTasks?.forEach { task ->
        // Разовая задача не зависит от limit — у неё всегда ровно одна дата
        // (у многолетников/деревьев dayOffset может быть >120, напр. осенняя обрезка).
        // Осенние задачи заданы от конца вегетации — приводим к отсчёту от начала.
        val baseOffset = taskDayOffset(task, seasonLength)
        if (task.repeatDays == null) {
            val d = anchor.plusDays(baseOffset.toLong())
            rows += SchedRow(task.name, fmtDate(d), d, statusOf(task.name, d, null))
            return@forEach
        }
        val occ = mutableListOf<LocalDate>()
        var offset = baseOffset
        while (offset <= limit) { occ += anchor.plusDays(offset.toLong()); offset += task.repeatDays }
        if (occ.isEmpty()) return@forEach // dayOffset уже за пределами limit — задача вне горизонта
        val idx = occ.indexOfFirst { !it.isBefore(today) }
        val repIdx = if (idx >= 0) idx else occ.size - 1
        val d = occ[repIdx]
        rows += SchedRow("${task.name} (каждые ${task.repeatDays} дн.)", fmtDate(d), d, statusOf(task.name, d, occ.getOrNull(repIdx + 1)))
    }
    wateringFreqDays?.let { freq ->
        val interval = if (conditions == "greenhouse") maxOf(1, Math.round(freq * 0.8).toInt()) else freq
        if (interval >= 1) {
            val wLimit = minOf(harvestDays ?: 120, 120)
            var offset = interval
            while (offset <= wLimit && anchor.plusDays(offset.toLong()).isBefore(today)) offset += interval
            if (offset <= wLimit) {
                val d = anchor.plusDays(offset.toLong())
                rows += SchedRow("Полив (каждые $interval дн.)", fmtDate(d), d, SchedStatus.UPCOMING)
            }
        }
    }
    harvestDays?.let { val d = anchor.plusDays(it.toLong()); rows += SchedRow("Сбор урожая", fmtDate(d), d, SchedStatus.NEUTRAL) }
    // Отсекаем то, что выполнить было нельзя: задачи раньше самой посадки (якорь сезона может
    // быть раньше неё, если куст завели в середине сезона) и раньше добавления в приложение.
    val floor = if (createdAt != null && createdAt.isAfter(planted)) createdAt else planted
    return rows.filter { !it.date.isBefore(floor) }.sortedBy { it.date }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlantingInfoScreen(
    plantingId: Int,
    onBack: () -> Unit,
    onOpenGuide: (cropId: Int, cropName: String?) -> Unit,
    onOpenPaywall: () -> Unit = {},
    viewModel: PlantingInfoViewModel = hiltViewModel()
) {
    LaunchedEffect(plantingId) { viewModel.reset(); viewModel.load(plantingId) }
    val state by viewModel.uiState.collectAsState()
    var tab by remember { mutableIntStateOf(0) }
    val tabs = listOf("О посадке", "Уход", "Болезни", "Вредители", "Соседи")
    val planting = state.planting

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text(planting?.cropName ?: "Посадка", fontFamily = NunitoFamily, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.onBackground) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, contentDescription = "Назад") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        when {
            state.isLoading || planting == null ->
                Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    if (state.error != null) Text(state.error!!, fontFamily = NunitoFamily, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    else CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                }
            else -> Column(modifier = Modifier.padding(padding)) {
                ScrollableTabRow(selectedTabIndex = tab, edgePadding = 0.dp) {
                    tabs.forEachIndexed { i, t ->
                        Tab(selected = tab == i, onClick = { tab = i },
                            text = { Text(t, fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, softWrap = false) })
                    }
                }
                val scroll = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)
                    .verticalScroll(rememberScrollState()).padding(16.dp)
                val crop = state.crop
                when (tab) {
                    0 -> AboutTab(
                        state, scroll,
                        onUpload = { bytes, actionId -> viewModel.uploadPhoto(planting.id, bytes, actionId) },
                        onDelete = viewModel::deletePhoto,
                        onReplace = { p, bytes -> viewModel.replacePhoto(p, bytes) },
                        onDeleteRecord = viewModel::deleteAction,
                        onSelectBed = viewModel::setBed,
                        onCreateBed = viewModel::createAndSetBed,
                        onRenameBed = viewModel::renameBed,
                        onDeleteBed = viewModel::deleteBed,
                        onSetConditions = viewModel::setConditions,
                        onDiagnose = viewModel::diagnosePhoto,
                        onOpenPaywall = onOpenPaywall,
                    )
                    1 -> if (crop != null) CropCareSection(crop, modifier = scroll)
                         else EmptyTab(scroll, "Нет данных об уходе.")
                    2 -> Column(modifier = scroll) {
                        QuickDiagnoseCard(state, onDiagnose = viewModel::diagnoseNewPhoto, onOpenPaywall = onOpenPaywall)
                        ProblemList(state.problems, "disease", "Болезни не отмечены.") { onOpenGuide(planting.cropId, planting.cropName) }
                    }
                    3 -> Column(modifier = scroll) {
                        QuickDiagnoseCard(state, onDiagnose = viewModel::diagnoseNewPhoto, onOpenPaywall = onOpenPaywall)
                        ProblemList(state.problems, "pest", "Вредители не отмечены.") { onOpenGuide(planting.cropId, planting.cropName) }
                    }
                    4 -> if (crop != null) CropNeighborsSection(crop, modifier = scroll)
                         else EmptyTab(scroll, "Нет данных.")
                }
            }
        }
    }
}

@Composable
private fun EmptyTab(modifier: Modifier, text: String) {
    Box(modifier, contentAlignment = Alignment.Center) {
        Text(text, fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun AboutTab(
    state: PlantingInfoUiState,
    modifier: Modifier,
    onUpload: (ByteArray, Int?) -> Unit,
    onDelete: (Int) -> Unit,
    onReplace: (PlantingPhoto, ByteArray) -> Unit,
    onDeleteRecord: (Int) -> Unit,
    onSelectBed: (ru.dachakalend.app.data.model.GardenBed) -> Unit,
    onCreateBed: (name: String, type: String, widthCm: Int?, lengthCm: Int?) -> Unit,
    onRenameBed: (bed: ru.dachakalend.app.data.model.GardenBed, name: String, widthCm: Int?, lengthCm: Int?) -> Unit,
    onDeleteBed: (bed: ru.dachakalend.app.data.model.GardenBed) -> Unit,
    onSetConditions: (String) -> Unit,
    onDiagnose: (PlantingPhoto) -> Unit,
    onOpenPaywall: () -> Unit = {},
) {
    val planting = state.planting ?: return
    // Посадка сверх free-набора без подписки: правки и новые записи бэкенд не примет (402).
    val locked = planting.locked
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(16.dp)) {
        if (locked) LockedBanner(onOpenPaywall)
        InfoSection(title = "Посадка") {
            InfoRow2("Дата посадки", planting.sownAt?.let { formatShort(it) } ?: "—")
            planting.variety?.takeIf { it.isNotBlank() }?.let { InfoRow2("Сорт", it) }
            if (locked) InfoRow2("Условия", if (planting.conditions == "greenhouse") "Теплица" else "Грунт")
            else ConditionsRow(current = planting.conditions ?: "soil", onSelect = onSetConditions)
            InfoRow2("Количество растений", "${planting.quantity ?: 1} шт.")
            planting.yieldPerPlantKg?.let { perPlant ->
                val expected = perPlant * (planting.quantity ?: 1)
                val s = "%.1f".format(expected).removeSuffix(",0").removeSuffix(".0")
                InfoRow2("Ожидаемый урожай", "~$s кг")
            }
            val currentBed = state.beds.firstOrNull { it.id == planting.bedId }
            InfoRow2("Место", currentBed?.name ?: "не выбрано")
        }

        if (!locked) InfoSection(title = "Место (грядка)") {
            BedPickerField(
                beds = state.beds,
                selectedBedId = planting.bedId,
                cropFamily = state.crop?.family,
                cropSpacingInRowCm = state.crop?.spacingInRowCm,
                cropSpacingBetweenRowsCm = state.crop?.spacingBetweenRowsCm,
                allowClear = false,
                excludePlantingId = planting.id,
                onSelect = { bed -> bed?.let { onSelectBed(it) } },
                onCreate = onCreateBed,
                onRename = onRenameBed,
                onDelete = onDeleteBed,
            )
            state.bedError?.let {
                Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
            }
        }

        val planted = plantedDate(planting.sownAt)
        val crop = state.crop
        if (planted != null && crop != null) {
            val schedule = buildSchedule(
                transplantDays = crop.transplantDays, careTasks = crop.careTasks, harvestDays = crop.harvestDays,
                wateringFreqDays = crop.wateringFreqDays, conditions = planting.conditions, sowingMethod = planting.sowingMethod,
                planted = planted, actions = state.recentActions, today = LocalDate.now(),
                createdAt = plantedDate(planting.createdAt), isPerennial = crop.isPerennial == true,
                seasonStart = state.seasonStartDoy, seasonEnd = state.seasonEndDoy
            )
            if (schedule.isNotEmpty()) {
                InfoSection(title = "Расписание работ") {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        SchedLegend(Color(0xFF2E7D32), "выполнено")
                        SchedLegend(MaterialTheme.colorScheme.error, "просрочено")
                        SchedLegend(Color(0x40000000), "предстоит")
                    }
                    schedule.forEach { SchedRowView(it) }
                }
            }
        }

        JournalSection(
            photos = state.photos,
            actions = state.recentActions,
            uploadBusy = state.uploadBusy,
            photoError = state.photoError,
            locked = locked,
            onUpload = onUpload,
            onDelete = onDelete,
            onReplace = onReplace,
            onDeleteRecord = onDeleteRecord,
            diagnosingPhotoId = state.diagnosingPhotoId,
            diagnoseErrorPhotoId = state.diagnoseErrorPhotoId,
            diagnoseError = state.diagnoseError,
            diagnoseSubscriptionRequired = state.diagnoseSubscriptionRequired,
            onDiagnose = onDiagnose,
            onOpenPaywall = onOpenPaywall,
        )
    }
}

// Быстрый вход в AI-диагностику с вкладок «Болезни»/«Вредители» (F2, зеркало web
// DiagnosePhotoButton): снял фото → сразу загрузка+диагноз, без похода в дневник фото.
// Диагноз closed-set — покрывает и болезни, и вредителей разом, поэтому карточка
// одинаковая на обеих вкладках: угадать заранее, что покажет фото, нельзя.
@Composable
private fun QuickDiagnoseCard(
    state: PlantingInfoUiState,
    onDiagnose: (ByteArray) -> Unit,
    onOpenPaywall: () -> Unit,
) {
    if (state.planting?.locked == true) return
    val pickers = rememberPhotoPickers(onBytes = onDiagnose)
    Card(modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp)) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("🔍 Определить болезнь/вредителя по фото", fontFamily = NunitoFamily, fontWeight = FontWeight.Black)
            if (state.quickDiagnoseBusy) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.width(8.dp))
                    Text("Определяю…", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold)
                }
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { pickers.camera() }, modifier = Modifier.weight(1f)) {
                        Icon(Icons.Default.PhotoCamera, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Камера", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, softWrap = false)
                    }
                    OutlinedButton(onClick = { pickers.gallery() }, modifier = Modifier.weight(1f)) {
                        Icon(Icons.Default.PhotoLibrary, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Галерея", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, softWrap = false)
                    }
                }
            }

            state.quickDiagnoseResult?.let { candidates ->
                if (candidates.isEmpty()) {
                    Text(
                        "Не удалось однозначно определить — сверьтесь со справочником ниже.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    candidates.forEach { c ->
                        Column {
                            Text("Похоже на: ${c.name}", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold)
                            Text(c.reasoning, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                    Text(
                        "Предварительная оценка ИИ — не заменяет консультацию агронома. Сверьтесь со справочником.",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            state.quickDiagnoseError?.let {
                Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                if (state.quickDiagnoseSubscriptionRequired) {
                    OutlinedButton(onClick = onOpenPaywall) {
                        Text("Оформить «Дачник Про»", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, softWrap = false)
                    }
                }
            }
        }
    }
}

// Посадка сверх free-набора: объясняем, почему правки закрыты, и даём путь к оплате.
@Composable
private fun LockedBanner(onOpenPaywall: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                "Только чтение",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                "Бесплатно ведутся 3 посадки. Записи и фото этой посадки сохранены, но добавлять новые можно с подпиской.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            OutlinedButton(onClick = onOpenPaywall) {
                Text("Оформить «Дачник Про»", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, softWrap = false)
            }
        }
    }
}

// Единый журнал посадки: действие + заметка + его фото в одной карточке, плюс одиночные фото.
// Собирается клиентом из recentActions + photos (без отдельного бэкенд-запроса).
private sealed interface JournalEntry { val dateIso: String }
private data class ActionEntry(val action: ActionLog, val photos: List<PlantingPhoto>) : JournalEntry {
    override val dateIso get() = action.loggedAt
}
private data class PhotoEntry(val photo: PlantingPhoto) : JournalEntry {
    override val dateIso get() = photo.takenAt
}

@Composable
private fun JournalSection(
    photos: List<PlantingPhoto>,
    actions: List<ActionLog>,
    uploadBusy: Boolean,
    photoError: String?,
    locked: Boolean,
    onUpload: (ByteArray, Int?) -> Unit,
    onDelete: (Int) -> Unit,
    onReplace: (PlantingPhoto, ByteArray) -> Unit,
    onDeleteRecord: (Int) -> Unit,
    diagnosingPhotoId: Int?,
    diagnoseErrorPhotoId: Int?,
    diagnoseError: String?,
    diagnoseSubscriptionRequired: Boolean,
    onDiagnose: (PlantingPhoto) -> Unit,
    onOpenPaywall: () -> Unit,
) {
    var viewer by remember { mutableStateOf<PlantingPhoto?>(null) }
    // Источник фото: галерея или камера. После выбора кадра — диалог привязки к действию (ниже),
    // чтобы фото показывало действие в ленте «Мой участок» и в журнале.
    var pendingBytes by remember { mutableStateOf<ByteArray?>(null) }
    val pickers = rememberPhotoPickers(onBytes = { pendingBytes = it })

    // Записи: действие (с его фото) + одиночные фото без действия (или с «осиротевшим» actionId).
    val entries = remember(actions, photos) {
        val photosByAction = photos.groupBy { it.actionId }
        val actionIds = actions.mapTo(HashSet()) { it.id }
        buildList<JournalEntry> {
            actions.forEach { a -> add(ActionEntry(a, photosByAction[a.id].orEmpty())) }
            photos.filter { it.actionId == null || it.actionId !in actionIds }.forEach { add(PhotoEntry(it)) }
        }.sortedByDescending { it.dateIso }
    }

    InfoSection(title = "Журнал") {
        // Заблокированная посадка: история видна, новые кадры бэкенд не примет (402).
        if (locked) Unit
        else if (uploadBusy) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                Spacer(Modifier.width(8.dp))
                Text("Загрузка…", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold)
            }
        } else {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { pickers.camera() }, modifier = Modifier.weight(1f)) {
                    Icon(Icons.Default.PhotoCamera, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Камера", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, softWrap = false)
                }
                OutlinedButton(onClick = { pickers.gallery() }, modifier = Modifier.weight(1f)) {
                    Icon(Icons.Default.PhotoLibrary, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Галерея", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, softWrap = false)
                }
            }
        }

        photoError?.let {
            Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
        }

        if (entries.isEmpty()) {
            Text(
                "Пока пусто. Отмечайте действия и снимайте посадку — соберётся история роста.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        } else {
            // Новые сверху, разделители по месяцам. groupBy по "yyyy-MM" сохраняет порядок после сортировки.
            entries.groupBy { it.dateIso.take(7) }.forEach { (monthKey, monthEntries) ->
                FeedMonthHeader(monthKey)
                monthEntries.forEach { entry ->
                    when (entry) {
                        is ActionEntry -> {
                            val a = entry.action
                            // Полный журнал посадки показывает текст заметки, включая авто-подстановку
                            // (препарат/удобрение) — полезный контекст. В глобальной ленте авто-заметки
                            // скрывает бэкенд.
                            val note = a.notes?.takeIf { it.isNotBlank() }
                            ActionFeedCard(
                                actionType = a.type,
                                actionLabel = ACTION_LABELS[a.type] ?: a.type,
                                note = note,
                                dateLabel = formatShort(a.loggedAt),
                                thumbs = entry.photos.map { p -> FeedThumb(thumbUrl = p.thumbUrl) { viewer = p } },
                            )
                        }
                        is PhotoEntry -> PhotoFeedRow(
                            thumbUrl = entry.photo.thumbUrl,
                            dateLabel = formatShort(entry.photo.takenAt),
                            caption = entry.photo.caption,
                            onOpen = { viewer = entry.photo }
                        )
                    }
                }
            }
        }
    }

    // Привязка к действию: после выбора кадра — выбрать действие этой посадки (или «без действия»).
    pendingBytes?.let { bytes ->
        AlertDialog(
            onDismissRequest = { pendingBytes = null },
            title = { Text("К какому действию?", fontFamily = NunitoFamily, fontWeight = FontWeight.Black) },
            text = {
                Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                    TextButton(onClick = { onUpload(bytes, null); pendingBytes = null }, modifier = Modifier.fillMaxWidth()) {
                        Text("Без действия", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold,
                            modifier = Modifier.fillMaxWidth())
                    }
                    actions.take(15).forEach { a ->
                        val label = (ACTION_LABELS[a.type] ?: a.type) + " · " + formatShort(a.loggedAt)
                        TextButton(onClick = { onUpload(bytes, a.id); pendingBytes = null }, modifier = Modifier.fillMaxWidth()) {
                            Text(label, fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold,
                                modifier = Modifier.fillMaxWidth())
                        }
                    }
                }
            },
            confirmButton = {},
            dismissButton = {
                TextButton(onClick = { pendingBytes = null }) {
                    Text("Отмена", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold)
                }
            }
        )
    }

    // photos — источник истины из ViewModel; viewer — снимок, взятый в момент открытия. Диагноз
    // приходит асинхронно и обновляет photos, поэтому берём актуальную версию по id, а не «замороженную» p.
    val currentViewer = viewer?.let { v -> photos.find { it.id == v.id } ?: v }
    currentViewer?.let { p ->
        PhotoViewerDialog(
            photo = p,
            onDismiss = { viewer = null },
            onDeletePhoto = { onDelete(p.id); viewer = null },
            onReplace = { bytes -> onReplace(p, bytes); viewer = null },
            onDeleteRecord = { p.actionId?.let { onDeleteRecord(it) }; viewer = null },
            diagBusy = diagnosingPhotoId == p.id,
            diagError = if (diagnoseErrorPhotoId == p.id) diagnoseError else null,
            diagSubscriptionRequired = diagnoseSubscriptionRequired,
            onDiagnose = { onDiagnose(p) },
            onOpenPaywall = onOpenPaywall,
        )
    }
}

@Composable
private fun PhotoViewerDialog(
    photo: PlantingPhoto,
    onDismiss: () -> Unit,
    onDeletePhoto: () -> Unit,
    onReplace: (ByteArray) -> Unit,
    onDeleteRecord: () -> Unit,
    diagBusy: Boolean,
    diagError: String?,
    diagSubscriptionRequired: Boolean,
    onDiagnose: () -> Unit,
    onOpenPaywall: () -> Unit,
) {
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        // Окно Dialog по умолчанию НЕ edge-to-edge → системные инсеты (навбар/статус-бар) в
        // композицию не долетают, и navigationBarsPadding() ниже подпирает нулевую высоту —
        // контент у нижнего края уходит под системную навигацию (жалоба пользователя,
        // кнопка «Определить болезнь» пряталась под кнопками навигации). Явно просим окно
        // диалога стать edge-to-edge — тогда инсеты появляются и padding-модификаторы работают.
        val dialogWindow = (LocalView.current.parent as? DialogWindowProvider)?.window
        SideEffect { dialogWindow?.let { WindowCompat.setDecorFitsSystemWindows(it, false) } }

        Box(Modifier.fillMaxSize().background(Color(0xE6000000))) {
            AsyncImage(
                model = mediaUrl(photo.url),
                contentDescription = "Фото посадки",
                contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxSize().padding(24.dp).align(Alignment.Center)
            )
            // Верхняя панель: действия слева, «Закрыть» справа.
            Row(
                modifier = Modifier.align(Alignment.TopCenter).fillMaxWidth()
                    .background(Color(0x99000000)).statusBarsPadding().padding(horizontal = 4.dp, vertical = 2.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                PhotoActionsBar(
                    hasAction = photo.actionId != null,
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
                    .navigationBarsPadding().padding(16.dp)
            ) {
                Text(formatShort(photo.takenAt), color = Color.White, fontFamily = NunitoFamily, fontWeight = FontWeight.Bold)
                photo.caption?.let { Text(it, color = Color(0xB3FFFFFF), fontFamily = NunitoFamily) }

                if (!photo.aiDiagnosis.isNullOrEmpty()) {
                    Spacer(Modifier.height(8.dp))
                    Column(
                        modifier = Modifier.fillMaxWidth()
                            .background(Color(0x1AFFFFFF), RoundedCornerShape(12.dp))
                            .padding(12.dp)
                    ) {
                        photo.aiDiagnosis.forEach { c ->
                            Text(
                                "Похоже на: ${c.name}",
                                color = Color.White, fontFamily = NunitoFamily, fontWeight = FontWeight.Bold
                            )
                            Text(c.reasoning, color = Color(0xB3FFFFFF), fontFamily = NunitoFamily, fontSize = 13.sp)
                            Spacer(Modifier.height(4.dp))
                        }
                        Text(
                            "Предварительная оценка ИИ — не заменяет консультацию агронома. Сверьтесь со справочником.",
                            color = Color(0x80FFFFFF), fontFamily = NunitoFamily, fontSize = 11.sp
                        )
                    }
                } else {
                    Spacer(Modifier.height(8.dp))
                    if (diagBusy) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = Color.White)
                            Spacer(Modifier.width(8.dp))
                            Text("Определяю…", color = Color.White, fontFamily = NunitoFamily, fontWeight = FontWeight.Bold)
                        }
                    } else {
                        TextButton(onClick = onDiagnose) {
                            Text(
                                "🔍 Определить болезнь/вредителя",
                                color = Color.White, fontFamily = NunitoFamily, fontWeight = FontWeight.Bold
                            )
                        }
                    }
                    diagError?.let {
                        Text(it, color = Color(0xFFFF8A80), fontFamily = NunitoFamily, fontSize = 12.sp)
                        if (diagSubscriptionRequired) {
                            TextButton(onClick = onOpenPaywall) {
                                Text(
                                    "Оформить «Дачник Про»",
                                    color = Color.White, fontFamily = NunitoFamily, fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun InfoSection(title: String, content: @Composable ColumnScope.() -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
            content()
        }
    }
}

// Цветная точка статуса вместо эмодзи 🟢🔴⚪
@Composable
private fun SchedLegend(color: Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Box(Modifier.size(8.dp).clip(CircleShape).background(color))
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun SchedRowView(row: SchedRow) {
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    val (color, dotColor, strike) = when (row.status) {
        SchedStatus.DONE -> Triple(muted, Color(0xFF2E7D32), true)
        SchedStatus.MISSED -> Triple(MaterialTheme.colorScheme.error, MaterialTheme.colorScheme.error, false)
        SchedStatus.UPCOMING -> Triple(MaterialTheme.colorScheme.onSurface, Color(0x40000000), false)
        SchedStatus.NEUTRAL -> Triple(muted, Color.Transparent, false)
    }
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Row(modifier = Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Box(Modifier.size(8.dp).clip(CircleShape).background(dotColor))
            Text(row.name, style = MaterialTheme.typography.bodyMedium, color = color,
                textDecoration = if (strike) TextDecoration.LineThrough else null)
        }
        Text(row.dateStr, style = MaterialTheme.typography.bodyMedium, color = color,
            fontWeight = if (row.status == SchedStatus.MISSED) FontWeight.Bold else FontWeight.Normal)
    }
}

@Composable
private fun InfoRow2(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f))
        Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
    }
}

// Редактируемые «Условия» (грунт/теплица) в карточке посадки — перенесены сюда из формы создания.
@Composable
private fun ConditionsRow(current: String, onSelect: (String) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text("Условия", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("soil" to "Грунт", "greenhouse" to "Теплица").forEach { (value, label) ->
                FilterChip(
                    selected = current == value,
                    onClick = { onSelect(value) },
                    shape = RoundedCornerShape(100.dp),
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = MaterialTheme.colorScheme.primary,
                        selectedLabelColor = Color.White
                    ),
                    label = { Text(label, fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, softWrap = false) }
                )
            }
        }
    }
}
