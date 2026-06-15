package ru.dachakalend.app.ui.guide

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.dachakalend.app.data.model.GuideEntry
import ru.dachakalend.app.ui.theme.NunitoFamily

// Список болезней ИЛИ вредителей культуры из Справочника (идентично карточке Справочника) —
// раскрывающиеся пункты + ссылка на отфильтрованный по культуре Справочник.
@Composable
fun ProblemList(
    entries: List<GuideEntry>,
    kind: String,
    emptyText: String,
    onOpenGuide: () -> Unit
) {
    val items = entries.filter { it.kind == kind }
    Column(
        modifier = Modifier.fillMaxWidth().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        if (items.isEmpty()) {
            Text(emptyText, fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(vertical = 16.dp))
        } else {
            items.forEach { ProblemCard(it) }
        }
        TextButton(onClick = onOpenGuide, modifier = Modifier.fillMaxWidth()) {
            Text("Все проблемы этой культуры в справочнике →",
                fontFamily = NunitoFamily, fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary)
        }
    }
}

@Composable
private fun ProblemCard(e: GuideEntry) {
    var expanded by remember { mutableStateOf(false) }
    val isDef = e.kind == "deficiency"
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp),
        onClick = { expanded = !expanded }
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("${guideKindIcon(e.kind)} ${e.name}",
                    fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold, fontSize = 15.sp,
                    color = MaterialTheme.colorScheme.onBackground, modifier = Modifier.weight(1f))
                Icon(if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                    contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (expanded) {
                Spacer(Modifier.height(8.dp))
                Row(label = "Признаки на этой культуре", value = e.signs, color = MaterialTheme.colorScheme.primary)
                // «Симптомы» скрываем, если дублируют «Признаки на этой культуре».
                if (e.symptoms?.trim() != (e.signs?.trim() ?: "")) {
                    Row(label = "Симптомы", value = e.symptoms)
                }
                Row(label = if (isDef) "Причина" else "Условия", value = e.conditions)
                Row(label = if (isDef) "Коррекция" else "Лечение", value = e.treatment, color = MaterialTheme.colorScheme.tertiary)
                Row(label = "Профилактика", value = e.prevention)
                e.season?.let { Row(label = "Период риска", value = it) }
            }
        }
    }
}

@Composable
private fun Row(label: String, value: String?, color: Color = MaterialTheme.colorScheme.onSurface) {
    if (value.isNullOrBlank()) return
    Column(modifier = Modifier.padding(bottom = 6.dp)) {
        Text(label.uppercase(), fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold,
            fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, fontFamily = NunitoFamily, fontSize = 14.sp, color = color)
    }
}
