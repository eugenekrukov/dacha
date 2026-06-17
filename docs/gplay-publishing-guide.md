# Публикация «Календарь дачника» в Google Play

Гайд под наш проект: `applicationId = ru.dachakalend.app`, флейвор **gplay** (платная подписка ЮKassa, без рекламы), сборка — **AAB**.

> Актуально на июнь 2026. Требования Google Play меняются — сверяйся с Play Console.

---

## 0. Что важно знать заранее (две вещи, которые ломают планы)

### 0.1. Новый личный аккаунт → обязательное закрытое тестирование
Если аккаунт разработчика **личный и создан после 13 ноября 2023**, перед публикацией в продакшн нужно:
- запустить **закрытое тестирование (closed testing)**,
- набрать **минимум 12 тестировщиков**, которые **непрерывно остаются в тесте ≥ 14 дней**,
- только после этого открывается кнопка «Apply for production».

Это +2 недели к срокам. Обход: **организационный аккаунт**, верифицированный по бизнес-документам / D-U-N-S — он публикуется в продакшн сразу. Для ИП Крюков Е.В. можно завести org-аккаунт и пропустить 12 тестеров. Реши до старта, какой путь.

### 0.2. Целевой API level
- Сейчас новые приложения должны таргетить **минимум Android 15 (API 35)**.
- С **31 августа 2026** — **Android 16 (API 36)**.
- ✅ **Уже выполнено**: `compileSdk`/`targetSdk = 36` (Android 16) в [android/app/build.gradle.kts](../android/app/build.gradle.kts) — требование к новым приложениям закрыто с запасом.

---

