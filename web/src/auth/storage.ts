// Bearer-токен и текущий gardenId в localStorage (зеркало Android TokenStorage).
const TOKEN_KEY = 'dacha_token'
const GARDEN_KEY = 'dacha_garden_id'
// Гостевой режим (POST /auth/guest): device_id — единственный «пароль» гостя, по нему сервер
// отдаёт того же гостя (в т.ч. когда истёк JWT). Стирается вместе с остальным в clearAll().
const GUEST_DEVICE_KEY = 'dacha_guest_device'
const GUEST_FLAG_KEY = 'dacha_is_guest'

export const tokenStore = {
  getToken: (): string | null => localStorage.getItem(TOKEN_KEY),
  setToken: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clearToken: () => localStorage.removeItem(TOKEN_KEY),

  getGardenId: (): number => {
    const v = localStorage.getItem(GARDEN_KEY)
    return v ? parseInt(v, 10) : -1
  },
  setGardenId: (id: number) => localStorage.setItem(GARDEN_KEY, String(id)),

  isGuest: (): boolean => localStorage.getItem(GUEST_FLAG_KEY) === '1',
  setGuest: (guest: boolean) =>
    guest ? localStorage.setItem(GUEST_FLAG_KEY, '1') : localStorage.removeItem(GUEST_FLAG_KEY),
  getGuestDeviceId: (): string => {
    let id = localStorage.getItem(GUEST_DEVICE_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(GUEST_DEVICE_KEY, id)
    }
    return id
  },

  clearAll: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(GARDEN_KEY)
    localStorage.removeItem(GUEST_DEVICE_KEY)
    localStorage.removeItem(GUEST_FLAG_KEY)
  },
}
