package ru.dachakalend.app.ui.harvest

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import ru.dachakalend.app.data.model.Planting

@Composable
fun HarvestLogBottomSheet(
    planting: Planting,
    onDismiss: () -> Unit,
    onLogged: () -> Unit = {},
    viewModel: HarvestLogViewModel = hiltViewModel()
) {
    val isSaving by viewModel.isSaving.collectAsState()
    AddHarvestSheet(
        plantings = listOf(planting),
        preselectedPlanting = planting,
        isSaving = isSaving,
        onDismiss = onDismiss,
        onSave = { plantingId, weightKg, quantity, notes, finishSeason ->
            viewModel.logHarvest(plantingId, weightKg, quantity, notes, finishSeason) {
                onLogged()
                onDismiss()
            }
        }
    )
}
