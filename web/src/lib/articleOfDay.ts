import type { BlogPost } from '../api/types'

// «Статья дня» на экране «Сегодня» — чистая функция, без состояния на сервере.
// Одинаковая реализация на web и Android: один и тот же день → одна и та же статья
// на обеих платформах и при перезаходе.
//
// Контент блога уже сезонный (публикуется под текущие дачные работы) — просто берём
// статью, опубликованную сегодня, а если сегодня ничего не вышло — последнюю из уже
// опубликованных. Будущие (запланированные) статьи не показываем заранее.
export function pickArticleOfDay(items: BlogPost[], today: Date): BlogPost | null {
  const todayKey = dateKey(today)
  let best: BlogPost | null = null
  let bestKey = -1
  for (const item of items) {
    const key = dateKey(new Date(item.published_at))
    if (key > todayKey) continue
    if (key > bestKey) {
      best = item
      bestKey = key
    }
  }
  return best
}

function dateKey(d: Date): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
}
