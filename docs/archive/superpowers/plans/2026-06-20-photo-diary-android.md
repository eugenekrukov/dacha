# F12 Фото-дневник — План 3: Android-клиент

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Android-клиент фото-дневника — захват (из листа действия + standalone) и лента посадки в Compose.

**Architecture:** Kotlin + Jetpack Compose + Hilt + Retrofit/Moshi + OkHttp (`AuthInterceptor` добавляет Bearer ко всем запросам) + Coil для картинок. Загрузка — `@Multipart`. Приватные фото (`/photos/file/:id` требует Bearer) грузятся Coil'ом через ImageLoader на app-овском OkHttpClient (иначе 401). Захват — системный photo picker `PickVisualMedia` + камера.

**Tech Stack:** Kotlin, Compose, Hilt, Retrofit, Moshi, OkHttp, Coil.

**Зависит от:** backend (План 1) задеплоен.

**Спецификация:** `docs/superpowers/specs/2026-06-20-photo-diary-design.md` (§6).

**Проверка (юнит-тесты Android в проекте не гоняются — баг тулчейна, см. session-note):** после задач — `gradlew.bat -p android :app:compileGplayDebugKotlin` (JAVA_HOME = JBR Android Studio, см. память `reference_dacha_android_cli_build`). BUILD SUCCESSFUL = критерий.

---

## Структура файлов
- Modify: `.../data/model/Models.kt` — `PlantingPhoto`.
- Modify: `.../data/api/DachaApi.kt` — multipart upload + get + delete.
- Create: `.../data/repository/PhotosRepository.kt`.
- Modify: `.../di/NetworkModule.kt` — `ImageLoader` на app OkHttpClient + helper полного URL.
- Modify: `.../ui/actions/ActionLogBottomSheet.kt` + `ActionLogViewModel.kt` — фото-вложение (одиночный режим).
- Modify: `.../ui/plantings/PlantingInfoScreen.kt` + `PlantingInfoViewModel.kt` — секция «Дневник».

Базовый пакет: `ru.dachakalend.app`. Корень исходников: `android/app/src/main/java/ru/dachakalend/app/`.

---

## Task 1: Модель PlantingPhoto + эндпоинты DachaApi

**Files:** Modify `data/model/Models.kt`, `data/api/DachaApi.kt`

- [ ] **Step 1: Добавить модель** в `Models.kt` (конвенция файла — `@JsonClass(generateAdapter = true)` + `@Json(name=...)`):
```kotlin
@JsonClass(generateAdapter = true)
data class PlantingPhoto(
    val id: Int,
    @Json(name = "planting_id") val plantingId: Int,
    @Json(name = "action_id") val actionId: Int? = null,
    val caption: String? = null,
    @Json(name = "taken_at") val takenAt: String,
    val width: Int? = null,
    val height: Int? = null,
    val url: String,                                  // относительный: /photos/file/:id
    @Json(name = "thumb_url") val thumbUrl: String
)
```

- [ ] **Step 2: Добавить эндпоинты** в `DachaApi.kt` (после блока `// Actions`). Нужны импорты `okhttp3.MultipartBody`, `okhttp3.RequestBody`:
```kotlin
    // Photos (фото-дневник)
    @GET("photos")
    suspend fun getPhotos(@Query("planting_id") plantingId: Int): List<PlantingPhoto>

    @Multipart
    @POST("photos")
    suspend fun uploadPhoto(
        @Part("planting_id") plantingId: RequestBody,
        @Part("action_id") actionId: RequestBody?,
        @Part("caption") caption: RequestBody?,
        @Part file: MultipartBody.Part
    ): PlantingPhoto

    @DELETE("photos/{id}")
    suspend fun deletePhoto(@Path("id") id: Int)
```

- [ ] **Step 3: Compile.** Run: `gradlew.bat -p android :app:compileGplayDebugKotlin`. Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: Commit:**
```bash
git add android/app/src/main/java/ru/dachakalend/app/data/model/Models.kt android/app/src/main/java/ru/dachakalend/app/data/api/DachaApi.kt
git commit -m "feat(android): PlantingPhoto модель + эндпоинты photos в DachaApi"
```

---

## Task 2: PhotosRepository

**Files:** Create `data/repository/PhotosRepository.kt`

