package ru.dachakalend.app.ui.common

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import ru.dachakalend.app.ui.theme.NunitoFamily
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

/**
 * Поле даты без клавиатуры: тап открывает календарь (DatePickerDialog).
 * Раньше дата вводилась текстом «ДД.ММ.ГГГГ» с буквенной клавиатурой — та открывалась и
 * закрывалась при переходе между полями, и шторка формы прыгала (жалоба владельца 2026-09-24).
 *
 * @param isoDate "2026-09-24"
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DateField(
    label: String,
    isoDate: String,
    onDateChange: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val focusManager = LocalFocusManager.current
    var open by remember { mutableStateOf(false) }
    val date = runCatching { LocalDate.parse(isoDate.take(10)) }.getOrNull()

    Box(modifier.fillMaxWidth()) {
        // enabled = false: поле не берёт фокус и не зовёт клавиатуру; цвета — как у обычного поля.
        OutlinedTextField(
            value = date?.let { formatIsoDate(it.toString()) } ?: "",
            onValueChange = {},
            enabled = false,
            label = { Text(label, fontFamily = NunitoFamily) },
            trailingIcon = { Icon(Icons.Default.CalendarMonth, contentDescription = null) },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
                disabledTextColor = MaterialTheme.colorScheme.onSurface,
                disabledBorderColor = MaterialTheme.colorScheme.outline,
                disabledLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
                disabledTrailingIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        )
        Box(Modifier.matchParentSize().clickable { focusManager.clearFocus(); open = true })
    }

    if (open) {
        // DatePicker работает в UTC-миллисекундах полуночи — переводим LocalDate туда и обратно без часового пояса.
        val state = rememberDatePickerState(
            initialSelectedDateMillis = (date ?: LocalDate.now()).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
        )
        DatePickerDialog(
            onDismissRequest = { open = false },
            confirmButton = {
                TextButton(onClick = {
                    state.selectedDateMillis?.let {
                        onDateChange(Instant.ofEpochMilli(it).atOffset(ZoneOffset.UTC).toLocalDate().toString())
                    }
                    open = false
                }) { Text("Готово", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold) }
            },
            dismissButton = {
                TextButton(onClick = { open = false }) { Text("Отмена", fontFamily = NunitoFamily) }
            }
        ) {
            DatePicker(state = state, title = null, headline = null, showModeToggle = false)
        }
    }
}
