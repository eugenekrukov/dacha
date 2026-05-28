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

    // Reminders
    @GET("reminders")
    suspend fun getReminders(): List<Reminder>

    // Plantings
    @GET("plantings")
    suspend fun getPlantings(): List<Planting>

    // Today
    @GET("today")
    suspend fun getToday(@Query("garden_id") gardenId: Int): TodayResponse
}
