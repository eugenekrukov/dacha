package ru.dachakalend.app.ui.paywall

import android.app.Activity
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import ru.dachakalend.app.billing.SubscriptionManager
import ru.dachakalend.app.billing.SubscriptionStatus
import ru.dachakalend.app.data.repository.Result
import javax.inject.Inject

data class PaywallUiState(
    val status: SubscriptionStatus = SubscriptionStatus(),
    val isPurchasing: Boolean = false,
    val error: String? = null,
    val isRedeeming: Boolean = false,
    val redeemError: String? = null,
    // Явное событие «доступ только что выдан» (покупка/восстановление/промокод) → навигация на главную.
    // НЕ выводим из ambient-статуса, иначе экран, открытый из настроек при активном доступе,
    // моментально закрывался бы.
    val accessGranted: Boolean = false,
    // Текст тоста-подтверждения после успешного промокода (null для покупки/восстановления).
    val redeemMessage: String? = null
)

@HiltViewModel
class PaywallViewModel @Inject constructor(
    private val subscriptionManager: SubscriptionManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(PaywallUiState())
    val uiState: StateFlow<PaywallUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            subscriptionManager.status.collect { status ->
                _uiState.value = _uiState.value.copy(status = status)
            }
        }
        viewModelScope.launch { subscriptionManager.refresh() }
    }

    fun purchaseMonthly(activity: Activity) = runPurchase { subscriptionManager.purchaseMonthly(activity) }
    fun purchaseYearly(activity: Activity)  = runPurchase { subscriptionManager.purchaseYearly(activity) }

    private fun runPurchase(buy: suspend () -> Unit) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isPurchasing = true, error = null)
            try {
                buy()
                subscriptionManager.refresh()
                // Навигируем только если покупка реально дала доступ
                if (subscriptionManager.isAccessAllowed()) {
                    _uiState.value = _uiState.value.copy(accessGranted = true)
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = "Ошибка при оформлении подписки")
            } finally {
                _uiState.value = _uiState.value.copy(isPurchasing = false)
            }
        }
    }

    fun restorePurchases() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isPurchasing = true, error = null)
            subscriptionManager.refresh()
            val restored = subscriptionManager.isAccessAllowed()
            _uiState.value = _uiState.value.copy(
                isPurchasing = false,
                accessGranted = restored,
                error = if (restored) null else "Активная подписка не найдена"
            )
        }
    }

    fun dismissError() {
        _uiState.value = _uiState.value.copy(error = null)
    }

    /** Погашение промокода. При успехе показываем подтверждение и выдаём доступ (accessGranted). */
    fun redeemPromo(code: String) {
        val trimmed = code.trim()
        if (trimmed.isEmpty()) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isRedeeming = true, redeemError = null)
            when (val res = subscriptionManager.redeemPromo(trimmed)) {
                is Result.Success -> {
                    val msg = if (res.data.promoLifetime) "Промокод активирован — доступ навсегда"
                              else "Промокод активирован — доступ на 30 дней"
                    _uiState.value = _uiState.value.copy(
                        isRedeeming = false,
                        accessGranted = true,
                        redeemMessage = msg
                    )
                }
                is Result.Error   -> _uiState.value = _uiState.value.copy(isRedeeming = false, redeemError = res.message)
                is Result.Loading -> Unit
            }
        }
    }

    fun dismissRedeemError() {
        _uiState.value = _uiState.value.copy(redeemError = null)
    }
}
