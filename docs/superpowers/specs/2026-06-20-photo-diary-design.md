# F12 — Фото-дневник посадок (UGC): дизайн

**Дата:** 2026-06-20
**Статус:** утверждён (брейнсторминг), готов к плану реализации
**Источник:** `docs/master-plan-2026.md` (2.2), `docs/product-research-2026.md` (F12)

## 1. Цель и рамки

Пользователь фотографирует свою посадку → копится **личная лента роста по датам**. Закрывает
пробел «нет фото в карточках посадок» руками юзера, даёт эмоциональное вовлечение (аудитория 40+),
retention и **слабо-размеченный датасет под будущую фото-диагностику** (F2, Claude Vision).

**Архитектура — гибрид (утверждено):** фото — самостоятельная сущность (`planting_photos`),
но захватывается из двух точек. Главная — **из листа действия** с фото-вложением: наполняет
дневник как побочный эффект обычного логирования (решает риск пустой ленты), без «ещё одной
соцсети». Вторая — **standalone** на экране посадки. Модель данных соц-готова с первого дня.

### В рамках этого спека
- Сущность `planting_photos` (с nullable `action_id`).
- Два входа захвата (из действия + standalone), обе платформы (Android + Web).
- **Личная приватная лента** посадки (просмотр на обеих платформах).
- Пайплайн обработки (sharp → webp 1600px + thumbnail), хранение на диске, приватная отдача
  через X-Accel-Redirect.
- Лимиты: free 3 / paid 30 фото на посадку, потолок ~1000/аккаунт.

### Вне рамок (отдельные Tier'ы позже)
- Публичный фид, кросс-юзер-лента «по культуре», лайки/комменты, шаринг.
- **🔒 Модерация запретного контента** — обязательный гейт ПЕРЕД любой публичностью. Для приватной
  ленты не требуется; **блокер соц-Tier'а** (без неё публичный фид не запускать).
- Оффлайн-кью загрузки (после F1 «офлайн Сегодня»). В v1 — загрузка сразу + ретрай по ошибке.
- Миграция на объектное хранилище (при давлении на диск; см. §7).
- AI-диагностика (F2) — дневник лишь копит данные.
- HEIC (iPhone) — пока reject с понятным сообщением; Android-first.

## 2. Модель данных

Миграция `044_planting_photos.sql`:

```sql
CREATE TABLE IF NOT EXISTS planting_photos (
  id           SERIAL PRIMARY KEY,
  planting_id  INTEGER NOT NULL REFERENCES plantings(id) ON DELETE CASCADE,
  action_id    INTEGER REFERENCES action_logs(id) ON DELETE SET NULL,
  taken_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),   -- из EXIF DateTimeOriginal или now
  caption      TEXT,
  visibility   VARCHAR(10) NOT NULL DEFAULT 'private', -- private|public (public — будущий Tier)
  file_path    TEXT NOT NULL,                          -- относительный путь webp (без thumbnail)
  width        INTEGER,
  height       INTEGER,
  bytes        INTEGER,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_planting_photos_timeline ON planting_photos(planting_id, taken_at DESC);
CREATE INDEX IF NOT EXISTS idx_planting_photos_action   ON planting_photos(action_id);
-- ALTER TABLE planting_photos OWNER TO dacha_user;  -- применить на VPS после psql -f под postgres
```

- `taken_at` — ось ленты. `thumbnail` отдельной колонкой не хранится: путь thumbnail выводится из
  `file_path` суффиксом `_t` (`<uuid>.webp` → `<uuid>_t.webp`).
- `visibility` заложен сразу, чтобы публичный фид не требовал миграции; в v1 всегда `private`.
- **Каскады:** удаление посадки и hard-delete аккаунта (миграция 036) чистят строки автоматически.
  Файлы на диске так НЕ удаляются — см. §4 (чистка).

## 3. Хранение на диске

