package ru.dachakalend.app.ui.garden

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import ru.dachakalend.app.data.model.GeocodeSuggestion

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
    // Debounce: новый LaunchedEffect при каждом изменении value
    // отменяет предыдущий и ждёт 500мс перед поиском
    LaunchedEffect(value) {
        if (value.length >= 2) {
            kotlinx.coroutines.delay(500L)
            onSearch(value)
        } else {
            onClearSuggestions()
        }
    }

    Column(modifier = modifier) {
        OutlinedTextField(
            value = value,
            onValueChange = { onValueChange(it) },
            label = { Text("Населённый пункт *") },
            placeholder = { Text("Например: Сергиев Посад") },
            supportingText = {
                if (isError) Text("Обязательное поле", color = MaterialTheme.colorScheme.error)
                else Text("Обязательно — для точного прогноза погоды")
            },
            isError = isError,
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            enabled = enabled
        )

        // Подсказки — inline Card под полем (нет popup-проблем)
        if (suggestions.isNotEmpty()) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .zIndex(10f),
                shape = RoundedCornerShape(bottomStart = 8.dp, bottomEnd = 8.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
            ) {
                Column {
                    suggestions.forEach { s ->
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    onValueChange(s.name)
                                    onSuggestionSelected(s)
                                }
                                .padding(horizontal = 16.dp, vertical = 10.dp)
                        ) {
                            Text(s.name, style = MaterialTheme.typography.bodyMedium)
                            if (s.displayName != s.name) {
                                Text(
                                    s.displayName,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                        if (s != suggestions.last()) {
                            HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
                        }
                    }
                }
            }
        }

        // Климатическая зона после выбора подсказки
        if (detectedZone != null) {
            Text(
                text = "🌍 ${ZONE_LABELS[detectedZone] ?: "Зона $detectedZone"}",
                style = MaterialTheme.typography.bodySmall,
                color = Color(0xFF2E7D32),
                modifier = Modifier.padding(start = 4.dp, top = 4.dp)
            )
        }
    }
}
