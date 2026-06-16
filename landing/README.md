# Лендинг «Календарь дачника» (для модерации ЮKassa)

Одностраничный сайт-визитка приложения с описанием услуги, тарифами, офертой, политикой
конфиденциальности и контактами — то, что требует модерация ЮKassa и 54-ФЗ.

## Файлы
- `index.html` — лендинг (главная). Ссылка для ЮKassa: `https://dacha.studio1008.com/`
- `return.html` — страница «оплата завершена» (куда ЮKassa возвращает после оплаты).

## Реквизиты (заполнены)
- Самозанятый: **Крюков Евгений Владимирович**, ИНН **540861624727**.
- E-mail: **dacha@studio1008.com** (обращения, возвраты, чеки 54-ФЗ).

## Деплой на dacha.studio1008.com
Домен уже указывает на VPS, где на `/` стоит reverse-proxy к API (порт 3002). API использует пути
`/auth`, `/billing`, `/health`, `/gardens`, … — корневого маршрута `/` у API нет, поэтому статику
безопасно отдавать только на ТОЧНЫЙ `/`, не задевая API.

1. Скопировать файлы на VPS, напр. в `/var/www/dacha-landing/`.
2. В nginx-конфиге `dacha.studio1008.com` добавить ПЕРЕД `location / { proxy_pass … }`:

```nginx
# Лендинг — только точный корень, остальное (API) уходит на proxy_pass
location = / {
    root /var/www/dacha-landing;
    try_files /index.html =404;
}
# Страница возврата после оплаты ЮKassa
location = /billing/return {
    root /var/www/dacha-landing;
    try_files /return.html =404;
}
```

3. `sudo nginx -t && sudo systemctl reload nginx`.
4. Проверить: `https://dacha.studio1008.com/` → лендинг; `https://dacha.studio1008.com/health` → API `{status:ok}`.

> `YOOKASSA_RETURN_URL` в `.env` бэкенда → `https://dacha.studio1008.com/billing/return`
> (значение по умолчанию уже такое). Доступ выдаёт вебхук + поллинг в приложении, страница возврата
> носит информационный характер.

## Что показать модерации ЮKassa
В поле «сайт/приложение» при подключении магазина указать: `https://dacha.studio1008.com/`
