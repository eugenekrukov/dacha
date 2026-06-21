package ru.dachakalend.app.data.repository

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.model.PlantingPhoto
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PhotosRepository @Inject constructor(
    private val api: DachaApi,
) {

    suspend fun getPhotos(plantingId: Int): Result<List<PlantingPhoto>> = try {
        Result.Success(api.getPhotos(plantingId))
    } catch (e: Exception) {
        errorResult(e, "Не удалось загрузить фото")
    }

    suspend fun uploadPhoto(
        plantingId: Int,
        bytes: ByteArray,
        actionId: Int? = null,
        caption: String? = null,
    ): Result<PlantingPhoto> = try {
        val textType = "text/plain".toMediaType()
        val filePart = MultipartBody.Part.createFormData(
            "file", "photo.jpg",
            bytes.toRequestBody("image/jpeg".toMediaType())
        )
        Result.Success(
            api.uploadPhoto(
                plantingId = plantingId.toString().toRequestBody(textType),
                actionId = actionId?.toString()?.toRequestBody(textType),
                caption = caption?.toRequestBody(textType),
                file = filePart
            )
        )
    } catch (e: Exception) {
        errorResult(e, "Не удалось загрузить фото")
    }

    suspend fun deletePhoto(id: Int): Result<Unit> = try {
        Result.Success(api.deletePhoto(id))
    } catch (e: Exception) {
        errorResult(e, "Не удалось удалить фото")
    }
}
