# Единый блок «действие + заметка + фото» — дизайн (к реализации в следующей сессии)

**Дата:** 2026-06-22
**Статус:** утверждён, НЕ реализован (перенесено на следующую сессию).
**Текущий код:** `main` `cca04a3`. Незакоммиченный черновик `feed.js` откатан — репо чистое.

## Проблема

Сейчас действие+заметка и фото — **разные блоки**:
- Экран посадки («О посадке»): отдельно секция **«Дневник»** (сетка/лента фото) и отдельно **«История действий»** (текст: тип действия + заметка + дата).
- Глобальная лента **«Мой участок»** (`GET /feed`): показывает только фото (с ярлыком действия) + вехи; текстовых действий без фото нет; заметки не показываются.

Одно событие (записал действие, добавил заметку и фото) разрывается на два блока.

## Решение (утверждено)

**Единая запись = действие + заметка + прикреплённые фото в одной карточке.** Применить
на **обоих** экранах: экран посадки И глобальная лента «Мой участок».

### Модель элемента ленты (3 типа)

| type | смысл | поля |
|------|-------|------|
| `action` | запись действия | `action_id`, `action_type`, `note` (если не auto), `date`, `planting_id`, `crop_name`, `photos: [{photo_id, url, thumb_url}]` |
| `photo` | одиночное фото без действия (`action_id IS NULL`) | `photo_id`, `url`, `thumb_url`, `caption`, `date`, `planting_id`, `crop_name` |
| `milestone` | веха | `kind` (`sowing`/`first_harvest`/`done`), `date`, `planting_id`, `crop_name`, `weight_kg?` |

**Важно:** веху **`transplanted` убрать** — «высадка» теперь обычное действие `transplanting` и
показывается как `action`-запись (иначе дубль). Остаются вехи: `sowing`, `first_harvest`, `done`.

## Бэкенд — переписать `GET /feed`

Запись-центричная модель: действия (с заметкой и агрегированными фото) + одиночные фото + вехи.
Готовый запрос (проверен на сборку, но без тестов — переписать `feed.test.js` под новую форму):

```sql
SELECT type, ts, data FROM (
  -- действия: заметка (null если auto) + агрегированные фото
  SELECT 'action' AS type, al.logged_at::timestamptz AS ts,
         json_build_object(
           'action_id', al.id, 'action_type', al.action_type,
           'note', CASE WHEN al.auto THEN NULL ELSE al.notes END,
           'planting_id', al.planting_id, 'crop_name', c.name,
           'photos', COALESCE((
             SELECT json_agg(json_build_object('photo_id', pp.id) ORDER BY pp.taken_at)
             FROM planting_photos pp WHERE pp.action_id = al.id), '[]'::json)
         ) AS data
  FROM action_logs al
  JOIN plantings p ON p.id = al.planting_id
  JOIN gardens   g ON g.id = p.garden_id
  JOIN crops     c ON c.id = p.crop_id
  WHERE g.user_id = $1

  UNION ALL  -- одиночные фото (без действия)
  SELECT 'photo', pp.taken_at::timestamptz,
         json_build_object('photo_id', pp.id, 'planting_id', pp.planting_id,
                           'crop_name', c.name, 'caption', pp.caption)
  FROM planting_photos pp
  JOIN plantings p ON p.id = pp.planting_id
  JOIN gardens   g ON g.id = p.garden_id
  JOIN crops     c ON c.id = p.crop_id
  WHERE g.user_id = $1 AND pp.action_id IS NULL

  UNION ALL  -- посев
  SELECT 'milestone', p.planted_at::timestamptz,
         json_build_object('kind','sowing','planting_id',p.id,'crop_name',c.name)
  FROM plantings p JOIN gardens g ON g.id=p.garden_id JOIN crops c ON c.id=p.crop_id
  WHERE g.user_id=$1 AND p.planted_at IS NOT NULL

  UNION ALL  -- первый урожай
  SELECT 'milestone', h.harvested_at::timestamptz,
         json_build_object('kind','first_harvest','planting_id',h.planting_id,'crop_name',c.name,'weight_kg',h.weight_kg)
  FROM harvests h
  JOIN (SELECT planting_id, MIN(harvested_at) AS first_at FROM harvests GROUP BY planting_id) f
    ON f.planting_id=h.planting_id AND f.first_at=h.harvested_at
  JOIN plantings p ON p.id=h.planting_id JOIN gardens g ON g.id=p.garden_id JOIN crops c ON c.id=p.crop_id
  WHERE g.user_id=$1

  UNION ALL  -- завершение сезона
  SELECT 'milestone', p.updated_at::timestamptz,
         json_build_object('kind','done','planting_id',p.id,'crop_name',c.name)
  FROM plantings p JOIN gardens g ON g.id=p.garden_id JOIN crops c ON c.id=p.crop_id
  WHERE g.user_id=$1 AND p.stage='done'
) feed
ORDER BY ts DESC NULLS LAST
LIMIT $2 OFFSET $3
```

