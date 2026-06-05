package ru.dachakalend.app.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Grass
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Info
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
    object Plantings : Screen("plantings") {
        const val ARG_NEW_CROP_ID = "newCropId"
        val routeWithArgs = "plantings?$ARG_NEW_CROP_ID={$ARG_NEW_CROP_ID}"
        fun withNewCrop(cropId: Int) = "plantings?$ARG_NEW_CROP_ID=$cropId"
    }
    object Harvest : Screen("harvest")

    // Sprint 5
    object Analytics : Screen("analytics")

    // Хаб «Информация» (таб): справочник + статистика
    object Info : Screen("info")

    // Монетизация
    object Paywall : Screen("paywall")

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
    BottomNavItem(Screen.Info, "Информация", Icons.Default.Info),
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
    Screen.Paywall.route,
    Screen.Analytics.route,
    Screen.Harvest.route
)
