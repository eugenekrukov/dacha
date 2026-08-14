package ru.dachakalend.app.data.repository

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.model.CreateSeedRequest
import ru.dachakalend.app.data.model.Seed
import ru.dachakalend.app.data.model.SeedShoppingItem
import ru.dachakalend.app.data.model.UpdateSeedRequest
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SeedsRepository @Inject constructor(private val api: DachaApi) {

    suspend fun getSeeds(): Result<List<Seed>> = try {
        Result.Success(api.getSeeds())
    } catch (e: Exception) {
        errorResult(e, "Не удалось загрузить семена")
    }

    suspend fun getShoppingList(): Result<List<SeedShoppingItem>> = try {
        Result.Success(api.getSeedsShoppingList())
    } catch (e: Exception) {
        errorResult(e, "Не удалось загрузить список покупок")
    }

    suspend fun createSeed(
        cropName: String, variety: String?, expiresOn: String?, wanted: Boolean? = null
    ): Result<Seed> = try {
        Result.Success(api.createSeed(CreateSeedRequest(cropName, variety, expiresOn, wanted)))
    } catch (e: Exception) {
        errorResult(e, "Не удалось добавить пакетик")
    }

    /** [expiresOn]: "YYYY-MM" — новый срок, "" — снять срок, null — не трогать. */
    suspend fun updateSeed(
        id: Int,
        cropName: String? = null,
        variety: String? = null,
        expiresOn: String? = null,
        wanted: Boolean? = null
    ): Result<Seed> = try {
        Result.Success(api.updateSeed(id, UpdateSeedRequest(cropName, variety, expiresOn, wanted)))
    } catch (e: Exception) {
        errorResult(e, "Не удалось сохранить изменения")
    }

    suspend fun deleteSeed(id: Int): Result<Unit> = try {
        api.deleteSeed(id)
        Result.Success(Unit)
    } catch (e: Exception) {
        errorResult(e, "Не удалось удалить пакетик")
    }

    suspend fun uploadPhoto(id: Int, bytes: ByteArray): Result<Seed> = try {
        val part = MultipartBody.Part.createFormData(
            "file", "packet.jpg", bytes.toRequestBody("image/jpeg".toMediaType())
        )
        Result.Success(api.uploadSeedPhoto(id, part))
    } catch (e: Exception) {
        errorResult(e, "Не удалось загрузить фото")
    }
}
