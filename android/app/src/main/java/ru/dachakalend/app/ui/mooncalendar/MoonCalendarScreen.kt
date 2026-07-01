package ru.dachakalend.app.ui.mooncalendar

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.RemoveCircleOutline
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.dachakalend.app.data.model.MoonDay
import ru.dachakalend.app.ui.theme.NunitoFamily
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.TextStyle
import java.util.Locale

private val DAY_HEADERS = listOf("Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс")
private val FavorableGreen = Color(0xFF2E7D32)
private val UnfavorableGray = Color(0xFFC7CDD8)

// «🌕 Полнолуние» → «Полнолуние»: своя иконка диска рисуется рядом, эмодзи дублировал бы её.
private fun stripEmoji(label: String) = label.substringAfter(' ')

@Composable
fun MoonCalendarScreen(onBack: () -> Unit, viewModel: MoonCalendarViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsState()
    val selectedDay = state.days.find { it.date == state.selectedDate }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) {
                    Icon(Icons.Default.ArrowBack, contentDescription = "Назад", tint = MaterialTheme.colorScheme.onBackground)
                }
                Text(
                    "Лунный календарь",
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.Black,
                    fontSize = 22.sp,
                    color = MaterialTheme.colorScheme.onBackground
                )
            }
        }

        selectedDay?.let { day ->
            item { DayInfoCard(day) }
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
                    MoonMonthGrid(
                        month = state.currentMonth,
                        days = state.days,
                        selectedDate = state.selectedDate,
                        onDayClick = { viewModel.selectDay(it.date) }
                    )
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
private fun DayInfoCard(day: MoonDay) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            MoonIcon(phaseFraction = day.phaseFraction, size = 56.dp)
            Column {
                val date = runCatching { LocalDate.parse(day.date) }.getOrNull()
                val weekday = date?.dayOfWeek?.getDisplayName(TextStyle.FULL_STANDALONE, Locale("ru"))
                    ?.replaceFirstChar { it.uppercase() }
                val month = date?.month?.getDisplayName(TextStyle.FULL_STANDALONE, Locale("ru"))
                Text(
                    "$weekday, ${date?.dayOfMonth} $month",
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 13.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    stripEmoji(day.phaseLabel),
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.Black,
                    fontSize = 18.sp,
                    color = MaterialTheme.colorScheme.onBackground
                )
                if (day.label != null) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Icon(
                            Icons.Default.RemoveCircleOutline,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(14.dp)
                        )
                        Text(
                            "Не сажать",
                            fontFamily = NunitoFamily,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
    Text(
        day.message,
        fontFamily = NunitoFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 13.sp,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(top = 6.dp)
    )
}

@Composable
private fun MonthNavigator(month: YearMonth, onPrev: () -> Unit, onNext: () -> Unit) {
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
private fun MoonMonthGrid(
    month: YearMonth,
    days: List<MoonDay>,
    selectedDate: String,
    onDayClick: (MoonDay) -> Unit
) {
    val today = LocalDate.now().toString()
    val byDate = days.associateBy { it.date }
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
                        val day = byDate[date.toString()]
                        MoonDayCell(
                            dayNumber = dayNumber,
                            day = day,
                            isToday = date.toString() == today,
                            isSelected = date.toString() == selectedDate,
                            onClick = { day?.let(onDayClick) },
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun MoonDayCell(
    dayNumber: Int,
    day: MoonDay?,
    isToday: Boolean,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val bgColor = if (isToday && !isSelected) MaterialTheme.colorScheme.primaryContainer else Color.Transparent

    Column(
        modifier = modifier
            .padding(2.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(bgColor)
            .then(
                if (isSelected) Modifier.border(2.dp, MaterialTheme.colorScheme.primary, RoundedCornerShape(12.dp))
                else Modifier
            )
            .clickable(onClick = onClick)
            .padding(vertical = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp)
    ) {
        Text(
            text = dayNumber.toString(),
            fontFamily = NunitoFamily,
            fontWeight = FontWeight.Bold,
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        if (day != null) {
            MoonIcon(phaseFraction = day.phaseFraction, size = 22.dp)
            Box(
                modifier = Modifier
                    .size(4.dp)
                    .clip(CircleShape)
                    .background(if (day.favorable) FavorableGreen else UnfavorableGray)
            )
        } else {
            Spacer(Modifier.size(22.dp))
        }
    }
}
