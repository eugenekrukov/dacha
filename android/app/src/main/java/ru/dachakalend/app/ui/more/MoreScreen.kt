package ru.dachakalend.app.ui.more

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.filled.HealthAndSafety
import androidx.compose.material.icons.filled.Computer
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.dachakalend.app.ui.theme.NunitoFamily

/**
 * Таб «Ещё» — редкие разделы: справочник (культуры / болезни) + настройки.
 * Зеркалит меню «Ещё» веб-версии; появился как 5-й пункт нижней навигации после того,
 * как «Справочник» убрали из «Профиля».
 */
@Composable
fun MoreScreen(
    onOpenSeeds: () -> Unit,
    onOpenCrops: () -> Unit,
    onOpenGuide: () -> Unit,
    onOpenSettings: () -> Unit,
) {
    val context = LocalContext.current
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .verticalScroll(rememberScrollState())
    ) {
        Text(
            "Ещё",
            fontFamily = NunitoFamily, fontWeight = FontWeight.Black, fontSize = 26.sp,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp)
        )
        Column(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            MoreCard(Icons.Default.Inventory2, "Мои семена", "Что уже куплено и у чего вышел срок", onOpenSeeds)
            MoreCard(Icons.AutoMirrored.Filled.MenuBook, "Справочник культур", "Сроки, полив, болезни, соседство", onOpenCrops)
            MoreCard(Icons.Default.HealthAndSafety, "Болезни и дефициты", "Дефициты микроэлементов, болезни, вредители", onOpenGuide)
            MoreCard(Icons.Default.Settings, "Настройки", "Подписка, уведомления, внешний вид", onOpenSettings)
            // Веб-версия — то, о чём иначе не узнают: в магазине она заявлена как преимущество,
            // а в самом приложении ссылки на неё не было вовсе (замечание владельца 2026-07-30).
            // Открываем в браузере: на телефоне это подтверждает, что вход тот же, а планировать
            // сезон человек потом пойдёт с компьютера.
            MoreCard(
                Icons.Default.Computer,
                "Веб-версия",
                "Тот же аккаунт в браузере — удобно планировать с компьютера"
            ) {
                context.startActivity(
                    android.content.Intent(
                        android.content.Intent.ACTION_VIEW,
                        android.net.Uri.parse("https://dacha.studio1008.com/app/")
                    )
                )
            }
        }
    }
}

@Composable
private fun MoreCard(icon: ImageVector, title: String, subtitle: String, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(24.dp), tint = MaterialTheme.colorScheme.primary)
            Spacer(Modifier.width(14.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(title, fontFamily = NunitoFamily, fontWeight = FontWeight.Black, fontSize = 16.sp,
                    color = MaterialTheme.colorScheme.onBackground)
                Text(subtitle, fontFamily = NunitoFamily, fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
