package ru.dachakalend.app.data.api

import retrofit2.http.*
import ru.dachakalend.app.data.model.*

interface DachaApi {

    // Auth
    @POST("auth/register")
    suspend fun register(@Body request: LoginRequest): AuthResponse

    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): AuthResponse

    @GET("auth/me")
    suspend fun getMe(): UserProfile

    // Gardens
    @GET("gardens")
    suspend fun getGardens(): List<Garden>

    @POST("gardens")
    suspend fun createGarden(@Body request: CreateGardenRequest): Garden

    // Today
    @GET("today")
    suspend fun getToday(@Query("garden_id") gardenId: Int): TodayResponse
}
