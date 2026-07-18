// Модели — зеркало backend/src/routes/*. Имена полей = столбцы БД (snake_case).
// Канон enum-значений — android/CONVENTIONS.md §5a.

export interface AuthResponse {
  token: string
  user: UserProfile
}

export interface UserProfile {
  id: number
  email: string
  name?: string | null
  email_verified?: boolean
  plantings_limit?: number
  subscribed?: boolean
  subscription_until?: string | null
  auto_renew?: boolean
  plan?: string | null
  has_saved_card?: boolean
  promo_active?: boolean
  promo_lifetime?: boolean
  promo_until?: string | null
  store?: string | null
  pending_email?: string | null
}

export interface Garden {
  id: number
  name: string
  region?: string | null
  city?: string | null
  climate_zone?: string | null
  garden_type?: string | null
  planting_count?: number
}

export interface BedHistoryEntry {
  crop_name: string
  family: string | null
  year: number
}

export interface GardenBed {
  id: number
  garden_id: number
  name: string
  type: 'soil' | 'greenhouse'
  history: BedHistoryEntry[]
}

export type PlantingStage =
  | 'sowing'
  | 'transplanted'
  | 'growing'
  | 'flowering'
  | 'harvesting'
  | 'done'

export interface OverdueCareTask {
  name: string
  days_overdue: number
  product?: string | null
}

export interface Planting {
  id: number
  garden_id: number
  crop_id: number
  crop_name?: string
  stage: PlantingStage
  conditions?: 'soil' | 'greenhouse'
  sowing_method?: 'seedling' | 'direct'
  variety?: string | null
  bed_id?: number | null
  quantity?: number
  planted_at?: string
  yield_per_plant_kg?: number | null
  watering_freq_days?: number | null
  harvest_days?: number | null
  last_action_at?: string | null
  last_action_type?: string | null
  next_care_task?: NextCareTask | null
  overdue_care_task?: OverdueCareTask | null
}

// Формат formatTasks (backend todayLogic.js): готовые title/description + детали.
export interface CropRef {
  id: number
  name: string
}

export interface TodayTask {
  type: string
  priority?: number
  title: string
  description?: string
  planting_id: number | null
  crop_name?: string | null
  days_overdue?: number | null
  days_until?: number | null
  care_task_name?: string | null
  product?: string | null
  // Групповая care-задача (несколько культур): для мульти-посадочного действия.
  crops?: string[] | null
  planting_ids?: number[] | null
  crop_names_with_ids?: CropRef[] | null
}

export interface WeatherInfo {
  temp_c: number | null
  temp_min: number | null
  temp_max: number | null
  humidity: number | null
  condition: string | null
  condition_text: string | null
  frost_risk: boolean | null
  heat_risk: boolean | null
  precip_prob_pct: number | null
  soil_temp_c: number | null
}

export interface ForecastDay {
  date: string
  min_temp_c: number | null
  max_temp_c: number | null
  precip_mm: number | null
  precip_prob_pct: number | null
  condition: string | null
  condition_text: string | null
}

export interface TodayResponse {
  tasks: TodayTask[]
  weather: WeatherInfo | null
  forecast: ForecastDay[]
  garden_name?: string
  [key: string]: unknown
}

export interface Recommendation {
  type: string
  priority?: string
  planting_id: number | null
  crop_name?: string | null
  message: string
}

export interface MoonDay {
  date: string
  phaseFraction: number // 0..1, 0/1=новолуние, 0.5=полнолуние
  illumination: number // 0..1
  favorable: boolean
  label: string | null
  phaseLabel: string
  message: string
}

export interface MoonCalendarResponse {
  days: MoonDay[]
  today: MoonDay
}

export interface CareTask {
  name: string
  day_offset: number
  repeat_days?: number | null
}

// Болезни/вредители/подкормки/полив — зеркало backend crops schema (миграция 005) и android Models.kt.
export interface CropDisease {
  name: string
  symptoms?: string | null
  conditions?: string | null
  treatment?: string | null
  prevention?: string | null
}

export interface CropPest {
  name: string
  signs?: string | null
  treatment?: string | null
  prevention?: string | null
}

export interface FertilizingEntry {
  stage?: string | null
  timing?: string | null
  fertilizer_type?: string | null
  product_example?: string | null
  dose?: string | null
  method?: string | null
  notes?: string | null
}

export interface WateringStage {
  freq_days?: number | null
  amount_l_m2?: number | null
  notes?: string | null
}

export interface WateringDetails {
  seedling?: WateringStage | null
  sprouted?: WateringStage | null
  growing?: WateringStage | null
  flowering?: WateringStage | null
  fruiting?: WateringStage | null
  harvesting?: WateringStage | null
  notes?: string | null
}

export interface ClimateZoneWindow {
  sow_start?: number | null
  sow_end?: number | null
  transplant_start?: number | null
  transplant_end?: number | null
}

