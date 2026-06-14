package ru.dachakalend.app.ui.guide

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.dachakalend.app.data.model.GuideEntry
import ru.dachakalend.app.ui.theme.NunitoFamily

@Composable
fun GuideScreen(
    cropId: Int = -1,
    cropName: String? = null,
    onEntryClick: (String) -> Unit,
    onBack: (() -> Unit)? = null,
    onClearCrop: () -> Unit = {},
    viewModel: GuideViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(cropId) {
        viewModel.load(cropId = if (cropId > 0) cropId else null)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 4.dp, vertical = 16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (onBack != null) {
                IconButton(onClick = onBack) {
                    Icon(Icons.Default.ArrowBack, contentDescription = "Назад", tint = MaterialTheme.colorScheme.onBackground)
                }
            } else {
                Spacer(Modifier.width(12.dp))
            }
            Text(
                "Справочник проблем",
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.Black,
                fontSize = 26.sp,
                color = MaterialTheme.colorScheme.onBackground
            )
        }

        if (cropId > 0) {
            FilterChip(
                selected = true,
                onClick = onClearCrop,
                modifier = Modifier.padding(horizontal = 16.dp),
                shape = RoundedCornerShape(100.dp),
                label = {
                    Text(
                        "Культура: ${cropName ?: "#$cropId"}",
                        fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, softWrap = false
                    )
                },
                trailingIcon = { Icon(Icons.Default.Close, contentDescription = "Сбросить фильтр", modifier = Modifier.size(16.dp)) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = MaterialTheme.colorScheme.primary,
                    selectedLabelColor = Color.White,
                    selectedTrailingIconColor = Color.White
                )
            )
        }

        OutlinedTextField(
            value = state.query,
            onValueChange = { viewModel.setQuery(it) },
            placeholder = { Text("Поиск: калий, фитофтороз…", fontFamily = NunitoFamily) },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
            trailingIcon = {
                if (state.query.isNotEmpty()) {
                    IconButton(onClick = { viewModel.setQuery("") }) {
                        Icon(Icons.Default.Clear, contentDescription = "Очистить")
                    }
                }
            },
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            singleLine = true,
            shape = RoundedCornerShape(12.dp),
            textStyle = LocalTextStyle.current.copy(fontFamily = NunitoFamily)
        )

        LazyRow(
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(GUIDE_KINDS) { (key, label) ->
                FilterChip(
                    selected = state.kind == key,
                    onClick = { viewModel.setKind(key) },
                    shape = RoundedCornerShape(100.dp),
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = MaterialTheme.colorScheme.primary,
                        selectedLabelColor = Color.White
                    ),
                    label = { Text(label, fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, softWrap = false) }
                )
            }
        }

        when {
            state.isLoading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
            }
            state.error != null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Ошибка загрузки", fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onBackground)
                    Spacer(Modifier.height(8.dp))
                    Button(onClick = { viewModel.load(if (cropId > 0) cropId else null) }, shape = RoundedCornerShape(16.dp)) {
                        Text("Повторить", fontFamily = NunitoFamily, fontWeight = FontWeight.Black)
                    }
                }
            }
            state.filtered.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("🍃", fontSize = 40.sp)
                    Spacer(Modifier.height(8.dp))
                    Text("Ничего не найдено", fontFamily = NunitoFamily, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            else -> {
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Группируем по виду в порядке: дефициты → болезни → вредители
                    listOf("deficiency", "disease", "pest").forEach { kind ->
                        val group = state.filtered.filter { it.kind == kind }
                        if (group.isNotEmpty()) {
                            item(key = "h_$kind") {
                                Text(
                                    "${guideKindIcon(kind)} ${GUIDE_KINDS.first { it.first == kind }.second}",
                                    fontFamily = NunitoFamily,
                                    fontWeight = FontWeight.Black,
                                    fontSize = 18.sp,
                                    color = MaterialTheme.colorScheme.onBackground,
                                    modifier = Modifier.padding(top = 8.dp, bottom = 2.dp)
                                )
                            }
                            items(group, key = { it.id }) { entry ->
                                GuideCard(entry = entry, onClick = { onEntryClick(entry.slug) })
                            }
                        }
                    }
                }
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
