package ru.dachakalend.app.ui.guide

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.dachakalend.app.data.model.GuideEntry
import ru.dachakalend.app.ui.theme.NunitoFamily

// Список записей справочника, сгруппированный по kind (дефициты → болезни → вредители) —
// вынесено из GuideScreen.kt, чтобы переиспользовать в ReferenceScreen (см. spec §5 Android).
fun LazyListScope.guideListBody(entries: List<GuideEntry>, onEntryClick: (String) -> Unit) {
    listOf("deficiency", "disease", "pest").forEach { kind ->
        val group = entries.filter { it.kind == kind }
        if (group.isNotEmpty()) {
            item(key = "h_$kind") {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.padding(top = 8.dp, bottom = 2.dp)
                ) {
                    Icon(guideKindIcon(kind), contentDescription = null,
                        tint = MaterialTheme.colorScheme.onBackground, modifier = Modifier.size(18.dp))
                    Text(
                        GUIDE_KINDS.first { it.first == kind }.second,
                        fontFamily = NunitoFamily,
                        fontWeight = FontWeight.Black,
                        fontSize = 18.sp,
                        color = MaterialTheme.colorScheme.onBackground
                    )
                }
            }
            items(group, key = { it.id }) { entry ->
                GuideCard(entry = entry, onClick = { onEntryClick(entry.slug) })
            }
        }
    }
}

@Composable
private fun DangerBadge(danger: Int?) {
    if (danger == null || danger < 2) return
    val high = danger >= 3
    val container = if (high) MaterialTheme.colorScheme.errorContainer else MaterialTheme.colorScheme.tertiaryContainer
    val content = if (high) MaterialTheme.colorScheme.onErrorContainer else MaterialTheme.colorScheme.onTertiaryContainer
    Box(
        modifier = Modifier
            .background(container, RoundedCornerShape(50))
            .padding(horizontal = 10.dp, vertical = 4.dp)
    ) {
        Text(
            if (high) "опасно" else "осторожно",
            fontFamily = NunitoFamily,
            fontWeight = FontWeight.Bold,
            fontSize = 11.sp,
            color = content
        )
    }
}

@Composable
private fun GuideCard(entry: GuideEntry, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    entry.name,
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.Black,
                    fontSize = 15.sp,
                    color = MaterialTheme.colorScheme.onBackground,
                    modifier = Modifier.weight(1f)
                )
                DangerBadge(entry.danger)
            }
            entry.symptoms?.let {
                Spacer(Modifier.height(4.dp))
                Text(
                    it,
                    fontFamily = NunitoFamily,
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}
