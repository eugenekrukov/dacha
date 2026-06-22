package ru.dachakalend.app.ui.common

import android.content.Context
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.FileProvider
import java.io.File

/** Два источника фото: галерея и камера. Оба отдают байты в общий колбэк. */
class PhotoPickers(val gallery: () -> Unit, val camera: () -> Unit)

private fun readBytes(context: Context, uri: Uri): ByteArray? =
    runCatching { context.contentResolver.openInputStream(uri)?.use { it.readBytes() } }.getOrNull()

private fun newCameraUri(context: Context): Uri {
    // Временный файл в cacheDir (покрыт file_paths.xml cache-path) → отдаём камере через FileProvider.
    val file = File(context.cacheDir, "camera_${System.currentTimeMillis()}.jpg")
    return FileProvider.getUriForFile(context, "${context.packageName}.provider", file)
}

/**
 * Галерея — системный `PickVisualMedia` (без runtime-разрешений).
 * Камера — `TakePicture` в cache-файл (тоже без разрешения CAMERA у приложения — снимает системная камера).
 * Результат обоих → [onBytes].
 */
@Composable
fun rememberPhotoPickers(onBytes: (ByteArray) -> Unit): PhotoPickers {
    val context = LocalContext.current
    val galleryLauncher = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) readBytes(context, uri)?.let(onBytes)
    }
    var cameraUri by remember { mutableStateOf<Uri?>(null) }
    val cameraLauncher = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        if (ok) cameraUri?.let { readBytes(context, it)?.let(onBytes) }
    }
    return PhotoPickers(
        gallery = { galleryLauncher.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
        camera = { val uri = newCameraUri(context); cameraUri = uri; cameraLauncher.launch(uri) }
    )
}
