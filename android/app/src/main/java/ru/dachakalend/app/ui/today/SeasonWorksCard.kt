package ru.dachakalend.app.ui.today

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.EventNote
import androidx.compose.material.icons.filled.ContentCut
import androidx.compose.material.icons.filled.Eco
import androidx.compose.material.icons.filled.Grass
import androidx.compose.material.icons.filled.Handyman
import androidx.compose.material.icons.filled.ShoppingBasket
import androidx.compose.material.icons.filled.Spa
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.dachakalend.app.data.model.SeasonWork
import ru.dachakalend.app.data.model.SeasonWorksResponse
import ru.dachakalend.app.ui.theme.NunitoFamily

private const val COLLAPSED_COUNT = 3

private fun categoryIcon(category: String): ImageVector = when (category) {
    "plan"    -> Icons.AutoMirrored.Filled.EventNote
    "prep"    -> Icons.Default.Handyman
    "sow"     -> Icons.Default.Grass
    "plant"   -> Icons.Default.Spa
    "prune"   -> Icons.Default.ContentCut
    "harvest" -> Icons.Default.ShoppingBasket
    else      -> Icons.Default.Eco
}

/**
 * «На этой неделе · регион» (стратегия 2.3): сезонные работы по фактическому сезону участка.
 * Нужен в межсезонье, когда задач по посадкам нет. Одним элементом LazyColumn — чтобы не сдвигать
 * индексы coach-marks больше чем на единицу.
 */
@Composable
fun SeasonWorksCard(
    works: SeasonWorksResponse,
    onHide: (SeasonWork) -> Unit,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }
    var openedId by remember { mutableStateOf<String?>(null) }
    val context = LocalContext.current
    val visible = if (expanded) works.items else works.items.take(COLLAPSED_COUNT)

    Card(
        modifier = modifier.fillMaxWidth().animateContentSize(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(Modifier.padding(horizontal = 16.dp, vertical = 14.dp)) {
            Text(
                text = "На этой неделе" + (works.region?.let { " · $it" } ?: ""),
                fontFamily = NunitoFamily, fontWeight = FontWeight.Black, fontSize = 16.sp,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1, overflow = TextOverflow.Ellipsis
            )
            Spacer(Modifier.height(4.dp))
            visible.forEachIndexed { i, work ->
                if (i > 0) HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = .5f))
                SeasonWorkRow(
                    work = work,
                    opened = openedId == work.id,
                    onToggle = { openedId = if (openedId == work.id) null else work.id },
                    onHide = { onHide(work) },
                    onOpenLink = { url -> context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
                )
            }
            if (works.items.size > COLLAPSED_COUNT) {
                TextButton(onClick = { expanded = !expanded }, modifier = Modifier.fillMaxWidth()) {
                    Text(
                        if (expanded) "Свернуть" else "Показать ещё (${works.items.size - COLLAPSED_COUNT})",
                        fontFamily = NunitoFamily, fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }
        }
    }
}

@Composable
private fun SeasonWorkRow(
    work: SeasonWork,
    opened: Boolean,
    onToggle: () -> Unit,
    onHide: () -> Unit,
    onOpenLink: (String) -> Unit
) {
    Column(Modifier.fillMaxWidth().clickable(onClick = onToggle).padding(vertical = 10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(categoryIcon(work.category), contentDescription = null,
                tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(12.dp))
            Text(
                work.title, modifier = Modifier.weight(1f),
                fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, fontSize = 15.sp,
                color = MaterialTheme.colorScheme.onSurface
            )
            if (work.inGarden) {
                Spacer(Modifier.width(8.dp))
                Surface(shape = RoundedCornerShape(8.dp), color = MaterialTheme.colorScheme.primaryContainer) {
                    Text(
                        "у вас есть", modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                        fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onPrimaryContainer, softWrap = false
                    )
                }
            }
        }
        if (opened) {
            Text(
                work.details, modifier = Modifier.padding(start = 32.dp, top = 6.dp),
                fontFamily = NunitoFamily, fontSize = 14.sp, lineHeight = 20.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Row(Modifier.padding(start = 20.dp), verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = onHide) {
                    Text("Сделано", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold)
                }
                TextButton(onClick = onHide) {
                    Text("Не актуально", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                work.link?.let { url ->
                    TextButton(onClick = { onOpenLink(url) }) {
                        Text("Справочник →", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

/**
 * Гость записал 3-е действие — один раз предлагаем сохранить данные регистрацией (спека 2.1).
 * Показывается на «Сегодня», когда закрыта шторка записи действия: шторка поверх шторки
 * выглядела бы как наказание за запись. Любое закрытие = больше не показываем.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GuestNudgeSheet(onRegister: () -> Unit, onDismiss: () -> Unit) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = MaterialTheme.colorScheme.surface
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .navigationBarsPadding()
                .padding(bottom = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                "Сохраните свои записи",
                fontFamily = NunitoFamily, fontWeight = FontWeight.Black, fontSize = 20.sp,
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                "Вы пользуетесь приложением без регистрации. Создайте аккаунт — посадки и журнал " +
                    "не потеряются при смене телефона, и откроется веб-версия.",
                fontFamily = NunitoFamily, fontSize = 15.sp, lineHeight = 21.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Button(
                onClick = { onDismiss(); onRegister() },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("Создать аккаунт", fontFamily = NunitoFamily, fontWeight = FontWeight.Black,
                    maxLines = 1, softWrap = false)
            }
            TextButton(onClick = onDismiss, modifier = Modifier.fillMaxWidth()) {
                Text("Позже", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
