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
 *
 * Используем ExposedDropdownMenuBox: список открывается ПОД строкой ввода (привязан к
 * её якорю и ширине), поле остаётся редактируемым (клавиатура не закрывается, можно
 * добавлять/удалять символы — список обновляется). Раньше был DropdownMenu внутри Box,
 * который рисовался поверх поля и перехватывал фокус.
 */
@OptIn(ExperimentalMaterial3Api::class)
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
        val expanded = suggestions.isNotEmpty()

        ExposedDropdownMenuBox(
            expanded = expanded,
            onExpandedChange = { /* раскрытие определяется наличием подсказок, не тапом */ }
        ) {
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
                singleLine = true,
                enabled = enabled,
                modifier = Modifier
                    .menuAnchor()
                    .fillMaxWidth()
            )

            ExposedDropdownMenu(
                expanded = expanded,
                onDismissRequest = { /* закрытие — через очистку запроса/выбор, ввод не прерываем */ }
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
