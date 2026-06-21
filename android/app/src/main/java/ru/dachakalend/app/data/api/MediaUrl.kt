package ru.dachakalend.app.data.api

import ru.dachakalend.app.BuildConfig

// Абсолютный URL для относительного пути фото из API (Coil требует полный URL).
// API отдаёт url/thumb_url как /photos/file/:id — приклеиваем к BASE_URL.
fun mediaUrl(relativePath: String): String =
    BuildConfig.BASE_URL.trimEnd('/') + "/" + relativePath.trimStart('/')
