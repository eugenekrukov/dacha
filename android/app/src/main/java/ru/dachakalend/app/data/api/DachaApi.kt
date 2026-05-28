package ru.dachakalend.app.data.api

import retrofit2.http.*
import ru.dachakalend.app.data.model.*

interface DachaApi {

    // Auth
    @POST("auth/register")
    suspend fun register(@Body request: RegisterRequest): AuthResponse

    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): AuthResponse

    @GET("auth/me")
    suspend fun getMe(): UserProfile

    // Gardens
    @GET("gardens")
    suspend fun getGardens(): List<Garden>

    @POST("gardens")
    suspend fun createGarden(@Body request: CreateGardenRequest): Garden

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

    // Actions
    @GET("actions")
    suspend fun getActions(@Query("planting_id") plantingId: Int): List<ActionLog>

    @POST("actions")
    suspend fun createAction(@Body request: CreateActionRequest): ActionLog

    // Reminders
    @GET("reminders")
    suspend fun getReminders(): List<Reminder>

    @POST("reminders")
    suspend fun createReminder(@Body request: CreateReminderRequest): Reminder

    // Today
    @GET("today")
    suspend fun getToday(@Query("garden_id") gardenId: Int): TodayResponse
}
