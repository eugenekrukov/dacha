package ru.dachakalend.app.data.repository

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import retrofit2.HttpException
import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.model.AiDiagnosisResult
import ru.dachakalend.app.data.model.PlantingPhoto
import javax.inject.Inject
import javax.inject.Singleton

private const val AI_DIAGNOSIS_FREE_LIMIT_MESSAGE =
    "Бесплатные проверки закончились (3 из 3). Оформите «Дачник Про» для безлимита."

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

    suspend fun diagnosePhoto(photoId: Int): Result<AiDiagnosisResult> = try {
        Result.Success(api.diagnosePhoto(photoId))
    } catch (e: HttpException) {
        // errorResult() даёт общее сообщение на любой 402 — здесь у 402 два разных кода
        // (subscription_required / ai_diagnosis_free_limit_reached), различаем сами по телу
        // ответа, не трогая общий errorResult() (им пользуются другие репозитории).
        if (e.code() == 402 && e.response()?.errorBody()?.string()?.contains("ai_diagnosis_free_limit_reached") == true) {
            Result.Error(AI_DIAGNOSIS_FREE_LIMIT_MESSAGE, isSubscriptionRequired = true)
        } else {
            errorResult(e, "Не удалось определить болезнь/вредителя")
        }
    } catch (e: Exception) {
        errorResult(e, "Не удалось определить болезнь/вредителя")
    }
}
