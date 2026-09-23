package ru.dachakalend.app.reference

import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import ru.dachakalend.app.data.model.BlogFeedResponse
import ru.dachakalend.app.data.model.BlogPost
import ru.dachakalend.app.data.repository.BlogRepository
import ru.dachakalend.app.data.repository.CropsRepository
import ru.dachakalend.app.data.repository.GuideRepository
import ru.dachakalend.app.data.repository.Result
import ru.dachakalend.app.ui.reference.ReferenceViewModel

// Статья, вышедшая после открытия вкладки, должна появиться при возврате на неё (ON_RESUME),
// а не только после выгрузки приложения — ViewModel вкладки переживает навигацию (saveState).
@OptIn(ExperimentalCoroutinesApi::class)
class ReferenceViewModelTest {

    private val dispatcher = StandardTestDispatcher()

    private fun post(slug: String) = BlogPost(slug, slug, "https://calendacha.ru/blog/$slug/", "2026-09-23T00:00:00+03:00")

    @Before fun setUp() = Dispatchers.setMain(dispatcher)
    @After fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `refreshArticles подхватывает статью, вышедшую после первой загрузки`() = runTest(dispatcher) {
        val crops = mockk<CropsRepository>()
        val guide = mockk<GuideRepository>()
        val blog = mockk<BlogRepository>()
        coEvery { crops.getCrops() } returns Result.Success(emptyList())
        coEvery { guide.getGuide() } returns Result.Success(emptyList())
        coEvery { blog.getBlogFeed(any(), 0) } returns Result.Success(BlogFeedResponse(listOf(post("klubnika")), 86))

        val vm = ReferenceViewModel(crops, guide, blog)
        advanceUntilIdle()
        assertEquals("klubnika", vm.uiState.value.articles.first().slug)

        coEvery { blog.getBlogFeed(any(), 0) } returns
            Result.Success(BlogFeedResponse(listOf(post("hosta"), post("klubnika")), 87))
        vm.refreshArticles()
        advanceUntilIdle()

        assertEquals(listOf("hosta", "klubnika"), vm.uiState.value.articles.map { it.slug })
        assertEquals(87, vm.uiState.value.articlesTotal)
    }
}
