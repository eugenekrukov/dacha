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
    val plantings: List<Planting> = emptyList()
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
        // Если climateZone ещё не сохранён (например, после первого онбординга),
        // подгружаем участок с сервера — там зона уже рассчитана бэкендом.
        if (tokenStorage.getClimateZone() == null) {
            viewModelScope.launch { gardenRepository.loadGardens() }
        }
        loadToday()
        registerPushToken()
    }

    // Явно запрашиваем push-токен и отправляем на бэкенд при каждом старте
    private fun registerPushToken() {
        RuStorePushClient.getToken()
            .addOnSuccessListener { token ->
                viewModelScope.launch {
                    try { api.registerPushToken(mapOf("token" to token)) }
                    catch (_: Exception) {}
                }
            }
    }

    fun loadToday() {
        viewModelScope.launch {
            _uiState.value = TodayUiState.Loading

            val gardenId = tokenStorage.getGardenId().takeIf { it != -1 }
            val todayDeferred = async { todayRepository.getToday() }
            val recsDeferred  = async { recommendationsRepository.getRecommendations() }
            val plantingsDeferred = async { plantingsRepository.getPlantings(gardenId) }

            val todayResult    = todayDeferred.await()
            val recsResult     = recsDeferred.await()
            val plantingsResult = plantingsDeferred.await()

            _uiState.value = when (todayResult) {
                is Result.Success -> TodayUiState.Success(
                    TodayScreenData(
                        today = todayResult.data,
                        recommendations = if (recsResult is Result.Success) recsResult.data else emptyList(),
                        plantings = if (plantingsResult is Result.Success) plantingsResult.data else emptyList()
                    )
                )
                is Result.Error   -> TodayUiState.Error(todayResult.message)
                is Result.Loading -> TodayUiState.Loading
            }
        }
    }
}
