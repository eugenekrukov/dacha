package ru.dachakalend.app.ui.actions

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.ui.graphics.Color
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.background
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.hilt.navigation.compose.hiltViewModel
import ru.dachakalend.app.data.model.CropRef
import ru.dachakalend.app.data.model.Planting
import ru.dachakalend.app.ui.theme.NunitoFamily

/** Одиночная посадка: запись действия из карточки задачи / экрана посадки. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ActionLogBottomSheet(
    planting: Planting,
    onDismiss: () -> Unit,
    onActionLogged: (loggedType: String) -> Unit = {},
    preselectedType: String? = null,
    initialNotes: String? = null,
    viewModel: ActionLogViewModel = hiltViewModel()
) {
    ActionLogSheetImpl(
        title = planting.cropName ?: "Посадка #${planting.id}",
        initialTargets = listOf(CropRef(planting.id, planting.cropName ?: "Посадка #${planting.id}")),
        grouped = false,
        onDismiss = onDismiss,
        onActionLogged = onActionLogged,
        preselectedType = preselectedType,
        initialNotes = initialNotes,
        viewModel = viewModel,
    )
}

/** Групповая care-задача: одно действие пишется во все перечисленные посадки.
 *  Заголовок — список культур с крестиком удаления (минимум одна остаётся). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MultiActionLogBottomSheet(
    title: String,
    targets: List<CropRef>,
    onDismiss: () -> Unit,
    onActionLogged: (loggedType: String) -> Unit = {},
    preselectedType: String? = null,
    initialNotes: String? = null,
    viewModel: ActionLogViewModel = hiltViewModel()
) {
    ActionLogSheetImpl(
        title = title,
        initialTargets = targets,
        grouped = true,
        onDismiss = onDismiss,
        onActionLogged = onActionLogged,
        preselectedType = preselectedType,
        initialNotes = initialNotes,
        viewModel = viewModel,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ActionLogSheetImpl(
    title: String,
    initialTargets: List<CropRef>,
    grouped: Boolean,
    onDismiss: () -> Unit,
    onActionLogged: (loggedType: String) -> Unit,
    preselectedType: String?,
    initialNotes: String?,
    viewModel: ActionLogViewModel
) {
    val state by viewModel.uiState.collectAsState()
    // Исключённые из записи посадки (по id). Сами строки из разметки НЕ убираем — иначе высота
    // листа уменьшается, и ModalBottomSheet в Material3 1.2.x спонтанно закрывается (re-anchor →
    // onDismissRequest). Поэтому исключённую строку лишь зачёркиваем; высота листа постоянна.
    var excluded by remember { mutableStateOf(emptySet<Int>()) }
    val activeTargets = initialTargets.filter { it.id !in excluded }
    var selectedType by remember { mutableStateOf(preselectedType) }
    // Заметка авто-подставляется (препарат «Обработки» / удобрение) ТОЛЬКО когда выбран
    // изначально предложенный тип. Сменили действие на другое — авто-текст исчезает.
    // Текст, введённый пользователем вручную, не затираем.
    var notes by remember { mutableStateOf(if (selectedType == preselectedType) initialNotes ?: "" else "") }
    var lastAuto by remember { mutableStateOf(if (selectedType == preselectedType) initialNotes else null) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    // Фото-вложение — только одиночный режим (один кадр на одну посадку/действие).
    val context = LocalContext.current
    var pendingPhoto by remember { mutableStateOf<ByteArray?>(null) }
    val photoPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) {
            pendingPhoto = runCatching { context.contentResolver.openInputStream(uri)?.use { it.readBytes() } }.getOrNull()
        }
    }

    LaunchedEffect(selectedType) {
        val auto = if (selectedType == preselectedType) initialNotes else null
        if (notes == (lastAuto ?: "")) notes = auto ?: ""   // пользователь не редактировал авто-текст
        lastAuto = auto
    }

    LaunchedEffect(Unit) { viewModel.reset() }
    LaunchedEffect(state.success) {
        if (state.success) {
            // Действие реально записано → сообщаем тип (для корректного снятия pending), затем закрываем.
            onActionLogged(selectedType ?: "")
            sheetState.hide()
            onDismiss()
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
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
                text = title,
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.Black,
                fontSize = 20.sp,
                color = MaterialTheme.colorScheme.onBackground
            )

            // Групповой режим: список культур. Крестик исключает культуру из записи (зачёркивает),
            // повторный тап — возвращает. Минимум одна активная остаётся. Строки не удаляются из
            // разметки (высота листа постоянна) — иначе лист спонтанно закрывается (Material3 1.2.x).
            if (grouped) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    initialTargets.forEach { tg ->
                        val isExcluded = tg.id in excluded
                        // Исключить можно, только если останется ≥1 активная; вернуть — всегда.
                        val canToggle = isExcluded || activeTargets.size > 1
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(MaterialTheme.colorScheme.secondaryContainer.copy(alpha = if (isExcluded) .15f else .4f))
                                .padding(start = 12.dp, end = 4.dp, top = 4.dp, bottom = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = tg.name,
                                fontFamily = NunitoFamily,
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp,
                                color = if (isExcluded) MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = .5f)
                                        else MaterialTheme.colorScheme.onBackground,
                                textDecoration = if (isExcluded) TextDecoration.LineThrough else null,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f)
                            )
                            IconButton(
                                onClick = {
                                    excluded = when {
                                        isExcluded            -> excluded - tg.id
                                        activeTargets.size > 1 -> excluded + tg.id
                                        else                   -> excluded
                                    }
                                },
                                enabled = canToggle,
                                modifier = Modifier.size(36.dp)
                            ) {
                                Icon(
                                    if (isExcluded) Icons.Default.Refresh else Icons.Default.Close,
                                    contentDescription = if (isExcluded) "Вернуть ${tg.name}" else "Убрать ${tg.name}",
                                    tint = if (canToggle) MaterialTheme.colorScheme.onSurfaceVariant
                                           else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = .3f),
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }
                    }
                }
            }

            Text(
                text = "Что сделали?",
                fontFamily = NunitoFamily,
                fontWeight = FontWeight.Black,
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            // Тип действия — 2х2 сетка кнопок
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.height(320.dp)
            ) {
                items(ACTION_TYPES) { (type, label) ->
                    val isSelected = selectedType == type
                    Button(
                        onClick = { selectedType = type },
                        shape = RoundedCornerShape(16.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isSelected)
                                MaterialTheme.colorScheme.primary
                            else
                                MaterialTheme.colorScheme.secondaryContainer,
                            contentColor = if (isSelected)
                                MaterialTheme.colorScheme.onPrimary
                            else
                                MaterialTheme.colorScheme.onSecondaryContainer
                        ),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(
                            imageVector = actionIcon(type),
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(Modifier.width(8.dp))
                        // Полная подпись с переносом: «Удаление усов/стрелок/цветков» больше не обрезаются.
                        Text(
                            label,
                            fontFamily = NunitoFamily,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            lineHeight = 15.sp,
                            softWrap = true,
                            maxLines = 2,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }

            OutlinedTextField(
                value = notes,
                onValueChange = { notes = it },
                label = { Text("Заметка (необязательно)", fontFamily = NunitoFamily) },
                modifier = Modifier.fillMaxWidth(),
                minLines = 1,
                maxLines = 3,
                textStyle = TextStyle(
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp
                )
            )

            // Фото-вложение — только одиночный режим (в групповом один кадр на много посадок неоднозначен).
            if (!grouped) {
                if (pendingPhoto == null) {
                    OutlinedButton(
                        onClick = { photoPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                        shape = RoundedCornerShape(16.dp)
                    ) {
                        Icon(Icons.Default.PhotoCamera, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Прикрепить фото", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold)
                    }
                } else {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(MaterialTheme.colorScheme.secondaryContainer.copy(alpha = .4f))
                            .padding(start = 12.dp, end = 4.dp, top = 4.dp, bottom = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Icon(Icons.Default.PhotoCamera, contentDescription = null, modifier = Modifier.size(16.dp))
                            Text("Фото прикреплено", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                        IconButton(onClick = { pendingPhoto = null }, modifier = Modifier.size(36.dp)) {
                            Icon(Icons.Default.Close, contentDescription = "Убрать фото", modifier = Modifier.size(18.dp))
                        }
                    }
                }
            }

            state.error?.let {
                Text(
                    it,
                    fontFamily = NunitoFamily,
                    color = MaterialTheme.colorScheme.error,
                    fontSize = 13.sp
                )
            }

            Button(
                onClick = {
                    selectedType?.let { type ->
                        val ids = activeTargets.map { it.id }
                        if (!grouped) {
                            // Одиночный режим: фото привязываем к записанному действию.
                            val pid = ids.firstOrNull() ?: return@let
                            if (type == "transplanting") {
                                viewModel.logTransplanting(pid, photoBytes = pendingPhoto)
                            } else {
                                viewModel.logAction(pid, type, notes.ifBlank { null }, auto = false, photoBytes = pendingPhoto)
                            }
                        } else if (type == "transplanting") {
                            viewModel.logTransplantingMulti(ids)
                        } else {
                            // Заметка теперь содержит осмысленное (препарат «Обработки» / удобрение
                            // или текст пользователя) — показываем её в журнале: auto = false.
                            viewModel.logActionMulti(ids, type, notes.ifBlank { null }, auto = false)
                        }
                    }
                },
                enabled = selectedType != null && activeTargets.isNotEmpty() && !state.isLoading,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(16.dp)
            ) {
                if (state.isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = MaterialTheme.colorScheme.onPrimary,
                        strokeWidth = 2.dp
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

