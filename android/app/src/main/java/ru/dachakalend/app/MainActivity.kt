package ru.dachakalend.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.*
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import dagger.hilt.android.AndroidEntryPoint
import ru.dachakalend.app.data.local.TokenStorage
import ru.dachakalend.app.navigation.Screen
import ru.dachakalend.app.navigation.bottomNavItems
import ru.dachakalend.app.navigation.screensWithoutBottomBar
import ru.dachakalend.app.ui.auth.LoginScreen
import ru.dachakalend.app.ui.auth.RegisterScreen
import ru.dachakalend.app.ui.calendar.CalendarScreen
import ru.dachakalend.app.ui.garden.CreateGardenScreen
import ru.dachakalend.app.ui.harvest.HarvestScreen
import ru.dachakalend.app.ui.plantings.PlantingsScreen
import ru.dachakalend.app.ui.theme.DachaCalendarTheme
import ru.dachakalend.app.ui.today.TodayScreen
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject
    lateinit var tokenStorage: TokenStorage

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Определяем стартовый экран
        val startDestination = when {
            !tokenStorage.isLoggedIn()   -> Screen.Login.route
            !tokenStorage.hasGarden()    -> Screen.CreateGarden.route
            else                          -> Screen.Today.route
        }

        setContent {
            DachaCalendarTheme {
                val navController = rememberNavController()
                val navBackStackEntry by navController.currentBackStackEntryAsState()
                val currentRoute = navBackStackEntry?.destination?.route

                val showBottomBar = currentRoute !in screensWithoutBottomBar

                Scaffold(
                    bottomBar = {
                        if (showBottomBar) {
                            NavigationBar {
                                bottomNavItems.forEach { item ->
                                    NavigationBarItem(
                                        selected = currentRoute == item.screen.route,
                                        onClick = {
                                            navController.navigate(item.screen.route) {
                                                popUpTo(Screen.Today.route) { saveState = true }
                                                launchSingleTop = true
                                                restoreState = true
                                            }
                                        },
                                        icon = { Icon(item.icon, contentDescription = item.label) },
                                        label = { Text(item.label) }
                                    )
                                }
                            }
                        }
                    }
                ) { innerPadding ->
                    NavHost(
                        navController = navController,
                        startDestination = startDestination,
                        modifier = Modifier.padding(innerPadding)
                    ) {
                        // Auth flow
                        composable(Screen.Login.route) {
                            LoginScreen(
                                onLoginSuccess = {
                                    if (tokenStorage.hasGarden()) {
                                        navController.navigate(Screen.Today.route) {
                                            popUpTo(Screen.Login.route) { inclusive = true }
                                        }
                                    } else {
                                        navController.navigate(Screen.CreateGarden.route) {
                                            popUpTo(Screen.Login.route) { inclusive = true }
                                        }
                                    }
                                },
                                onGoToRegister = { navController.navigate(Screen.Register.route) }
                            )
                        }
                        composable(Screen.Register.route) {
                            RegisterScreen(
                                onRegisterSuccess = {
                                    navController.navigate(Screen.CreateGarden.route) {
                                        popUpTo(Screen.Login.route) { inclusive = true }
                                    }
                                },
                                onBack = { navController.popBackStack() }
                            )
                        }
                        composable(Screen.CreateGarden.route) {
                            CreateGardenScreen(
                                onGardenCreated = {
                                    navController.navigate(Screen.Today.route) {
                                        popUpTo(Screen.CreateGarden.route) { inclusive = true }
                                    }
                                }
                            )
                        }

                        // Main app
                        composable(Screen.Today.route) { TodayScreen() }
                        composable(Screen.Calendar.route) { CalendarScreen() }
                        composable(Screen.Plantings.route) { PlantingsScreen() }
                        composable(Screen.Harvest.route) { HarvestScreen() }
                    }
                }
            }
        }
    }

    private fun TokenStorage.isLoggedIn() = getToken() != null
    private fun TokenStorage.hasGarden() = getGardenId() != -1
}
