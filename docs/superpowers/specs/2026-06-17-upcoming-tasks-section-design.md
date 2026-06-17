# Design: Секция «Скоро» на экране «Сегодня»

**Дата:** 2026-06-17  
**Статус:** Approved

## Проблема

Care-задачи показываются в «Задачах на сегодня» с опережением до +3 дней (для предупреждения пользователя заранее). Это ожидаемое поведение, но будущие работы смешаны с актуальными задачами, что вызывает путаницу.

## Решение

Разделить экран «Сегодня» на две секции:
- **«Задачи на сегодня»** — задачи, наступившие сегодня или просроченные (`daysUntil == 0`)
- **«Скоро»** — care-задачи, наступящие через 1–3 дня (`daysUntil > 0`), только просмотр

## Затронутые файлы

| Файл | Изменение |
|------|-----------|
| `backend/src/utils/todayLogic.js` | `formatTasks`: добавить `days_until` в возвращаемый объект |
| `android/.../data/model/Models.kt` | `TodayTask`: добавить поле `daysUntil: Int? = null` |
| `android/.../ui/today/TodayScreen.kt` | `TodayContent`: разбить tasks на два списка, добавить секцию «Скоро» |

## Детали реализации

### Backend (`todayLogic.js`)

В функции `formatTasks`, в возвращаемый объект добавить:
```js
days_until: t.days_until || null,
```

`days_until` уже вычисляется в `buildTasks` для care-задач с `diff > 0`, но не пробрасывается через `formatTasks`. Остальные типы задач (полив, пересадка, урожай) получат `null`.

### Android — `Models.kt`

```kotlin
data class TodayTask(
    val type: String,
    val priority: Int,
    val title: String,
    val description: String,
    @Json(name = "planting_id") val plantingId: Int?,
    @Json(name = "crop_name") val cropName: String?,
    @Json(name = "days_overdue") val daysOverdue: Int?,
    @Json(name = "care_task_name") val careTaskName: String? = null,
    val product: String? = null,
    @Json(name = "days_until") val daysUntil: Int? = null,   // новое поле
)
```

### Android — `TodayScreen.kt`

В начале `TodayContent` разбить `tasks`:
```kotlin
val currentTasks  = tasks.filter { (it.daysUntil ?: 0) == 0 }
val upcomingTasks = tasks.filter { (it.daysUntil ?: 0) > 0 }
```

**Секция «Задачи на сегодня»** — без изменений, рендерит `currentTasks`.  
Условие видимости: `currentTasks.isNotEmpty()` (вместо `tasks.isNotEmpty()`).

**Секция «Скоро»** — добавляется после существующих задач, перед «Советами дня»:
- Заголовок: `SectionTitle(icon = Icons.Default.CalendarMonth, title = "Скоро")`
- Карточки: `SunnyTaskCard(task = task, onClick = null)` — без тапа (просмотр)
- Свайп (снуз/удалить) сохраняется — пользователь может убрать неактуальную будущую задачу
- Видима только если `upcomingTasks.isNotEmpty()`

**`EmptyTasksCard`** — логика не меняется: показывается если нет посадок или `tasks.isEmpty()` (объединённый список).

**`coachScrollIdx`** — обновить параметры `remember(...)` и логику подсчёта индексов:
```kotlin
val currentTasks  = tasks.filter { (it.daysUntil ?: 0) == 0 }
val upcomingTasks = tasks.filter { (it.daysUntil ?: 0) > 0 }
val coachScrollIdx = remember(weatherVisible, currentTasks.size, upcomingTasks.size, recsVisible) {
    var i = 0
    buildMap {
        if (weatherVisible) { put("weather", i); i++ }
        if (currentTasks.isNotEmpty()) {
            put("tasks", i)
            i += 1 + currentTasks.size  // заголовок + карточки
        } else if (plantings.isEmpty()) i++  // EmptyTasksCard
        if (upcomingTasks.isNotEmpty()) i += 1 + upcomingTasks.size  // заголовок + карточки
        if (recsVisible) { put("recs", i) }
    }
}
```
Coach mark ключ `"upcoming"` не нужен — только сдвиг индекса `"recs"`.

## Что не меняется

- Логика `buildTasks` в бэкенде — окно +3 дней остаётся
- Description карточек: «Через N дн.» уже генерируется `formatTasks`
- Snooze/delete для задач из «Скоро» работают так же, как для «Сегодня»
- Тесты `TodayViewModelTest` — не затрагиваются (фильтрация в UI-слое)
