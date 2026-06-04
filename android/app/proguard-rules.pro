# Moshi
-keep class ru.dachakalend.app.data.model.** { *; }
-keepclassmembers class ru.dachakalend.app.data.model.** { *; }

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
