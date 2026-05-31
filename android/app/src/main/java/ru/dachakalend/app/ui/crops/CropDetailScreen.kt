package ru.dachakalend.app.ui.crops

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import ru.dachakalend.app.data.model.Crop
import ru.dachakalend.app.data.model.CropDisease
import ru.dachakalend.app.data.model.CropPest
import ru.dachakalend.app.data.model.FertilizingEntry
import ru.dachakalend.app.data.model.WateringStage

// ─── Helpers ────────────────────────────────────────────────────────────────

private fun dayOfYearToShort(day: Int): String {
    val months = listOf(
        31 to "янв", 59 to "фев", 90 to "мар", 120 to "апр",
        151 to "май", 181 to "июн", 212 to "июл", 243 to "авг",
        273 to "сен", 304 to "окт", 334 to "ноя", 365 to "дек"
    )
    val (_, name) = months.firstOrNull { day <= it.first } ?: (365 to "дек")
    return name
}

private fun sowingRange(start: Int?, end: Int?): String {
    if (start == null) return "—"
    val s = dayOfYearToShort(start)
    val e = end?.let { dayOfYearToShort(it) }
    return if (e != null && e != s) "$s – $e" else s
}

private val STAGE_LABELS = mapOf(
    "seedling"  to "Рассада",
    "sprouted"  to "Всходы",
    "growing"   to "Рост",
    "flowering" to "Цветение",
    "fruiting"  to "Плодоношение",
    "harvesting"to "Уборка"
)

// ─── Screen ─────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CropDetailScreen(
    crop: Crop,
    onBack: () -> Unit,
    onPlant: (Crop) -> Unit
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    val tabs = listOf("Уход", "Болезни", "Соседи")

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(crop.name) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Назад")
                    }
                }
            )
        },
        bottomBar = {
            Surface(shadowElevation = 8.dp) {
                Button(
                    onClick = { onPlant(crop) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp)
                        .height(56.dp)
                ) {
                    Text("🌱 Посадить", style = MaterialTheme.typography.titleMedium)
                }
            }
        }
    ) { padding ->
        Column(modifier = Modifier.padding(padding)) {
            TabRow(selectedTabIndex = selectedTab) {
                tabs.forEachIndexed { index, title ->
                    Tab(
                        selected = selectedTab == index,
                        onClick = { selectedTab = index },
                        text = { Text(title) }
                    )
                }
            }

            when (selectedTab) {
                0 -> CareTab(crop)
                1 -> DiseasesTab(crop)
                2 -> NeighborsTab(crop)
            }
        }
    }
}

// ─── Tab: Уход ───────────────────────────────────────────────────────────────

