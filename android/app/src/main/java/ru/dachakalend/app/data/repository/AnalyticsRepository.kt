package ru.dachakalend.app.data.repository

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import dagger.hilt.android.qualifiers.ApplicationContext
import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.model.AnalyticsSummary
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AnalyticsRepository @Inject constructor(
    private val api: DachaApi,
    @ApplicationContext private val context: Context
) {

    suspend fun getSummary(): Result<AnalyticsSummary> = try {
        Result.Success(api.getAnalyticsSummary())
    } catch (e: Exception) {
        Result.Error(e.message ?: "Ошибка загрузки аналитики")
    }

    /** Скачивает CSV и возвращает Intent для Share sheet */
    suspend fun exportActionsIntent(): Result<Intent> = try {
        val body = api.exportActions()
        val csvBytes = body.bytes()

        val file = File(context.cacheDir, "actions_export.csv")
        file.writeBytes(csvBytes)

        val uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.provider",
            file
        )
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/csv"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        Result.Success(Intent.createChooser(intent, "Экспорт истории"))
    } catch (e: Exception) {
        Result.Error(e.message ?: "Ошибка экспорта")
    }
}
