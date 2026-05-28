package ru.dachakalend.app.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Grass
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Spa
import androidx.compose.ui.graphics.vector.ImageVector

sealed class Screen(val route: String) {
    // Auth flow
    object Login : Screen("login")
    object Register : Screen("register")
    object CreateGarden : Screen("create_garden")

    // Main app
    object Today : Screen("today")
    object Calendar : Screen("calendar")
    object Plantings : Screen("plantings")
    object Harvest : Screen("harvest")
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

// Экраны, на которых не показывается BottomBar
val screensWithoutBottomBar = setOf(
    Screen.Login.route,
    Screen.Register.route,
    Screen.CreateGarden.route
)
