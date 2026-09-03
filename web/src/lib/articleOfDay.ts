import type { BlogPost } from '../api/types'

// «Статья дня» на экране «Сегодня» — чистая функция, без состояния на сервере.
// Одинаковая реализация на web и Android (см. spec §6): один и тот же день →
// одна и та же статья на обеих платформах и при перезаходе.
//
//   pool = статьи с месяцем публикации == месяц(today), сезонный контент
//   pool пуст → берём весь список; список пуст → null (секция не рисуется)
//   pool[dayOfYear(today) % pool.length]
export function pickArticleOfDay(items: BlogPost[], today: Date): BlogPost | null {
  const month = today.getMonth()
  const pool = items.filter((a) => new Date(a.published_at).getMonth() === month)
  const source = pool.length > 0 ? pool : items
  if (source.length === 0) return null

  const startOfYear = new Date(today.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((today.getTime() - startOfYear.getTime()) / 86_400_000)
  return source[dayOfYear % source.length]
}
