---
tags: [dacha, android]
---

> обновлено: 2026-07-01, commit `945b12e`


# Android

Package: `ru.dachakalend.app` · minSdk 26 · target/compileSdk 36 · флейворы `rustore`/`gplay` (Samsung-флейвор и весь рекламный стек РСЯ удалены из кода 2026-06-30, платная модель).

## Структура
```
android/app/src/main/java/ru/dachakalend/app/
├── App.kt / MainActivity.kt
├── data/{api,local,model,repository}/
├── navigation/Navigation.kt
├── notification/DachaPushService.kt
└── ui/{auth,garden,today,calendar,crops,plantings,actions,harvest,analytics,theme}/
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
