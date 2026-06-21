package ru.dachakalend.app.ui.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import ru.dachakalend.app.data.model.FeedItem
import ru.dachakalend.app.data.repository.FeedRepository
import ru.dachakalend.app.data.repository.GardenRepository
import ru.dachakalend.app.data.repository.Result
import javax.inject.Inject

data class FeedUiState(
    val isLoading: Boolean = true,
    val items: List<FeedItem> = emptyList(),
    val error: String? = null,
    val loadingMore: Boolean = false,
    val nextOffset: Int? = 0,        // 0 — ещё не грузили; null — конец ленты
    val gardenName: String? = null,  // шапка профиля
    val gardenRegion: String? = null,
)

private const val PAGE = 30

@HiltViewModel
class FeedViewModel @Inject constructor(
    private val feedRepository: FeedRepository,
    private val gardenRepository: GardenRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(FeedUiState())
    val uiState: StateFlow<FeedUiState> = _uiState.asStateFlow()

    init { load(); loadGarden() }

    private fun loadGarden() {
        viewModelScope.launch {
            (gardenRepository.loadGardens() as? Result.Success)?.data?.firstOrNull()?.let { g ->
                _uiState.value = _uiState.value.copy(gardenName = g.name, gardenRegion = g.region)
            }
        }
    }

    /** Первичная загрузка / pull-to-refresh: сбрасывает ленту (но сохраняет шапку участка). */
    fun load() {
        _uiState.value = _uiState.value.copy(isLoading = true, error = null)
        viewModelScope.launch {
            when (val res = feedRepository.getFeed(limit = PAGE, offset = 0)) {
                is Result.Success -> _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    items = res.data.items,
                    nextOffset = res.data.nextOffset,
                    error = null,
                )
                is Result.Error   -> _uiState.value = _uiState.value.copy(isLoading = false, error = res.message, nextOffset = null)
                is Result.Loading -> Unit
            }
        }
    }

    /** Догрузка следующей страницы при прокрутке к концу. */
    fun loadMore() {
        val state = _uiState.value
        val offset = state.nextOffset
        if (offset == null || offset == 0 || state.loadingMore || state.isLoading) return
        _uiState.value = state.copy(loadingMore = true)
        viewModelScope.launch {
            when (val res = feedRepository.getFeed(limit = PAGE, offset = offset)) {
                is Result.Success -> _uiState.value = _uiState.value.copy(
                    loadingMore = false,
                    items = _uiState.value.items + res.data.items,
                    nextOffset = res.data.nextOffset,
                )
                is Result.Error   -> _uiState.value = _uiState.value.copy(loadingMore = false)
                is Result.Loading -> Unit
            }
        }
    }
}
