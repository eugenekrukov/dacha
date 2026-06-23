import { tokenStore } from '../auth/storage'
import type {
  ActionLog,
  AnalyticsSummary,
  AuthResponse,
  BillingPlan,
  CreateGardenRequest,
  CreatePaymentResponse,
  CreatePlantingRequest,
  Crop,
  FeedResponse,
  Garden,
  GeocodeSuggestion,
  GuideEntry,
  GuideEntryDetail,
  GuideKind,
  Harvest,
  Planting,
  PlantingPhoto,
  PlantingStage,
  Recommendation,
  TodayResponse,
  UserProfile,
} from './types'

// В деве запросы идут через /api (Vite проксирует на прод с rewrite) — чтобы SPA-маршруты
// не конфликтовали с API-роутами. В проде SPA и API на одном домене → префикс пустой.
const BASE = import.meta.env.DEV ? '/api' : ''

export class ApiError extends Error {
  status: number
  code?: string
  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

type Json = Record<string, unknown>

async function request<T>(
  path: string,
  opts: { method?: string; body?: Json; auth?: boolean } = {},
): Promise<T> {
  const { method = 'GET', body, auth = true } = opts
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body) headers['Content-Type'] = 'application/json'
  if (auth) {
    const token = tokenStore.getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    // токен протух/невалиден — выходим
    tokenStore.clearAll()
    throw new ApiError(401, 'Требуется вход', 'unauthorized')
  }

  let data: unknown = null
  const text = await res.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!res.ok) {
    const d = (data ?? {}) as { error?: string; message?: string }
    throw new ApiError(res.status, d.error || d.message || `HTTP ${res.status}`, d.error)
  }

  return data as T
}

