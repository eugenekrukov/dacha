package ru.dachakalend.app.data.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

// --- Auth ---

@JsonClass(generateAdapter = true)
data class LoginRequest(
    val email: String,
    val password: String
)

@JsonClass(generateAdapter = true)
data class AuthResponse(
    val token: String,
    val user: UserProfile
)

@JsonClass(generateAdapter = true)
data class UserProfile(
    val id: Int,
    val name: String,
    val email: String
)

// --- Today Screen ---

@JsonClass(generateAdapter = true)
data class TodayResponse(
    @Json(name = "garden_id") val gardenId: Int,
    val tasks: List<TodayTask>,
    val weather: WeatherSummary?,
    @Json(name = "generated_at") val generatedAt: String
)

@JsonClass(generateAdapter = true)
data class TodayTask(
    val type: String,          // frost_alert | transplant_due | watering_due | harvest_due | reminder
    val priority: Int,
    val title: String,
    val description: String,
    @Json(name = "planting_id") val plantingId: Int?,
    @Json(name = "crop_name") val cropName: String?,
    @Json(name = "days_overdue") val daysOverdue: Int?
)

@JsonClass(generateAdapter = true)
data class WeatherSummary(
    @Json(name = "temp_min") val tempMin: Double?,
    @Json(name = "temp_max") val tempMax: Double?,
    val humidity: Int?,
    val condition: String?,
    @Json(name = "frost_risk") val frostRisk: Boolean?
)

// --- Garden ---

@JsonClass(generateAdapter = true)
data class Garden(
    val id: Int,
    val name: String,
    val location: String?,
    val region: String?
)

@JsonClass(generateAdapter = true)
data class CreateGardenRequest(
    val name: String,
    val location: String?,
    val region: String?,
    @Json(name = "soil_type") val soilType: String?,
    @Json(name = "climate_zone") val climateZone: String?
)
