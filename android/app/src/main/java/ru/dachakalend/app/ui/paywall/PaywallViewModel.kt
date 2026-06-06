package ru.dachakalend.app.ui.paywall

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
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
    // Явное событие «доступ только что выдан» (оплата/промокод) → навигация на главную.
    // НЕ выводим из ambient-статуса, иначе экран, открытый из настроек при активном доступе,
    // моментально закрывался бы.
    val accessGranted: Boolean = false,
    // Текст тоста-подтверждения после успешного промокода (null для оплаты).
    val redeemMessage: String? = null,
    // Событие: открыть ссылку оплаты ЮKassa в Custom Tab (после открытия экран сбрасывает в null).
    val paymentUrl: String? = null
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

    /** Создаёт платёж и отдаёт UI ссылку для открытия в Custom Tab. */
    fun purchase(plan: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isPurchasing = true, error = null)
            when (val res = subscriptionManager.startPayment(plan)) {
                is Result.Success -> _uiState.value = _uiState.value.copy(isPurchasing = false, paymentUrl = res.data)
                is Result.Error   -> _uiState.value = _uiState.value.copy(isPurchasing = false, error = res.message)
                is Result.Loading -> Unit
            }
        }
    }

    /** Экран открыл Custom Tab — сбрасываем событие, чтобы не открыть повторно. */
    fun onPaymentLaunched() {
        _uiState.value = _uiState.value.copy(paymentUrl = null)
    }

    /**
     * После возврата из Custom Tab опрашиваем сервер: вебхук ЮKassa мог уже выдать доступ.
     * Несколько попыток с паузой — на случай задержки доставки вебхука.
     */
    fun checkAfterPayment() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isPurchasing = true)
            repeat(8) {
                subscriptionManager.refresh()
                if (subscriptionManager.isAccessAllowed()) {
                    _uiState.value = _uiState.value.copy(isPurchasing = false, accessGranted = true)
                    return@launch
                }
                delay(1500)
            }
            // Не дождались — не показываем ошибку (оплата могла быть отменена); просто снимаем спиннер.
            _uiState.value = _uiState.value.copy(isPurchasing = false)
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
