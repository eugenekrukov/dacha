package ru.dachakalend.app.ui.actions

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ContentCut
import androidx.compose.material.icons.filled.Eco
import androidx.compose.material.icons.filled.Grass
import androidx.compose.material.icons.filled.HealthAndSafety
import androidx.compose.material.icons.filled.Spa
import androidx.compose.material.icons.filled.WaterDrop
import androidx.compose.ui.graphics.vector.ImageVector

/**
 * Material-иконка по типу действия. Единый источник для селектора действий
 * (ActionLogBottomSheet) и журнала (JournalScreen) — единая визуальная лексика
 * с экраном «Сегодня» (taskIcon/recStyle).
 */
fun actionIcon(type: String): ImageVector = when (type) {
    "watering"                      -> Icons.Default.WaterDrop
    "fertilizing"                   -> Icons.Default.Eco
    "treatment"                     -> Icons.Default.HealthAndSafety
    "transplanting", "pricking_out" -> Icons.Default.Grass
    "pinching", "pruning"           -> Icons.Default.ContentCut
    else                            -> Icons.Default.Spa
}
