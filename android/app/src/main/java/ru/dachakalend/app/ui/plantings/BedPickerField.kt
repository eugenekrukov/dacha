package ru.dachakalend.app.ui.plantings

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.dachakalend.app.data.model.GardenBed
import ru.dachakalend.app.ui.theme.NunitoFamily

/**
 * Подсказка севооборота: совпало ли семейство выбранной культуры с семейством в истории
 * грядки за 3 года (история приходит вместе с грядкой). Возвращает текст предупреждения или null.
 * Чистая функция — покрыта юнит-тестом (RotationWarningTest).
 */
fun rotationWarning(bed: GardenBed?, cropFamily: String?): String? {
    if (bed == null || cropFamily.isNullOrBlank()) return null
    val match = bed.history
        .filter { it.family == cropFamily }
        .maxByOrNull { it.year } ?: return null
    return "На грядке «${bed.name}» в ${match.year} росла культура семейства " +
        "«$cropFamily» (${match.cropName}) — для этого семейства рекомендуют перерыв 3–4 года."
}

/**
 * Поле выбора грядки с инлайн-созданием/переименованием/удалением.
 * Состояние списка грядок и CRUD-операции владеет вызывающий экран/VM — компонент только UI.
 */
@Composable
fun BedPickerField(
    beds: List<GardenBed>,
    selectedBedId: Int?,
    cropFamily: String?,
    allowClear: Boolean,
    onSelect: (GardenBed?) -> Unit,
    onCreate: (name: String, type: String) -> Unit,
    onRename: (bed: GardenBed, name: String) -> Unit,
    onDelete: (bed: GardenBed) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    var creating by remember { mutableStateOf(false) }
    var newName by remember { mutableStateOf("") }
    var newType by remember { mutableStateOf("soil") }
    var renamingId by remember { mutableStateOf<Int?>(null) }
    var renameValue by remember { mutableStateOf("") }
    var confirmDelete by remember { mutableStateOf<GardenBed?>(null) }

    val selectedBed = beds.firstOrNull { it.id == selectedBedId }

    val closeMenu = {
        expanded = false
        creating = false
        newName = ""
        newType = "soil"
        renamingId = null
        renameValue = ""
    }

    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            "Место (необязательно)",
            fontFamily = NunitoFamily,
            fontWeight = FontWeight.Black,
            fontSize = 14.sp,
            color = MaterialTheme.colorScheme.onBackground
        )

        Box {
            OutlinedButton(
                onClick = { expanded = true },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text(
                    selectedBed?.let { b ->
                        b.name + (if (b.type == "greenhouse") " · теплица" else " · грунт")
                    } ?: "Не выбрано",
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f)
                )
                Icon(Icons.Default.ArrowDropDown, contentDescription = null)
            }

            DropdownMenu(expanded = expanded, onDismissRequest = closeMenu) {
                if (allowClear) {
                    DropdownMenuItem(
                        text = { Text("Не выбрано", fontFamily = NunitoFamily) },
                        onClick = { closeMenu(); onSelect(null) }
                    )
                }
                beds.forEach { bed ->
                    if (renamingId == bed.id) {
                        OutlinedTextField(
                            value = renameValue,
                            onValueChange = { renameValue = it },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp),
                            trailingIcon = {
                                TextButton(onClick = {
                                    val n = renameValue.trim()
                                    renamingId = null
                                    if (n.isNotEmpty() && n != bed.name) onRename(bed, n)
                                }) { Text("OK", fontFamily = NunitoFamily) }
                            }
                        )
                    } else {
                        DropdownMenuItem(
                            text = {
                                Text(
                                    bed.name + (if (bed.type == "greenhouse") " · теплица" else " · грунт"),
                                    fontFamily = NunitoFamily,
                                    fontWeight = if (bed.id == selectedBedId) FontWeight.Black else FontWeight.Normal
                                )
                            },
                            onClick = { closeMenu(); onSelect(bed) },
                            trailingIcon = {
                                Row {
                                    IconButton(onClick = { renamingId = bed.id; renameValue = bed.name }, modifier = Modifier.size(32.dp)) {
                                        Icon(Icons.Default.Edit, contentDescription = "Переименовать", modifier = Modifier.size(16.dp))
                                    }
                                    IconButton(onClick = { confirmDelete = bed }, modifier = Modifier.size(32.dp)) {
                                        Icon(Icons.Default.Delete, contentDescription = "Удалить", modifier = Modifier.size(16.dp))
                                    }
                                }
                            }
                        )
                    }
                }

                HorizontalDivider()

                if (creating) {
                    Column(modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = newName,
                            onValueChange = { if (it.length <= 80) newName = it },
                            label = { Text("Название грядки", fontFamily = NunitoFamily) },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            FilterChip(
                                selected = newType == "soil",
                                onClick = { newType = "soil" },
                                shape = RoundedCornerShape(100.dp),
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = MaterialTheme.colorScheme.primary,
                                    selectedLabelColor = Color.White
                                ),
                                label = { Text("Грунт", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, softWrap = false) }
                            )
                            FilterChip(
                                selected = newType == "greenhouse",
                                onClick = { newType = "greenhouse" },
                                shape = RoundedCornerShape(100.dp),
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = MaterialTheme.colorScheme.primary,
                                    selectedLabelColor = Color.White
                                ),
                                label = { Text("Теплица", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, softWrap = false) }
                            )
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            TextButton(onClick = { creating = false; newName = ""; newType = "soil" }) {
                                Text("Отмена", fontFamily = NunitoFamily)
                            }
                            Button(onClick = {
                                val n = newName.trim()
                                if (n.isNotEmpty()) {
                                    onCreate(n, newType)
                                    closeMenu()
                                }
                            }) { Text("Добавить", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold) }
                        }
                    }
                } else {
                    DropdownMenuItem(
                        text = { Text("Новая грядка", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary) },
                        leadingIcon = { Icon(Icons.Default.Add, contentDescription = null, tint = MaterialTheme.colorScheme.primary) },
                        onClick = { creating = true }
                    )
                }
            }
        }

        rotationWarning(selectedBed, cropFamily)?.let { warn ->
            Text(
                warn,
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.SemiBold,
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.tertiary
            )
        }
    }

    confirmDelete?.let { bed ->
        AlertDialog(
            onDismissRequest = { confirmDelete = null },
            title = { Text("Удалить грядку?", fontFamily = NunitoFamily, fontWeight = FontWeight.Black) },
            text = { Text("«${bed.name}» будет удалена. Посадки на ней не пропадут — у них просто снимется привязка к месту.", fontFamily = NunitoFamily) },
            confirmButton = {
                TextButton(onClick = { confirmDelete = null; onDelete(bed) }) {
                    Text("Удалить", color = MaterialTheme.colorScheme.error, fontFamily = NunitoFamily, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = { TextButton(onClick = { confirmDelete = null }) { Text("Отмена", fontFamily = NunitoFamily) } }
        )
    }
}
