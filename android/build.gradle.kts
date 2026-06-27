// Top-level build file where you can add configuration options common to all sub-projects/modules.
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.ksp) apply false
    alias(libs.plugins.hilt) apply false
    alias(libs.plugins.google.services) apply false
    alias(libs.plugins.firebase.crashlytics) apply false
}

// E3: project path содержит кириллицу ("Календарь дачника") — Gradle 9 / AGP 9 тест-воркер на Windows
// не может загрузить тест-классы из build/-каталога с не-ASCII путём (java.lang.ClassNotFoundException
// для всех unit-тестов; известный баг JVM/Gradle с native-кодировкой argfile-класспасса, см. gradle/gradle#30304).
// Чиним переносом build-каталогов в ASCII-путь (%LOCALAPPDATA%); сами исходники остаются на месте.
val hasNonAsciiPath = rootDir.absolutePath.any { it.code > 127 }
if (hasNonAsciiPath) {
    val asciiBuildRoot = File(System.getenv("LOCALAPPDATA") ?: System.getProperty("java.io.tmpdir"), "dacha-android-build")
    subprojects {
        layout.buildDirectory.set(File(asciiBuildRoot, project.name))
    }
}
