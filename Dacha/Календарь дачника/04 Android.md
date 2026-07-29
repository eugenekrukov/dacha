---
tags: [dacha, android]
---

> обновлено: 2026-07-29


# Android

Package: `ru.dachakalend.app` · minSdk 26 · target/compileSdk 36 · флейворы `rustore`/`gplay` (Samsung-флейвор и весь рекламный стек РСЯ удалены из кода 2026-06-30, платная модель).

## Структура
```
android/app/src/main/java/ru/dachakalend/app/
├── App.kt / MainActivity.kt
├── data/{api,local,model,repository}/
├── navigation/Navigation.kt
├── notification/DachaPushService.kt
└── ui/{auth,garden,today,calendar,crops,plantings,actions,harvest,analytics,
     feed,guide,journal,more,onboarding,paywall,profile,settings,splash,common,theme}/
```

## Паттерны кода
- ViewModel → `StateFlow<UiState>` (sealed: Loading/Success/Error)
- Repository → `Result<T>` (sealed: Success/Error/Loading)
- `runCatching` только для парсинга дат, иначе явный sealed
- DI через Hilt + `@Singleton` репозитории

Полные конвенции — `android/CONVENTIONS.md` в репо.

## Сборка
- `:app:compileGplayDebugKotlin` и аналоги по флейворам (без флейвора команды не существует)
- CLI-сборка с не-ASCII путём — нужен JBR JAVA_HOME + truststore для VK artifactory.
- Unit-тесты: исправлены 2026-06-25 (buildDir → `%LOCALAPPDATA%\dacha-android-build` из-за кириллического пути).

## Пуши
RuStore Push (флейвор rustore) / FCM (gplay). Дедупликация мёртвых токенов — `push_tokens`.

## Недавно добавлено (в `main`, ждёт релиза)
- Грядки + севооборот: поле «Место», пикер грядки + инлайн CRUD, подсказка севооборота (`ui/beds`, юнит-тест `RotationWarningTest`).
- Экран «Календарь» (`ui/calendar/`) показывает фазу Луны в сетке дней + карточку совета/«Не сажать» для выбранного дня — данные из `GET /moon-calendar` (`data/repository/MoonCalendarRepository.kt`). `MoonIcon.kt` рисует диск параметрически по фазе, не из готовых картинок.

## Связано
[[01 Архитектура]] · [[02 Backend]] · [[08 Статус и бэклог]]

## Версии и релизы
- В магазинах (Google Play и RuStore одновременно): **vc10 / 1.0.7** — free+premium вместо триала,
  напоминание об осмотре посадки, фикс переноса лейбла в нижнем меню.
- Готовится **vc11 / 1.0.8**: тёмная тема + фиксы (карточка подписки в тёмной теме, севооборот,
  формат дат на «Урожае»).
- Площадки на одной волне — отдельные тексты «Что нового» на два магазина больше не нужны.

## Добавлено позже (2026-07-08 … 07-29)
- **Пятый таб «Ещё»** (`ui/more/MoreScreen.kt`): справочник культур, болезни, настройки.
  «Профиль» перестроен на вкладки Лента / Статистика / Аккаунт.
- **Тёмная тема**: тумблер Система/Светлая/Тёмная в настройках (`TokenStorage.themeMode`),
  статус-бар синхронизируется с выбором. Грабли темы: карточки, хардкодившие светлый фон
  (`Color.White`, пастель), становились нечитаемы — проверять `MaterialTheme.colorScheme`,
  а не хардкод; для цвета акцента брать `colorScheme.primary` (тема задаёт его раздельно
  для светлой и тёмной).
- **Напоминание об осмотре посадки**: периодический локальный пуш через WorkManager
  (раз в день / 2 / 3 дня), backend не участвует.
- **Запрос оценки**: `AppReview.kt` во флейворе rustore зовёт нативный флоу RuStore
  (`requestReviewFlow`/`launchReviewFlow`) на 6-й день использования, один раз.
  В gplay — заглушка no-op: Google Play In-App Review подключим после публикации там.
