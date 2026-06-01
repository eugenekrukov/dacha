package ru.dachakalend.app.ui.garden

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier

/**
 * Поле выбора региона РФ с фильтрацией по набранным символам.
 * Содержит все 85 субъектов. Опциональное поле.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RegionInputField(
    value: String,
    onValueChange: (String) -> Unit,
    enabled: Boolean = true,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }
    var query by remember { mutableStateOf(value) }

    // Синхронизируем query с внешним value (для предзаполнения)
    LaunchedEffect(value) {
        if (query != value) query = value
    }

    val filtered = remember(query) {
        if (query.isBlank()) RUSSIAN_REGIONS
        else RUSSIAN_REGIONS.filter { it.contains(query, ignoreCase = true) }
    }

    ExposedDropdownMenuBox(
        expanded = expanded && filtered.isNotEmpty(),
        onExpandedChange = { expanded = it },
        modifier = modifier
    ) {
        OutlinedTextField(
            value = query,
            onValueChange = { query = it; expanded = true },
            label = { Text("Регион (опционально)") },
            supportingText = { Text("Уточняет климатическую зону если город не определён") },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier.menuAnchor().fillMaxWidth(),
            singleLine = true,
            enabled = enabled
        )
        ExposedDropdownMenu(
            expanded = expanded && filtered.isNotEmpty(),
            onDismissRequest = { expanded = false }
        ) {
            if (query.isNotBlank()) {
                DropdownMenuItem(
                    text = { Text("— очистить —", color = MaterialTheme.colorScheme.onSurfaceVariant) },
                    onClick = { query = ""; onValueChange(""); expanded = false }
                )
            }
            filtered.forEach { region ->
                DropdownMenuItem(
                    text = { Text(region) },
                    onClick = { query = region; onValueChange(region); expanded = false }
                )
            }
        }
    }
}
