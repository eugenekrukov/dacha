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
import javax.inject.Inject

data class PaywallUiState(
    val status: SubscriptionStatus = SubscriptionStatus(),
    val isPurchasing: Boolean = false,
    val error: String? = null
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

    fun purchaseMonthly(activity: Activity) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isPurchasing = true, error = null)
            try {
                subscriptionManager.purchaseMonthly(activity)
                subscriptionManager.refresh()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = "Ошибка при оформлении подписки")
            } finally {
                _uiState.value = _uiState.value.copy(isPurchasing = false)
            }
        }
    }

    fun purchaseYearly(activity: Activity) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isPurchasing = true, error = null)
            try {
                subscriptionManager.purchaseYearly(activity)
                subscriptionManager.refresh()
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
            _uiState.value = _uiState.value.copy(isPurchasing = false)
        }
    }

    fun dismissError() {
        _uiState.value = _uiState.value.copy(error = null)
    }
}
