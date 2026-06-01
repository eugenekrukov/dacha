package ru.dachakalend.app.ui.settings

import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import ru.dachakalend.app.data.local.TokenStorage
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
    private val tokenStorage: TokenStorage
) : ViewModel() {

    private val _settings = MutableStateFlow(loadSettings())
    val settings: StateFlow<NotificationSettings> = _settings.asStateFlow()

    private val _loggedOut = MutableStateFlow(false)
    val loggedOut: StateFlow<Boolean> = _loggedOut.asStateFlow()

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

    fun logout() {
        tokenStorage.logout()
        _loggedOut.value = true
    }
}
