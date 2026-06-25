package ru.dachakalend.app.ui.guide

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import ru.dachakalend.app.data.model.GuideCropLink
import ru.dachakalend.app.data.model.GuideEntryDetail
import ru.dachakalend.app.ui.theme.NunitoFamily

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GuideDetailScreen(
    slug: String,
    onBack: () -> Unit,
    onCropClick: (Int) -> Unit,
    viewModel: GuideViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsState()
    LaunchedEffect(slug) { viewModel.loadEntry(slug) }

    val entry = state.entry

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        entry?.name ?: "Справочник",
                        fontFamily = NunitoFamily,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onBackground
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Назад")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        when {
            state.detailLoading || (entry == null && state.detailError == null) ->
                Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                }
            entry == null ->
                Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    Text(
                        state.detailError ?: "Не найдено",
                        fontFamily = NunitoFamily,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            else -> DetailContent(entry, Modifier.padding(padding), onCropClick)
        }
    }
}

@Composable
private fun DetailContent(entry: GuideEntryDetail, modifier: Modifier, onCropClick: (Int) -> Unit) {
    val isDeficiency = entry.kind == "deficiency"
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Фото проблемы (если есть) + атрибуция лицензии
        entry.imageUrl?.let { url ->
            Column {
                AsyncImage(
                    model = url,
                    contentDescription = entry.name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp)
                        .clip(RoundedCornerShape(22.dp))
                )
                entry.imageCredit?.let { credit ->
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "Фото: $credit",
                        fontFamily = NunitoFamily,
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        // Бейджи: вид · элемент · сезон
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Badge(guideKindLabel(entry.kind),
                MaterialTheme.colorScheme.secondaryContainer, MaterialTheme.colorScheme.onSecondaryContainer,
                icon = guideKindIcon(entry.kind))
            entry.element?.let {
                Badge(it, MaterialTheme.colorScheme.primaryContainer, MaterialTheme.colorScheme.onPrimaryContainer)
            }
            entry.season?.let {
                Badge(it, MaterialTheme.colorScheme.tertiaryContainer, MaterialTheme.colorScheme.onTertiaryContainer)
            }
        }

        InfoCard {
            Block("Описание", entry.description)
            Block("Симптомы", entry.symptoms)
            Block(if (isDeficiency) "Причина" else "Условия", entry.conditions)
            Block(if (isDeficiency) "Коррекция" else "Лечение", entry.treatment, highlight = true)
            Block("Профилактика", entry.prevention)
        }

        if (entry.crops.isNotEmpty()) {
            Text(
                "Где встречается",
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.Black,
                fontSize = 18.sp,
                color = MaterialTheme.colorScheme.onBackground
            )
            entry.crops.forEach { CropLinkCard(it, onClick = { onCropClick(it.cropId) }) }
        }
    }
}

@Composable
private fun Badge(text: String, container: Color, content: Color, icon: ImageVector? = null) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        modifier = Modifier
            .background(container, RoundedCornerShape(50))
            .padding(horizontal = 12.dp, vertical = 6.dp)
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, tint = content, modifier = Modifier.size(14.dp))
        }
        Text(text, fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = content)
    }
}

@Composable
private fun InfoCard(content: @Composable ColumnScope.() -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp), content = content)
    }
}

@Composable
private fun Block(label: String, value: String?, highlight: Boolean = false) {
    if (value.isNullOrBlank()) return
    Column {
        Text(
            label.uppercase(),
            fontFamily = NunitoFamily,
            fontWeight = FontWeight.SemiBold,
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            value,
            fontFamily = NunitoFamily,
            fontSize = 14.sp,
            color = if (highlight) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onBackground
        )
    }
}

@Composable
private fun CropLinkCard(link: GuideCropLink, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(
                link.cropName,
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.Black,
                fontSize = 15.sp,
                color = MaterialTheme.colorScheme.onBackground
            )
            link.signs?.let {
                Spacer(Modifier.height(2.dp))
                Text(it, fontFamily = NunitoFamily, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