export interface Crop {
  id: number
  name: string
  category?: string | null
  family?: string | null
  image_url?: string | null
  image_credit?: string | null
  is_perennial?: boolean
  sowing_start_day?: number | null
  sowing_end_day?: number | null
  transplant_days?: number | null
  harvest_days?: number | null
  watering_freq_days?: number | null
  frost_sensitive?: boolean
  yield_per_plant_kg?: number | null
  notes?: string | null
  care_tasks?: CareTask[] | null
  good_neighbors?: string[] | null
  bad_neighbors?: string[] | null
  good_predecessors?: string[] | null
  diseases?: CropDisease[] | null
  pests?: CropPest[] | null
  watering_details?: WateringDetails | null
  fertilizing_schedule?: FertilizingEntry[] | null
  climate_zones?: Record<string, ClimateZoneWindow> | null
}

export interface NextCareTask {
  name: string
  days_until: number
}

// Канон значений — android/CONVENTIONS.md §5a
export type ActionType = 'watering' | 'fertilizing' | 'treatment' | 'other'

export interface ActionLog {
  id: number
  planting_id: number
  action_type: string
  notes?: string | null
  auto?: boolean
  logged_at: string
  crop_name?: string
}

// /geocode/suggest
export interface GeocodeSuggestion {
  name: string
  display_name: string
  lat: number
  lon: number
  zone?: string | null
}

export interface CreateGardenRequest {
  name: string
  city?: string
  region?: string
  climate_zone?: string
  garden_type?: 'soil' | 'greenhouse' | 'mixed'
}

export interface CreatePlantingRequest {
  garden_id: number
  crop_id: number
  planted_at?: string
  quantity?: number
  conditions?: 'soil' | 'greenhouse'
  sowing_method?: 'seedling' | 'direct'
  variety?: string
  bed_id?: number
}

export interface UpdatePlantingInfoRequest {
  planted_at?: string
  quantity?: number
  conditions?: 'soil' | 'greenhouse'
  sowing_method?: 'seedling' | 'direct'
  variety?: string
  bed_id?: number
}

export interface Harvest {
  id: number
  planting_id: number
  crop_name?: string
  weight_kg?: number | null
  quantity?: number | null
  notes?: string | null
  harvested_at: string
}

export interface AnalyticsSummary {
  streak: number
  total_actions: number
  total_harvests: number
  plantings_count: number
  activity_by_day: { date: string; count: number }[]
  onboarding: { garden: boolean; planting: boolean; action: boolean; harvest: boolean }
}

// Справочник проблем растений (дефициты/болезни/вредители) — зеркало backend routes/guide.js.
export type GuideKind = 'deficiency' | 'disease' | 'pest'

export interface GuideEntry {
  id: number
  slug: string
  name: string
  kind: GuideKind
  element?: string | null
  category?: string | null
  danger?: number | null
  symptoms?: string | null
  season?: string | null
  image_url?: string | null
  // Полные поля приходят из GET /guide (и /guide?crop_id=...). При фильтре по культуре —
  // ещё и signs (признаки, специфичные для этой культуры).
  description?: string | null
  conditions?: string | null
  treatment?: string | null
  prevention?: string | null
  signs?: string | null
}

export interface GuideCropLink {
  crop_id: number
  crop_name: string
  signs?: string | null
  image_url?: string | null
}

// Фото-дневник посадки (F12). url/thumb_url — относительные, требуют Bearer (см. AuthImage).
export interface PlantingPhoto {
  id: number
  planting_id: number
  action_id: number | null
  caption: string | null
  taken_at: string
  width: number | null
  height: number | null
  url: string        // /photos/file/:id
  thumb_url: string  // /photos/file/:id?thumb=1
}

export interface GuideEntryDetail extends GuideEntry {
  description?: string | null
  conditions?: string | null
  treatment?: string | null
  prevention?: string | null
  image_credit?: string | null
  crops?: GuideCropLink[]
}

// Персональная лента «Мой участок» (GET /feed) — зеркало backend/src/routes/feed.js.
// Запись-центричная модель: action (действие+заметка+фото), photo (одиночное фото), milestone (веха).
export interface FeedPhoto {
  photo_id: number
  url: string        // /photos/file/:id
  thumb_url: string  // /photos/file/:id?thumb=1
}

export type MilestoneKind = 'sowing' | 'first_harvest' | 'done'

export interface FeedItem {
  type: 'action' | 'photo' | 'milestone'
  date: string
  planting_id?: number | null
  crop_name?: string | null
  // action
  action_id?: number
  action_type?: string
  note?: string | null
  photos?: FeedPhoto[]
  // photo (одиночное, без привязки к действию)
  photo_id?: number
  caption?: string | null
  url?: string
  thumb_url?: string
  // milestone
  kind?: MilestoneKind
  weight_kg?: number | null
}

export interface FeedResponse {
  items: FeedItem[]
  next_offset: number | null
}

export type BillingPlan = 'monthly' | 'yearly'

export interface CreatePaymentResponse {
  payment_id: string
  confirmation_url: string
  status: string
}
