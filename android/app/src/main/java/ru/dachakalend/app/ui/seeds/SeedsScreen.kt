package ru.dachakalend.app.ui.seeds

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import ru.dachakalend.app.data.api.mediaUrl
import ru.dachakalend.app.data.model.Seed
import ru.dachakalend.app.ui.common.rememberPhotoPickers
import ru.dachakalend.app.ui.theme.NunitoFamily

// На пакетике срок пишут месяцем («годен до 12.2027»), в API он лежит датой.
private fun formatExpiry(iso: String?): String {
    if (iso == null || iso.length < 7) return "срок не указан"
    return "годен до ${iso.substring(5, 7)}.${iso.substring(0, 4)}"
}

/** ISO-дата → поле ввода «12.2027». */
private fun toMonthInput(iso: String?): String =
    if (iso == null || iso.length < 7) "" else "${iso.substring(5, 7)}.${iso.substring(0, 4)}"

/** «12.2027» → «2027-12» для API; "" — снять срок; null — ввод не разобрали. */
private fun parseMonthInput(text: String): String? {
    val trimmed = text.trim()
    if (trimmed.isEmpty()) return ""
    val m = Regex("""^(\d{1,2})[./\-](\d{4})$""").find(trimmed) ?: return null
    val month = m.groupValues[1].toInt()
    if (month !in 1..12) return null
    return "${m.groupValues[2]}-${month.toString().padStart(2, '0')}"
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SeedsScreen(
    onBack: () -> Unit = {},
    viewModel: SeedsViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(state.error) {
        state.error?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearError()
        }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Мои семена",
                        fontFamily = NunitoFamily, fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.onBackground
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Назад")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background
                )
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { viewModel.openAdd() },
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = Color.White
            ) {
                Icon(Icons.Default.Add, contentDescription = "Добавить пакетик")
            }
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .padding(padding)
        ) {
            when {
                state.isLoading -> CircularProgressIndicator(
                    modifier = Modifier.align(Alignment.Center),
                    color = MaterialTheme.colorScheme.primary
                )
                state.seeds.isEmpty() -> EmptySeeds(Modifier.align(Alignment.Center))
                else -> LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    if (state.expiredCount > 0) {
                        item {
                            Text(
                                "Просрочено пакетиков: ${state.expiredCount}. " +
                                    "Всхожесть уже не та — проверьте перед посевом.",
                                fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, fontSize = 14.sp,
                                color = MaterialTheme.colorScheme.error
                            )
                        }
                    }
                    items(state.seeds, key = { it.id }) { seed ->
                        SeedCard(
                            seed = seed,
                            onClick = { viewModel.openEdit(seed) },
                            onDelete = { viewModel.delete(seed) }
                        )
                    }
                }
            }
        }
    }

    if (state.showSheet) {
        SeedSheet(
            seed = state.editing,
            isSaving = state.isSaving,
            onDismiss = { viewModel.closeSheet() },
            onSave = { cropName, variety, expiresOn, photo ->
                viewModel.save(state.editing?.id, cropName, variety, expiresOn, photo)
            }
        )
    }
}

@Composable
private fun EmptySeeds(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Icon(
            Icons.Default.Inventory2, contentDescription = null,
            tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(48.dp)
        )
        Text(
            "Коробка с семенами пуста",
            fontFamily = NunitoFamily, fontWeight = FontWeight.Black, fontSize = 18.sp,
            color = MaterialTheme.colorScheme.onBackground
        )
        Text(
            "Сфотографируйте пакетик — и приложение подскажет, что уже куплено и у чего вышел срок",
            fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
    }
}

@Composable
private fun SeedCard(seed: Seed, onClick: () -> Unit, onDelete: () -> Unit) {
    var confirmDelete by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (seed.thumbUrl != null) {
                AsyncImage(
                    model = mediaUrl(seed.thumbUrl),
                    contentDescription = "Пакетик: ${seed.cropName}",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.size(64.dp).clip(RoundedCornerShape(14.dp))
                )
            } else {
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(MaterialTheme.colorScheme.background),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Default.PhotoCamera, contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            Spacer(Modifier.width(14.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    seed.cropName,
                    fontFamily = NunitoFamily, fontWeight = FontWeight.Black, fontSize = 16.sp,
                    color = MaterialTheme.colorScheme.onBackground,
                    maxLines = 1, overflow = TextOverflow.Ellipsis
                )
                seed.variety?.let {
                    Text(
                        it,
                        fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1, overflow = TextOverflow.Ellipsis
                    )
                }
                Text(
                    when {
                        seed.expired -> "Просрочен — ${formatExpiry(seed.expiresOn)}"
                        seed.expiresThisYear -> "Использовать в этом сезоне — ${formatExpiry(seed.expiresOn)}"
                        else -> formatExpiry(seed.expiresOn)
                    },
                    fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, fontSize = 13.sp,
                    color = when {
                        seed.expired -> MaterialTheme.colorScheme.error
                        seed.expiresThisYear -> MaterialTheme.colorScheme.primary
                        else -> MaterialTheme.colorScheme.onSurfaceVariant
                    }
                )
            }
            IconButton(onClick = { confirmDelete = true }) {
                Icon(
                    Icons.Default.Delete, contentDescription = "Удалить ${seed.cropName}",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }

    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("Убрать из инвентаря?", fontFamily = NunitoFamily, fontWeight = FontWeight.Black) },
            text = {
                Text(
                    "«${seed.cropName}» исчезнет из списка семян. Посадки и записи это не затронет.",
                    fontFamily = NunitoFamily, fontWeight = FontWeight.SemiBold
                )
            },
            confirmButton = {
                TextButton(onClick = { confirmDelete = false; onDelete() }) {
                    Text("Убрать", fontFamily = NunitoFamily, fontWeight = FontWeight.Black)
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmDelete = false }) {
                    Text("Отмена", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold)
                }
            }
        )
    }
}

