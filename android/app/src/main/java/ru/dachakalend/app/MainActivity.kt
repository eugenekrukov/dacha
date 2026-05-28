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
import ru.dachakalend.app.navigation.Screen
import ru.dachakalend.app.navigation.bottomNavItems
import ru.dachakalend.app.ui.calendar.CalendarScreen
import ru.dachakalend.app.ui.harvest.HarvestScreen
import ru.dachakalend.app.ui.plantings.PlantingsScreen
import ru.dachakalend.app.ui.theme.DachaCalendarTheme
import ru.dachakalend.app.ui.today.TodayScreen

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @OptIn(ExperimentalMaterial3Api::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            DachaCalendarTheme {
                val navController = rememberNavController()
                val navBackStackEntry by navController.currentBackStackEntryAsState()
                val currentRoute = navBackStackEntry?.destination?.route

                Scaffold(
                    bottomBar = {
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
                ) { innerPadding ->
                    NavHost(
                        navController = navController,
                        startDestination = Screen.Today.route,
                        modifier = Modifier.padding(innerPadding)
                    ) {
                        composable(Screen.Today.route) { TodayScreen() }
                        composable(Screen.Calendar.route) { CalendarScreen() }
                        composable(Screen.Plantings.route) { PlantingsScreen() }
                        composable(Screen.Harvest.route) { HarvestScreen() }
                    }
                }
            }
        }
    }
}
