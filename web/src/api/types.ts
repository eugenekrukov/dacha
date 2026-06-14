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
  trial_active?: boolean
  trial_days_left?: number
  subscribed?: boolean
  subscription_until?: string | null
  auto_renew?: boolean
  plan?: string | null
  has_saved_card?: boolean
  promo_active?: boolean
  promo_lifetime?: boolean
  promo_until?: string | null
  store?: string | null
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
export interface TodayTask {
  type: string
  priority?: number
  title: string
  description?: string
  planting_id: number | null
  crop_name?: string | null
  days_overdue?: number | null
  care_task_name?: string | null
  product?: string | null
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

export interface GuideEntryDetail extends GuideEntry {
  description?: string | null
  conditions?: string | null
  treatment?: string | null
  prevention?: string | null
  image_credit?: string | null
  crops?: GuideCropLink[]
}

export type BillingPlan = 'monthly' | 'yearly'

export interface CreatePaymentResponse {
  payment_id: string
  confirmation_url: string
  status: string
}