JS-постобработка: для `action` достроить `url`/`thumb_url` каждому `photos[]`; для `photo` —
`url`/`thumb_url`; `weight_kg` → `parseFloat`. Пагинация как сейчас (`next_offset`). **Без миграции.**

**Деплой нужен** (меняется контракт `/feed`): push → VPS fetch+reset → `pm2 restart dacha-api`.
⚠️ Контракт меняется — Android и бэкенд выкатывать согласованно (старое приложение со старой
моделью сломается на новом ответе). Поскольку фича ещё не у пользователей в проде (только debug на
устройстве), рассинхрон не критичен, но порядок: сначала Android-модель, потом деплой бэка.

## Android

### Модель (`Models.kt`)
- `FeedItem`: добавить `note: String?`, `photos: List<FeedPhoto>` (где `FeedPhoto(photoId, url, thumbUrl)`),
  оставить поля одиночного `photo` (`photoId/url/thumbUrl/caption`) и `milestone` (`kind/weightKg`).
- Новый `FeedPhoto` data class.

### Глобальная лента (`ProfileScreen.kt` / `FeedViewModel`)
- Рендер `action`-записи: иконка действия (`actionIcon(type)`) + название (`ACTION_TYPES.toMap()`) +
  заметка + ряд миниатюр (`photos`), дата. Тап по миниатюре → полноэкранный просмотр (с панелью
  Заменить/Удалить фото/Удалить запись — уже есть `PhotoActionsBar`).
- `photo` (одиночное) и `milestone` — как сейчас (`PhotoFeedRow`/`MilestoneFeedRow`).
- replace/delete/deleteAction в `FeedViewModel` уже есть — переиспользовать.

### Экран посадки (`PlantingInfoScreen.kt`)
- Слить **«Дневник»** и **«История действий»** в одну ленту (можно **клиентом**, без бэка:
  уже есть `state.recentActions` + `state.photos` с `actionId`).
  - Сгруппировать `photos` по `actionId`.
  - Для каждого действия из `recentActions`: карточка = иконка+название + заметка + миниатюры (его фото) + дата.
  - Фото с `actionId == null` (или без совпадения) — одиночные фото-карточки.
  - Группировка по месяцам (как сейчас), кнопки **Камера/Галерея** сверху + диалог «к какому действию?».
- Убрать отдельную секцию «История действий».
- Общую карточку записи вынести в `ui/feed/FeedComponents.kt` (переиспользовать на обоих экранах).

## Открытые нюансы (решить при реализации)
- **Многословность глобальной ленты:** теперь это полный журнал действий (вкл. авто-действия?).
  Возможно, в глобальной ленте показывать только действия с фото/заметкой ИЛИ все — уточнить, если будет «шумно».
- **Несколько фото на действие:** ряд миниатюр; тап открывает конкретное фото.
- **Дубли вех:** `transplanted` убран; проверить, что `first_harvest`/`done` не дублируют действия.
- **Свёртка повторов** (была в `collapseActions`) — решить, нужна ли в единой ленте.

## Что НЕ трогать (уже сделано и в проде, `cca04a3`)
Лента «Мой участок» (вкладка Профиль), камера+галерея, привязка фото к действию, замена/удаление фото,
удаление записи (каскад фото на бэке), панель действий сверху, фикс поля «Заметка» (скролл+Done).
