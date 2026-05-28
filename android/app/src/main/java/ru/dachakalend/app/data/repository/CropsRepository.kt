package ru.dachakalend.app.data.repository

import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.model.Crop
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CropsRepository @Inject constructor(private val api: DachaApi) {

    suspend fun getCrops(category: String? = null): Result<List<Crop>> = runCatching {
        api.getCrops(category)
    }

    suspend fun getCrop(id: Int): Result<Crop> = runCatching {
        api.getCrop(id)
    }
}