Вне гита и вне сборки веба — отдельный каталог `/var/www/dacha-media/`:
```
/var/www/dacha-media/plantings/<planting_id>/<uuid>.webp     # основной, 1600px q80 (~210 КБ)
/var/www/dacha-media/plantings/<planting_id>/<uuid>_t.webp   # thumbnail ~400px (~15 КБ)
```
`file_path` в БД хранит относительный путь (`plantings/<id>/<uuid>.webp`) → базовый URL/каталог
можно сменить (переезд на объектное хранилище) без правки данных.

**Квота** считается из БД (source of truth, не файлы): `COUNT(*) WHERE planting_id` для лимита на
посадку, `COUNT(*)` по аккаунту (через join garden→user) для потолка.

## 4. Backend API

Новый модуль `routes/photos.js`, префикс `/photos`. Паттерны auth (`fastify.authenticate`) и
IDOR (`userOwnsPlanting`) — копия из `actions.js`.

Обработку изображения выносим за интерфейс **`services/imageService.js`** (resize/webp/exif/thumbnail
+ запись/удаление файлов) — роут тонкий, в тестах сервис мокается (паттерн `nalogService`/
`emailService`/`fcmService`).

### `POST /photos` (multipart/form-data)
- Поля: `planting_id` (обяз.), `action_id` (опц.), `caption` (опц.), `taken_at` (опц.), `file`.
- Auth + IDOR: `userOwnsPlanting(planting_id, user)`; если задан `action_id` — проверить, что он
  принадлежит этой же посадке (иначе 400/403).
- **Лимит:** активная платная подписка (через `access`-сервис) → 30/посадку, иначе (триал) →
  3/посадку; потолок аккаунта ~1000. Перебор → `409 { code: 'photo_limit_reached', limit }`.
- **Доступ:** `POST /photos` сам по себе НЕ под `requireAccess` (квота решает) — поэтому дневник
  достижим в рамках текущей access-модели приложения. Вход (A) «из действия» наследует
  `requireAccess` от `POST /actions` (логирование действия уже под гейтом); вход (B) standalone —
  доступен в пределах квоты. Истёкшие без подписки и так за paywall'ом до экранов посадок.
- Обработка (`imageService`, §5) → `INSERT` в `planting_photos` → `201` с объектом фото (вкл. `url`,
  `thumb_url`).

### `GET /photos?planting_id=`
- Лента посадки, scoped по владельцу (как `GET /actions`), сорт `taken_at DESC`.
- Отдаёт: `id`, `url`, `thumb_url`, `caption`, `taken_at`, `action_id`, `width`, `height`.

### `DELETE /photos/:id`
- Проверка владельца → `imageService` удаляет файлы (webp + thumbnail) → удалить строку → `204`.

### `GET /photos/file/:id` — приватная отдача байтов (X-Accel-Redirect)
- Проверка владельца/`visibility` → ответ с заголовком `X-Accel-Redirect: /media-internal/<file_path>`
  (или `_t` для thumbnail по query `?thumb=1`). Сами байты отдаёт nginx из `internal`-локации.
- `url`/`thumb_url` в ответах API указывают на этот эндпоинт.

### Чистка файлов
- `DELETE /photos/:id`, удаление посадки и аккаунта: **до** удаления строк собрать `file_path` и
  удалить файлы через `imageService`.
- Еженедельная джоба-сборщик осиротевших файлов (сверяет каталог с БД) — страховка.

## 5. Пайплайн обработки (`imageService`)

При загрузке (`sharp`):
1. Валидация: mime ∈ {jpeg, png, webp}, размер ≤ 10 МБ (стрим с лимитом, не в память целиком).
2. `rotate()` — применить EXIF-ориентацию.
3. Считать EXIF `DateTimeOriginal` → `taken_at` (если клиент не прислал).
4. `resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })` → webp q80 — основной кадр.
5. `resize(400, ...)` → webp — thumbnail.
6. **Срезать весь EXIF, включая GPS** (`withMetadata` НЕ вызывать / явно без metadata). Приватность +
   152-ФЗ: иначе уедут координаты дома. Дату уже извлекли в п.3.
