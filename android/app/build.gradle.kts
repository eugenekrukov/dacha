plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
}

android {
    namespace = "ru.dachakalend.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "ru.dachakalend.app"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0"

        // URL бэкенда — менять здесь при смене окружения
        buildConfigField("String", "BASE_URL", "\"https://dacha.studio1008.com/\"")

        // RuStore Push — ID проекта из RuStore Консоль → Push-уведомления → Проекты
        buildConfigField("String", "RUSTORE_PUSH_PROJECT_ID", "\"HG8uxj8nCRFKvPWNRhubdefqYcYiAset\"")
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
        }
    }

    // Флейворы по магазину (E5). rustore — платный гейт (ЮKassa), без рекламы; gplay/samsung —
    // оплата из РФ невозможна → бесплатно с рекламой РСЯ (Yandex Mobile Ads). Реклама изолирована
    // в source set src/withAds (только gplay+samsung), rustore-сборка без рекламного SDK.
    flavorDimensions += "store"
    productFlavors {
        create("rustore") {
            dimension = "store"
            buildConfigField("String", "STORE", "\"rustore\"")
            buildConfigField("boolean", "PAYMENTS_ENABLED", "true")
            buildConfigField("boolean", "ADS_ENABLED", "false")
        }
        create("gplay") {
            dimension = "store"
            buildConfigField("String", "STORE", "\"gplay\"")
            buildConfigField("boolean", "PAYMENTS_ENABLED", "false")
            buildConfigField("boolean", "ADS_ENABLED", "true")
            // Боевые ID объявлений РСЯ (кабинет Яндекс Рекламы). Демо-аналоги: demo-banner-yandex /
            // demo-interstitial-yandex — вернуть временно, если на устройстве нужна тестовая реклама.
            buildConfigField("String", "BANNER_AD_UNIT", "\"R-M-19420797-1\"")
            buildConfigField("String", "INTERSTITIAL_AD_UNIT", "\"R-M-19420797-2\"")
        }
        create("samsung") {
            dimension = "store"
            buildConfigField("String", "STORE", "\"samsung\"")
            buildConfigField("boolean", "PAYMENTS_ENABLED", "false")
            buildConfigField("boolean", "ADS_ENABLED", "true")
            buildConfigField("String", "BANNER_AD_UNIT", "\"demo-banner-yandex\"")
            buildConfigField("String", "INTERSTITIAL_AD_UNIT", "\"demo-interstitial-yandex\"")
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

    // RuStore Push SDK
    implementation(libs.rustore.push)

    // Chrome Custom Tabs — открытие страницы оплаты ЮKassa
    implementation(libs.androidx.browser)

    // Yandex Mobile Ads (РСЯ) — только рекламные флейворы (gplay/samsung), src/withAds
    "gplayImplementation"(libs.yandex.mobileads)
    "samsungImplementation"(libs.yandex.mobileads)

    // Testing
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.1")
    testImplementation("io.mockk:mockk:1.13.11")
    testImplementation("app.cash.turbine:turbine:1.1.0")
}
