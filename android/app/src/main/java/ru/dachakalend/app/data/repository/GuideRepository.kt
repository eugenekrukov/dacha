package ru.dachakalend.app.data.repository

import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.model.GuideEntry
import ru.dachakalend.app.data.model.GuideEntryDetail
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class GuideRepository @Inject constructor(
    private val api: DachaApi
) {

    suspend fun getGuide(
        kind: String? = null,
        cropId: Int? = null,
        q: String? = null
    ): Result<List<GuideEntry>> = try {
        Result.Success(api.getGuide(kind, cropId, q))
    } catch (e: Exception) {
        Result.Error(e.message ?: "Ошибка загрузки справочника")
    }

    suspend fun getEntry(slug: String): Result<GuideEntryDetail> = try {
        Result.Success(api.getGuideEntry(slug))
    } catch (e: Exception) {
        Result.Error(e.message ?: "Запись не найдена")
    }
}
