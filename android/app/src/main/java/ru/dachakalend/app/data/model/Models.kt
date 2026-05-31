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
    val notes: String?
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
    val stage: String?,
    val timing: String?,
    @Json(name = "fertilizer_type") val fertilizerType: String?,
    @Json(name = "product_example") val productExample: String?,
    val dose: String?,
    val method: String?,   // root | foliar
    val notes: String?
)

@JsonClass(generateAdapter = true)
data class CropDisease(
    val name: String,
    val symptoms: String?,
    val conditions: String?,
    val treatment: String?,
    val prevention: String?
)

@JsonClass(generateAdapter = true)
data class CropPest(
    val name: String,
    val signs: String?,
    val treatment: String?,
    val prevention: String?
)

@JsonClass(generateAdapter = true)
data class Crop(
    val id: Int,
    val name: String,
    val category: String,               // vegetable | herb | berry | flower
    @Json(name = "sowing_start_day") val sowingStartDay: Int?,
    @Json(name = "sowing_end_day") val sowingEndDay: Int?,
    @Json(name = "transplant_days") val transplantDays: Int?,
    @Json(name = "harvest_days") val harvestDays: Int?,
    @Json(name = "watering_freq_days") val wateringFreqDays: Int?,
    @Json(name = "frost_sensitive") val frostSensitive: Boolean?,
    @Json(name = "companion_crops") val companionCrops: String?,
    val notes: String?,
    // Расширенные поля (v2)
    @Json(name = "climate_zones") val climateZones: Map<String, ClimateZoneWindow>? = null,
    @Json(name = "watering_details") val wateringDetails: WateringDetails? = null,
    @Json(name = "fertilizing_schedule") val fertilizingSchedule: List<FertilizingEntry>? = null,
    val diseases: List<CropDisease>? = null,
    val pests: List<CropPest>? = null,
    @Json(name = "good_neighbors") val goodNeighbors: List<String>? = null,
    @Json(name = "bad_neighbors") val badNeighbors: List<String>? = null,
    @Json(name = "good_predecessors") val goodPredecessors: List<String>? = null
)

// --- Planting requests ---

@JsonClass(generateAdapter = true)
data class CreatePlantingRequest(
    @Json(name = "crop_id") val cropId: Int,
    @Json(name = "garden_id") val gardenId: Int,
    val stage: String = "sowing",
    @Json(name = "planted_at") val sownAt: String?,  // колонка planted_at в БД
    val notes: String? = null
)

// --- ActionLog ---

@JsonClass(generateAdapter = true)
data class ActionLog(
    val id: Int,
    @Json(name = "planting_id") val plantingId: Int,
    @Json(name = "crop_name") val cropName: String?,
    @Json(name = "action_type") val type: String,  // watering | fertilizing | treatment | other
    val notes: String?,
    @Json(name = "logged_at") val loggedAt: String
)

@JsonClass(generateAdapter = true)
data class CreateActionRequest(
    @Json(name = "planting_id") val plantingId: Int,
    val type: String,
    val notes: String? = null
)

// --- Reminder request ---

@JsonClass(generateAdapter = true)
data class CreateReminderRequest(
    val type: String,                                  // watering | fertilizing | treatment | custom
    val message: String? = null,
    @Json(name = "remind_at") val remindAt: String,   // ISO 8601
    @Json(name = "planting_id") val plantingId: Int? = null
)

// --- Harvest ---

@JsonClass(generateAdapter = true)
data class Harvest(
    val id: Int,
    @Json(name = "planting_id") val plantingId: Int,
    @Json(name = "crop_name") val cropName: String?,
    @Json(name = "weight_kg") val weightKg: Double?,
    val quantity: Int?,
    val notes: String?,
    @Json(name = "harvested_at") val harvestedAt: String
)

@JsonClass(generateAdapter = true)
data class CreateHarvestRequest(
    @Json(name = "planting_id") val plantingId: Int,
    @Json(name = "weight_kg") val weightKg: Double? = null,
    val quantity: Int? = null,
    val notes: String? = null
)

// --- Analytics ---

@JsonClass(generateAdapter = true)
data class AnalyticsSummary(
    val streak: Int,
    @Json(name = "total_actions") val totalActions: Int,
    @Json(name = "total_harvests") val totalHarvests: Int,
    @Json(name = "activity_by_day") val activityByDay: List<ActivityDay>,
    val onboarding: OnboardingProgress
)

@JsonClass(generateAdapter = true)
data class ActivityDay(
    val date: String,   // yyyy-MM-dd
    val count: Int
)

@JsonClass(generateAdapter = true)
data class OnboardingProgress(
    val garden: Boolean,
    val planting: Boolean,
    val action: Boolean,
    val harvest: Boolean
)

// --- Garden ---

@JsonClass(generateAdapter = true)
data class Garden(
    val id: Int,
    val name: String,
    val region: String?,
    @Json(name = "soil_type") val soilType: String?,
    @Json(name = "climate_zone") val climateZone: String?
)

@JsonClass(generateAdapter = true)
data class CreateGardenRequest(
    val name: String,
    val region: String?,
    val city: String? = null,
    @Json(name = "soil_type") val soilType: String?,
    @Json(name = "climate_zone") val climateZone: String?
)
