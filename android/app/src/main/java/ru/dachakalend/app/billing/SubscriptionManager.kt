package ru.dachakalend.app.billing

import android.app.Activity
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import ru.rustore.sdk.billingclient.RuStoreBillingClientFactory
import ru.rustore.sdk.billingclient.model.purchase.PaymentResult
import ru.rustore.sdk.billingclient.model.purchase.Purchase
import ru.rustore.sdk.billingclient.model.purchase.PurchaseState
import ru.dachakalend.app.data.local.TokenStorage
import ru.dachakalend.app.data.model.PromoRedeemResponse
import ru.dachakalend.app.data.repository.AuthRepository
import ru.dachakalend.app.data.repository.Result
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume

/** ID подписок из RuStore Консоль → Монетизация → Подписки */
object SubscriptionProduct {
    const val MONTHLY = "dacha_pro_monthly"   // 299 ₽/мес
    const val YEARLY  = "dacha_pro_yearly"    // 1990 ₽/год
}

data class SubscriptionStatus(
    val isSubscribed: Boolean = false,
    val isTrialActive: Boolean = false,
    val trialDaysLeft: Int = 0,
    val isPromo: Boolean = false,          // активен промо-доступ (по коду)
    val isPromoLifetime: Boolean = false,  // промо «навсегда»
    val isLoading: Boolean = false,
    val activeProductId: String? = null
) {
    val isAccessAllowed: Boolean get() = isSubscribed || isTrialActive || isPromo
}

@Singleton
class SubscriptionManager @Inject constructor(
    private val tokenStorage: TokenStorage,
    private val authRepository: AuthRepository
) {
    private val _status = MutableStateFlow(
        SubscriptionStatus(
            isTrialActive = tokenStorage.isTrialActive(),
            trialDaysLeft = tokenStorage.trialDaysLeft(),
            isLoading     = true
        )
    )
    val status: StateFlow<SubscriptionStatus> = _status.asStateFlow()

    /** Загружает реальный статус из RuStore + триал с сервера. Вызывается при старте и после покупки. */
    suspend fun refresh() {
        _status.value = _status.value.copy(isLoading = true)
        val purchases = fetchActivePurchases()
        val activeProductId = purchases.firstOrNull { purchase: Purchase ->
            purchase.productId in setOf(SubscriptionProduct.MONTHLY, SubscriptionProduct.YEARLY) &&
            purchase.purchaseState == PurchaseState.CONFIRMED
        }?.productId

        // Синхронизируем статус подписки на сервер (для серверного гейта платных действий).
        authRepository.syncSubscription(activeProductId != null)

        // Сервер — источник правды по триалу и промо; при сетевой ошибке — офлайн-фолбэк на TokenStorage.
        val me = authRepository.me()
        val (trialActive, trialDaysLeft) = when (me) {
            is Result.Success -> me.data.trialActive to me.data.trialDaysLeft
            else              -> tokenStorage.isTrialActive() to tokenStorage.trialDaysLeft()
        }
        val isPromo = (me as? Result.Success)?.data?.promoActive ?: _status.value.isPromo
        val isPromoLifetime = (me as? Result.Success)?.data?.promoLifetime ?: _status.value.isPromoLifetime

        _status.value = SubscriptionStatus(
            isSubscribed    = activeProductId != null,
            isTrialActive   = trialActive,
            trialDaysLeft   = trialDaysLeft,
            isPromo         = isPromo,
            isPromoLifetime = isPromoLifetime,
            isLoading       = false,
            activeProductId = activeProductId
        )
    }

    /**
     * Погашает промокод. При успехе сразу обновляет статус доступа из /auth/me.
     * Возвращает данные кода (тип/lifetime) — экран показывает подтверждение,
     * либо ошибку («не найден» / «уже использован»).
     */
    suspend fun redeemPromo(code: String): Result<PromoRedeemResponse> {
        return when (val res = authRepository.redeemPromo(code.trim())) {
            is Result.Success -> {
                // Оптимистично отражаем доступ и перечитываем серверный статус
                _status.value = _status.value.copy(
                    isPromo = res.data.promoActive,
                    isPromoLifetime = res.data.promoLifetime
                )
                refresh()
                Result.Success(res.data)
            }
            is Result.Error -> Result.Error(res.message)
            is Result.Loading -> Result.Loading
        }
    }

    fun isAccessAllowed(): Boolean = _status.value.isAccessAllowed

    suspend fun purchaseMonthly(activity: Activity) = purchase(SubscriptionProduct.MONTHLY)
    suspend fun purchaseYearly(activity: Activity)  = purchase(SubscriptionProduct.YEARLY)

    private suspend fun purchase(productId: String): Unit =
        suspendCancellableCoroutine { cont ->
            RuStoreBillingClientFactory.getSingleton()
                .purchases
                .purchaseProduct(productId = productId)
                .addOnSuccessListener { _: PaymentResult -> cont.resume(Unit) }
                .addOnFailureListener { _: Throwable     -> cont.resume(Unit) }
        }

    private suspend fun fetchActivePurchases(): List<Purchase> =
        suspendCancellableCoroutine { cont ->
            RuStoreBillingClientFactory.getSingleton()
                .purchases
                .getPurchases()
                .addOnSuccessListener { result: List<Purchase> -> cont.resume(result) }
                .addOnFailureListener { _: Throwable            -> cont.resume(emptyList()) }
        }
}
