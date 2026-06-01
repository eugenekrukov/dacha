package ru.dachakalend.app.ui.garden

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import ru.dachakalend.app.data.model.GeocodeSuggestion

/**
 * Поле ввода города с автодополнением от Nominatim.
 * Использует delay(500ms) в LaunchedEffect для debounce без Flow в ViewModel.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CityInputField(
    value: String,
    onValueChange: (String) -> Unit,
    suggestions: List<GeocodeSuggestion>,
    onSearch: (String) -> Unit,
    onSuggestionSelected: (GeocodeSuggestion) -> Unit,
    onClearSuggestions: () -> Unit,
    enabled: Boolean = true,
    modifier: Modifier = Modifier
) {
    var dropdownExpanded by remember { mutableStateOf(false) }

    // Debounce: если value изменилось — через 500мс делаем поиск
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

    // Закрываем если подсказки пропали
    LaunchedEffect(suggestions) {
        if (suggestions.isEmpty()) dropdownExpanded = false
    }

    ExposedDropdownMenuBox(
        expanded = dropdownExpanded && suggestions.isNotEmpty(),
        onExpandedChange = { dropdownExpanded = it && suggestions.isNotEmpty() },
        modifier = modifier
    ) {
        OutlinedTextField(
            value = value,
            onValueChange = { onValueChange(it) },
            label = { Text("Город или посёлок") },
            placeholder = { Text("Например: Сергиев Посад") },
            supportingText = { Text("Для точного прогноза погоды") },
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
                    text = { Text(s.displayName) },
                    onClick = {
                        onValueChange(s.name)
                        onSuggestionSelected(s)
                        dropdownExpanded = false
                    }
                )
            }
        }
    }
}
