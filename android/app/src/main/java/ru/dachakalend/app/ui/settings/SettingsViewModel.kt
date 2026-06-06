package ru.dachakalend.app.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import ru.dachakalend.app.billing.SubscriptionManager
import ru.dachakalend.app.billing.SubscriptionStatus
import ru.dachakalend.app.data.local.TokenStorage
import ru.dachakalend.app.data.repository.AuthRepository
import ru.dachakalend.app.data.repository.Result
import javax.inject.Inject

data class NotificationSettings(
    val frost: Boolean = true,
    val heat: Boolean = true,
    val watering: Boolean = true,
    val fertilizing: Boolean = true,
    val transplant: Boolean = true
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val tokenStorage: TokenStorage,
    private val subscriptionManager: SubscriptionManager,
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _settings = MutableStateFlow(loadSettings())
    val settings: StateFlow<NotificationSettings> = _settings.asStateFlow()

    private val _loggedOut = MutableStateFlow(false)
    val loggedOut: StateFlow<Boolean> = _loggedOut.asStateFlow()

    // Профиль для баннера подтверждения email. null = ещё не загружен (баннер не показываем).
    private val _emailVerified = MutableStateFlow<Boolean?>(null)
    val emailVerified: StateFlow<Boolean?> = _emailVerified.asStateFlow()

    private val _email = MutableStateFlow<String?>(null)
    val email: StateFlow<String?> = _email.asStateFlow()

    val subscriptionStatus: StateFlow<SubscriptionStatus> = subscriptionManager.status

    init {
        viewModelScope.launch { subscriptionManager.refresh() }
        loadProfile()
    }

    fun loadProfile() {
        viewModelScope.launch {
            when (val r = authRepository.me()) {
                is Result.Success -> {
                    _emailVerified.value = r.data.emailVerified
                    _email.value = r.data.email
                }
                else -> Unit  // оффлайн/ошибка — баннер просто не показываем
            }
        }
    }

    private fun loadSettings() = NotificationSettings(
        frost       = tokenStorage.isNotificationEnabled(TokenStorage.NOTIF_FROST),
        heat        = tokenStorage.isNotificationEnabled(TokenStorage.NOTIF_HEAT),
        watering    = tokenStorage.isNotificationEnabled(TokenStorage.NOTIF_WATERING),
        fertilizing = tokenStorage.isNotificationEnabled(TokenStorage.NOTIF_FERTILIZE),
        transplant  = tokenStorage.isNotificationEnabled(TokenStorage.NOTIF_TRANSPLANT)
    )

    fun setFrost(enabled: Boolean) {
        tokenStorage.setNotificationEnabled(TokenStorage.NOTIF_FROST, enabled)
        _settings.value = _settings.value.copy(frost = enabled)
    }
    fun setHeat(enabled: Boolean) {
        tokenStorage.setNotificationEnabled(TokenStorage.NOTIF_HEAT, enabled)
        _settings.value = _settings.value.copy(heat = enabled)
    }
    fun setWatering(enabled: Boolean) {
        tokenStorage.setNotificationEnabled(TokenStorage.NOTIF_WATERING, enabled)
        _settings.value = _settings.value.copy(watering = enabled)
    }
    fun setFertilizing(enabled: Boolean) {
        tokenStorage.setNotificationEnabled(TokenStorage.NOTIF_FERTILIZE, enabled)
        _settings.value = _settings.value.copy(fertilizing = enabled)
    }
    fun setTransplant(enabled: Boolean) {
        tokenStorage.setNotificationEnabled(TokenStorage.NOTIF_TRANSPLANT, enabled)
        _settings.value = _settings.value.copy(transplant = enabled)
    }

    /** Отключает автопродление подписки (доступ доживает до конца оплаченного периода). */
    fun cancelAutoRenew() {
        viewModelScope.launch { subscriptionManager.cancelAutoRenew() }
    }

    fun logout() {
        tokenStorage.logout()
        _loggedOut.value = true
    }
}
