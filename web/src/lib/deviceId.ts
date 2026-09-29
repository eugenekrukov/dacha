// Стабильный id браузера в localStorage — для метрик открытий (app_opens, article_opens).
// ponytail: без localStorage (приватный режим) — id на одну загрузку, такое открытие просто не свяжется с прошлыми.
export function webDeviceId(): string {
  const KEY = 'dacha_device_id'
  try {
    const saved = localStorage.getItem(KEY)
    if (saved) return saved
    const id = `web-${crypto.randomUUID()}`
    localStorage.setItem(KEY, id)
    return id
  } catch {
    return `web-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}