7. Записать `<uuid>.webp` + `<uuid>_t.webp`; вернуть `{ file_path, width, height, bytes, taken_at }`.

**Разрешение 1600px — обоснование:** AI-вектор проекта — Claude Vision (F2), который и так даунскейлит
вход до ~1568px. Значит 1600px webp = «AI-готовое» разрешение; хранить тяжёлые оригиналы смысла нет.

## 6. Клиенты (Android + Web)

### Точки захвата (обе платформы)
**(A) Из листа действия** (`ActionLogBottomSheet` / web `ActionLogSheet`): кнопка «📷 Фото»
(камера/галерея). На сабмите: `POST /actions` → берём `action.id` → `POST /photos` с этим `action_id`.
Фото видно и в журнале (join по `action_id`), и в ленте посадки — одна строка, два представления.
- ⚠️ В **мульти-посадочном** режиме листа фото-вложение **отключено** (один кадр на много посадок
  неоднозначен).

**(B) Standalone** на экране посадки: секция «Дневник», «+ Добавить фото» → захват → `POST /photos`
с `action_id=null`.

### Лента (экран посадки)
Секция «Дневник» — сетка миниатюр (`thumb_url`) по `taken_at`; тап → полноэкранный просмотр (свайп),
подпись + дата + бейдж типа действия (если есть `action_id`), удаление из просмотра.

### Захват по платформам
- Android: системный photo picker (`PickVisualMedia`) + камера-intent; превью перед отправкой.
- Web: `<input type="file" accept="image/*" capture="environment">` (мобильный браузер → камера,
  десктоп → выбор файла).

### Надёжность загрузки (v1)
Грузим сразу с индикатором прогресса; ошибка → тост «не загрузилось, повторить». Полноценный
оффлайн-кью — после F1.

### Модели
- Android: `data class PlantingPhoto(id, url, thumbUrl, caption, takenAt, actionId, width, height)`.
- Web: тип `PlantingPhoto` в `api/types.ts` (те же поля, snake_case как в API).

## 7. Деплой-нюансы (грабли)

- Новые зависимости `@fastify/multipart` + `sharp` → `npm install` на VPS. `sharp` тянет нативный
  бинарь — на Linux x64 есть prebuilt, **проверить сборку на проде** обязательно.
- Миграция `044` → `psql -f` под postgres + **`ALTER TABLE planting_photos OWNER TO dacha_user`**.
- Создать `/var/www/dacha-media/` (пишет API-процесс, читает nginx).
- nginx: `internal`-локация `location /media-internal/ { internal; alias /var/www/dacha-media/; }`
  для X-Accel-Redirect; **`client_max_body_size` поднять до ~12 МБ** для аплоад-локации (дефолт 1 МБ
  → иначе 413). Бэкап конфига, `nginx -t`, reload.
- Объём хранилища (модель, средний профиль ~220 КБ/фото с thumbnail): на 68 ГБ свободного диска VPS —
  ~4–6 тыс. активных юзеро-сезонов; порог переезда на объектное хранилище ≈ 10k активных юзеров или
  2–3 сезона данных.

## 8. Тестирование

`__tests__/photos.test.js` (vitest, мок `imageService`):
- happy path загрузки (201, строка создана);
- IDOR: чужая посадка → 403;
- `action_id` не от этой посадки → 400/403;
- квота free (4-е фото → 409 `photo_limit_reached`), квота paid (31-е → 409);
- `GET` scoped по владельцу (чужие фото не видны);
- `DELETE` удаляет строку + вызывает удаление файлов; чужое → 403/404.

Цель — рост покрытия (база 312).

## 9. Открытые knob'ы (не блокеры)
- Дать ли триал-юзерам 30 фото (showcase) вместо 3 — по умолчанию 3.
- Точное число потолка аккаунта (~1000) — уточнить при росте.