@Composable
private fun CareTab(crop: Crop) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Сроки посева
        InfoCard(title = "Сроки посева") {
            if (crop.climateZones != null && crop.climateZones.isNotEmpty()) {
                val zoneNames = mapOf("6" to "Юг РФ", "5" to "Средняя полоса", "4" to "Урал", "3" to "Сибирь")
                listOf("6", "5", "4", "3").forEach { zone ->
                    val z = crop.climateZones[zone] ?: return@forEach
                    val sow = sowingRange(z.sowStart, z.sowEnd)
                    val transplant = if (z.transplantStart != null)
                        sowingRange(z.transplantStart, z.transplantEnd) else null
                    InfoRow(zoneNames[zone] ?: zone, if (transplant != null) "посев $sow · рассада $transplant" else sow)
                }
            } else {
                InfoRow("Посев (день года)", sowingRange(crop.sowingStartDay, crop.sowingEndDay))
                InfoRow("До пикировки", crop.transplantDays?.let { "$it дн." } ?: "—")
            }
            InfoRow("До урожая", crop.harvestDays?.let { "~$it дн." } ?: "—")
            InfoRow("Боится заморозков", if (crop.frostSensitive == true) "Да ❄️" else "Нет ✅")
        }

        // Полив
        val watering = crop.wateringDetails
        if (watering != null) {
            InfoCard(title = "Полив по стадиям") {
                data class StageEntry(val label: String, val stage: WateringStage?)
                listOf(
                    StageEntry("Рассада",      watering.seedling),
                    StageEntry("Всходы",       watering.sprouted),
                    StageEntry("Рост",         watering.growing),
                    StageEntry("Цветение",     watering.flowering),
                    StageEntry("Плодоношение", watering.fruiting),
                    StageEntry("Уборка",       watering.harvesting)
                ).forEach { (label, w) ->
                    if (w == null) return@forEach
                    val value = buildString {
                        w.freqDays?.let { append("каждые $it дн.") }
                        w.amountLM2?.let { append(" · $it л/м²") }
                    }
                    if (value.isNotBlank()) InfoRow(label, value)
                }
                watering.notes?.let {
                    Spacer(Modifier.height(4.dp))
                    Text(it, style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        } else {
            InfoCard(title = "Полив") {
                InfoRow("Частота", crop.wateringFreqDays?.let { "каждые $it дн." } ?: "—")
                if (!crop.notes.isNullOrBlank()) {
                    Spacer(Modifier.height(4.dp))
                    Text(crop.notes, style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }

        // Подкормки
        val schedule = crop.fertilizingSchedule
        if (!schedule.isNullOrEmpty()) {
            InfoCard(title = "Схема подкормок") {
                schedule.forEachIndexed { i, entry ->
                    if (i > 0) HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                    FertilizingRow(entry)
                }
            }
        }
    }
}

@Composable
private fun FertilizingRow(entry: FertilizingEntry) {
    val stageLabel = entry.stage?.let { STAGE_LABELS[it] } ?: entry.stage ?: ""
    val methodLabel = when (entry.method) {
        "foliar" -> "внекорневая"
        "root"   -> "корневая"
        else     -> ""
    }
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                stageLabel,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.SemiBold
            )
            if (methodLabel.isNotEmpty()) {
                Text(
                    methodLabel,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
        entry.timing?.let {
            Text(it, style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        entry.productExample?.let { product ->
            val dose = entry.dose?.let { " — $it" } ?: ""
            Text(
                "🧪 $product$dose",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium
            )
        }
        entry.notes?.let {
            if (it.isNotBlank()) Text(it, style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

// ─── Tab: Болезни ────────────────────────────────────────────────────────────

@Composable
private fun DiseasesTab(crop: Crop) {
    val diseases = crop.diseases.orEmpty()
    val pests = crop.pests.orEmpty()

    if (diseases.isEmpty() && pests.isEmpty()) {
        EmptyTabPlaceholder("Данные о болезнях и вредителях\nпока не добавлены")
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        if (diseases.isNotEmpty()) {
            Text(
                "Болезни",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 4.dp)
            )
            diseases.forEach { DiseaseCard(it) }
        }
        if (pests.isNotEmpty()) {
            Spacer(Modifier.height(4.dp))
            Text(
                "Вредители",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 4.dp)
            )
            pests.forEach { PestCard(it) }
        }
    }
}

@Composable
private fun DiseaseCard(disease: CropDisease) {
    var expanded by remember { mutableStateOf(false) }
    Card(
        modifier = Modifier.fillMaxWidth(),
        onClick = { expanded = !expanded }
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "🦠 ${disease.name}",
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.weight(1f)
                )
                Icon(
                    if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            if (expanded) {
                Spacer(Modifier.height(8.dp))
                disease.symptoms?.let {
                    DetailRow("Симптомы", it)
                }
                disease.conditions?.let {
                    DetailRow("Условия", it)
                }
                disease.treatment?.let {
                    DetailRow("Лечение", it, highlightColor = MaterialTheme.colorScheme.primary)
                }
                disease.prevention?.let {
                    DetailRow("Профилактика", it)
                }
            }
        }
    }
}

@Composable
private fun PestCard(pest: CropPest) {
    var expanded by remember { mutableStateOf(false) }
    Card(
        modifier = Modifier.fillMaxWidth(),
        onClick = { expanded = !expanded }
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "🐛 ${pest.name}",
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.weight(1f)
                )
                Icon(
                    if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            if (expanded) {
                Spacer(Modifier.height(8.dp))
                pest.signs?.let { DetailRow("Признаки", it) }
                pest.treatment?.let {
                    DetailRow("Борьба", it, highlightColor = MaterialTheme.colorScheme.primary)
                }
                pest.prevention?.let { DetailRow("Профилактика", it) }
            }
        }
    }
}

@Composable
private fun DetailRow(
    label: String,
    value: String,
    highlightColor: Color = MaterialTheme.colorScheme.onSurface
) {
    Column(modifier = Modifier.padding(bottom = 6.dp)) {
        Text(
            label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(value, style = MaterialTheme.typography.bodyMedium, color = highlightColor)
    }
}

// ─── Tab: Соседи ─────────────────────────────────────────────────────────────

@Composable
private fun NeighborsTab(crop: Crop) {
    val good = crop.goodNeighbors.orEmpty()
    val bad  = crop.badNeighbors.orEmpty()
    val prev = crop.goodPredecessors.orEmpty()

    if (good.isEmpty() && bad.isEmpty() && prev.isEmpty()) {
        EmptyTabPlaceholder("Данные о совместимости\nпока не добавлены")
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        if (good.isNotEmpty()) {
            NeighborSection(
                title = "✅ Хорошие соседи",
                items = good,
                chipColor = MaterialTheme.colorScheme.tertiaryContainer,
                textColor = MaterialTheme.colorScheme.onTertiaryContainer
            )
        }
        if (bad.isNotEmpty()) {
            NeighborSection(
                title = "❌ Плохие соседи",
                items = bad,
                chipColor = MaterialTheme.colorScheme.errorContainer,
                textColor = MaterialTheme.colorScheme.onErrorContainer
            )
        }
        if (prev.isNotEmpty()) {
            NeighborSection(
                title = "🔄 Хорошие предшественники",
                items = prev,
                chipColor = MaterialTheme.colorScheme.secondaryContainer,
                textColor = MaterialTheme.colorScheme.onSecondaryContainer
            )
        }
    }
}

@Composable
private fun NeighborSection(
    title: String,
    items: List<String>,
    chipColor: Color,
    textColor: Color
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items.forEach { name ->
                Box(
                    modifier = Modifier
                        .background(chipColor, RoundedCornerShape(50))
                        .padding(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Text(name, style = MaterialTheme.typography.bodySmall, color = textColor)
                }
            }
        }
    }
}

// ─── Shared Components ───────────────────────────────────────────────────────

@Composable
private fun EmptyTabPlaceholder(text: String) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text(
            text,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center
        )
    }
}

@Composable
private fun InfoCard(title: String, content: @Composable ColumnScope.() -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            content()
        }
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(
            label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f)
        )
        Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
    }
    Spacer(Modifier.height(4.dp))
}
