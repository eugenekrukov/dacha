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

/**
 * Поле ввода населённого пункта с автодополнением.
 * Дебаунс — в ViewModel (Flow.debounce 400мс), не в Compose.
 * Подсказки — inline Card под полем (без popup, нет конфликтов с фокусом).
 */
@Composable
fun CityInputField(
    value: String,
    onValueChange: (String) -> Unit,
    suggestions: List<GeocodeSuggestion>,
    detectedZone: String?,
    onCityQueryChanged: (String) -> Unit,   // вызывается на каждое изменение, ViewModel дебаунсит
    onSuggestionSelected: (GeocodeSuggestion) -> Unit,
    enabled: Boolean = true,
    isError: Boolean = false,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier) {
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

        // Подсказки как Card под полем — работает в любом Compose-контексте
        if (suggestions.isNotEmpty()) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .zIndex(10f),
                shape = RoundedCornerShape(bottomStart = 8.dp, bottomEnd = 8.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
            ) {
                Column {
                    suggestions.forEachIndexed { index, s ->
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
                        if (index < suggestions.lastIndex) {
                            HorizontalDivider(modifier = Modifier.padding(horizontal = 16.dp))
                        }
                    }
                }
            }
        }

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
