# Moshi
-keep class ru.dachakalend.app.data.model.** { *; }
-keepclassmembers class ru.dachakalend.app.data.model.** { *; }

# Moshi без codegen: @JsonClass-классы вне data.model (офлайн-кэш CachedToday, ActionQueue)
# разбираются рефлексией. Без keep R8 режет generic-сигнатуры полей → List<Recommendation> читается
# как список LinkedHashTreeMap → ClassCastException на «Сегодня» офлайн (Crashlytics, 38 падений
# за 30 дней на 1.0.7–1.0.13, разбор 2026-09-15).
-keep @com.squareup.moshi.JsonClass class * { *; }

# Retrofit
-keepattributes Signature
-keepattributes Exceptions
-keepattributes *Annotation*

# Tink / EncryptedSharedPreferences (androidx.security-crypto):
# errorprone-аннотации compile-only, в рантайме их нет — R8 ругается без этих правил.
-dontwarn com.google.errorprone.annotations.**
-keep class com.google.crypto.tink.** { *; }
# Tink.KeysDownloader тянет google-api-client + joda-time (загрузка ключей по сети) —
# мы их не используем, классов в проекте нет.
-dontwarn com.google.api.client.http.**
-dontwarn org.joda.time.**

# Retrofit / OkHttp / Okio — типичные release-предупреждения
-dontwarn retrofit2.**
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
