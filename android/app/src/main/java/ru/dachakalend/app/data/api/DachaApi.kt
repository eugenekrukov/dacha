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

    // Plantings
    @GET("plantings")
    suspend fun getPlantings(@Query("garden_id") gardenId: Int? = null): List<Planting>

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
