package ru.dachakalend.app.ui.guide

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import ru.dachakalend.app.data.model.GuideEntry
import ru.dachakalend.app.data.model.GuideEntryDetail
import ru.dachakalend.app.data.repository.GuideRepository
import ru.dachakalend.app.data.repository.Result
import javax.inject.Inject

// Виды проблем для фильтра. null = «Все».
val GUIDE_KINDS = listOf(
    null to "Все",
    "deficiency" to "Дефициты",
    "disease" to "Болезни",
    "pest" to "Вредители"
)

fun guideKindLabel(kind: String): String = when (kind) {
    "deficiency" -> "Дефицит"
    "disease" -> "Болезнь"
    "pest" -> "Вредитель"
    else -> kind
}

fun guideKindIcon(kind: String): String = when (kind) {
    "deficiency" -> "🍂"
    "disease" -> "🦠"
    "pest" -> "🐛"
    else -> "•"
}

data class GuideUiState(
    val entries: List<GuideEntry> = emptyList(),
    val filtered: List<GuideEntry> = emptyList(),
    val kind: String? = null,
    val query: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
    // деталь
    val entry: GuideEntryDetail? = null,
    val detailLoading: Boolean = false,
    val detailError: String? = null
)

@HiltViewModel
class GuideViewModel @Inject constructor(
    private val repository: GuideRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(GuideUiState())
    val uiState: StateFlow<GuideUiState> = _uiState.asStateFlow()

    fun load(cropId: Int? = null) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            when (val result = repository.getGuide(cropId = cropId)) {
                is Result.Success -> _uiState.value = _uiState.value.copy(
                    entries = result.data,
                    filtered = applyFilter(result.data, _uiState.value.kind, _uiState.value.query),
                    isLoading = false
                )
                is Result.Error -> _uiState.value = _uiState.value.copy(error = result.message, isLoading = false)
                is Result.Loading -> Unit
            }
        }
    }

    fun setKind(kind: String?) {
        _uiState.value = _uiState.value.copy(
            kind = kind,
            filtered = applyFilter(_uiState.value.entries, kind, _uiState.value.query)
        )
    }

    fun setQuery(query: String) {
        _uiState.value = _uiState.value.copy(
            query = query,
            filtered = applyFilter(_uiState.value.entries, _uiState.value.kind, query)
        )
    }

    private fun applyFilter(list: List<GuideEntry>, kind: String?, query: String): List<GuideEntry> {
        val q = query.trim().lowercase()
        return list.filter { e ->
            (kind == null || e.kind == kind) &&
                (q.isBlank() || "${e.name} ${e.symptoms.orEmpty()}".lowercase().contains(q))
        }
    }

    fun loadEntry(slug: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(detailLoading = true, detailError = null)
            when (val result = repository.getEntry(slug)) {
                is Result.Success -> _uiState.value = _uiState.value.copy(entry = result.data, detailLoading = false)
                is Result.Error -> _uiState.value = _uiState.value.copy(detailError = result.message, detailLoading = false)
                is Result.Loading -> Unit
            }
        }
    }
}
