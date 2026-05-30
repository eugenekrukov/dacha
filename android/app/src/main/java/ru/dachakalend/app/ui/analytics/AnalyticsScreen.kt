package ru.dachakalend.app.ui.analytics

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.dachakalend.app.data.model.ActivityDay
import ru.dachakalend.app.data.model.AnalyticsSummary

@Composable
fun AnalyticsScreen(viewModel: AnalyticsViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current

    // Запуск Share-интента
    LaunchedEffect(state.shareIntent) {
        state.shareIntent?.let {
            context.startActivity(it)
            viewModel.clearShareIntent()
        }
    }

    val snackbarHostState = remember { SnackbarHostState() }
    LaunchedEffect(state.error) {
        state.error?.let { snackbarHostState.showSnackbar(it) }
    }

    Scaffold(snackbarHost = { SnackbarHost(snackbarHostState) }) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            when {
                state.isLoading -> CircularProgressIndicator(Modifier.align(Alignment.Center))
                state.summary != null -> AnalyticsContent(
                    summary = state.summary!!,
                    isExporting = state.isExporting,
                    onExport = { viewModel.exportActions() }
                )
            }
        }
    }
}

@Composable
private fun AnalyticsContent(
    summary: AnalyticsSummary,
    isExporting: Boolean,
    onExport: () -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Итоговые метрики
        item {
            Text("Моя статистика", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                StatCard(
                    modifier = Modifier.weight(1f),
                    label = "Серия дней",
                    value = "🔥 ${summary.streak}"
                )
                StatCard(
                    modifier = Modifier.weight(1f),
                    label = "Действий",
                    value = "${summary.totalActions}"
                )
                StatCard(
                    modifier = Modifier.weight(1f),
                    label = "Сборов",
                    value = "${summary.totalHarvests}"
                )
            }
        }

        // Онбординг-прогресс
        item {
            OnboardingCard(summary)
        }

        // График активности
        if (summary.activityByDay.isNotEmpty()) {
            item {
                Text("Активность за 30 дней", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            }
            item {
                ActivityChart(days = summary.activityByDay)
            }
        }

        // Экспорт
        item {
            Button(
                onClick = onExport,
                enabled = !isExporting,
                modifier = Modifier.fillMaxWidth()
            ) {
                if (isExporting) {
                    CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp, color = Color.White)
                    Spacer(Modifier.width(8.dp))
                }
                Icon(Icons.Default.Share, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text("Экспорт истории действий (CSV)")
            }
        }
    }
}

@Composable
private fun StatCard(modifier: Modifier = Modifier, label: String, value: String) {
    Card(modifier = modifier) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(value, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(4.dp))
            Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun OnboardingCard(summary: AnalyticsSummary) {
    val steps = listOf(
        "Участок создан" to summary.onboarding.garden,
        "Первая посадка" to summary.onboarding.planting,
        "Первое действие" to summary.onboarding.action,
        "Первый урожай" to summary.onboarding.harvest
    )
    val done = steps.count { it.second }
    val total = steps.size

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                "Прогресс ($done/$total)",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
            LinearProgressIndicator(
                progress = { done.toFloat() / total },
                modifier = Modifier.fillMaxWidth()
            )
            steps.forEach { (label, completed) ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        if (completed) "✅" else "⬜",
                        fontSize = 16.sp,
                        modifier = Modifier.width(28.dp)
                    )
                    Text(label, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
    }
}

@Composable
private fun ActivityChart(days: List<ActivityDay>) {
    val maxCount = days.maxOf { it.count }.coerceAtLeast(1)
    val barColor = MaterialTheme.colorScheme.primary

    Card(modifier = Modifier.fillMaxWidth()) {
        LazyRow(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 16.dp)
                .height(80.dp),
            horizontalArrangement = Arrangement.spacedBy(3.dp),
            verticalAlignment = Alignment.Bottom
        ) {
            items(days) { day ->
                val fraction = day.count.toFloat() / maxCount
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Bottom,
                    modifier = Modifier.width(14.dp).height(80.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .width(10.dp)
                            .height((fraction * 60).dp.coerceAtLeast(4.dp))
                            .clip(RoundedCornerShape(topStart = 3.dp, topEnd = 3.dp))
                            .background(barColor.copy(alpha = 0.7f + fraction * 0.3f))
                    )
                }
            }
        }
    }
}
