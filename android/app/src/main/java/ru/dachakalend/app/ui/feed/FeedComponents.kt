package ru.dachakalend.app.ui.feed

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.DeleteSweep
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.Spa
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
import ru.dachakalend.app.ui.actions.actionIcon
import ru.dachakalend.app.ui.common.rememberPhotoPickers
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

/** Одна миниатюра в ряду фото записи: эскиз + обработчик открытия. */
data class FeedThumb(val thumbUrl: String?, val onOpen: () -> Unit)

/**
 * Единая карточка записи «действие + заметка + прикреплённые фото» — общий компонент
 * для глобальной ленты «Мой участок» и журнала на экране посадки.
 * Иконку и метку действия даёт вызывающая сторона (единый источник ACTION_TYPES/actionIcon).
 * Тап по миниатюре открывает конкретное фото; карточка без фото — информационная строка.
 */
@Composable
fun ActionFeedCard(
    actionType: String,
    actionLabel: String,
    note: String?,
    dateLabel: String,
    thumbs: List<FeedThumb>,
    cropName: String? = null,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .padding(vertical = 4.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(actionIcon(actionType), contentDescription = null,
                modifier = Modifier.size(20.dp), tint = MaterialTheme.colorScheme.primary)
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                val title = actionLabel + (cropName?.takeIf { it.isNotBlank() }?.let { " — $it" } ?: "")
                Text(title, fontFamily = NunitoFamily, fontWeight = FontWeight.Bold,
                    fontSize = 14.sp, color = MaterialTheme.colorScheme.onBackground)
                note?.takeIf { it.isNotBlank() }?.let {
                    Text(it, fontFamily = NunitoFamily, fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Text(dateLabel, fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold,
                fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        if (thumbs.isNotEmpty()) {
            Row(
                modifier = Modifier.padding(start = 30.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                thumbs.forEach { t ->
                    AsyncImage(
                        model = mediaUrl(t.thumbUrl.orEmpty()),
                        contentDescription = "Фото записи",
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.size(64.dp).clip(RoundedCornerShape(10.dp)).clickable(onClick = t.onOpen)
                    )
                }
            }
        }
    }
}

/**
 * Строка фото в ленте: миниатюра + дата, привязанное действие и подпись.
 * Дату форматирует вызывающая сторона (передаёт готовую строку) — компонент не знает про формат ISO.
 */
@Composable
fun PhotoFeedRow(
    thumbUrl: String?,
    dateLabel: String,
    caption: String?,
    onOpen: () -> Unit,
    cropName: String? = null,
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
            cropName?.takeIf { it.isNotBlank() }?.let {
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
 * Панель действий над фото в полноэкранном просмотре (дневник и лента):
 * «Заменить» (камера/галерея → [onReplaceBytes]), «Удалить фото» ([onDeletePhoto]) и —
 * если фото привязано к действию — «Удалить запись» (действие + фото, с подтверждением).
 */
@Composable
fun PhotoActionsBar(
    hasAction: Boolean,
    onReplaceBytes: (ByteArray) -> Unit,
    onDeletePhoto: () -> Unit,
    onDeleteRecord: () -> Unit,
) {
    val pickers = rememberPhotoPickers(onBytes = onReplaceBytes)
    var sourceMenu by remember { mutableStateOf(false) }
    var confirmRecord by remember { mutableStateOf(false) }

    Row(verticalAlignment = Alignment.CenterVertically) {
        Box {
            IconButton(onClick = { sourceMenu = true }) {
                Icon(Icons.Default.SwapHoriz, contentDescription = "Заменить", tint = Color.White)
            }
            DropdownMenu(expanded = sourceMenu, onDismissRequest = { sourceMenu = false }) {
                DropdownMenuItem(
                    text = { Text("Сделать фото", fontFamily = NunitoFamily) },
                    onClick = { sourceMenu = false; pickers.camera() }
                )
                DropdownMenuItem(
                    text = { Text("Из галереи", fontFamily = NunitoFamily) },
                    onClick = { sourceMenu = false; pickers.gallery() }
                )
            }
        }
        IconButton(onClick = onDeletePhoto) {
            Icon(Icons.Default.Delete, contentDescription = "Удалить фото", tint = Color.White)
        }
        if (hasAction) {
            IconButton(onClick = { confirmRecord = true }) {
                Icon(Icons.Default.DeleteSweep, contentDescription = "Удалить запись", tint = Color(0xFFEF5350))
            }
        }
    }

    if (confirmRecord) {
        AlertDialog(
            onDismissRequest = { confirmRecord = false },
            title = { Text("Удалить запись?", fontFamily = NunitoFamily, fontWeight = FontWeight.Black) },
            text = {
                Text("Действие и прикреплённое фото будут удалены без возможности восстановления.",
                    fontFamily = NunitoFamily)
            },
            confirmButton = {
                TextButton(onClick = { confirmRecord = false; onDeleteRecord() }) {
                    Text("Удалить", color = MaterialTheme.colorScheme.error,
                        fontFamily = NunitoFamily, fontWeight = FontWeight.Black)
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmRecord = false }) {
                    Text("Отмена", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold)
                }
            }
        )
    }
}

/**
 * Карточка-веха сезона в ленте (только глобальная лента «Мой участок»).
 * kind: sowing | first_harvest | done (высадка — обычное действие, не веха).
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
    val icon: ImageVector
    val text = when (kind) {
        "sowing"        -> { icon = Icons.Default.Spa; "Посев — $crop" }
        "first_harvest" -> {
            icon = Icons.Default.EmojiEvents
            val kg = weightKg?.let { w ->
                val s = "%.1f".format(w).removeSuffix(",0").removeSuffix(".0")
                " · $s кг"
            } ?: ""
            "Первый урожай — $crop$kg"
        }
        "done"          -> { icon = Icons.Default.Flag; "Сезон завершён — $crop" }
        else            -> { icon = Icons.Default.Spa; crop }
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
        Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(18.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(text, fontFamily = NunitoFamily, fontWeight = FontWeight.Bold,
                fontSize = 13.sp, color = MaterialTheme.colorScheme.onBackground)
            Text(dateLabel, fontFamily = NunitoFamily, fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
