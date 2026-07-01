package ru.dachakalend.app.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Grass
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.ui.graphics.vector.ImageVector

sealed class Screen(val route: String) {
    // Splash
    object Splash : Screen("splash")

    // Onboarding intro (shown before first login)
    object Intro : Screen("intro")

    // Auth flow
    object Login : Screen("login")
    object Register : Screen("register")
    object CreateGarden : Screen("create_garden")
    object OnboardingCrops : Screen("onboarding_crops")

    // Подтверждение email (после регистрации — с «Позже»; из настроек — без)
    object VerifyEmail : Screen("verify_email?email={email}&fromRegister={fromRegister}") {
        const val ARG_EMAIL = "email"
        const val ARG_FROM_REGISTER = "fromRegister"
        fun route(email: String?, fromRegister: Boolean) =
            "verify_email?$ARG_EMAIL=${android.net.Uri.encode(email ?: "")}&$ARG_FROM_REGISTER=$fromRegister"
    }

    // Сброс пароля по коду из письма
    object PasswordReset : Screen("password_reset")

    // Garden edit
    object GardenEdit : Screen("garden_edit")

    // Settings
    object Settings : Screen("settings")

    // Journal
    object Journal : Screen("journal")

    // Main app
    object Today : Screen("today") {
        const val ARG_FROM_ONBOARDING = "fromOnboarding"
        val routeWithArgs = "today?$ARG_FROM_ONBOARDING={$ARG_FROM_ONBOARDING}"
        fun fromOnboarding() = "today?$ARG_FROM_ONBOARDING=true"
    }
    object Calendar : Screen("calendar")
    object MoonCalendar : Screen("moon_calendar")
    object Plantings : Screen("plantings") {
        const val ARG_NEW_CROP_ID = "newCropId"
        val routeWithArgs = "plantings?$ARG_NEW_CROP_ID={$ARG_NEW_CROP_ID}"
        fun withNewCrop(cropId: Int) = "plantings?$ARG_NEW_CROP_ID=$cropId"
    }
    object Harvest : Screen("harvest")

    // Sprint 5
    object Analytics : Screen("analytics")

    // Хаб «Информация» (таб): справочник + статистика
    object Profile : Screen("profile")

    // Монетизация
    object Paywall : Screen("paywall")

    // Справочник проблем (дефициты/болезни/вредители)
    object Guide : Screen("guide") {
        const val ARG_CROP_ID = "cropId"
        const val ARG_CROP = "crop"
        val routeWithArgs = "guide?$ARG_CROP_ID={$ARG_CROP_ID}&$ARG_CROP={$ARG_CROP}"
        fun withCrop(cropId: Int, cropName: String?) =
            "guide?$ARG_CROP_ID=$cropId&$ARG_CROP=${android.net.Uri.encode(cropName ?: "")}"
    }

    // Информация о посадке (полноэкранная страница с вкладками)
    object PlantingInfo : Screen("planting_info/{plantingId}") {
        const val ARG_PLANTING_ID = "plantingId"
        fun route(plantingId: Int) = "planting_info/$plantingId"
    }
    object GuideDetail : Screen("guide_detail/{slug}") {
        const val ARG_SLUG = "slug"
        fun route(slug: String) = "guide_detail/$slug"
    }

    // Sprint 3
    object Crops : Screen("crops")
    object CropDetail : Screen("crop_detail/{cropId}") {
        const val ARG_SHOW_PLANT = "showPlantButton"
        val routeWithArgs = "crop_detail/{cropId}?$ARG_SHOW_PLANT={$ARG_SHOW_PLANT}"
        fun route(cropId: Int, showPlantButton: Boolean = true) =
            "crop_detail/$cropId?$ARG_SHOW_PLANT=$showPlantButton"
    }
}

data class BottomNavItem(
    val screen: Screen,
    val label: String,
    val icon: ImageVector
)

val bottomNavItems = listOf(
    BottomNavItem(Screen.Today, "Сегодня", Icons.Default.Home),
    BottomNavItem(Screen.Calendar, "Календарь", Icons.Default.CalendarMonth),
    BottomNavItem(Screen.Plantings, "Посадки", Icons.Default.Grass),
    BottomNavItem(Screen.Profile, "Профиль", Icons.Default.Person),
)

val screensWithoutBottomBar = setOf(
    Screen.Splash.route,
    Screen.Intro.route,
    Screen.Login.route,
    Screen.Register.route,
    Screen.CreateGarden.route,
    Screen.OnboardingCrops.route,
    Screen.VerifyEmail.route,
    Screen.PasswordReset.route,
    Screen.GardenEdit.route,
    Screen.Settings.route,
    Screen.Journal.route,
    Screen.Crops.route,
    Screen.CropDetail.routeWithArgs,
    Screen.Guide.route,
    Screen.Guide.routeWithArgs,
    Screen.GuideDetail.route,
    Screen.PlantingInfo.route,
    Screen.Paywall.route,
    Screen.Analytics.route,
    Screen.Harvest.route,
    Screen.MoonCalendar.route
)
