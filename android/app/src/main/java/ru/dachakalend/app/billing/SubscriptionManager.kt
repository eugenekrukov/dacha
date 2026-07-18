package ru.dachakalend.app.billing

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import ru.dachakalend.app.data.local.TokenStorage
import ru.dachakalend.app.data.model.PromoRedeemResponse
import ru.dachakalend.app.data.repository.AuthRepository
import ru.dachakalend.app.data.repository.BillingRepository
import ru.dachakalend.app.data.repository.Result
import javax.inject.Inject
import javax.inject.Singleton

/** Идентификаторы тарифов для бэкенда ЮKassa. */
object SubscriptionProduct {
    const val MONTHLY = "monthly"   // 299 ₽/мес
    const val YEARLY  = "yearly"    // 1990 ₽/год
}

data class SubscriptionStatus(
    val isSubscribed: Boolean = false,
    val isPromo: Boolean = false,          // активен промо-доступ (по коду)
    val isPromoLifetime: Boolean = false,  // промо «навсегда»
    val promoUntil: String? = null,        // ISO-дата окончания промо-доступа (null = нет/вечно)
    val subscriptionUntil: String? = null, // ISO-дата окончания подписки (null = нет)
    val autoRenew: Boolean = false,        // включено ли автопродление
    val plan: String? = null,              // текущий тариф (monthly/yearly)
    val plantingsLimit: Int = 3,           // лимит free-тарифа (1 сад / N посадок, без ограничения по времени)
    val isLoading: Boolean = false
) {
    // Free-тариф бессрочный (лимит по числу посадок, не по времени) — доступ к самому приложению
    // есть всегда; isAccessAllowed отражает только «Дачник Про» (снят лимит посадок).
    val isAccessAllowed: Boolean get() = isSubscribed || isPromo
}

/**
 * Источник истины по доступу — сервер (/auth/me). Подписка приходит из вебхука ЮKassa
 * (не из стора). Оплата — через BillingRepository: createPayment → ссылка для Custom Tab,
 * после возврата клиент перечитывает статус (refresh).
 */
@Singleton
class SubscriptionManager @Inject constructor(
    private val tokenStorage: TokenStorage,
    private val authRepository: AuthRepository,
    private val billingRepository: BillingRepository
) {
    private val _status = MutableStateFlow(SubscriptionStatus(isLoading = true))
    val status: StateFlow<SubscriptionStatus> = _status.asStateFlow()

    /** Перечитывает статус доступа с сервера (подписка/промо/лимит free-тарифа). */
    suspend fun refresh() {
        _status.value = _status.value.copy(isLoading = true)
        when (val me = authRepository.me()) {
            is Result.Success -> {
                val d = me.data
                _status.value = SubscriptionStatus(
                    isSubscribed      = d.subscribed,
                    isPromo           = d.promoActive,
                    isPromoLifetime   = d.promoLifetime,
                    promoUntil        = d.promoUntil,
                    subscriptionUntil = d.subscriptionUntil,
                    autoRenew         = d.autoRenew,
                    plan              = d.plan,
                    plantingsLimit    = d.plantingsLimit,
                    isLoading         = false
                )
            }
            else -> {
                // Сетевая ошибка: оставляем статус как был, снимаем только isLoading.
                _status.value = _status.value.copy(isLoading = false)
            }
        }
    }

    /** Создаёт платёж в ЮKassa и возвращает confirmation_url для открытия в Custom Tab. */
    suspend fun startPayment(plan: String): Result<String> = billingRepository.createPayment(plan)

    /** Отключает автопродление и обновляет статус. */
    suspend fun cancelAutoRenew(): Result<Unit> {
        val res = billingRepository.cancelAutoRenew()
        if (res is Result.Success) refresh()
        return res
    }

    /**
     * Погашает промокод. При успехе сразу обновляет статус доступа из /auth/me.
     * Возвращает данные кода (тип/lifetime) — экран показывает подтверждение,
     * либо ошибку («не найден» / «уже использован»).
     */
    suspend fun redeemPromo(code: String): Result<PromoRedeemResponse> {
        return when (val res = authRepository.redeemPromo(code.trim())) {
            is Result.Success -> {
                _status.value = _status.value.copy(
                    isPromo = res.data.promoActive,
                    isPromoLifetime = res.data.promoLifetime,
                    promoUntil = res.data.promoUntil
                )
                refresh()
                Result.Success(res.data)
            }
            is Result.Error -> Result.Error(res.message)
            is Result.Loading -> Result.Loading
        }
    }

    fun isAccessAllowed(): Boolean = _status.value.isAccessAllowed
}
