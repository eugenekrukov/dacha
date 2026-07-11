import java.util.Properties
import com.google.firebase.crashlytics.buildtools.gradle.CrashlyticsExtension

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
    alias(libs.plugins.google.services)
    alias(libs.plugins.firebase.crashlytics)
}

// Релизная подпись из android/keystore.properties (не в репозитории). Если файла нет или он
// с плейсхолдерами — release собирается без signingConfig (для CI/чужой машины не падаем).
val keystorePropsFile = rootProject.file("keystore.properties")
val keystoreProps = Properties().apply {
    if (keystorePropsFile.exists()) keystorePropsFile.inputStream().use { load(it) }
}
val hasReleaseSigning = keystorePropsFile.exists() &&
    keystoreProps.getProperty("storePassword")?.startsWith("ЗАМЕНИ") == false

android {
    namespace = "ru.dachakalend.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "ru.dachakalend.app"
        minSdk = 26
        targetSdk = 36
        versionCode = 9
        versionName = "1.0.6"

        // URL бэкенда — менять здесь при смене окружения
        buildConfigField("String", "BASE_URL", "\"https://dacha.studio1008.com/\"")

        // RuStore Push — ID проекта из RuStore Консоль → Push-уведомления → Проекты
        buildConfigField("String", "RUSTORE_PUSH_PROJECT_ID", "\"HG8uxj8nCRFKvPWNRhubdefqYcYiAset\"")
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = rootProject.file(keystoreProps.getProperty("storeFile"))
                storePassword = keystoreProps.getProperty("storePassword")
                keyAlias = keystoreProps.getProperty("keyAlias")
                keyPassword = keystoreProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        debug {
            isDebuggable = true
            // applicationIdSuffix = ".debug"  // отключено: RuStore Push требует точного совпадения package name
        }
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            // Подпись из keystore.properties; если ключа нет — release остаётся неподписанным.
            if (hasReleaseSigning) signingConfig = signingConfigs.getByName("release")
            // Загружаем R8 mapping.txt в Crashlytics — иначе стектрейсы релизных крашей
            // приходят с обфусцированными/неточными именами и номерами строк.
            configure<CrashlyticsExtension> {
                mappingFileUploadEnabled = true
            }
        }
    }

    // Флейворы по магазину. rustore + gplay — платный гейт (ЮKassa), без рекламы (Google с 02.08.2022
    // не требует Play Billing для оплаты из РФ → in-app ЮKassa легальна). Рекламы в проекте нет
    // (samsung-флейвор с РСЯ удалён 2026-06-30).
    flavorDimensions += "store"
    productFlavors {
        create("rustore") {
            dimension = "store"
            buildConfigField("String", "STORE", "\"rustore\"")
            buildConfigField("boolean", "PAYMENTS_ENABLED", "true")
        }
        create("gplay") {
            dimension = "store"
            buildConfigField("String", "STORE", "\"gplay\"")
            // С 2026-06-13 gplay — платная подписка (ЮKassa), без рекламы. Google не требует Google
            // Play Billing для оплаты из РФ (support 11950272, с 02.08.2022) → in-app ЮKassa легальна.
            buildConfigField("boolean", "PAYMENTS_ENABLED", "true")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    testOptions {
        unitTests {
            isReturnDefaultValues = true
            all {
                it.jvmArgs(
                    "--add-opens=java.base/java.lang=ALL-UNNAMED",
                    "--add-opens=java.base/java.lang.reflect=ALL-UNNAMED",
                    "--add-opens=java.base/java.util=ALL-UNNAMED",
                    "-Djdk.attach.allowAttachSelf=true",
                    "-Dfile.encoding=UTF-8"
                )
            }
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

dependencies {
    // Core
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)

    // Compose BOM
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.material.icons.extended)
    debugImplementation(libs.androidx.ui.tooling)

    // Navigation
    implementation(libs.androidx.navigation.compose)

    // DI — Hilt (KSP вместо KAPT)
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.hilt.navigation.compose)

    // Network — Retrofit + Moshi
    implementation(libs.retrofit)
    implementation(libs.retrofit.converter.moshi)
    implementation(libs.okhttp.logging)
    implementation(libs.moshi.kotlin)

    // Изображения
    implementation(libs.coil.compose)

    // Настройки
    implementation(libs.datastore.preferences)

    // Шифрованное хранилище для токена
    implementation(libs.androidx.security.crypto)

    // WorkManager + Hilt-Work
    implementation(libs.work.runtime.ktx)
    implementation(libs.hilt.work)
    ksp(libs.hilt.work.compiler)

    // RuStore Push SDK (rustore-флейвор) + Firebase Cloud Messaging (gplay)
    implementation(libs.rustore.push)
    implementation(libs.firebase.messaging)

    // Crashlytics — точные стектрейсы крашей (раньше расследовали баги без них).
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.crashlytics)

    // Chrome Custom Tabs — открытие страницы оплаты ЮKassa
    implementation(libs.androidx.browser)

    // RuStore Reviews SDK — только rustore-флейвор (нативный запрос оценки). gplay — no-op AppReview.
    "rustoreImplementation"(libs.rustore.review)

    // Testing
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.2")
    testImplementation("io.mockk:mockk:1.13.11")
    testImplementation("app.cash.turbine:turbine:1.1.0")
}