- [ ] **Step 1: Создать репозиторий** (следовать стилю `ActionsRepository.kt` — конструктор с `@Inject`, `DachaApi`, suspend-методы, `runCatching`). Чтение байтов из `Uri` делает вызывающий (есть `Context`), репозиторий принимает `ByteArray`:
```kotlin
package ru.dachakalend.app.data.repository

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.model.PlantingPhoto
import javax.inject.Inject

class PhotosRepository @Inject constructor(private val api: DachaApi) {

    suspend fun getPhotos(plantingId: Int): Result<List<PlantingPhoto>> =
        runCatching { api.getPhotos(plantingId) }

    suspend fun uploadPhoto(
        plantingId: Int,
        bytes: ByteArray,
        actionId: Int? = null,
        caption: String? = null
    ): Result<PlantingPhoto> = runCatching {
        val textType = "text/plain".toMediaType()
        val filePart = MultipartBody.Part.createFormData(
            "file", "photo.jpg",
            bytes.toRequestBody("image/jpeg".toMediaType())
        )
        api.uploadPhoto(
            plantingId = plantingId.toString().toRequestBody(textType),
            actionId = actionId?.toString()?.toRequestBody(textType),
            caption = caption?.toRequestBody(textType),
            file = filePart
        )
    }

    suspend fun deletePhoto(id: Int): Result<Unit> =
        runCatching { api.deletePhoto(id) }
}
```
(Если в проекте репозитории НЕ используют `Result`/`runCatching` — привести к фактическому стилю `ActionsRepository.kt`. Проверить при чтении.)

- [ ] **Step 2: Compile.** Run: `gradlew.bat -p android :app:compileGplayDebugKotlin`. Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit:**
```bash
git add android/app/src/main/java/ru/dachakalend/app/data/repository/PhotosRepository.kt
git commit -m "feat(android): PhotosRepository (get/upload multipart/delete)"
```

---

## Task 3: Coil ImageLoader с авторизацией + helper URL

**Files:** Modify `di/NetworkModule.kt`; найти и Modify класс `@HiltAndroidApp` Application.

- [ ] **Step 1: Найти Application-класс** (`grep -rl "@HiltAndroidApp" android/app/src/main`). Это, вероятно, `DachaApp.kt`.

- [ ] **Step 2: Сделать ImageLoader на app OkHttpClient.** Приватные фото идут под Bearer (`AuthInterceptor` в OkHttp). Coil по умолчанию использует свой OkHttp без перехватчика → 401. Реализовать `ImageLoaderFactory` в Application-классе, инжектируя `OkHttpClient`:
```kotlin
// в классе Application (@HiltAndroidApp), добавить интерфейс ImageLoaderFactory:
// class DachaApp : Application(), ImageLoaderFactory {
//     @Inject lateinit var okHttpClient: OkHttpClient
//     override fun newImageLoader(): ImageLoader =
//         ImageLoader.Builder(this).okHttpClient(okHttpClient).build()
// }
```
Импорты: `coil.ImageLoader`, `coil.ImageLoaderFactory`, `okhttp3.OkHttpClient`, `javax.inject.Inject`. (Coil сам подхватывает `ImageLoaderFactory` из Application — глобально для всех `AsyncImage`, включая существующие картинки справочника; для публичных guide-URL Bearer безвреден.)

- [ ] **Step 3: Helper полного URL.** API отдаёт относительный `url` (`/photos/file/:id`). Coil нужен абсолютный. Добавить top-level helper (например в `data/api/` файл `MediaUrl.kt`):
```kotlin
package ru.dachakalend.app.data.api

import ru.dachakalend.app.BuildConfig

// Абсолютный URL для относительного пути фото из API (Coil требует полный URL).
fun mediaUrl(relativePath: String): String =
    BuildConfig.BASE_URL.trimEnd('/') + "/" + relativePath.trimStart('/')
```

- [ ] **Step 4: Compile.** Run: `gradlew.bat -p android :app:compileGplayDebugKotlin`. Expected: BUILD SUCCESSFUL.

- [ ] **Step 5: Commit:**
```bash
git add -A android/app/src/main/java/ru/dachakalend/app
git commit -m "feat(android): Coil ImageLoader с Bearer (app OkHttp) + mediaUrl helper"
```

---

## Task 4: Секция «Дневник» на экране посадки

**Files:** Modify `ui/plantings/PlantingInfoViewModel.kt`, `ui/plantings/PlantingInfoScreen.kt`

- [ ] **Step 1: Прочитать** оба файла — понять, как устроены state (`StateFlow`/`uiState`), загрузка данных, инъекция репозиториев, структура Composable.

- [ ] **Step 2: ViewModel — состояние и операции дневника.** Инжектировать `PhotosRepository`. Добавить в ui-state: `photos: List<PlantingPhoto>`, флаги `photosLoading`, `uploadBusy`, `photoError: String?`. Методы:
  - `loadPhotos(plantingId)` — `getPhotos`, заполнить state.
  - `uploadPhoto(plantingId, bytes)` — `uploadPhoto`, при успехе добавить в начало списка; при ошибке распарсить лимит (HttpException 409 → сообщение про лимит/подписку); сбросить `uploadBusy`.
  - `deletePhoto(id)` — `deletePhoto`, убрать из списка.
  Вызвать `loadPhotos` при инициализации экрана посадки (там же, где грузится инфо).