export const api = {
  // --- auth ---
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: { email, password }, auth: false }),
  register: (email: string, password: string) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: { email, password, store: 'web' }, auth: false }),
  me: () => request<UserProfile>('/auth/me'),
  forgotPassword: (email: string) =>
    request<{ ok: boolean }>('/auth/forgot-password', { method: 'POST', body: { email }, auth: false }),
  resetPassword: (email: string, code: string, password: string) =>
    request<{ ok: boolean }>('/auth/reset-password', {
      method: 'POST',
      body: { email, code, password },
      auth: false,
    }),

  // --- gardens ---
  getGardens: () => request<Garden[]>('/gardens'),
  createGarden: (body: CreateGardenRequest) =>
    request<Garden>('/gardens', { method: 'POST', body: body as unknown as Record<string, unknown> }),
  updateGarden: (id: number, body: CreateGardenRequest) =>
    request<Garden>(`/gardens/${id}`, { method: 'PUT', body: body as unknown as Record<string, unknown> }),
  geocodeSuggest: (q: string) =>
    request<GeocodeSuggestion[]>(`/geocode/suggest?q=${encodeURIComponent(q)}`),

  // --- crops ---
  getCrops: () => request<Crop[]>('/crops', { auth: false }),
  getCrop: (id: number) => request<Crop>(`/crops/${id}`, { auth: false }),

  // --- guide (справочник проблем) ---
  getGuide: (params?: { kind?: GuideKind; crop_id?: number; q?: string }) => {
    const qs = new URLSearchParams()
    if (params?.kind) qs.set('kind', params.kind)
    if (params?.crop_id) qs.set('crop_id', String(params.crop_id))
    if (params?.q) qs.set('q', params.q)
    const s = qs.toString()
    return request<GuideEntry[]>(`/guide${s ? `?${s}` : ''}`, { auth: false })
  },
  getGuideEntry: (slug: string) => request<GuideEntryDetail>(`/guide/${slug}`, { auth: false }),

  // --- plantings ---
  getPlantings: (gardenId: number) => request<Planting[]>(`/plantings?garden_id=${gardenId}`),
  getPlanting: (id: number) => request<Planting>(`/plantings/${id}`),
  createPlanting: (body: CreatePlantingRequest) =>
    request<Planting>('/plantings', { method: 'POST', body: body as unknown as Record<string, unknown> }),
  updateStage: (id: number, stage: PlantingStage) =>
    request<Planting>(`/plantings/${id}/stage`, { method: 'PATCH', body: { stage } }),
  deletePlanting: (id: number) =>
    request<{ deleted: boolean }>(`/plantings/${id}`, { method: 'DELETE' }),

  // --- actions ---
  getActions: (plantingId: number) =>
    request<ActionLog[]>(`/actions?planting_id=${plantingId}`),
  getAllActions: () => request<ActionLog[]>('/actions'),
  getGardenActions: (gardenId: number) =>
    request<ActionLog[]>(`/actions?garden_id=${gardenId}`),
  logAction: (plantingId: number, type: string, notes?: string) =>
    request<ActionLog>('/actions', {
      method: 'POST',
      body: { planting_id: plantingId, action_type: type, notes: notes ?? null },
    }),
  // --- photos (фото-дневник) ---
  getPhotos: (plantingId: number) =>
    request<PlantingPhoto[]>(`/photos?planting_id=${plantingId}`),
  uploadPhoto: async (
    plantingId: number,
    file: File,
    opts: { actionId?: number; caption?: string } = {},
  ): Promise<PlantingPhoto> => {
    const fd = new FormData()
    fd.append('planting_id', String(plantingId))
    if (opts.actionId != null) fd.append('action_id', String(opts.actionId))
    if (opts.caption) fd.append('caption', opts.caption)
    fd.append('file', file)
    const token = tokenStore.getToken()
    const res = await fetch(`${BASE}/photos`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd, // НЕ ставим Content-Type — браузер сам выставит boundary
    })
    if (!res.ok) {
      let code: string | undefined
      try { code = (await res.json()).code } catch { /* ignore */ }
      throw new ApiError(res.status, code === 'photo_limit_reached' ? 'Достигнут лимит фото' : `HTTP ${res.status}`, code)
    }
    return res.json()
  },
  deletePhoto: (id: number) =>
    request<void>(`/photos/${id}`, { method: 'DELETE' }),
  // Удаление записи действия вместе с привязанными фото (FK: фото удаляются на бэкенде).
  deleteAction: (id: number) =>
    request<{ deleted: boolean }>(`/actions/${id}`, { method: 'DELETE' }),

  // --- персональная лента «Мой участок» (P1) ---
  getFeed: (limit = 30, offset = 0) =>
    request<FeedResponse>(`/feed?limit=${limit}&offset=${offset}`),

  // CSV-экспорт журнала: нужен Bearer → тянем blob вручную (не через request()).
  fetchActionsCsv: async (): Promise<Blob> => {
    const token = tokenStore.getToken()
    const res = await fetch(`${BASE}/actions/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) throw new ApiError(res.status, 'Не удалось выгрузить CSV')
    return res.blob()
  },

  // --- harvests ---
  getHarvests: (gardenId: number) => request<Harvest[]>(`/harvests?garden_id=${gardenId}`),
  addHarvest: (plantingId: number, body: { weight_kg?: number; quantity?: number; notes?: string }) =>
    request<Harvest>('/harvests', {
      method: 'POST',
      body: { planting_id: plantingId, ...body },
    }),

  // --- analytics ---
  getAnalytics: () => request<AnalyticsSummary>('/analytics/summary'),

  // --- billing / promo ---
  createPayment: (plan: BillingPlan) =>
    request<CreatePaymentResponse>('/billing/create-payment', { method: 'POST', body: { plan } }),
  cancelAutoRenew: () =>
    request<{ auto_renew: boolean; subscription_until: string | null }>('/billing/cancel-autorenew', {
      method: 'POST',
    }),
  redeemPromo: (code: string) =>
    request<{ ok?: boolean; type?: string }>('/promo/redeem', { method: 'POST', body: { code } }),

  // --- email verification ---
  verifyEmail: (code: string) =>
    request<{ email_verified: boolean }>('/auth/verify-email', { method: 'POST', body: { code } }),
  resendVerification: () =>
    request<unknown>('/auth/resend-verification', { method: 'POST' }),

  // --- account management (П4) ---
  changePassword: (current_password: string, new_password: string) =>
    request<{ ok: boolean }>('/auth/password', { method: 'PATCH', body: { current_password, new_password } }),
  changeEmail: (new_email: string, password: string) =>
    request<{ ok: boolean }>('/auth/change-email', { method: 'POST', body: { new_email, password } }),
  confirmEmailChange: (code: string) =>
    request<{ email: string }>('/auth/confirm-email-change', { method: 'POST', body: { code } }),
  deleteAccount: (password: string) =>
    request<{ ok: boolean }>('/auth/me', { method: 'DELETE', body: { password } }),

  // --- today / recommendations ---
  getToday: (gardenId: number) => request<TodayResponse>(`/today?garden_id=${gardenId}`),
  getRecommendations: (gardenId: number) =>
    request<Recommendation[]>(`/recommendations?garden_id=${gardenId}`),
}
