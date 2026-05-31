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
    @Json(name = "garden_id") val gardenId: Int? = null,
    val tasks: List<TodayTask> = emptyList(),
    val weather: WeatherSummary? = null,
    @Json(name = "generated_at") val generatedAt: String = ""
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
    @Json(name = "temp_c") val tempC: Double?,
    @Json(name = "temp_min") val tempMin: Double?,
    @Json(name = "temp_max") val tempMax: Double?,
    val humidity: Int?,
    val condition: String?,
    @Json(name = "condition_text") val conditionText: String?,
    @Json(name = "frost_risk") val frostRisk: Boolean?,
    @Json(name = "heat_risk") val heatRisk: Boolean?
)

// --- WeatherSnapshot (GET /weather) ---

@JsonClass(generateAdapter = true)
data class WeatherSnapshot(
    val id: Int,
    @Json(name = "garden_id") val gardenId: Int,
    @Json(name = "temp_c") val tempC: Double?,
    @Json(name = "min_temp_c") val minTempC: Double?,
    @Json(name = "max_temp_c") val maxTempC: Double?,
    @Json(name = "humidity_pct") val humidityPct: Int?,
    @Json(name = "wind_ms") val windMs: Double?,
    @Json(name = "precip_mm") val precipMm: Double?,
    val condition: String?,
    @Json(name = "condition_text") val conditionText: String?,
    @Json(name = "frost_risk") val frostRisk: Boolean?,
    @Json(name = "heat_risk") val heatRisk: Boolean?,
    @Json(name = "fetched_at") val fetchedAt: String
)

// --- Recommendation ---

@JsonClass(generateAdapter = true)
data class Recommendation(
    val type: String,       // watering | frost_alert | harvest_ready
    val priority: String,   // critical | high | medium | low
    @Json(name = "planting_id") val plantingId: Int?,
    @Json(name = "crop_name") val cropName: String?,
    val message: String
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
    val type: String?,                                // watering | fertilizing | treatment | custom
    val message: String?,
    @Json(name = "remind_at") val remindAt: String,  // ISO 8601: "2026-06-15T08:00:00Z"
    @Json(name = "is_sent") val isSent: Boolean?,
    @Json(name = "planting_id") val plantingId: Int?,
    @Json(name = "crop_name") val cropName: String?
)

// --- Planting ---

@JsonClass(generateAdapter = true)
data class Planting(
    val id: Int,
    @Json(name = "crop_id") val cropId: Int,
    @Json(name = "crop_name") val cropName: String?,
    @Json(name = "garden_id") val gardenId: Int,
    val stage: String,             // sowing | sprouted | growing | flowering | harvesting | done
    @Json(name = "planted_at") val sownAt: String?,     // колонка planted_at в БД
    @Json(name = "expected_harvest_at") val expectedHarvestAt: String?,
    val notes: String?,
    @Json(name = "last_action_at") val lastActionAt: String? = null
)

// --- Crop ---

@JsonClass(generateAdapter = true)
data class ClimateZoneWindow(
    @Json(name = "sow_start") val sowStart: Int?,
    @Json(name = "sow_end") val sowEnd: Int?,
    @Json(name = "transplant_start") val transplantStart: Int?,
    @Json(name = "transplant_end") val transplantEnd: Int?
)

@JsonClass(generateAdapter = true)
data class WateringStage(
    @Json(name = "freq_days") val freqDays: Int?,
    @Json(name = "amount_l_m2") val amountLM2: Int?
)

// watering_details содержит стадии + строковый ключ "notes" — типизируем явно
@JsonClass(generateAdapter = true)
data class WateringDetails(
    val seedling: WateringStage? = null,
    val sprouted: WateringStage? = null,
    val growing: WateringStage? = null,
    val flowering: WateringStage? = null,
    val fruiting: WateringStage? = null,
    val harvesting: WateringStage? = null,
    val notes: String? = null
)

@JsonClass(generateAdapter = true)
data class FertilizingEntry(
