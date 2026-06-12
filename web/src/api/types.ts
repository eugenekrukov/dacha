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
  overdue_care_task?: OverdueCareTask | null
}

export interface TodayTask {
  type: string
  planting_id: number | null
  crop_name?: string
  care_task_name?: string | null
  product?: string | null
}

export interface TodayResponse {
  tasks: TodayTask[]
  // прочие поля /today (погода/сводка) добавим по мере портирования экрана
  [key: string]: unknown
}

export interface Recommendation {
  type: string
  priority?: string
  planting_id: number | null
  crop_name?: string | null
  message: string
}

export interface Crop {
  id: number
  name: string
  category?: string | null
  sowing_start_day?: number | null
  sowing_end_day?: number | null
  transplant_days?: number | null
  harvest_days?: number | null
  watering_freq_days?: number | null
  frost_sensitive?: boolean
  yield_per_plant_kg?: number | null
  notes?: string | null
  good_neighbors?: string[] | null
  bad_neighbors?: string[] | null
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

export type BillingPlan = 'monthly' | 'yearly'

export interface CreatePaymentResponse {
  payment_id: string
  confirmation_url: string
  status: string
}
