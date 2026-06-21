package ru.dachakalend.app.ui.feed

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import ru.dachakalend.app.data.api.mediaUrl
import ru.dachakalend.app.ui.theme.NunitoFamily

private val RU_MONTHS = listOf(
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
)

/** "2026-06" → "Июнь 2026". На входе ключ даты вида takenAt.take(7). */
fun monthYearLabel(monthKey: String): String = runCatching {
    val (y, m) = monthKey.split("-")
    "${RU_MONTHS[m.toInt() - 1]} $y"
}.getOrDefault(monthKey)

/** Заголовок-разделитель месяца в ленте. */
@Composable
fun FeedMonthHeader(monthKey: String, modifier: Modifier = Modifier) {
    Text(
        text = monthYearLabel(monthKey),
        fontFamily = NunitoFamily,
        fontWeight = FontWeight.Black,
        fontSize = 13.sp,
        color = MaterialTheme.colorScheme.primary,
        modifier = modifier.padding(top = 8.dp, bottom = 2.dp)
    )
}

/**
 * Строка фото в ленте: миниатюра + дата, привязанное действие и подпись.
 * Дату форматирует вызывающая сторона (передаёт готовую строку) — компонент не знает про формат ISO.
 */
@Composable
fun PhotoFeedRow(
    thumbUrl: String?,
    dateLabel: String,
    actionLabel: String?,
    caption: String?,
    onOpen: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onOpen)
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        AsyncImage(
            model = mediaUrl(thumbUrl.orEmpty()),
            contentDescription = "Фото посадки",
            contentScale = ContentScale.Crop,
            modifier = Modifier.size(72.dp).clip(RoundedCornerShape(12.dp))
        )
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(dateLabel, fontFamily = NunitoFamily, fontWeight = FontWeight.Bold,
                fontSize = 14.sp, color = MaterialTheme.colorScheme.onBackground)
            actionLabel?.let {
                Text(it, fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold,
                    fontSize = 12.sp, color = MaterialTheme.colorScheme.primary)
            }
            caption?.takeIf { it.isNotBlank() }?.let {
                Text(it, fontFamily = NunitoFamily, fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

/**
 * Карточка-веха сезона в ленте (только глобальная лента «Мой участок»).
 * kind: sowing | transplanted | first_harvest | done.
 */
@Composable
fun MilestoneFeedRow(
    kind: String,
    cropName: String?,
    weightKg: Double?,
    dateLabel: String,
    onOpen: () -> Unit,
) {
    val crop = cropName ?: "культура"
    val text = when (kind) {
        "sowing"        -> "🌱 Посев — $crop"
        "transplanted"  -> "🌿 Высажено в грунт — $crop"
        "first_harvest" -> {
            val kg = weightKg?.let { w ->
                val s = "%.1f".format(w).removeSuffix(",0").removeSuffix(".0")
                " · $s кг"
            } ?: ""
            "🌾 Первый урожай — $crop$kg"
        }
        "done"          -> "🏆 Сезон завершён — $crop"
        else            -> crop
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onOpen)
            .background(MaterialTheme.colorScheme.primary.copy(alpha = .07f))
            .padding(horizontal = 12.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(text, fontFamily = NunitoFamily, fontWeight = FontWeight.Bold,
                fontSize = 13.sp, color = MaterialTheme.colorScheme.onBackground)
            Text(dateLabel, fontFamily = NunitoFamily, fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
