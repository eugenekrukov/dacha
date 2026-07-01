package ru.dachakalend.app.data.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

// --- Auth ---

@JsonClass(generateAdapter = true)
data class LoginRequest(
    val email: String,
    val password: String,
    val store: String? = null   // магазин установки (E5): rustore/gplay
)

@JsonClass(generateAdapter = true)
data class AuthResponse(
    val token: String,
    val user: UserProfile
)

@JsonClass(generateAdapter = true)
data class UserProfile(
    val id: Int,
    val name: String? = null,   // имя больше не собирается при регистрации; старые записи могут содержать
    val email: String,
    // Серверный триал (источник правды). login отдаёт без них → дефолты.
    @Json(name = "trial_active") val trialActive: Boolean = false,
    @Json(name = "trial_days_left") val trialDaysLeft: Int = 0,
    // Промо-доступ (только /auth/me). promoActive — активен сейчас, promoLifetime — навсегда,
    // promoUntil — ISO-дата окончания доступа (null если промо нет или оно вечное).
    @Json(name = "promo_active") val promoActive: Boolean = false,
    @Json(name = "promo_lifetime") val promoLifetime: Boolean = false,
    @Json(name = "promo_until") val promoUntil: String? = null,
    // Подтверждён ли email. login не отдаёт поле → дефолт true (не доставать баннером);
    // /auth/me и register отдают реальное значение (новый пользователь = false).
    @Json(name = "email_verified") val emailVerified: Boolean = true,
    // Подписка ЮKassa (только /auth/me). subscribed — активна сейчас; subscriptionUntil — ISO-дата
    // окончания (null если нет); autoRenew — включено автопродление; plan — monthly/yearly;
    // hasSavedCard — привязана ли карта для автосписания.
    @Json(name = "subscribed") val subscribed: Boolean = false,
    @Json(name = "subscription_until") val subscriptionUntil: String? = null,
    @Json(name = "auto_renew") val autoRenew: Boolean = false,
    @Json(name = "plan") val plan: String? = null,
    @Json(name = "has_saved_card") val hasSavedCard: Boolean = false,
    // Ожидающий подтверждения новый email (verify-first смена email; только /auth/me).
    @Json(name = "pending_email") val pendingEmail: String? = null
)

// Ответ POST /billing/create-payment — ссылка на оплату ЮKassa (открывается в Custom Tab).
@JsonClass(generateAdapter = true)
data class CreatePaymentResponse(
    @Json(name = "payment_id") val paymentId: String,
    @Json(name = "confirmation_url") val confirmationUrl: String? = null,
    val status: String = ""
)

@JsonClass(generateAdapter = true)
data class PromoRedeemResponse(
    val type: String,                                   // "lifetime" | "month" | "days"
    @Json(name = "promo_active") val promoActive: Boolean,
    @Json(name = "promo_lifetime") val promoLifetime: Boolean,
    @Json(name = "promo_until") val promoUntil: String? = null
)

// --- Today Screen ---

@JsonClass(generateAdapter = true)
data class TodayResponse(
    @Json(name = "garden_id") val gardenId: Int? = null,
    val tasks: List<TodayTask> = emptyList(),
    val weather: WeatherSummary? = null,
    val forecast: List<ForecastDay> = emptyList(),
    @Json(name = "generated_at") val generatedAt: String = ""
)

@JsonClass(generateAdapter = true)
data class TodayTask(
    val type: String,
    val priority: Int,
    val title: String,
    val description: String,
    @Json(name = "planting_id") val plantingId: Int?,
    @Json(name = "crop_name") val cropName: String?,
    @Json(name = "days_overdue") val daysOverdue: Int?,
    @Json(name = "care_task_name") val careTaskName: String? = null,
    // Рекомендованный препарат для care-задач-обработок (чем обрабатывать)
    val product: String? = null,
    @Json(name = "days_until") val daysUntil: Int? = null,
    // Групповая care-задача (несколько культур): посадки для мульти-посадочного действия.
    val crops: List<String>? = null,
    @Json(name = "planting_ids") val plantingIds: List<Int>? = null,
    @Json(name = "crop_names_with_ids") val cropNamesWithIds: List<CropRef>? = null,
)

@JsonClass(generateAdapter = true)
data class CropRef(
    val id: Int,
    val name: String,
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
    @Json(name = "heat_risk") val heatRisk: Boolean?,
    @Json(name = "precip_prob_pct") val precipProbPct: Int? = null,
    @Json(name = "soil_temp_c") val soilTempC: Double? = null
)

