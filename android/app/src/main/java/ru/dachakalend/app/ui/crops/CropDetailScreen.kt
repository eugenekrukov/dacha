package ru.dachakalend.app.ui.crops

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import ru.dachakalend.app.data.model.Crop

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CropDetailScreen(
    crop: Crop,
    onBack: () -> Unit,
    onPlant: (Crop) -> Unit
) {
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
        Column(
            modifier = Modifier
                .padding(padding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Сроки
            InfoCard(title = "Сроки") {
                InfoRow("Посев (день года)", crop.sowingStartDay?.let { s ->
                    crop.sowingEndDay?.let { e -> "$s – $e" } ?: s.toString()
                } ?: "—")
                InfoRow("До пикировки", crop.transplantDays?.let { "$it дней" } ?: "—")
                InfoRow("До урожая", crop.harvestDays?.let { "~$it дней" } ?: "—")
            }

            // Уход
            InfoCard(title = "Уход") {
                InfoRow("Полив каждые", crop.wateringFreqDays?.let { "$it дней" } ?: "—")
                InfoRow("Боится заморозков", if (crop.frostSensitive == true) "Да ❄️" else "Нет")
            }

            // Совместимость
            if (!crop.companionCrops.isNullOrBlank()) {
                InfoCard(title = "Хорошие соседи") {
                    Text(crop.companionCrops, style = MaterialTheme.typography.bodyMedium)
                }
            }

            // Заметки агронома
            if (!crop.notes.isNullOrBlank()) {
                InfoCard(title = "Советы") {
                    Text(crop.notes, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
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
        Text(label, style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
    }
    Spacer(Modifier.height(4.dp))
}