/** Шторка добавления/правки пакетика: культура, сорт, срок годности, фото. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SeedSheet(
    seed: Seed?,
    isSaving: Boolean,
    onDismiss: () -> Unit,
    onSave: (cropName: String, variety: String?, expiresOn: String, photo: ByteArray?) -> Unit
) {
    var cropName by remember { mutableStateOf(seed?.cropName ?: "") }
    var variety by remember { mutableStateOf(seed?.variety ?: "") }
    var expiryText by remember { mutableStateOf(toMonthInput(seed?.expiresOn)) }
    var photoBytes by remember { mutableStateOf<ByteArray?>(null) }
    var showErrors by remember { mutableStateOf(false) }

    val pickers = rememberPhotoPickers(onBytes = { photoBytes = it })
    val expiryParsed = parseMonthInput(expiryText)

    // skipPartiallyExpanded + verticalScroll обязательны в паре: без первого лист открывается
    // на половину экрана и обрезает кнопку «Сохранить», без второго до неё не добраться при
    // поднятой клавиатуре (imePadding сжимает лист, а не прокручивает). Жалоба владельца
    // 2026-07-30, тот же дефект был в AddHarvestSheet.
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = MaterialTheme.colorScheme.surface,
        windowInsets = WindowInsets(0)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp)
                .navigationBarsPadding()
                .imePadding()
                .padding(bottom = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Text(
                if (seed == null) "Новый пакетик" else "Пакетик",
                fontFamily = NunitoFamily, fontWeight = FontWeight.Black, fontSize = 20.sp,
                color = MaterialTheme.colorScheme.onBackground
            )

            OutlinedTextField(
                value = cropName,
                onValueChange = { cropName = it },
                label = { Text("Культура", fontFamily = NunitoFamily) },
                placeholder = { Text("Томат", fontFamily = NunitoFamily) },
                isError = showErrors && cropName.isBlank(),
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            )
            OutlinedTextField(
                value = variety,
                onValueChange = { variety = it },
                label = { Text("Сорт", fontFamily = NunitoFamily) },
                placeholder = { Text("Бычье сердце", fontFamily = NunitoFamily) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            )
            OutlinedTextField(
                value = expiryText,
                onValueChange = { expiryText = it },
                label = { Text("Годен до (месяц с пакетика)", fontFamily = NunitoFamily) },
                placeholder = { Text("12.2027", fontFamily = NunitoFamily) },
                isError = showErrors && expiryParsed == null,
                supportingText = if (showErrors && expiryParsed == null) {
                    { Text("Формат: 12.2027", fontFamily = NunitoFamily) }
                } else null,
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            )

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(onClick = { pickers.camera() }, shape = RoundedCornerShape(12.dp)) {
                    Icon(Icons.Default.PhotoCamera, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Снять", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, softWrap = false)
                }
                OutlinedButton(onClick = { pickers.gallery() }, shape = RoundedCornerShape(12.dp)) {
                    Text("Из галереи", fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, softWrap = false)
                }
                if (photoBytes != null) {
                    Text(
                        "фото готово",
                        fontFamily = NunitoFamily, fontWeight = FontWeight.Bold, fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.tertiary
                    )
                }
            }

            Button(
                onClick = {
                    showErrors = true
                    if (cropName.isNotBlank() && expiryParsed != null) {
                        onSave(cropName.trim(), variety.trim().ifEmpty { null }, expiryParsed, photoBytes)
                    }
                },
                enabled = !isSaving,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(16.dp)
            ) {
                Text(
                    if (isSaving) "Сохраняем…" else "Сохранить",
                    fontFamily = NunitoFamily, fontWeight = FontWeight.Black, softWrap = false
                )
            }
        }
    }
}
