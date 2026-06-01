package ru.dachakalend.app.ui.garden

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import ru.dachakalend.app.data.model.GeocodeSuggestion

/**
 * Поле ввода населённого пункта с автодополнением.
 * Дебаунс — в ViewModel (Flow.debounce 400мс).
 * Подсказки — DropdownMenu привязан к TextField через Box.
 */
@Composable
fun CityInputField(
    value: String,
    onValueChange: (String) -> Unit,
    suggestions: List<GeocodeSuggestion>,
    detectedZone: String?,
    onCityQueryChanged: (String) -> Unit,
    onSuggestionSelected: (GeocodeSuggestion) -> Unit,
    enabled: Boolean = true,
    isError: Boolean = false,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier) {
        Box {
            OutlinedTextField(
                value = value,
                onValueChange = { new ->
                    onValueChange(new)
                    onCityQueryChanged(new)
                },
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

            // DropdownMenu позиционируется относительно Box (под TextField)
            DropdownMenu(
                expanded = suggestions.isNotEmpty(),
                onDismissRequest = { /* не закрывать по клику вне — пользователь продолжает печатать */ },
                modifier = Modifier.fillMaxWidth()
            ) {
                suggestions.forEach { s ->
                    DropdownMenuItem(
                        text = {
                            Column {
                                Text(s.name, style = MaterialTheme.typography.bodyMedium)
                                if (s.displayName.isNotBlank() && s.displayName != s.name) {
                                    Text(
                                        s.displayName,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                        },
                        onClick = {
                            onValueChange(s.name)
                            onSuggestionSelected(s)
                        }
                    )
                }
            }
        }

        // Климатическая зона после выбора
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
