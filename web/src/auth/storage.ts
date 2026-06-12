// Bearer-токен и текущий gardenId в localStorage (зеркало Android TokenStorage).
const TOKEN_KEY = 'dacha_token'
const GARDEN_KEY = 'dacha_garden_id'

export const tokenStore = {
  getToken: (): string | null => localStorage.getItem(TOKEN_KEY),
  setToken: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clearToken: () => localStorage.removeItem(TOKEN_KEY),

  getGardenId: (): number => {
    const v = localStorage.getItem(GARDEN_KEY)
    return v ? parseInt(v, 10) : -1
  },
  setGardenId: (id: number) => localStorage.setItem(GARDEN_KEY, String(id)),

  clearAll: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(GARDEN_KEY)
  },
}
