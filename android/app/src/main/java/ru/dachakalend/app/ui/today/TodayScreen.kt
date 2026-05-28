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
import androidx.hilt.navigation.compose.hiltViewModel
import ru.dachakalend.app.data.model.TodayTask
import ru.dachakalend.app.data.model.WeatherSummary
import ru.dachakalend.app.ui.theme.taskColor

@Composable
fun TodayScreen(viewModel: TodayViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsState()

    when (val state = uiState) {
        is TodayUiState.Loading -> LoadingScreen()
        is TodayUiState.Error   -> ErrorScreen(state.message) { viewModel.loadToday() }
        is TodayUiState.Success -> TodayContent(state.data.weather, state.data.tasks) { viewModel.loadToday() }
    }
}

@Composable
private fun TodayContent(
    weather: WeatherSummary?,
    tasks: List<TodayTask>,
    onRefresh: () -> Unit
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text(
                text = "Сегодня",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 4.dp)
            )
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
                TaskCard(task)
            }
        } else {
            item {
                EmptyTasksCard()
            }
        }

        // Быстрые действия
        item {
            QuickActionsRow()
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
                        else "—",
                        style = MaterialTheme.typography.headlineLarge,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                    weather.condition?.let {
                        Text(
                            text = it,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }
                }
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
private fun TaskCard(task: TodayTask) {
    val color = taskColor(task.type)
    Card(
        modifier = Modifier.fillMaxWidth(),
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
        }
    }
}

@Composable
private fun QuickActionsRow() {
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
        listOf(
            Triple(Icons.Default.WaterDrop, "Полил", MaterialTheme.colorScheme.primary),
            Triple(Icons.Default.Spa, "Подкормил", Color(0xFF8D6E63)),
            Triple(Icons.Default.BugReport, "Обработал", Color(0xFFE53935))
        ).forEach { (icon, label, tint) ->
            @Composable
            fun QuickBtn() {
                OutlinedButton(
                    onClick = { /* TODO: Спринт 3 — ActionLog */ },
                    modifier = Modifier.weight(1f),
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 10.dp)
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(icon, contentDescription = label, tint = tint, modifier = Modifier.size(20.dp))
                        Spacer(Modifier.height(2.dp))
                        Text(label, fontSize = 12.sp)
                    }
                }
            }
            QuickBtn()
        }
    }
}

@Composable
private fun EmptyTasksCard() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(
            modifier = Modifier.padding(24.dp).fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text("🌱", fontSize = 32.sp)
            Spacer(Modifier.height(8.dp))
            Text(
                "Всё в порядке! Задач нет",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
            )
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
    else             -> Icons.Default.Notifications
}
