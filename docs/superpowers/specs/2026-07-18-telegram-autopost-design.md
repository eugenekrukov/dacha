# Telegram-автопостер — дизайн

## Цель
Распространение приложения через новый Telegram-канал «Календарь дачника». Бот `@calendacha_bot`
(токен уже выпущен через BotFather) автоматически постит в канал контент из той же очереди, что
уже наполняется для ВК-автопостера (`vk_post_queue`, `backend/scripts/vk-queue.js load <файл>`).

## Архитектура
Переиспользуем существующий движок ВК-автопостера, а не строим параллельную инфраструктуру:

- **Миграция** (аддитивная, `ALTER TABLE vk_post_queue`): добавляет колонки
  `telegram_status TEXT NOT NULL DEFAULT 'pending'`, `telegram_post_url TEXT`, `telegram_error TEXT`,
  `telegram_attempts INTEGER NOT NULL DEFAULT 0`, `telegram_posted_at TIMESTAMPTZ` + частичный индекс
  по `telegram_status='pending'`. Статус Telegram-публикации независим от `status` (ВК) — если один
  канал упал, а другой прошёл, ретраится только упавший (ни `wall.post`, ни `sendMessage` не идемпотентны,
  повторный прогон не должен дублировать успешный пост).
- **`backend/src/services/telegramService.js`** — тонкая обёртка над Bot API (`sendPhoto`/`sendMessage`),
  без новых npm-зависимостей (глобальный `fetch`, как в `vkService.js`). Экспортирует `sendPost({ token,
  channelId, text, photoUrl })` → `{ messageId }`, и `postUrl(channelUsername, messageId)`.
  В отличие от ВК, ссылка в теле поста не режет охват в Telegram — не нужен трюк «ссылка первым
  комментарием», текст+ссылка идут одним сообщением/подписью к фото.
  Текст переиспользует `vkContent.queueMessage()` (уже снимает markdown-разметку исходных md-файлов) —
  без `parse_mode`, обычный plain text, чтобы не городить экранирование MarkdownV2.
- **`backend/src/jobs/telegramQueueJob.js`** — отдельный cron по образцу `vkQueueJob.js`
  (`runTelegramQueue`, `isEnabled`, `startTelegramQueueJob`), включается только если заданы
  `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHANNEL_ID`. Без env — idle, деплоить безопасно (как ВК-джоб).
  Выбирает до `BATCH=2` строк с `telegram_status='pending' AND scheduled_at <= NOW()`, независимо от
  `status` (ВК-поле) — так публикация в Telegram не блокируется исходом публикации в ВК и наоборот.
- Wiring в `backend/src/app.js` рядом с `startVkQueueJob(app.db)`.

## `.env` (Hetzner)
```
TELEGRAM_BOT_TOKEN=8333482648:AAFY...        # токен от BotFather, @calendacha_bot
TELEGRAM_CHANNEL_ID=@calendacha              # публичный канал → username вместо числового chat_id
TELEGRAM_POST_LINK=https://dacha.studio1008.com   # опц., деф. = лендинг
```
Канал должен быть **публичным** (с `@username`) — тогда `chat_id` для Bot API это сам username,
не нужно вычислять числовой id через `getUpdates`. Бота нужно добавить в канал админом с правом
«Публикация сообщений».

## Канал (создаётся владельцем вручную — Bot API не создаёт каналы)
- **Имя:** «Календарь дачника 🌻»
- **Username:** `@calendacha` (тот же бренд, что группа ВК `vk.ru/calendacha` и Дзен-канал)
- **Описание:** «Когда сажать, чем подкормить, что делать на грядках сегодня. Лунный календарь,
  сроки посадки, разбор вредителей и болезней — без воды. В приложении — персональные напоминания
  по вашему региону: dacha.studio1008.com»
- Шаги: создать канал → сделать публичным с `@calendacha` → добавить `@calendacha_bot` в
  администраторы с правом постинга.

## Тесты
`backend/src/__tests__/telegramQueue.test.js` по образцу `vkQueue.test.js`: `isEnabled`, успешная
публикация (фото+теги, независимый `telegram_status`), ошибка на 3-й попытке → `failed`, no-op без env.

## Деплой
Обычный backend (`reset --hard origin/main` + `pm2 restart`); миграция один раз через
`sudo -u postgres psql -d dacha_db -f backend/src/db/migrations/058_telegram_queue_columns.sql`
(`dacha_user` не имеет прав DDL на VPS — см. `CLAUDE.md`). Добавить `.env` на Hetzner,
`pm2 restart dacha-api`. Запись в `docs/DEPLOY.md` по аналогии с разделом «Автопостер ВК».

## Вне рамок
Ссылки на канал в футере лендинга/приложения/email (как сделано для ВК-группы) — отдельная
маленькая задача, не блокирует автопостер. Можно сделать сразу после того, как канал заработает.
