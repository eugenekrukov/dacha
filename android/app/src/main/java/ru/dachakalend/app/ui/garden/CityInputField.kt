package ru.dachakalend.app.ui.garden

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Public
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import ru.dachakalend.app.data.model.GeocodeSuggestion

/**
 * Поле ввода населённого пункта с автодополнением.
 * Дебаунс — в ViewModel (Flow.debounce 400мс).
 *
 * Подсказки рендерим ИНЛАЙНОМ под полем (обычная Column, не popup). Раньше был
 * ExposedDropdownMenu/DropdownMenu — popup перехватывал фокус IME, из-за чего удаление
 * символов с клавиатуры срабатывало не всегда (жалоба тестера: «Сергиев не стирался»).
 * Инлайн-список фокус не отбирает — поле остаётся полностью редактируемым.
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
        var focused by remember { mutableStateOf(false) }

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
            // Крестик-очистка одним тапом — удобный сброс всего поля.
            trailingIcon = {
                if (value.isNotEmpty() && enabled) {
                    IconButton(onClick = {
                        onValueChange("")
                        onCityQueryChanged("")
                    }) {
                        Icon(Icons.Default.Clear, contentDescription = "Очистить")
                    }
                }
            },
            modifier = Modifier
                .fillMaxWidth()
                .onFocusChanged { focused = it.isFocused }
        )

        // Инлайн-список подсказок: показываем, пока поле в фокусе и есть варианты.
        if (focused && suggestions.isNotEmpty()) {
            Surface(
                shape = RoundedCornerShape(12.dp),
                tonalElevation = 2.dp,
                color = MaterialTheme.colorScheme.surface,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp)
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
                            if (s.displayName.isNotBlank() && s.displayName != s.name) {
                                Text(
                                    s.displayName,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                }
            }
        }

        // Климатическая зона после выбора
        if (detectedZone != null) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier.padding(start = 4.dp, top = 4.dp)
            ) {
                Icon(Icons.Default.Public, contentDescription = null, tint = Color(0xFF2E7D32), modifier = Modifier.size(14.dp))
                Text(
                    text = ZONE_LABELS[detectedZone] ?: "Зона $detectedZone",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFF2E7D32)
                )
            }
        }
    }
}
