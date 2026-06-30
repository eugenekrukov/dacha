package ru.dachakalend.app.data.repository

import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.model.CreateBedRequest
import ru.dachakalend.app.data.model.GardenBed
import ru.dachakalend.app.data.model.UpdateBedRequest
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BedsRepository @Inject constructor(private val api: DachaApi) {

    suspend fun getBeds(gardenId: Int): Result<List<GardenBed>> = try {
        Result.Success(api.getBeds(gardenId))
    } catch (e: Exception) {
        errorResult(e, "Ошибка загрузки грядок")
    }

    suspend fun createBed(gardenId: Int, name: String, type: String): Result<GardenBed> = try {
        Result.Success(api.createBed(gardenId, CreateBedRequest(name = name, type = type)))
    } catch (e: Exception) {
        errorResult(e, "Ошибка создания грядки")
    }

    suspend fun updateBed(id: Int, name: String? = null, type: String? = null): Result<GardenBed> = try {
        Result.Success(api.updateBed(id, UpdateBedRequest(name = name, type = type)))
    } catch (e: Exception) {
        errorResult(e, "Ошибка обновления грядки")
    }

    suspend fun deleteBed(id: Int): Result<Unit> = try {
        api.deleteBed(id)
        Result.Success(Unit)
    } catch (e: Exception) {
        errorResult(e, "Ошибка удаления грядки")
    }
}
