package ru.dachakalend.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.*
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
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
import androidx.navigation.NavType
import androidx.navigation.navArgument
import ru.dachakalend.app.ui.auth.LoginScreen
import ru.dachakalend.app.ui.auth.RegisterScreen
import ru.dachakalend.app.ui.calendar.CalendarScreen
import ru.dachakalend.app.ui.crops.CropDetailScreen
import ru.dachakalend.app.ui.crops.CropsScreen
import ru.dachakalend.app.ui.crops.CropsViewModel
import ru.dachakalend.app.ui.garden.CreateGardenScreen
import ru.dachakalend.app.ui.analytics.AnalyticsScreen
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
                        // Plantings — базовый маршрут (из BottomNav)
                        composable(Screen.Plantings.route) {
                            PlantingsScreen(
                                onAddCrop = { navController.navigate(Screen.Crops.route) }
                            )
                        }
                        // Plantings — с newCropId (из CropDetail → сразу создаём посадку)
                        composable(
                            route = Screen.Plantings.routeWithArgs,
                            arguments = listOf(navArgument(Screen.Plantings.ARG_NEW_CROP_ID) {
                                type = NavType.IntType
                                defaultValue = -1
                            })
                        ) {
                            PlantingsScreen(
                                onAddCrop = { navController.navigate(Screen.Crops.route) }
                            )
                        }
                        composable(Screen.Harvest.route) { HarvestScreen() }
                        composable(Screen.Analytics.route) { AnalyticsScreen() }

                        // Справочник культур
                        composable(Screen.Crops.route) {
                            val cropsViewModel: CropsViewModel = hiltViewModel()
                            val state by cropsViewModel.uiState.collectAsState()
                            CropsScreen(
                                viewModel = cropsViewModel,
                                onCropClick = { crop ->
                                    cropsViewModel.selectCrop(crop)
                                    navController.navigate(Screen.CropDetail.route(crop.id))
                                }
                            )
                        }
                        composable(
                            route = Screen.CropDetail.route,
                            arguments = listOf(navArgument("cropId") { type = NavType.IntType })
                        ) { backStackEntry ->
                            val cropId = backStackEntry.arguments?.getInt("cropId")
                            // Берём crop из предыдущей записи стека через ViewModel.
                            // try-catch обязателен: при навигации onPlant Crops убирается из стека,
                            // и Compose делает ещё одну recomposition — без защиты будет IAE crash.
                            val cropsEntry = try {
                                navController.getBackStackEntry(Screen.Crops.route)
                            } catch (e: Exception) {
                                null
                            } ?: return@composable
                            val cropsViewModel: CropsViewModel = hiltViewModel(cropsEntry)
                            val state by cropsViewModel.uiState.collectAsState()
                            val crop = state.selectedCrop
                            if (crop != null && (cropId == null || crop.id == cropId)) {
                                CropDetailScreen(
                                    crop = crop,
                                    onBack = {
                                        cropsViewModel.clearSelectedCrop()
                                        navController.popBackStack()
                                    },
                                    onPlant = { selectedCrop ->
                                        // Передаём cropId через nav argument — PlantingsViewModel
                                        // получит его через SavedStateHandle и сразу создаст посадку
                                        navController.navigate(
                                            Screen.Plantings.withNewCrop(selectedCrop.id)
                                        ) {
                                            popUpTo(Screen.Today.route)
                                        }
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    private fun TokenStorage.isLoggedIn() = getToken() != null
    private fun TokenStorage.hasGarden() = getGardenId() != -1
}
