package ru.dachakalend.app.ui.garden

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import ru.dachakalend.app.data.model.GeocodeSuggestion

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CityInputField(
    value: String,
    onValueChange: (String) -> Unit,
    suggestions: List<GeocodeSuggestion>,
    detectedZone: String?,
    onSearch: (String) -> Unit,
    onSuggestionSelected: (GeocodeSuggestion) -> Unit,
    onClearSuggestions: () -> Unit,
    enabled: Boolean = true,
    isError: Boolean = false,
    modifier: Modifier = Modifier
) {
    var dropdownExpanded by remember { mutableStateOf(false) }

    // Debounce через LaunchedEffect + delay
    LaunchedEffect(value) {
        if (value.length >= 2) {
            kotlinx.coroutines.delay(500L)
            onSearch(value)
            dropdownExpanded = true
        } else {
            onClearSuggestions()
            dropdownExpanded = false
        }
    }

    LaunchedEffect(suggestions) {
        if (suggestions.isEmpty()) dropdownExpanded = false
    }

    Column(modifier = modifier) {
        ExposedDropdownMenuBox(
            expanded = dropdownExpanded && suggestions.isNotEmpty(),
            onExpandedChange = { dropdownExpanded = it && suggestions.isNotEmpty() },
            modifier = Modifier.fillMaxWidth()
        ) {
            OutlinedTextField(
                value = value,
                onValueChange = { onValueChange(it) },
                label = { Text("Населённый пункт *") },
                placeholder = { Text("Например: Сергиев Посад") },
                supportingText = {
                    if (isError) Text("Обязательное поле — для точного прогноза погоды", color = MaterialTheme.colorScheme.error)
                    else Text("Обязательно — для точного прогноза погоды")
                },
                isError = isError,
                modifier = Modifier.menuAnchor().fillMaxWidth(),
                singleLine = true,
                enabled = enabled
            )
            ExposedDropdownMenu(
                expanded = dropdownExpanded && suggestions.isNotEmpty(),
                onDismissRequest = { dropdownExpanded = false }
            ) {
                suggestions.forEach { s ->
                    DropdownMenuItem(
                        text = {
                            Column {
                                Text(s.name, style = MaterialTheme.typography.bodyMedium)
                                Text(
                                    s.displayName,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        },
                        onClick = {
                            onValueChange(s.name)
                            onSuggestionSelected(s)
                            dropdownExpanded = false
                        }
                    )
                }
            }
        }

        // Показываем определённую климатическую зону
        if (detectedZone != null) {
            Text(
                text = "🌍 ${ZONE_LABELS[detectedZone] ?: "Зона $detectedZone"}",
                style = MaterialTheme.typography.bodySmall,
                color = Color(0xFF2E7D32),
                modifier = Modifier.padding(start = 16.dp, top = 2.dp)
            )
        }
    }
}
