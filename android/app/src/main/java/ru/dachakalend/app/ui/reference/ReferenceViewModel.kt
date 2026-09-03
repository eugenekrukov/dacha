package ru.dachakalend.app.ui.reference

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import ru.dachakalend.app.data.model.BlogPost
import ru.dachakalend.app.data.model.Crop
import ru.dachakalend.app.data.model.GuideEntry
import ru.dachakalend.app.data.repository.BlogRepository
import ru.dachakalend.app.data.repository.CropsRepository
import ru.dachakalend.app.data.repository.GuideRepository
import ru.dachakalend.app.data.repository.Result
import javax.inject.Inject

enum class ReferenceTab { ALL, CROPS, GUIDE, ARTICLES }

private const val ARTICLES_PAGE = 20

data class ReferenceUiState(
    val crops: List<Crop> = emptyList(),
    val guideEntries: List<GuideEntry> = emptyList(),
    val articles: List<BlogPost> = emptyList(),
    val articlesTotal: Int = 0,
    val query: String = "",
    val tab: ReferenceTab = ReferenceTab.ALL,
    val isLoading: Boolean = false,
    val loadingMore: Boolean = false,
    val error: String? = null,
) {
    private val q get() = query.trim().lowercase()
    val matchedCrops get() = if (q.isBlank()) crops else crops.filter { it.name.lowercase().contains(q) }
    val matchedGuide get() = if (q.isBlank()) guideEntries else guideEntries.filter { it.name.lowercase().contains(q) }
    val matchedArticles get() = if (q.isBlank()) articles else articles.filter { it.title.lowercase().contains(q) }

    // Пустой запрос → только активный сегмент («Все» → статьи, свежее содержимое раздела).
    // Непустой запрос → все три корпуса сразу, сегмент фильтрует группу (зеркало web ReferenceScreen).
    val showCrops get() = if (q.isNotBlank()) tab == ReferenceTab.ALL || tab == ReferenceTab.CROPS else tab == ReferenceTab.CROPS
    val showGuide get() = if (q.isNotBlank()) tab == ReferenceTab.ALL || tab == ReferenceTab.GUIDE else tab == ReferenceTab.GUIDE
    val showArticles get() = if (q.isNotBlank()) tab == ReferenceTab.ALL || tab == ReferenceTab.ARTICLES else tab == ReferenceTab.ALL || tab == ReferenceTab.ARTICLES
    val nothingFound get() = q.isNotBlank() && matchedCrops.isEmpty() && matchedGuide.isEmpty() && matchedArticles.isEmpty()
}

@HiltViewModel
class ReferenceViewModel @Inject constructor(
    private val cropsRepository: CropsRepository,
    private val guideRepository: GuideRepository,
    private val blogRepository: BlogRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ReferenceUiState())
    val uiState: StateFlow<ReferenceUiState> = _uiState.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            val cropsResult = cropsRepository.getCrops()
            val guideResult = guideRepository.getGuide()
            val crops = (cropsResult as? Result.Success)?.data
            val guide = (guideResult as? Result.Success)?.data
            if (crops == null || guide == null) {
                val message = (cropsResult as? Result.Error)?.message ?: (guideResult as? Result.Error)?.message
                _uiState.value = _uiState.value.copy(isLoading = false, error = message ?: "Не удалось загрузить справочник")
                return@launch
            }
            // Фид блога может быть недоступен — культуры и болезни важнее, не роняем экран ради статей.
            val blog = (blogRepository.getBlogFeed(ARTICLES_PAGE, 0) as? Result.Success)?.data
            _uiState.value = _uiState.value.copy(
                crops = crops,
                guideEntries = guide,
                articles = blog?.items ?: emptyList(),
                articlesTotal = blog?.total ?: 0,
                isLoading = false
            )
        }
    }

    fun setQuery(query: String) {
        _uiState.value = _uiState.value.copy(query = query)
    }

    fun setTab(tab: ReferenceTab) {
        _uiState.value = _uiState.value.copy(tab = tab)
    }

    fun loadMoreArticles() {
        val state = _uiState.value
        if (state.loadingMore || state.articles.size >= state.articlesTotal) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(loadingMore = true)
            when (val result = blogRepository.getBlogFeed(ARTICLES_PAGE, state.articles.size)) {
                is Result.Success -> _uiState.value = _uiState.value.copy(
                    articles = _uiState.value.articles + result.data.items,
                    articlesTotal = result.data.total,
                    loadingMore = false
                )
                is Result.Error -> _uiState.value = _uiState.value.copy(loadingMore = false)
                is Result.Loading -> Unit
            }
        }
    }
}