## 1. Предусловия
- **Аккаунт Google Play Console** — разовый взнос **$25** (https://play.google.com/console). Личный или организационный (см. 0.1).
- **Keystore** — у нас уже есть (`C:\Users\e-kru\.android\dacha-release`, alias `key0`), подключён в build.gradle через `keystore.properties`. **НЕ потерять** — иначе обновления выложить не сможешь.
- **google-services.json** — на месте (нужен для FCM-пушей в gplay). Не удалять.

---

## 2. Сборка релизов через Android Studio

### Перед каждым билдом

1. Открыть проект: **File → Open → `android/`** (именно папка `android/`, не корень репо)
2. **File → Sync Project with Gradle Files** — дождаться завершения
3. Проверить `versionCode` и `versionName` в `app/build.gradle.kts`:
   - Текущие: `versionCode = 3`, `versionName = "1.0.1"`
   - **Перед каждой новой загрузкой вверх по `versionCode`** (монотонно растёт, уменьшить нельзя)

---

### 2.1. Сборка APK для RuStore (3-й билд)

RuStore принимает **APK** (не AAB).

1. **Build → Generate Signed Bundle / APK…**
2. Выбрать **APK** → **Next**
3. Заполнить keystore:
   - **Key store path:** `C:\Users\e-kru\.android\dacha-release`
   - **Key store password:** (из `android/keystore.properties`)
   - **Key alias:** `key0`
   - **Key password:** (из `android/keystore.properties`)
   - → **Next**
4. Выбрать только флейвор **rustore** (снять отметку с gplay/samsung)
5. Build Variants: **release**
6. Signature Versions: ✅ **V1 (Jar Signature)** + ✅ **V2 (Full APK Signature)**
7. **Finish**

Артефакт:
```
android/app/rustore/release/app-rustore-release.apk
```
Android Studio покажет уведомление «APK(s) generated successfully» → **locate**.

---

### 2.2. Сборка AAB для Google Play (1-й билд)

Google Play принимает **только AAB** (Android App Bundle).

1. **Build → Generate Signed Bundle / APK…**
2. Выбрать **Android App Bundle** → **Next**
3. Keystore — те же данные, что и для RuStore (шаг 3 выше)
4. Выбрать только флейвор **gplay** (снять отметку с остальных)
5. Build Variants: **release**
6. **Finish**

Артефакт:
```
android/app/gplay/release/app-gplay-release.aab
```

---

### 2.3. Альтернатива: CLI из папки `android/`

```powershell
# APK для RuStore
.\gradlew.bat assembleRustoreRelease

# AAB для Google Play
.\gradlew.bat bundleGplayRelease
```

Если gradlew не видит Java:
```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
```

---

### 2.4. Добавление SHA-1 в Firebase после первой загрузки в Google Play

**Это нужно сделать один раз после первого успешного AAB-прогона в Play Console.**

Google Play при первой загрузке AAB создаёт собственный **app signing key** и подписывает им APK при доставке пользователям. Этот ключ нужно добавить в Firebase, иначе Google Sign-In перестанет работать для пользователей из Google Play.

1. Play Console → приложение → **App integrity → App signing**
2. Скопировать **SHA-1** из раздела «App signing key certificate» (третий SHA-1 в проекте — после debug и release upload-key)
3. [Firebase Console](https://console.firebase.google.com) → проект Dacha → **Project settings → Your apps → Android → ru.dachakalend.app**
4. **Add fingerprint** → вставить SHA-1 → **Save**

---

## 3. Play App Signing (подпись)
При первой загрузке Google предложит **Play App Signing**:
- наш `dacha-release` становится **upload-ключом**,
- Google хранит и применяет собственный **app signing key** при доставке пользователям.

Согласись (это стандарт). Главное — хранить upload-ключ и пароли; если потеряешь — upload-ключ можно сбросить через поддержку, app signing key остаётся у Google.

---

## 4. Создание приложения в Console
Play Console → **Create app**:
- Название: **Календарь дачника**
- Язык по умолчанию: русский
- Тип: **App**
- Платно/бесплатно: **Free** (оплата — подписка ЮKassa внутри, см. §8)
- Принять декларации (Developer Program Policies, US export laws).

---

## 5. Обязательные анкеты (Dashboard → «Set up your app»)

| Раздел | Что указать для нас |
|---|---|
| **App access** | Приложение **требует вход** → дать ревьюверу тестовый аккаунт: `e-krukov@ya.ru` / `q1w2e3r4`. Без этого отклонят (не смогут пройти дальше логина). |
| **Ads** | Реклама **отсутствует** (в gplay рекламу выпилили) → «No, my app does not contain ads». |
| **Content rating** | Заполнить анкету IARC. Приложение-утилита, без насилия/контента → рейтинг 3+. |
| **Target audience** | Аудитория — **взрослые (18+ / 16+)**, не для детей → не подпадаем под Families. |
| **Data safety** | Объявить сбор данных: **email** (аккаунт, верификация), возможно геолокация города (для погоды). Передача в ЮKassa при оплате. Данные шифруются, есть удаление аккаунта. |
| **Government apps / Financial features** | Если спросят про финансы — у нас оплата подписки через стороннюю ПС (ЮKassa), не финансовый сервис. |
| **Privacy Policy** | URL политики — у нас есть лендинг: `https://dacha.studio1008.com/` (укажи прямую ссылку на политику/оферту). |

---

## 6. Карточка магазина (Store listing)
- **Название** (≤30): Календарь дачника
- **Краткое описание** (≤80): Задачи, посадки и календарь работ для дачника
- **Полное описание** (≤4000): фичи — задачи на сегодня, посадки, запись действий, календарь работ, погода и напоминания.
- **Иконка**: 512×512 PNG (есть: `ic_launcher` / исходник подсолнуха).
- **Feature graphic**: **1024×500** PNG/JPG (обязателен) — баннер карточки. Нужно сделать отдельно.
- **Скриншоты телефона**: минимум **2** (лучше 4–8), от 320 до 3840 px. Берём из записи экрана/скриншотов приложения.
- **Промо-видео**: Google Play берёт видео **только ссылкой на YouTube** (загрузки файла нет!). Наш ролик `dacha_promo_rustore.mp4` → **залить на YouTube** (можно «не для детей», доступ по ссылке) и вставить URL. ⚠️ Это отличие от RuStore, где видео грузится файлом.

---

## 7. Монетизация и российская специфика
- Приложение **бесплатное**, подписка оформляется **внутри через ЮKassa** (внешняя ПС), не через Google Play Billing.
- Это **легально**: Google с 02.08.2022 **приостановил требование** использовать Google Play Billing для оплаты от пользователей из РФ (выплаты Google в РФ всё равно не работают). См. [памятку Google](https://support.google.com/googleplay/android-developer/answer/11950272).
- Блокируются только **платные приложения** и их обновления в РФ — нас не касается (приложение бесплатное).
- В Console **не настраивай** Google Play Billing / подписки Google — мы их не используем.

---

## 8. Релиз и закрытое тестирование

### Путь A — личный аккаунт (через тестирование)
1. **Testing → Closed testing** → создать трек, загрузить AAB.
2. Добавить **≥12 тестеров** (email-список или Google-группа), разослать opt-in ссылку.
3. Держать их в тесте **≥14 дней** непрерывно.
4. Появится **Apply for production** → заполнить анкету о тестировании → дождаться доступа.
5. **Production → Create release** → тот же AAB → выпустить.

### Путь B — организационный аккаунт (D-U-N-S)
Сразу **Production → Create release** → загрузить AAB → на ревью.

### Релиз
- Заполни **Release notes** (что нового).
- Раскатку можно сделать поэтапной (staged rollout, напр. 20%).
- **Ревью**: обычно от нескольких часов до нескольких дней (у новых аккаунтов дольше).

---

## 9. Финальный чек-лист перед загрузкой
- [ ] `targetSdk ≥ 35` (см. 0.2) — пересобрать
- [ ] `versionCode` повышен
- [ ] AAB подписан upload-ключом (`:app:bundleGplayRelease`)
- [ ] `google-services.json` в сборке (FCM пуши)
- [ ] Бэкенд задеплоен (gplay под платным гейтом — правка `access.js`)
- [ ] Тестовый аккаунт указан в **App access**
- [ ] Privacy Policy URL, Data safety, Content rating, Ads=No заполнены
- [ ] Feature graphic 1024×500, ≥2 скриншота, иконка 512
- [ ] Промо-видео залито на YouTube и ссылка вставлена

---

## 10. Что нужно подготовить (чего пока нет)
1. **targetSdk 35/36** — правка gradle + пересборка.
2. **Feature graphic 1024×500** — могу собрать через ffmpeg/Remotion в фирменном стиле.
3. **Скриншоты** для карточки — есть исходные кадры записи, можно оформить.
4. **Промо-видео на YouTube** — залить наш ролик и взять ссылку.
5. **Решение по аккаунту** — личный (12 тестеров/14 дней) или организационный (сразу прод).
