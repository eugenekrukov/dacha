package ru.dachakalend.app.data.repository

import ru.dachakalend.app.data.api.DachaApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Прямые платежи ЮKassa (замена RuStore Billing). createPayment возвращает ссылку оплаты
 * (confirmation_url), которую UI открывает в Chrome Custom Tab. Само продление доступа делает
 * серверный вебхук ЮKassa — клиент после возврата перечитывает /auth/me (SubscriptionManager.refresh).
 */
@Singleton
class BillingRepository @Inject constructor(
    private val api: DachaApi
) {
    /** Создаёт платёж по тарифу (monthly/yearly). Успех → URL для оплаты. */
    suspend fun createPayment(plan: String): Result<String> {
        return try {
            val res = api.createPayment(mapOf("plan" to plan))
            val url = res.confirmationUrl
            if (url.isNullOrBlank()) Result.Error("Не удалось получить ссылку на оплату")
            else Result.Success(url)
        } catch (e: Exception) {
            Result.Error(parseError(e))
        }
    }

    /** Отключает автопродление подписки (доступ доживает до конца оплаченного периода). */
    suspend fun cancelAutoRenew(): Result<Unit> {
        return try {
            api.cancelAutoRenew()
            Result.Success(Unit)
        } catch (e: Exception) {
            Result.Error(parseError(e))
        }
    }

    private fun parseError(e: Exception): String = when {
        e.message?.contains("503") == true -> "Оплата временно недоступна"
        e.message?.contains("Unable to resolve host") == true -> "Нет соединения с сервером"
        else -> "Не удалось оформить оплату"
    }
}
