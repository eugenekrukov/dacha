package ru.dachakalend.app.ui.today

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import ru.dachakalend.app.data.api.DachaApi
import ru.dachakalend.app.data.local.TokenStorage
import ru.dachakalend.app.data.model.ActionLog
import ru.dachakalend.app.data.model.Planting
import ru.dachakalend.app.data.model.Recommendation
import ru.dachakalend.app.data.model.TodayResponse
import ru.dachakalend.app.data.model.TodayTask
import ru.dachakalend.app.data.repository.ActionsRepository
import ru.dachakalend.app.data.repository.GardenRepository
import ru.dachakalend.app.data.repository.PlantingsRepository
import ru.dachakalend.app.data.repository.RecommendationsRepository
import ru.dachakalend.app.data.repository.Result
import ru.dachakalend.app.data.repository.TodayRepository
import ru.dachakalend.app.ui.plantings.attentionCount
import ru.dachakalend.app.BuildConfig
import ru.rustore.sdk.pushclient.RuStorePushClient
import com.google.firebase.messaging.FirebaseMessaging
import javax.inject.Inject

data class TodayScreenData(
    val today: TodayResponse,
    val recommendations: List<Recommendation>,
    val plantings: List<Planting> = emptyList(),
    val todayActions: List<ActionLog> = emptyList(),
    // F1: данные показаны из кэша (нет сети), cachedAt — когда снят снимок.
    val offline: Boolean = false,
    val cachedAt: Long? = null,
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
    private val actionsRepository: ActionsRepository,
    private val tokenStorage: TokenStorage,
    private val api: DachaApi,
    private val todayCache: ru.dachakalend.app.data.local.TodayCache,
    private val syncManager: ru.dachakalend.app.data.sync.ActionSyncManager
) : ViewModel() {

    private val _uiState = MutableStateFlow<TodayUiState>(TodayUiState.Loading)
    val uiState: StateFlow<TodayUiState> = _uiState

    private val _dismissedRecs = MutableStateFlow<Set<String>>(
        tokenStorage.getDismissedRecsForToday()
    )
    val dismissedRecs: StateFlow<Set<String>> = _dismissedRecs.asStateFlow()

    private val _deletedRecs = MutableStateFlow<Set<String>>(tokenStorage.getDeletedRecs())
    val deletedRecs: StateFlow<Set<String>> = _deletedRecs.asStateFlow()

    private val _snoozedTasks = MutableStateFlow<Set<String>>(tokenStorage.getSnoozedTasksForToday())
    val snoozedTasks: StateFlow<Set<String>> = _snoozedTasks.asStateFlow()

    private val _deletedTasks = MutableStateFlow<Set<String>>(tokenStorage.getDeletedTasks())
    val deletedTasks: StateFlow<Set<String>> = _deletedTasks.asStateFlow()

    fun snoozeRec(key: String) {
        tokenStorage.addDismissedRec(key)
        _dismissedRecs.value = _dismissedRecs.value + key
    }

    fun deleteRec(key: String) {
        tokenStorage.deleteRec(key)
        _deletedRecs.value = _deletedRecs.value + key
    }

    fun snoozeTask(key: String) {
        tokenStorage.snoozeTask(key)
        _snoozedTasks.value = _snoozedTasks.value + key
        // Снуз влияет на бейдж — пересчитываем по текущим посадкам.
        (_uiState.value as? TodayUiState.Success)?.data?.let { data ->
            tokenStorage.saveAttentionCount(
                attentionCount(data.plantings, tokenStorage.getPendingTasks(), tokenStorage.getSnoozedTasksForToday())
            )
        }
    }

    fun deleteTask(key: String) {
        tokenStorage.deleteTask(key)
        _deletedTasks.value = _deletedTasks.value + key
    }

    fun deleteAction(id: Int, clientId: String? = null) {
        viewModelScope.launch {
            when (actionsRepository.deleteAction(id, clientId)) {
                is Result.Success -> loadToday(silent = true)
                else -> Unit
            }
        }
    }

    init {
        if (tokenStorage.getClimateZone() == null) {
            viewModelScope.launch { gardenRepository.loadGardens() }
        }
        loadToday()
        registerPushToken()
        viewModelScope.launch {
            actionsRepository.deletedActionEvents.collect {
                loadToday(silent = true)
            }
        }
        viewModelScope.launch {
            actionsRepository.loggedActionEvents.collect { info ->
                // Офлайн нельзя пересчитать задачи на сервере → закрываем подходящую локально
                // (snooze: вернётся завтра / обратимо), затем перечитываем (офлайн — из кэша).
                (_uiState.value as? TodayUiState.Success)?.data?.today?.tasks
                    ?.filter { it.plantingId == info.plantingId }
                    ?.forEach { snoozeTask(taskSnoozeKey(it)) }
                loadToday(silent = true)
            }
        }
    }

    private fun registerPushToken() {
        // По флейвору: rustore → RuStore Push токен; gplay/samsung → FCM-токен. Провайдер уходит на сервер.
        if (BuildConfig.STORE == "rustore") {
            try {
                RuStorePushClient.getToken()
                    .addOnSuccessListener { token ->
                        tokenStorage.savePushToken(token)
                        viewModelScope.launch {
                            try { api.registerPushToken(mapOf("token" to token, "provider" to "rustore")) }
                            catch (_: Exception) {}
                        }
                    }
            } catch (_: Exception) {
                // RuStore SDK недоступен в unit-test окружении — игнорируем
            }
        } else {
            try {
                FirebaseMessaging.getInstance().token
                    .addOnSuccessListener { token ->
                        tokenStorage.savePushToken(token)
                        viewModelScope.launch {
                            try { api.registerPushToken(mapOf("token" to token, "provider" to "fcm")) }
                            catch (_: Exception) {}
                        }
                    }
            } catch (_: Exception) {
                // Firebase недоступен в unit-test окружении — игнорируем
            }
        }
    }

    fun loadToday(silent: Boolean = false) {
        viewModelScope.launch {
            if (!silent) _uiState.value = TodayUiState.Loading

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

            // Кэш pending для НЕ-care задач (полив/подкормка/пересадка/урожай). Care-просрочка
            // теперь server-driven (Planting.overdueCareTask) — в кэш её не кладём, чтобы бейдж
            // и карточки считались из одного источника.
            val plantingsList = if (plantingsResult is Result.Success) plantingsResult.data else emptyList()
            if (todayResult is Result.Success) {
                val pending = todayResult.data.tasks
                    .filter { it.plantingId != null && it.type != "care_task_due" }
                    .associate { it.plantingId!! to TokenStorage.PendingTaskInfo(
                        type         = it.type,
                        careTaskName = it.careTaskName,
                        cropName     = it.cropName,
                        title        = it.title
                    )}
                tokenStorage.savePendingTasks(pending)
                // Бейдж = число посадок, требующих внимания (как на карточках «Посадок»).
                tokenStorage.saveAttentionCount(
                    attentionCount(plantingsList, pending, tokenStorage.getSnoozedTasksForToday())
                )
            }

            val gardenIdForCache = gardenId ?: -1
            _uiState.value = when (todayResult) {
                is Result.Success -> {
                    val data = TodayScreenData(
                        today          = todayResult.data,
                        recommendations = if (recsResult is Result.Success) recsResult.data else emptyList(),
                        // Завершённые (архивные) посадки не показываем в быстрых действиях
                        plantings      = plantingsList.filter { it.stage != "done" },
                        todayActions   = todayActions,
                    )
                    if (gardenIdForCache != -1) {
                        todayCache.save(ru.dachakalend.app.data.local.CachedToday(
                            gardenId = gardenIdForCache,
                            cachedAt = System.currentTimeMillis(),
                            today = data.today,
                            recommendations = data.recommendations,
                            plantings = data.plantings,
                            todayActions = data.todayActions,
                        ))
                    }
                    launch { syncManager.sync() }
                    TodayUiState.Success(data)
                }
                is Result.Error -> {
                    val cached = if (todayResult.isNetwork && gardenIdForCache != -1)
                        todayCache.load(gardenIdForCache) else null
                    if (cached != null) {
                        TodayUiState.Success(TodayScreenData(
                            today = cached.today,
                            recommendations = cached.recommendations,
                            plantings = cached.plantings.filter { it.stage != "done" },
                            todayActions = cached.todayActions,
                            offline = true,
                            cachedAt = cached.cachedAt,
                        ))
                    } else {
                        TodayUiState.Error(todayResult.message)
                    }
                }
                is Result.Loading -> TodayUiState.Loading
            }
        }
    }
}

internal fun recKey(rec: Recommendation) = "${rec.type}:${rec.cropName}:${rec.message.take(30)}"
internal fun taskSnoozeKey(task: TodayTask) = "${task.type}:${task.plantingId}:${task.cropName}:${task.careTaskName}"
