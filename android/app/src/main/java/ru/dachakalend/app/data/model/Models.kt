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
    @field:Json(name = "garden_id") val gardenId: Int? = null,
    val tasks: List<TodayTask> = emptyList(),
    val weather: WeatherSummary? = null,
    @field:Json(name = "generated_at") val generatedAt: String = ""
)

@JsonClass(generateAdapter = true)
data class TodayTask(
    val type: String,          // frost_alert | transplant_due | watering_due | harvest_due | reminder
    val priority: Int,
    val title: String,
    val description: String,
    @field:Json(name = "planting_id") val plantingId: Int?,
    @field:Json(name = "crop_name") val cropName: String?,
    @field:Json(name = "days_overdue") val daysOverdue: Int?
)

@JsonClass(generateAdapter = true)
data class WeatherSummary(
    @field:Json(name = "temp_min") val tempMin: Double?,
    @field:Json(name = "temp_max") val tempMax: Double?,
    val humidity: Int?,
    val condition: String?,
    @field:Json(name = "frost_risk") val frostRisk: Boolean?
)

// --- Register ---

@JsonClass(generateAdapter = true)
data class RegisterRequest(
    val name: String,
    val email: String,
    val password: String
)

// --- Reminder ---

@JsonClass(generateAdapter = true)
data class Reminder(
    val id: Int,
    val title: String,
    val message: String?,
    @field:Json(name = "remind_at") val remindAt: String,  // ISO 8601: "2026-06-15T08:00:00Z"
    @field:Json(name = "is_sent") val isSent: Boolean?,
    @field:Json(name = "planting_id") val plantingId: Int?
)

// --- Planting ---

@JsonClass(generateAdapter = true)
data class Planting(
    val id: Int,
    @field:Json(name = "crop_id") val cropId: Int,
    @field:Json(name = "crop_name") val cropName: String?,
    @field:Json(name = "garden_id") val gardenId: Int,
    val stage: String,             // sowing | sprouted | growing | flowering | harvesting | done
    @field:Json(name = "sown_at") val sownAt: String?,
    @field:Json(name = "expected_harvest_at") val expectedHarvestAt: String?,
    val notes: String?
)

// --- Crop ---

@JsonClass(generateAdapter = true)
data class Crop(
    val id: Int,
    val name: String,
    val category: String,               // vegetables | greens | fruits | berries | flowers
    @field:Json(name = "sowing_start_day") val sowingStartDay: Int?,
    @field:Json(name = "sowing_end_day") val sowingEndDay: Int?,
    @field:Json(name = "transplant_days") val transplantDays: Int?,
    @field:Json(name = "harvest_days") val harvestDays: Int?,
    @field:Json(name = "watering_freq_days") val wateringFreqDays: Int?,
    @field:Json(name = "frost_sensitive") val frostSensitive: Boolean?,
    @field:Json(name = "companion_crops") val companionCrops: String?,
    val notes: String?
)

// --- Planting requests ---

@JsonClass(generateAdapter = true)
data class CreatePlantingRequest(
    @field:Json(name = "crop_id") val cropId: Int,
    @field:Json(name = "garden_id") val gardenId: Int,
    val stage: String = "sowing",
    @field:Json(name = "sown_at") val sownAt: String?,   // ISO date "2026-05-28"
    val notes: String? = null
)

// --- ActionLog ---

@JsonClass(generateAdapter = true)
data class ActionLog(
    val id: Int,
    @field:Json(name = "planting_id") val plantingId: Int,
    @field:Json(name = "crop_name") val cropName: String?,
    val type: String,       // watering | fertilizing | treatment | other
    val notes: String?,
    @field:Json(name = "logged_at") val loggedAt: String
)

@JsonClass(generateAdapter = true)
data class CreateActionRequest(
    @field:Json(name = "planting_id") val plantingId: Int,
    val type: String,
    val notes: String? = null
)

// --- Reminder request ---

@JsonClass(generateAdapter = true)
data class CreateReminderRequest(
    val title: String,
    val message: String? = null,
    @field:Json(name = "remind_at") val remindAt: String,   // ISO 8601
    @field:Json(name = "planting_id") val plantingId: Int? = null
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
    @field:Json(name = "soil_type") val soilType: String?,
    @field:Json(name = "climate_zone") val climateZone: String?
)
