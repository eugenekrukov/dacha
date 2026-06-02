package ru.dachakalend.app.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Grass
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Spa
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
    BottomNavItem(Screen.Harvest, "Урожай", Icons.Default.Spa),
)

val screensWithoutBottomBar = setOf(
    Screen.Splash.route,
    Screen.Intro.route,
    Screen.Login.route,
    Screen.Register.route,
    Screen.CreateGarden.route,
    Screen.OnboardingCrops.route,
    Screen.GardenEdit.route,
    Screen.Settings.route,
    Screen.Journal.route,
    Screen.Crops.route,
    Screen.CropDetail.routeWithArgs,
    Screen.Paywall.route,
    Screen.Analytics.route
)
