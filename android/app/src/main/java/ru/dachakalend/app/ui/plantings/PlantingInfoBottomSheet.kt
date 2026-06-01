package ru.dachakalend.app.ui.plantings

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.dachakalend.app.data.model.ActionLog
import ru.dachakalend.app.data.model.CareTask
import ru.dachakalend.app.data.model.Planting
import java.time.LocalDate
import java.time.format.DateTimeFormatter

private val ACTION_LABELS = mapOf(
    "watering"    to "💧 Полив",
    "fertilizing" to "🌿 Подкормка",
    "treatment"   to "🛡️ Обработка",
    "other"       to "📋 Другое"
)

private fun formatShort(iso: String): String = try {
    val date = java.time.OffsetDateTime.parse(iso)
    "%02d.%02d.%02d".format(date.dayOfMonth, date.monthValue, date.year % 100)
} catch (_: Exception) {
    try {
        val d = LocalDate.parse(iso.take(10))
        "%02d.%02d.%02d".format(d.dayOfMonth, d.monthValue, d.year % 100)
    } catch (_: Exception) { iso }
}

private fun plantedDate(sownAt: String?): LocalDate? = sownAt?.let {
    runCatching { LocalDate.parse(it.take(10)) }.getOrNull()
}

private fun offsetDate(base: LocalDate, days: Int): String {
    val d = base.plusDays(days.toLong())
    return "%02d.%02d.%02d".format(d.dayOfMonth, d.monthValue, d.year % 100)
}

// Разворачиваем повторяющиеся задачи до harvestDays (или 120 дней)
private fun expandTasks(tasks: List<CareTask>, planted: LocalDate, harvestDays: Int?): List<Pair<String, String>> {
    val limit = harvestDays ?: 120
    val result = mutableListOf<Triple<String, String, LocalDate>>()
    for (task in tasks) {
        var offset = task.dayOffset
        while (offset <= limit) {
            val date = planted.plusDays(offset.toLong())
            result += Triple(task.name, offsetDate(planted, offset), date)
            if (task.repeatDays == null) break
            offset += task.repeatDays
        }
    }
    return result.sortedBy { it.third }.map { it.first to it.second }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlantingInfoBottomSheet(
    planting: Planting,
    onDismiss: () -> Unit,
    onCropDetail: (Int) -> Unit,
    viewModel: PlantingInfoViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(planting.id) {
        viewModel.reset()
        viewModel.load(planting.id, planting.cropId)
    }

    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp)
                .padding(bottom = 32.dp)
                .navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Заголовок
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    planting.cropName ?: "Посадка",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
                TextButton(onClick = { onCropDetail(planting.cropId) }) {
                    Icon(Icons.Default.Info, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("О культуре")
                }
            }

            if (state.isLoading) {
                Box(Modifier.fillMaxWidth().height(100.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else {
                val planted = plantedDate(planting.sownAt)

                // ── 1. Основная информация ────────────────────────────────
                InfoSection(title = "Посадка") {
                    InfoRow2("Дата посадки", planting.sownAt?.let { formatShort(it) } ?: "—")
                    InfoRow2("Условия", if (planting.conditions == "greenhouse") "🏠 Теплица" else "🌱 Грунт")
                    InfoRow2("Количество растений", "${planting.quantity ?: 1} шт.")
                }

                // ── 2. Расчётные даты процессов ───────────────────────────
                val crop = state.crop
                if (planted != null && crop != null) {
                    val taskDates = mutableListOf<Pair<String, String>>()

                    // Пересадка/пикировка
                    crop.transplantDays?.let {
                        taskDates += "🌿 Пересадка/пикировка" to offsetDate(planted, it)
                    }
                    // Уход (care_tasks)
                    crop.careTasks?.let { tasks ->
                        taskDates += expandTasks(tasks, planted, crop.harvestDays)
                    }
                    // Сбор урожая
                    crop.harvestDays?.let {
                        taskDates += "🌾 Сбор урожая" to offsetDate(planted, it)
                    }

                    if (taskDates.isNotEmpty()) {
                        InfoSection(title = "Расписание работ") {
                            taskDates.sortedBy { it.second }.forEach { (name, date) ->
                                InfoRow2(name, date)
                            }
                        }
                    }
                }

                // ── 3. История действий ───────────────────────────────────
                InfoSection(title = "История действий") {
                    if (state.recentActions.isEmpty()) {
                        Text(
                            "Действий пока не записано",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    } else {
                        state.recentActions.forEach { action ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    ACTION_LABELS[action.type] ?: action.type,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.weight(1f)
                                )
                                Column(horizontalAlignment = androidx.compose.ui.Alignment.End) {
                                    Text(formatShort(action.loggedAt), style = MaterialTheme.typography.bodyMedium)
                                    if (!action.notes.isNullOrBlank()) {
                                        Text(
                                            action.notes,
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                }
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

@Composable
private fun InfoRow2(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(
            label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f)
        )
        Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
    }
}