@JsonClass(generateAdapter = true)
data class ForecastDay(
    val date: String,
    @Json(name = "min_temp_c") val minTempC: Double?,
    @Json(name = "max_temp_c") val maxTempC: Double?,
    @Json(name = "precip_mm") val precipMm: Double?,
    @Json(name = "precip_prob_pct") val precipProbPct: Int?,
    val condition: String?,
    @Json(name = "condition_text") val conditionText: String?
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

// --- Moon calendar ---

@JsonClass(generateAdapter = true)
data class MoonDay(
    val date: String,
    @Json(name = "phaseFraction") val phaseFraction: Double, // 0..1, 0/1=новолуние, 0.5=полнолуние
    val illumination: Double,
    val favorable: Boolean,
    val label: String?,       // не null только для новолуния/полнолуния — предупреждающая метка
    val phaseLabel: String,   // общее название фазы (эмодзи + текст)
    val message: String
)

@JsonClass(generateAdapter = true)
data class MoonCalendarResponse(
    val days: List<MoonDay>,
    val today: MoonDay
)

// --- Recommendation ---

@JsonClass(generateAdapter = true)
data class Recommendation(
    val type: String,
    val priority: String,
    @Json(name = "planting_id") val plantingId: Int?,
    @Json(name = "crop_name") val cropName: String?,
    val message: String
)

// --- Register ---

@JsonClass(generateAdapter = true)
data class RegisterRequest(
    val email: String,
    val password: String,
    val store: String? = null   // магазин установки (E5): rustore/gplay
)

// --- Reminder ---

@JsonClass(generateAdapter = true)
data class Reminder(
    val id: Int,
    val type: String?,
    val message: String?,
    @Json(name = "remind_at") val remindAt: String,
    @Json(name = "is_sent") val isSent: Boolean?,
    @Json(name = "planting_id") val plantingId: Int?,
    @Json(name = "crop_name") val cropName: String?
)

// --- Planting ---

@JsonClass(generateAdapter = true)
data class NextCareTask(
    val name: String,
    @Json(name = "days_until") val daysUntil: Int
)

// Просроченная (или наступившая сегодня) care-задача — индикатор «Требует ухода»
// на карточке посадки. Источник — сервер (GET /plantings), а не кэш экрана «Сегодня».
@JsonClass(generateAdapter = true)
data class OverdueCareTask(
    val name: String,
    @Json(name = "days_overdue") val daysOverdue: Int,
    // Рекомендованный препарат для «Обработки» (чем обрабатывать); null для прочих care-задач
    val product: String? = null
)

@JsonClass(generateAdapter = true)
data class Planting(
    val id: Int,
    @Json(name = "crop_id") val cropId: Int,
    @Json(name = "crop_name") val cropName: String?,
    @Json(name = "garden_id") val gardenId: Int,
    val stage: String,
    @Json(name = "planted_at") val sownAt: String?,
    @Json(name = "expected_harvest_at") val expectedHarvestAt: String?,
    val variety: String? = null,
    @Json(name = "bed_id") val bedId: Int? = null,
    val notes: String?,
    @Json(name = "last_action_at") val lastActionAt: String? = null,
    val quantity: Int? = 1,
    val conditions: String? = "soil",
    @Json(name = "sowing_method") val sowingMethod: String? = "seedling",
    @Json(name = "watering_freq_days") val wateringFreqDays: Int? = null,
    @Json(name = "yield_per_plant_kg") val yieldPerPlantKg: Double? = null,
    @Json(name = "next_care_task") val nextCareTask: NextCareTask? = null,
    @Json(name = "overdue_care_task") val overdueCareTask: OverdueCareTask? = null
)

// --- Фото-дневник (F12) ---

@JsonClass(generateAdapter = true)
data class PlantingPhoto(
    val id: Int,
    @Json(name = "planting_id") val plantingId: Int,
    @Json(name = "action_id") val actionId: Int? = null,
    val caption: String? = null,
    @Json(name = "taken_at") val takenAt: String,
    val width: Int? = null,
    val height: Int? = null,
    val url: String,                                  // относительный: /photos/file/:id
    @Json(name = "thumb_url") val thumbUrl: String
)

// --- Лента «Мой участок» (GET /feed) ---

@JsonClass(generateAdapter = true)
data class FeedResponse(
    val items: List<FeedItem>,
    @Json(name = "next_offset") val nextOffset: Int? = null
)

// Фото, агрегированное в action-запись ленты.
@JsonClass(generateAdapter = true)
data class FeedPhoto(
    @Json(name = "photo_id") val photoId: Int,
    val url: String,                                  // относительный: /photos/file/:id
    @Json(name = "thumb_url") val thumbUrl: String
)

// Плоский элемент ленты. Запись-центричная модель (3 типа):
//   action    — действие + заметка + агрегированные фото (photos[]).
//   photo     — одиночное фото без действия (photoId/url/thumbUrl/caption).
//   milestone — веха (kind + по нужде weightKg).
@JsonClass(generateAdapter = true)
data class FeedItem(
    val type: String,                                 // "action" | "photo" | "milestone"
    val date: String,
    @Json(name = "planting_id") val plantingId: Int? = null,
    @Json(name = "crop_name") val cropName: String? = null,
    // action
    @Json(name = "action_id") val actionId: Int? = null,
    @Json(name = "action_type") val actionType: String? = null,
    val note: String? = null,
    val photos: List<FeedPhoto> = emptyList(),
    // photo (одиночное)
    @Json(name = "photo_id") val photoId: Int? = null,
    val caption: String? = null,
    val url: String? = null,
    @Json(name = "thumb_url") val thumbUrl: String? = null,
    // milestone
    val kind: String? = null,                         // sowing | first_harvest | done
    @Json(name = "weight_kg") val weightKg: Double? = null
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
data class CareTask(
    val name: String,
    @Json(name = "day_offset") val dayOffset: Int,
    @Json(name = "repeat_days") val repeatDays: Int? = null
)

@JsonClass(generateAdapter = true)
data class Crop(
    val id: Int,
    val name: String,
    val category: String,
    val family: String? = null,
    @Json(name = "image_url") val imageUrl: String? = null,
    @Json(name = "image_credit") val imageCredit: String? = null,
    @Json(name = "is_perennial") val isPerennial: Boolean? = null,
    @Json(name = "sowing_start_day") val sowingStartDay: Int?,
    @Json(name = "sowing_end_day") val sowingEndDay: Int?,
    @Json(name = "transplant_days") val transplantDays: Int?,
    @Json(name = "harvest_days") val harvestDays: Int?,
    @Json(name = "watering_freq_days") val wateringFreqDays: Int?,
    @Json(name = "frost_sensitive") val frostSensitive: Boolean?,
    @Json(name = "companion_crops") val companionCrops: String?,
    val notes: String?,
    @Json(name = "climate_zones") val climateZones: Map<String, ClimateZoneWindow>? = null,
    @Json(name = "watering_details") val wateringDetails: WateringDetails? = null,
    @Json(name = "fertilizing_schedule") val fertilizingSchedule: List<FertilizingEntry>? = null,
    val diseases: List<CropDisease>? = null,
    val pests: List<CropPest>? = null,
    @Json(name = "good_neighbors") val goodNeighbors: List<String>? = null,
    @Json(name = "bad_neighbors") val badNeighbors: List<String>? = null,
    @Json(name = "good_predecessors") val goodPredecessors: List<String>? = null,
    @Json(name = "care_tasks") val careTasks: List<CareTask>? = null
)

// --- Справочник проблем растений (GET /guide) ---

// Элемент списка справочника. kind: "deficiency" | "disease" | "pest".
@JsonClass(generateAdapter = true)
data class GuideEntry(
    val id: Int,
    val slug: String,
    val name: String,
    val kind: String,
    val element: String? = null,           // K/Ca/Mg/N/P/Fe/B — только для deficiency
    val category: String? = null,
    val danger: Int? = null,               // 1..3
    val symptoms: String? = null,
    val season: String? = null,
    @Json(name = "image_url") val imageUrl: String? = null,
    // Полные поля приходят из GET /guide; при фильтре по культуре — ещё и signs (признаки на культуре).
    val description: String? = null,
    val conditions: String? = null,
    val treatment: String? = null,
    val prevention: String? = null,
    val signs: String? = null
)

// Культура, поражаемая проблемой, с культуро-специфичными признаками.
@JsonClass(generateAdapter = true)
data class GuideCropLink(
    @Json(name = "crop_id") val cropId: Int,
    @Json(name = "crop_name") val cropName: String,
    val signs: String? = null,
    @Json(name = "image_url") val imageUrl: String? = null
)

// Деталь записи (GET /guide/:slug) — все поля + поражаемые культуры.
@JsonClass(generateAdapter = true)
data class GuideEntryDetail(
    val id: Int,
    val slug: String,
    val name: String,
    val kind: String,
    val element: String? = null,
    val category: String? = null,
    val danger: Int? = null,
    val description: String? = null,
    val symptoms: String? = null,
    val conditions: String? = null,
    val treatment: String? = null,
    val prevention: String? = null,
    val season: String? = null,
    @Json(name = "image_url") val imageUrl: String? = null,
    @Json(name = "image_credit") val imageCredit: String? = null,
    val crops: List<GuideCropLink> = emptyList()
)

// --- Planting requests ---

@JsonClass(generateAdapter = true)
data class CreatePlantingRequest(
    @Json(name = "crop_id") val cropId: Int,
    @Json(name = "garden_id") val gardenId: Int,
    val stage: String = "sowing",
    @Json(name = "planted_at") val sownAt: String?,
    val notes: String? = null,
    val quantity: Int = 1,
    val conditions: String = "soil",
    @Json(name = "sowing_method") val sowingMethod: String = "seedling",   // seedling | direct
    val variety: String? = null,
    @Json(name = "bed_id") val bedId: Int? = null
)

// --- UpdatePlantingInfoRequest ---

@JsonClass(generateAdapter = true)
data class UpdatePlantingInfoRequest(
    @Json(name = "planted_at") val plantedAt: String? = null,
    val quantity: Int? = null,
    val conditions: String? = null,
    @Json(name = "sowing_method") val sowingMethod: String? = null,
    val variety: String? = null,
    @Json(name = "bed_id") val bedId: Int? = null
)

// --- ActionLog ---

@JsonClass(generateAdapter = true)
data class ActionLog(
    val id: Int,
    @Json(name = "planting_id") val plantingId: Int,
    @Json(name = "crop_name") val cropName: String?,
    @Json(name = "action_type") val type: String,
    val notes: String?,
    // true = заметка подставлена автоматически (имя задачи/удобрения) → скрываем в журнале
    val auto: Boolean = false,
    @Json(name = "logged_at") val loggedAt: String,
    // F1: client_id связывает запись с операцией очереди; pending=true — синтетическая
    // «оптимистичная» запись, ещё не подтверждённая сервером (рисуем «↑ ждёт отправки»).
    @Json(name = "client_id") val clientId: String? = null,
    val pending: Boolean = false,
)

@JsonClass(generateAdapter = true)
data class CreateActionRequest(
    @Json(name = "planting_id") val plantingId: Int,
    val type: String,
    val notes: String? = null,
    val auto: Boolean = false,
    // F1: идемпотентность офлайн-очереди + клиентское время записи.
    @Json(name = "client_id") val clientId: String? = null,
    @Json(name = "logged_at") val loggedAt: String? = null,
)

// --- Reminder request ---

@JsonClass(generateAdapter = true)
data class CreateReminderRequest(
    val type: String,
    val message: String? = null,
    @Json(name = "remind_at") val remindAt: String,
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
    @Json(name = "plantings_count") val plantingsCount: Int = 0,
    @Json(name = "activity_by_day") val activityByDay: List<ActivityDay>,
    val onboarding: OnboardingProgress
)

@JsonClass(generateAdapter = true)
data class ActivityDay(
    val date: String,
    val count: Int
)

@JsonClass(generateAdapter = true)
data class OnboardingProgress(
    val garden: Boolean,
    val planting: Boolean,
    val action: Boolean,
    val harvest: Boolean
)

// --- Geocode ---

@JsonClass(generateAdapter = true)
data class GeocodeSuggestion(
    val name: String,
    @Json(name = "display_name") val displayName: String,
    val lat: Double,
    val lon: Double,
    val zone: String? = null  // климатическая зона "3"-"6", null если не определена
)

// --- Garden ---

@JsonClass(generateAdapter = true)
data class Garden(
    val id: Int,
    val name: String,
    val region: String?,
    val city: String? = null,
    val lat: Double? = null,
    val lon: Double? = null,
    @Json(name = "soil_type") val soilType: String?,
    @Json(name = "climate_zone") val climateZone: String?,
    @Json(name = "garden_type") val gardenType: String? = "soil"
)

@JsonClass(generateAdapter = true)
data class CreateGardenRequest(
    val name: String,
    val region: String?,
    val city: String? = null,
    val lat: Double? = null,
    val lon: Double? = null,
    @Json(name = "soil_type") val soilType: String?,
    @Json(name = "climate_zone") val climateZone: String?,
    @Json(name = "garden_type") val gardenType: String? = "soil"
)

@JsonClass(generateAdapter = true)
data class UpdateGardenRequest(
    val name: String,
    val region: String?,
    val city: String? = null,
    val lat: Double? = null,
    val lon: Double? = null,
    @Json(name = "soil_type") val soilType: String? = null,
    @Json(name = "climate_zone") val climateZone: String? = null,
    @Json(name = "garden_type") val gardenType: String? = null
)

// --- Garden beds (грядки) ---

@JsonClass(generateAdapter = true)
data class BedHistoryEntry(
    @Json(name = "crop_name") val cropName: String,
    val family: String? = null,
    val year: Int
)

@JsonClass(generateAdapter = true)
data class GardenBed(
    val id: Int,
    // В списке GET /gardens/:id/beds сервер garden_id не отдаёт — поле nullable.
    @Json(name = "garden_id") val gardenId: Int? = null,
    val name: String,
    val type: String,                       // "soil" | "greenhouse"
    val history: List<BedHistoryEntry> = emptyList()
)

@JsonClass(generateAdapter = true)
data class CreateBedRequest(
    val name: String,
    val type: String                        // "soil" | "greenhouse"
)

@JsonClass(generateAdapter = true)
data class UpdateBedRequest(
    val name: String? = null,
    val type: String? = null
)
