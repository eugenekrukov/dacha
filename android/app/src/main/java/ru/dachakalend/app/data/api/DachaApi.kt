package ru.dachakalend.app.data.api

import retrofit2.http.*
import retrofit2.http.HTTP
import retrofit2.http.Headers
import ru.dachakalend.app.data.model.*

interface DachaApi {

    // Auth
    @POST("auth/register")
    suspend fun register(@Body request: RegisterRequest): AuthResponse

    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): AuthResponse

    @GET("auth/me")
    suspend fun getMe(): UserProfile

    // Синхронизация статуса подписки на сервер (источник правды по подписке — RuStore на клиенте)
    @POST("auth/subscription")
    suspend fun syncSubscription(@Body body: Map<String, Boolean>)

    // Подтверждение email кодом из письма (текущий пользователь)
    @POST("auth/verify-email")
    suspend fun verifyEmail(@Body body: Map<String, String>)

    // Повторная отправка кода подтверждения
    @POST("auth/resend-verification")
    suspend fun resendVerification()

    // Сброс пароля: запрос кода на email (публичный)
    @POST("auth/forgot-password")
    suspend fun forgotPassword(@Body body: Map<String, String>)

    // Сброс пароля: установка нового пароля по коду (публичный)
    @POST("auth/reset-password")
    suspend fun resetPassword(@Body body: Map<String, String>)

    // Смена пароля залогиненным (нужен текущий)
    @PATCH("auth/password")
    suspend fun changePassword(@Body body: Map<String, String>)

    // Смена email — шаг 1: запрос кода на новый адрес
    @POST("auth/change-email")
    suspend fun changeEmail(@Body body: Map<String, String>)

    // Смена email — шаг 2: подтверждение кода
    @POST("auth/confirm-email-change")
    suspend fun confirmEmailChange(@Body body: Map<String, String>)

    // Удаление аккаунта
    @HTTP(method = "DELETE", path = "auth/me", hasBody = true)
    suspend fun deleteAccount(@Body body: Map<String, String>)

    // Погашение промокода — бесплатный доступ (lifetime / month)
    @POST("promo/redeem")
    suspend fun redeemPromo(@Body body: Map<String, String>): PromoRedeemResponse

    // Billing (ЮKassa) — создание платежа: возвращает ссылку на оплату (confirmation_url)
    @POST("billing/create-payment")
    suspend fun createPayment(@Body body: Map<String, String>): CreatePaymentResponse

    // Billing — отключить автопродление подписки
    @POST("billing/cancel-autorenew")
    suspend fun cancelAutoRenew()

    // Geocode
    @GET("geocode/suggest")
    suspend fun suggestCity(@Query("q") query: String): List<GeocodeSuggestion>

    // Gardens
    @GET("gardens")
    suspend fun getGardens(): List<Garden>

    @POST("gardens")
    suspend fun createGarden(@Body request: CreateGardenRequest): Garden

    @PUT("gardens/{id}")
    suspend fun updateGarden(@Path("id") id: Int, @Body request: UpdateGardenRequest): Garden

    // Crops
    @GET("crops")
    suspend fun getCrops(@Query("category") category: String? = null): List<Crop>

    @GET("crops/{id}")
    suspend fun getCrop(@Path("id") id: Int): Crop

    // Guide (справочник проблем: дефициты/болезни/вредители)
    @GET("guide")
    suspend fun getGuide(
        @Query("kind") kind: String? = null,
        @Query("crop_id") cropId: Int? = null,
        @Query("q") q: String? = null
    ): List<GuideEntry>

    @GET("guide/{slug}")
    suspend fun getGuideEntry(@Path("slug") slug: String): GuideEntryDetail

    // Plantings
    @GET("plantings")
    suspend fun getPlantings(@Query("garden_id") gardenId: Int? = null): List<Planting>

    @GET("plantings/{id}")
    suspend fun getPlanting(@Path("id") id: Int): Planting

    @POST("plantings")
    suspend fun createPlanting(@Body request: CreatePlantingRequest): Planting

    @PATCH("plantings/{id}/stage")
    suspend fun updatePlantingStage(
        @Path("id") id: Int,
        @Body body: Map<String, String>
    ): Planting

    @HTTP(method = "DELETE", path = "plantings/{id}", hasBody = false)
    suspend fun deletePlanting(@Path("id") id: Int)

    @PATCH("plantings/{id}/info")
    suspend fun updatePlantingInfo(
        @Path("id") id: Int,
        @Body request: UpdatePlantingInfoRequest
    ): Planting

    // Actions
    @GET("actions")
    suspend fun getActions(
        @Query("planting_id") plantingId: Int? = null,
        @Query("limit") limit: Int? = null
    ): List<ActionLog>

    @POST("actions")
    suspend fun createAction(@Body request: CreateActionRequest): ActionLog

    @DELETE("actions/{id}")
    suspend fun deleteAction(@Path("id") id: Int)

    // Photos (фото-дневник)
    @GET("photos")
    suspend fun getPhotos(@Query("planting_id") plantingId: Int): List<PlantingPhoto>

    @Multipart
    @POST("photos")
    suspend fun uploadPhoto(
        @Part("planting_id") plantingId: okhttp3.RequestBody,
        @Part("action_id") actionId: okhttp3.RequestBody?,
        @Part("caption") caption: okhttp3.RequestBody?,
        @Part file: okhttp3.MultipartBody.Part
    ): PlantingPhoto

    @DELETE("photos/{id}")
    suspend fun deletePhoto(@Path("id") id: Int)

    // Reminders
    @GET("reminders")
    suspend fun getReminders(): List<Reminder>

    @POST("reminders")
    suspend fun createReminder(@Body request: CreateReminderRequest): Reminder

    // Weather
    @GET("weather")
    suspend fun getWeather(@Query("garden_id") gardenId: Int): WeatherSnapshot

    // Recommendations
    @GET("recommendations")
    suspend fun getRecommendations(@Query("garden_id") gardenId: Int): List<Recommendation>

    // Push tokens
    @POST("push-tokens")
    suspend fun registerPushToken(@Body body: Map<String, String>)

    @HTTP(method = "DELETE", path = "push-tokens", hasBody = true)
    suspend fun deletePushToken(@Body body: Map<String, String>)

    // Harvests
    @GET("harvests")
    suspend fun getHarvests(@Query("garden_id") gardenId: Int? = null): List<Harvest>

    @POST("harvests")
    suspend fun createHarvest(@Body request: CreateHarvestRequest): Harvest

    // Today
    @GET("today")
    suspend fun getToday(@Query("garden_id") gardenId: Int): TodayResponse

    // Analytics
    @GET("analytics/summary")
    suspend fun getAnalyticsSummary(): AnalyticsSummary

    @GET("actions/export")
    @Headers("Accept: text/csv")
    suspend fun exportActions(): okhttp3.ResponseBody
}