- [ ] **Step 3: Compose — секция «Дневник».** В `PlantingInfoScreen.kt` под расписанием/действиями добавить секцию:
  - Заголовок «Дневник» + кнопка «Добавить фото» (иконка камеры).
  - `rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia())` → по выбранному `Uri` прочитать байты через `LocalContext.current.contentResolver.openInputStream(uri)?.readBytes()` и вызвать `viewModel.uploadPhoto(plantingId, bytes)`.
  - Сетка миниатюр: `LazyVerticalGrid(columns = GridCells.Fixed(3))` (или `FlowRow`), каждая — `AsyncImage(model = mediaUrl(photo.thumbUrl), ...)` квадратная с `ContentScale.Crop`, тап → полноэкранный просмотр (Dialog/полноэкранный Composable) с `AsyncImage(model = mediaUrl(photo.url))`, датой, подписью, кнопкой удаления (`viewModel.deletePhoto`).
  - Пустое состояние: «Пока нет фото. Снимите свою посадку — соберётся лента роста.»
  - Прогресс при `uploadBusy`; `photoError` показывать (Snackbar/текст).

- [ ] **Step 4: Compile.** Run: `gradlew.bat -p android :app:compileGplayDebugKotlin`. Expected: BUILD SUCCESSFUL.

- [ ] **Step 5: Commit:**
```bash
git add android/app/src/main/java/ru/dachakalend/app/ui/plantings/
git commit -m "feat(android): секция Дневник на экране посадки (сетка, добавление, просмотр, удаление)"
```

---

## Task 5: Фото-вложение в листе действия

**Files:** Modify `ui/actions/ActionLogViewModel.kt`, `ui/actions/ActionLogBottomSheet.kt`

- [ ] **Step 1: Прочитать** оба файла. Понять, как пишется действие (одиночный режим — `plantingId`/target; мульти-режим — список), что возвращает запись действия (нужен `actionId` созданного `ActionLog`).

- [ ] **Step 2: ViewModel.** Инжектировать `PhotosRepository`. Добавить состояние `pendingPhoto: ByteArray?` (выбранное, но ещё не загруженное фото) и метод установки/сброса. В операции записи действия (одиночный режим): после успешного создания действия, если `pendingPhoto != null`, вызвать `photosRepository.uploadPhoto(plantingId, pendingPhoto, actionId = createdAction.id)`. Ошибку фото показать, но действие не откатывать. В мульти-режиме фото игнорировать.

- [ ] **Step 3: Compose.** В `ActionLogBottomSheet.kt` только для **одиночного** режима (когда не grouped) добавить кнопку «📷 Фото» + `PickVisualMedia`-launcher; по выбору читать байты (`LocalContext` contentResolver) и класть в VM (`pendingPhoto`); показать метку «фото прикреплено» с крестиком сброса. В мульти-режиме блок не показывать.

- [ ] **Step 4: Compile.** Run: `gradlew.bat -p android :app:compileGplayDebugKotlin`. Expected: BUILD SUCCESSFUL.

- [ ] **Step 5: Commit:**
```bash
git add android/app/src/main/java/ru/dachakalend/app/ui/actions/
git commit -m "feat(android): фото-вложение в листе действия (одиночный режим)"
```

---

## Task 6: Проверка сборки и ручной прогон

> Не TDD — верификация. Юнит-тесты Android не запускаются (тулчейн), поэтому критерий — компиляция всех флейворов + ручной прогон пользователем.

- [ ] **Step 1: Компиляция всех затронутых флейворов:**
```bash
gradlew.bat -p android :app:compileGplayDebugKotlin
gradlew.bat -p android :app:compileRustoreDebugKotlin
```
Expected: BUILD SUCCESSFUL (допустимы только пред-существующие warning'и).

- [ ] **Step 2:** Отметить в session-note, что Android-клиент готов; сборку APK/AAB и ручной прогон (камера/галерея, лента, просмотр, удаление, фото из действия) выполняет пользователь на устройстве (как принято в проекте).

- [ ] **Step 3: Commit** (если были правки по итогам).

---

## Self-review (выполнено автором плана)
- **Покрытие спека §6 (Android):** модель/эндпоинты → Task 1; репозиторий → Task 2; приватная загрузка картинок (Coil+Bearer) + URL → Task 3; лента на экране посадки → Task 4; фото из листа действия (одиночный режим, мульти — off) → Task 5; проверка → Task 6.
- **Согласованность:** `PlantingPhoto` (поля camelCase + `@Json` snake_case как в `Models.kt`), `PhotosRepository.{getPhotos,uploadPhoto,deletePhoto}`, `mediaUrl(relative)`, ImageLoader на app OkHttp — единые имена во всех задачах. URL из API относительные → везде через `mediaUrl()`.
- **Известные нюансы зафиксированы:** Coil без auth-перехватчика дал бы 401 (Task 3 решает); мульти-режим листа действия фото не поддерживает (Task 5); чтение `Uri`→`ByteArray` делает Composable (есть `Context`), репозиторий context-free.
- **Открытый момент для исполнителя:** точный стиль репозиториев (`Result`/`runCatching` vs исключения) — сверить с `ActionsRepository.kt` при реализации Task 2; имя Application-класса — найти grep'ом (Task 3).
