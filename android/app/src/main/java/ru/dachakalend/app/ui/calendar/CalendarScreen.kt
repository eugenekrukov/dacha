package ru.dachakalend.app.ui.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Spa
import androidx.compose.material.icons.filled.Grass
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.dachakalend.app.ui.theme.DachaColorScheme
import ru.dachakalend.app.ui.theme.NunitoFamily
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.TextStyle
import java.util.Locale

private val DAY_HEADERS = listOf("Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс")

@Composable
fun CalendarScreen(viewModel: CalendarViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsState()

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.background)
                    .padding(vertical = 8.dp)
            ) {
                Text(
                    "Календарь",
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.Black,
                    fontSize = 28.sp,
                    color = MaterialTheme.colorScheme.onBackground
                )
            }
        }

        item {
            MonthNavigator(
                month = state.currentMonth,
                onPrev = viewModel::previousMonth,
                onNext = viewModel::nextMonth
            )
        }

        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(22.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
            ) {
                Box(modifier = Modifier.padding(12.dp)) {
                    MonthGrid(
                        month = state.currentMonth,
                        eventsByDay = state.eventsByDay,
                        selectedDay = state.selectedDay,
                        onDayClick = viewModel::selectDay
                    )
                }
            }
        }

        // Список событий выбранного дня
        state.selectedDay?.let { day ->
            val events = state.eventsByDay[day] ?: emptyList()
            item {
                Text(
                    text = "${day.dayOfMonth} ${
                        day.month.getDisplayName(TextStyle.FULL_STANDALONE, Locale("ru"))
                    }",
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.Black,
                    fontSize = 16.sp,
                    color = MaterialTheme.colorScheme.onBackground,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
            if (events.isEmpty()) {
                item {
                    Text(
                        "Задач на этот день нет",
                        fontFamily = NunitoFamily,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            } else {
                items(events) { event ->
                    EventCard(event)
                }
            }
        }

        if (state.isLoading) {
            item {
                Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                }
            }
        }

        state.error?.let { error ->
            item {
                Text(error, fontFamily = NunitoFamily, color = MaterialTheme.colorScheme.error)
            }
        }
    }
}

@Composable
private fun MonthNavigator(
    month: YearMonth,
    onPrev: () -> Unit,
    onNext: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        IconButton(onClick = onPrev) {
            Icon(Icons.Default.ChevronLeft, contentDescription = "Предыдущий месяц", tint = MaterialTheme.colorScheme.primary)
        }
        Text(
            text = "${month.month.getDisplayName(TextStyle.FULL_STANDALONE, Locale("ru"))
                .replaceFirstChar { it.uppercase() }} ${month.year}",
            fontFamily = NunitoFamily,
            fontWeight = FontWeight.Black,
            fontSize = 16.sp,
            color = MaterialTheme.colorScheme.onBackground
        )
        IconButton(onClick = onNext) {
            Icon(Icons.Default.ChevronRight, contentDescription = "Следующий месяц", tint = MaterialTheme.colorScheme.primary)
        }
    }
}

@Composable
private fun MonthGrid(
    month: YearMonth,
    eventsByDay: Map<LocalDate, List<DayEvent>>,
    selectedDay: LocalDate?,
    onDayClick: (LocalDate) -> Unit
) {
    val today = LocalDate.now()
    val firstDayOfWeek = month.atDay(1).dayOfWeek.let {
        if (it == DayOfWeek.SUNDAY) 6 else it.value - 1
    }
    val daysInMonth = month.lengthOfMonth()
    val totalCells = firstDayOfWeek + daysInMonth
    val rows = (totalCells + 6) / 7

    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(modifier = Modifier.fillMaxWidth()) {
            DAY_HEADERS.forEach { header ->
                Text(
                    text = header,
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.Center,
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        repeat(rows) { row ->
            Row(modifier = Modifier.fillMaxWidth()) {
                repeat(7) { col ->
                    val cellIndex = row * 7 + col
                    val dayNumber = cellIndex - firstDayOfWeek + 1
                    if (dayNumber < 1 || dayNumber > daysInMonth) {
                        Spacer(Modifier.weight(1f))
                    } else {
                        val date = month.atDay(dayNumber)
                        val hasEvents = eventsByDay.containsKey(date)
                        val isToday = date == today
                        val isSelected = date == selectedDay
                        DayCell(
                            day = dayNumber,
                            isToday = isToday,
                            isSelected = isSelected,
                            hasEvents = hasEvents,
                            onClick = { onDayClick(date) },
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun DayCell(
    day: Int,
    isToday: Boolean,
    isSelected: Boolean,
    hasEvents: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val bgColor = when {
        isSelected -> MaterialTheme.colorScheme.primary
        isToday    -> MaterialTheme.colorScheme.primaryContainer
        else       -> Color.Transparent
    }
    val textColor = when {
        isSelected -> MaterialTheme.colorScheme.onPrimary
        else       -> MaterialTheme.colorScheme.onSurface
    }

    Box(
        modifier = modifier
            .aspectRatio(1f)
            .padding(2.dp)
            .clip(CircleShape)
            .background(bgColor)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = day.toString(),
                fontFamily = NunitoFamily,
                fontWeight = if (isToday || isSelected) FontWeight.ExtraBold else FontWeight.Bold,
                fontSize = 13.sp,
                color = textColor
            )
            if (hasEvents) {
                Box(
                    modifier = Modifier
                        .size(4.dp)
                        .clip(CircleShape)
                        .background(
                            if (isSelected) MaterialTheme.colorScheme.onPrimary
                            else DachaColorScheme.secondary
                        )
                )
            }
        }
    }
}

@Composable
private fun EventCard(event: DayEvent) {
    val (icon, color) = eventStyle(event.type)
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(color.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(18.dp))
            }
            Text(
                event.title,
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onBackground
            )
        }
    }
}

private fun eventStyle(type: String): Pair<ImageVector, Color> = when (type) {
    "harvest", "harvest_due"     -> Icons.Default.Spa to Color(0xFF4CAF50)
    "sowing"                     -> Icons.Default.Grass to Color(0xFF8D6E63)
    "watering", "watering_due"   -> Icons.Default.Notifications to Color(0xFF2196F3)
    "fertilizing", "fertilizing_due" -> Icons.Default.Spa to Color(0xFF9C27B0)
    "transplant_due"             -> Icons.Default.Grass to Color(0xFF795548)
    "frost_alert"                -> Icons.Default.Notifications to Color(0xFF00BCD4)
    else                         -> Icons.Default.Notifications to Color(0xFFFFB300)
}


