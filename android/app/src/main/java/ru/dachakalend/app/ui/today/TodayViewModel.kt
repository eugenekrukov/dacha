package ru.dachakalend.app.ui.today

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.local.TokenStorage
import ru.dachakalend.app.data.model.ActionLog
import ru.dachakalend.app.data.model.Planting
import ru.dachakalend.app.data.model.Recommendation
import ru.dachakalend.app.data.model.TodayResponse
import ru.dachakalend.app.data.repository.GardenRepository
import ru.dachakalend.app.data.repository.PlantingsRepository
import ru.dachakalend.app.data.repository.RecommendationsRepository
import ru.dachakalend.app.data.repository.Result
import ru.dachakalend.app.data.repository.TodayRepository
import ru.rustore.sdk.pushclient.RuStorePushClient
import javax.inject.Inject

data class TodayScreenData(
    val today: TodayResponse,
    val recommendations: List<Recommendation>,
    val plantings: List<Planting> = emptyList(),
    val todayActions: List<ActionLog> = emptyList()
)

sealed class TodayUiState {
    object Loading : TodayUiState()
    data class Success(val data: TodayScreenData) : TodayUiState()
    data class Error(val message: String) : TodayUiState()
}

@HiltViewModel
class TodayViewModel @Inject constructor(
    private val todayRepository: TodayRepository,
    private val recommendationsRepository: RecommendationsRepository,
    private val plantingsRepository: PlantingsRepository,
    private val gardenRepository: GardenRepository,
    private val tokenStorage: TokenStorage,
    private val api: DachaApi
) : ViewModel() {

    private val _uiState = MutableStateFlow<TodayUiState>(TodayUiState.Loading)
    val uiState: StateFlow<TodayUiState> = _uiState

    init {
        if (tokenStorage.getClimateZone() == null) {
            viewModelScope.launch { gardenRepository.loadGardens() }
        }
        loadToday()
        registerPushToken()
    }

    private fun registerPushToken() {
        try {
            RuStorePushClient.getToken()
                .addOnSuccessListener { token ->
                    viewModelScope.launch {
                        try { api.registerPushToken(mapOf("token" to token)) }
                        catch (_: Exception) {}
                    }
                }
        } catch (_: Exception) {
            // RuStore SDK недоступен в unit-test окружении — игнорируем
        }
    }

    fun loadToday() {
        viewModelScope.launch {
            _uiState.value = TodayUiState.Loading

            val gardenId = tokenStorage.getGardenId().takeIf { it != -1 }
            val todayDeferred    = async { todayRepository.getToday() }
            val recsDeferred     = async { recommendationsRepository.getRecommendations() }
            val plantingsDeferred = async { plantingsRepository.getPlantings(gardenId) }
            val actionsDeferred  = async {
                try { api.getActions(limit = 20) } catch (_: Exception) { emptyList() }
            }

            val todayResult     = todayDeferred.await()
            val recsResult      = recsDeferred.await()
            val plantingsResult = plantingsDeferred.await()
            // Сохраняем счётчик активных посадок для Badge в BottomNav
            if (plantingsResult is Result.Success) {
                val active = plantingsResult.data.count { it.stage != "done" }
                tokenStorage.saveActivePlantingsCount(active)
            }
            val allActions      = actionsDeferred.await()

            // Оставляем только действия за сегодня (по дате в loggedAt)
            val todayDate = java.time.LocalDate.now().toString() // "2026-05-31"
            val todayActions = allActions.filter { it.loggedAt.startsWith(todayDate) }

            _uiState.value = when (todayResult) {
                is Result.Success -> TodayUiState.Success(
                    TodayScreenData(
                        today          = todayResult.data,
                        recommendations = if (recsResult is Result.Success) recsResult.data else emptyList(),
                        plantings      = if (plantingsResult is Result.Success) plantingsResult.data else emptyList(),
                        todayActions   = todayActions
                    )
                )
                is Result.Error   -> TodayUiState.Error(todayResult.message)
                is Result.Loading -> TodayUiState.Loading
            }
        }
    }
}
