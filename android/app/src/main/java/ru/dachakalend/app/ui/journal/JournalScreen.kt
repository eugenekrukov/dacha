package ru.dachakalend.app.ui.journal

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.dachakalend.app.data.model.ActionLog

private val ACTION_LABELS = mapOf(
    "watering"    to "💧 Полив",
    "fertilizing" to "🌿 Подкормка",
    "treatment"   to "🛡️ Обработка",
    "other"       to "📋 Другое"
)

private fun formatDate(iso: String): String = try {
    val d = java.time.LocalDate.parse(iso)
    "%02d.%02d.%d".format(d.dayOfMonth, d.monthValue, d.year)
} catch (_: Exception) { iso }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun JournalScreen(
    onBack: () -> Unit,
    viewModel: JournalViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsState()
    var filterExpanded by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Журнал действий") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Назад")
                    }
                },
                actions = {
                    if (state.allCrops.isNotEmpty()) {
                        ExposedDropdownMenuBox(
                            expanded = filterExpanded,
                            onExpandedChange = { filterExpanded = !filterExpanded }
                        ) {
                            TextButton(
                                onClick = { filterExpanded = true },
                                modifier = Modifier.menuAnchor()
                            ) {
                                Text(state.cropFilter ?: "Все культуры")
                            }
                            ExposedDropdownMenu(
                                expanded = filterExpanded,
                                onDismissRequest = { filterExpanded = false }
                            ) {
                                DropdownMenuItem(
                                    text = { Text("Все культуры") },
                                    onClick = { viewModel.setCropFilter(null); filterExpanded = false }
                                )
                                state.allCrops.forEach { crop ->
                                    DropdownMenuItem(
                                        text = { Text(crop) },
                                        onClick = { viewModel.setCropFilter(crop); filterExpanded = false }
                                    )
                                }
                            }
                        }
                    }
                }
            )
        }
    ) { padding ->
        when {
            state.isLoading -> Box(
                Modifier.fillMaxSize().padding(padding),
                contentAlignment = Alignment.Center
            ) { CircularProgressIndicator() }

            state.filteredActions.isEmpty() -> Box(
                Modifier.fillMaxSize().padding(padding),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    if (state.cropFilter != null) "Нет действий для выбранной культуры"
                    else "Действий пока нет",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            else -> LazyColumn(
                modifier = Modifier.padding(padding),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                state.groupedByDate.entries.sortedByDescending { it.key }.forEach { (date, logs) ->
                    item {
                        Text(
                            text = formatDate(date),
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(top = 12.dp, bottom = 4.dp)
                        )
                    }
                    items(logs) { log ->
                        JournalEntry(log)
                    }
                }
            }
        }
    }
}

@Composable
private fun JournalEntry(log: ActionLog) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = ACTION_LABELS[log.type] ?: log.type,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.weight(1f)
            )
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = log.cropName ?: "",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                if (!log.notes.isNullOrBlank()) {
                    Text(
                        text = log.notes,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}
