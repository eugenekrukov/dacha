package ru.dachakalend.app.ui.harvest

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.dachakalend.app.data.model.Planting
import ru.dachakalend.app.ui.theme.NunitoFamily

/**
 * Шторка записи урожая. Если [preselectedPlanting] задан — поле культуры зафиксировано
 * (клик по карточке «Убрать урожай» на «Сегодня»), иначе — выпадающий список из [plantings]
 * (журнал урожая, HarvestScreen).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddHarvestSheet(
    plantings: List<Planting>,
    preselectedPlanting: Planting? = null,
    isSaving: Boolean,
    onDismiss: () -> Unit,
    onSave: (plantingId: Int, weightKg: Double?, quantity: Int?, notes: String?, finishSeason: Boolean) -> Unit
) {
    var selectedPlanting by remember { mutableStateOf(preselectedPlanting ?: plantings.firstOrNull()) }
    var weightText by remember { mutableStateOf("") }
    var quantityText by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var finishSeason by remember { mutableStateOf(false) }
    var dropdownExpanded by remember { mutableStateOf(false) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = MaterialTheme.colorScheme.surface,
        windowInsets = WindowInsets(0)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .navigationBarsPadding()
                .imePadding()
                .padding(bottom = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                "Записать урожай",
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.Black,
                fontSize = 20.sp,
                color = MaterialTheme.colorScheme.onBackground
            )

            if (preselectedPlanting != null) {
                OutlinedTextField(
                    value = preselectedPlanting.cropName ?: "Посадка #${preselectedPlanting.id}",
                    onValueChange = {},
                    readOnly = true,
                    enabled = false,
                    label = { Text("Культура", fontFamily = NunitoFamily) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                )
            } else {
                ExposedDropdownMenuBox(
                    expanded = dropdownExpanded,
                    onExpandedChange = { dropdownExpanded = it }
                ) {
                    OutlinedTextField(
                        value = selectedPlanting?.cropName
                            ?: selectedPlanting?.let { "Посадка #${it.id}" }
                            ?: "Нет посадок",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Культура", fontFamily = NunitoFamily) },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(dropdownExpanded) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor(),
                        shape = RoundedCornerShape(12.dp)
                    )
                    ExposedDropdownMenu(
                        expanded = dropdownExpanded,
                        onDismissRequest = { dropdownExpanded = false }
                    ) {
                        plantings.forEach { planting ->
                            DropdownMenuItem(
                                text = { Text(planting.cropName ?: "Посадка #${planting.id}", fontFamily = NunitoFamily) },
                                onClick = {
                                    selectedPlanting = planting
                                    dropdownExpanded = false
                                }
                            )
                        }
                    }
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = weightText,
                    onValueChange = { weightText = it },
                    label = { Text("Вес, кг", fontFamily = NunitoFamily) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp)
                )
                OutlinedTextField(
                    value = quantityText,
                    onValueChange = { quantityText = it },
                    label = { Text("Штук", fontFamily = NunitoFamily) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp)
                )
            }

            OutlinedTextField(
                value = notes,
                onValueChange = { notes = it },
                label = { Text("Заметка (необязательно)", fontFamily = NunitoFamily) },
                modifier = Modifier.fillMaxWidth(),
                maxLines = 4,
                minLines = 2,
                shape = RoundedCornerShape(12.dp)
            )

            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Checkbox(checked = finishSeason, onCheckedChange = { finishSeason = it })
                Text(
                    "Это весь урожай в этом сезоне",
                    fontFamily = NunitoFamily,
                    fontSize = 14.sp,
                    color = MaterialTheme.colorScheme.onBackground
                )
            }

            Button(
                onClick = {
                    val pid = selectedPlanting?.id ?: return@Button
                    onSave(
                        pid,
                        weightText.toDoubleOrNull(),
                        quantityText.toIntOrNull(),
                        notes.ifBlank { null },
                        finishSeason
                    )
                },
                enabled = selectedPlanting != null && !isSaving &&
                        (weightText.toDoubleOrNull() != null || quantityText.toIntOrNull() != null),
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(16.dp)
            ) {
                if (isSaving) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                } else {
                    Text(
                        "Сохранить",
                        fontFamily = NunitoFamily,
                        fontWeight = FontWeight.Black,
                        softWrap = false
                    )
                }
            }
        }
    }
}
