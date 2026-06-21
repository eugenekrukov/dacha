package ru.dachakalend.app.ui.crops

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Spa
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import ru.dachakalend.app.data.model.Crop
import ru.dachakalend.app.ui.guide.GuideViewModel
import ru.dachakalend.app.ui.guide.ProblemList
import ru.dachakalend.app.ui.theme.NunitoFamily

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CropDetailScreen(
    crop: Crop,
    climateZone: String? = null,
    onBack: () -> Unit,
    onPlant: ((Crop) -> Unit)? = null,
    onOpenGuide: (() -> Unit)? = null,
    guideViewModel: GuideViewModel = hiltViewModel()
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    val tabs = listOf("Уход", "Болезни", "Вредители", "Соседи")

    val guideState by guideViewModel.uiState.collectAsState()
    LaunchedEffect(crop.id) { guideViewModel.load(cropId = crop.id) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text(crop.name, fontFamily = NunitoFamily, fontWeight = FontWeight.Black, color = MaterialTheme.colorScheme.onBackground) },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, contentDescription = "Назад") }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        },
        bottomBar = if (onPlant != null) ({
            Surface(shadowElevation = 8.dp, color = MaterialTheme.colorScheme.background) {
                Button(onClick = { onPlant(crop) }, modifier = Modifier.fillMaxWidth().padding(16.dp).height(52.dp), shape = RoundedCornerShape(16.dp)) {
                    Icon(Icons.Default.Spa, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Посадить", fontFamily = NunitoFamily, fontWeight = FontWeight.Black, softWrap = false)
                }
            }
        }) else ({}),
    ) { padding ->
        Column(modifier = Modifier.padding(padding)) {
            ScrollableTabRow(selectedTabIndex = selectedTab, edgePadding = 0.dp) {
                tabs.forEachIndexed { index, title ->
                    Tab(selected = selectedTab == index, onClick = { selectedTab = index },
                        text = { Text(title, fontFamily = NunitoFamily, fontWeight = FontWeight.Bold) })
                }
            }
            val scroll = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .verticalScroll(rememberScrollState())
                .padding(16.dp)
            when (selectedTab) {
                0 -> CropCareSection(crop, climateZone, modifier = scroll)
                1 -> ProblemList(guideState.entries, "disease", "Болезни не отмечены.") { onOpenGuide?.invoke() }
                2 -> ProblemList(guideState.entries, "pest", "Вредители не отмечены.") { onOpenGuide?.invoke() }
                3 -> CropNeighborsSection(crop, modifier = scroll)
            }
        }
    }
}
