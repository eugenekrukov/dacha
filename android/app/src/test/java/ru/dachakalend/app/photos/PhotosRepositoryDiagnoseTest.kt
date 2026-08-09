package ru.dachakalend.app.photos

import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response
import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.model.AiDiagnosisCandidate
import ru.dachakalend.app.data.model.AiDiagnosisResult
import ru.dachakalend.app.data.repository.PhotosRepository
import ru.dachakalend.app.data.repository.Result

class PhotosRepositoryDiagnoseTest {

    @Test
    fun `diagnosePhoto happy path возвращает кандидатов`() = runTest {
        val api = mockk<DachaApi>()
        val expected = AiDiagnosisResult(
            candidates = listOf(AiDiagnosisCandidate(8, "Фитофтороз", "high", "обоснование")),
            disclaimer = "Предварительная оценка",
            diagnosedAt = "2026-08-09T00:00:00Z",
        )
        coEvery { api.diagnosePhoto(1) } returns expected

        val repo = PhotosRepository(api)
        val result = repo.diagnosePhoto(1)

        assertTrue(result is Result.Success)
        assertEquals(1, (result as Result.Success).data.candidates.size)
    }

    @Test
    fun `diagnosePhoto 402 возвращает Result Error`() = runTest {
        val api = mockk<DachaApi>()
        coEvery { api.diagnosePhoto(1) } throws HttpException(
            Response.error<AiDiagnosisResult>(402, "".toResponseBody(null))
        )

        val repo = PhotosRepository(api)
        val result = repo.diagnosePhoto(1)

        assertTrue(result is Result.Error)
    }
}
