package ru.dachakalend.app.ui.common

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import ru.dachakalend.app.data.api.mediaUrl
import ru.dachakalend.app.ui.theme.NunitoFamily

/**
 * Просмотр одного фото на весь экран: затемнённый фон, картинка целиком, крестик и подпись.
 *
 * [relativePath] — путь как отдаёт API (прогоняется через [mediaUrl]).
 *
 * ponytail: у `PlantingInfoScreen` свой `PhotoViewerDialog` — он не просмотрщик, а редактор
 * (заменить фото, удалить фото, удалить запись целиком, дата съёмки). Объединять их сейчас
 * значило бы тащить сюда `PlantingPhoto` и слот действий ради одной кнопки закрытия. Появится
 * третье место с просмотром — вот тогда обобщать, добавив сюда слот `actions`.
 */
@Composable
fun FullScreenPhotoDialog(
    relativePath: String,
    contentDescription: String,
    caption: String? = null,
    onDismiss: () -> Unit,
) {
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Box(Modifier.fillMaxSize().background(Color(0xE6000000))) {
            AsyncImage(
                model = mediaUrl(relativePath),
                contentDescription = contentDescription,
                contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxSize().padding(24.dp).align(Alignment.Center)
            )
            // Крестик наверху: низ диалога перекрывается системной навигацией — инсеты
            // в Dialog не доходят (та же причина, что в PhotoViewerDialog посадки).
            IconButton(
                onClick = onDismiss,
                modifier = Modifier.align(Alignment.TopEnd).statusBarsPadding().padding(4.dp)
            ) {
                Icon(Icons.Default.Close, contentDescription = "Закрыть", tint = Color.White)
            }
            caption?.let {
                Text(
                    it,
                    color = Color.White,
                    fontFamily = NunitoFamily,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.align(Alignment.BottomCenter)
                        .navigationBarsPadding().padding(16.dp)
                )
            }
        }
    }
}
