package ru.dachakalend.app.data.repository

import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.model.GeocodeSuggestion
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class GeocoderRepository @Inject constructor(private val api: DachaApi) {

    suspend fun suggest(query: String): Result<List<GeocodeSuggestion>> = try {
        Result.Success(api.suggestCity(query))
    } catch (e: Exception) {
        Result.Error(e.message ?: "Ошибка поиска")
    }
}
