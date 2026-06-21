package ru.dachakalend.app.ui.crops

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import coil.compose.AsyncImage
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AcUnit
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Eco
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.dachakalend.app.data.model.Crop
import ru.dachakalend.app.ui.theme.NunitoFamily

@Composable
fun CropsScreen(
    onCropClick: (Crop) -> Unit,
    onBack: (() -> Unit)? = null,
    viewModel: CropsViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.background)
                .padding(horizontal = 4.dp, vertical = 16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (onBack != null) {
                IconButton(onClick = onBack) {
                    Icon(
                        Icons.Default.ArrowBack,
                        contentDescription = "Назад",
                        tint = MaterialTheme.colorScheme.onBackground
                    )
                }
            } else {
                Spacer(Modifier.width(12.dp))
            }
            Text(
                "Культуры",
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.Black,
                fontSize = 28.sp,
                color = MaterialTheme.colorScheme.onBackground
            )
        }

        // Поле поиска
        OutlinedTextField(
            value = state.searchQuery,
            onValueChange = { viewModel.setSearchQuery(it) },
            placeholder = { Text("Поиск культуры...", fontFamily = NunitoFamily) },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
            trailingIcon = {
                if (state.searchQuery.isNotEmpty()) {
                    IconButton(onClick = { viewModel.setSearchQuery("") }) {
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

        // Фильтр по категории
        if (state.searchQuery.isBlank()) {
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(CROP_CATEGORIES) { (key, label) ->
                    FilterChip(
                        selected = state.selectedCategory == key,
                        onClick = { viewModel.loadCrops(key) },
                        shape = RoundedCornerShape(100.dp),
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = MaterialTheme.colorScheme.primary,
                            selectedLabelColor = Color.White
                        ),
                        label = {
                            Text(
                                label,
                                fontFamily = NunitoFamily,
                                fontWeight = FontWeight.Bold,
                                softWrap = false
                            )
                        }
                    )
                }
            }
        }

        when {
            state.isLoading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
            }
            state.error != null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        "Ошибка загрузки",
                        fontFamily = NunitoFamily,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onBackground
                    )
                    Spacer(Modifier.height(8.dp))
                    Button(
                        onClick = { viewModel.loadCrops() },
                        shape = RoundedCornerShape(16.dp)
                    ) {
                        Text("Повторить", fontFamily = NunitoFamily, fontWeight = FontWeight.Black)
                    }
                }
            }
            state.filteredCrops.isEmpty() -> Box(
                Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("🌿", fontSize = 40.sp)
                    Spacer(Modifier.height(8.dp))
                    Text(
                        if (state.searchQuery.isNotBlank()) "Ничего не найдено по \"${state.searchQuery}\""
                        else "Культуры не найдены",
                        fontFamily = NunitoFamily,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            else -> {
                val annuals = state.filteredCrops.filter { it.isPerennial != true }
                val perennials = state.filteredCrops.filter { it.isPerennial == true }
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (annuals.isNotEmpty() && perennials.isNotEmpty()) {
                        item(key = "h_annual") { SectionHeader("Однолетние") }
                    }
                    items(annuals, key = { it.id }) { crop ->
                        CropCard(crop = crop, onClick = { onCropClick(crop) })
                    }
                    if (perennials.isNotEmpty()) {
                        item(key = "h_perennial") { SectionHeader("Многолетние", "не нужно сажать каждый год") }
                    }
                    items(perennials, key = { it.id }) { crop ->
                        CropCard(crop = crop, onClick = { onCropClick(crop) })
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionHeader(title: String, subtitle: String? = null) {
    Row(
        modifier = Modifier.padding(top = 8.dp, bottom = 2.dp),
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(
            title,
            fontFamily = NunitoFamily,
            fontWeight = FontWeight.Black,
            fontSize = 18.sp,
            color = MaterialTheme.colorScheme.onBackground
        )
        if (subtitle != null) {
            Text(
                subtitle,
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.SemiBold,
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun CropCard(crop: Crop, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Фото культуры (F4) — если есть; иначе обобщённая иконка.
            if (crop.imageUrl != null) {
                AsyncImage(
                    model = crop.imageUrl,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.size(48.dp).clip(RoundedCornerShape(12.dp))
                )
            } else {
                Icon(
                    imageVector = Icons.Default.Eco,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(40.dp)
                )
            }
            Spacer(Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    crop.name,
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.Black,
                    fontSize = 15.sp,
                    color = MaterialTheme.colorScheme.onBackground
                )
                Spacer(Modifier.height(2.dp))
                crop.harvestDays?.let {
                    Text(
                        "Урожай через ~$it дней",
                        fontFamily = NunitoFamily,
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                if (crop.frostSensitive == true) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Icon(Icons.Default.AcUnit, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(13.dp))
                        Text(
                            "Боится заморозков",
                            fontFamily = NunitoFamily,
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.error
                        )
                    }
                }
                if (crop.isPerennial == true) {
                    Text(
                        "🌿 Многолетник",
                        fontFamily = NunitoFamily,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.tertiary
                    )
                }
            }
        }
    }
}

