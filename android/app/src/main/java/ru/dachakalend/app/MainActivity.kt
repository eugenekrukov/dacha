package ru.dachakalend.app

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavType
import androidx.navigation.compose.*
import androidx.navigation.navArgument
import dagger.hilt.android.AndroidEntryPoint
import ru.dachakalend.app.billing.SubscriptionManager
import ru.dachakalend.app.data.local.TokenStorage
import ru.dachakalend.app.navigation.*
import ru.dachakalend.app.ui.splash.SplashScreen
import ru.dachakalend.app.ui.onboarding.CoachMarkController
import ru.dachakalend.app.ui.onboarding.CoachMarkOverlay
import ru.dachakalend.app.ui.onboarding.TutorialIntroScreen
import ru.dachakalend.app.ui.paywall.PaywallScreen
import ru.dachakalend.app.notification.NotificationHelper
import ru.dachakalend.app.ui.auth.LoginScreen
import ru.dachakalend.app.ui.auth.RegisterScreen
import ru.dachakalend.app.ui.auth.VerifyEmailScreen
import ru.dachakalend.app.ui.auth.PasswordResetScreen
import ru.dachakalend.app.ui.calendar.CalendarScreen
import ru.dachakalend.app.ui.crops.CropDetailScreen
import ru.dachakalend.app.ui.crops.CropsScreen
import ru.dachakalend.app.ui.crops.CropsViewModel
import ru.dachakalend.app.ui.garden.CreateGardenScreen
import ru.dachakalend.app.ui.garden.GardenEditScreen
import ru.dachakalend.app.ui.garden.OnboardingCropsScreen
import ru.dachakalend.app.ui.analytics.AnalyticsScreen
import ru.dachakalend.app.ui.harvest.HarvestScreen
import ru.dachakalend.app.ui.guide.GuideScreen
import ru.dachakalend.app.ui.guide.GuideDetailScreen
import ru.dachakalend.app.ui.plantings.PlantingInfoScreen
import ru.dachakalend.app.ui.info.InfoHubScreen
import ru.dachakalend.app.ui.journal.JournalScreen
import ru.dachakalend.app.ui.plantings.PlantingsScreen
import ru.dachakalend.app.ui.settings.SettingsScreen
import ru.dachakalend.app.ui.theme.DachaCalendarTheme
import ru.dachakalend.app.ui.today.TodayScreen
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject lateinit var tokenStorage: TokenStorage
    @Inject lateinit var subscriptionManager: SubscriptionManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val realStartDestination = when {
            !tokenStorage.isLoggedIn() && !tokenStorage.isIntroDone() -> Screen.Intro.route
            !tokenStorage.isLoggedIn() -> Screen.Login.route
            !tokenStorage.hasGarden()  -> Screen.CreateGarden.route
            else                       -> Screen.Today.route
        }

        // EXTRA_PUSH_TYPE ставит DachaPushService (foreground); "type" — RuStore при тапе
        // на системное уведомление (background/killed, notification+data payload).
        val pushType = intent.getStringExtra(NotificationHelper.EXTRA_PUSH_TYPE)
            ?: intent.getStringExtra("type")
        val deepLinkRoute: String? = when (pushType) {
            TokenStorage.NOTIF_FROST,
            TokenStorage.NOTIF_HEAT      -> Screen.Today.route
            TokenStorage.NOTIF_WATERING,
            TokenStorage.NOTIF_FERTILIZE,
            TokenStorage.NOTIF_TRANSPLANT -> Screen.Today.route
            else                          -> null
        }

        setContent {
            DachaCalendarTheme {
                val navController = rememberNavController()
                val navBackStackEntry by navController.currentBackStackEntryAsState()
                val currentRoute = navBackStackEntry?.destination?.route

                val showBottomBar = currentRoute !in screensWithoutBottomBar
                val activePlantings by tokenStorage.pendingCount.collectAsState()

                val coachMarkController = remember { CoachMarkController() }
                val showCoachMark = remember {
                    tokenStorage.isLoggedIn() && tokenStorage.hasGarden() && !tokenStorage.isCoachDone()
                }

                // При старте проверяем доступ (триал или подписка). Только в платных сборках:
                // в gplay/samsung оплата невозможна → монетизация рекламой, Paywall не показываем.
                LaunchedEffect(Unit) {
                    if (BuildConfig.PAYMENTS_ENABLED && tokenStorage.isLoggedIn() && tokenStorage.hasGarden()) {
                        subscriptionManager.refresh()
                        if (!subscriptionManager.isAccessAllowed()) {
                            navController.navigate(Screen.Paywall.route) {
                                popUpTo(Screen.Today.route) { inclusive = true }
                                launchSingleTop = true
                            }
                        }
                    }
                }

                // Runtime-запрос POST_NOTIFICATIONS (Android 13+). Без него на API ≥ 33
                // уведомления молча не показываются. Спрашиваем один раз, когда пользователь
                // уже в приложении (залогинен + есть участок) — напоминания имеют смысл.
                val context = LocalContext.current
                val notifPermLauncher = rememberLauncherForActivityResult(
                    ActivityResultContracts.RequestPermission()
                ) { tokenStorage.setNotifPermissionAsked() }
                LaunchedEffect(Unit) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                        tokenStorage.isLoggedIn() && tokenStorage.hasGarden() &&
                        !tokenStorage.isNotifPermissionAsked() &&
                        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                            != PackageManager.PERMISSION_GRANTED
                    ) {
                        notifPermLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                    }
                }

                LaunchedEffect(deepLinkRoute) {
                    if (deepLinkRoute != null && tokenStorage.isLoggedIn() && tokenStorage.hasGarden()) {
                        navController.navigate(deepLinkRoute) {
                            popUpTo(Screen.Today.route) { inclusive = false }
                            launchSingleTop = true
                        }
                    }
                }

                Box(modifier = Modifier.fillMaxSize()) {
                Scaffold(
                    bottomBar = {
                        if (showBottomBar) {
                            androidx.compose.foundation.layout.Column {
                            // Рекламный баннер РСЯ над навбаром (no-op в rustore-сборке)
                            ru.dachakalend.app.ads.Ads.Banner()
                            NavigationBar {
                                bottomNavItems.forEach { item ->
                                    val showBadge = item.screen == Screen.Plantings && activePlantings > 0
                                    val navModifier = when (item.screen) {
                                        Screen.Plantings -> Modifier.onGloballyPositioned {
                                            coachMarkController.updateBounds("nav_plantings", it.boundsInRoot())
                                        }
                                        Screen.Calendar  -> Modifier.onGloballyPositioned {
                                            coachMarkController.updateBounds("nav_calendar", it.boundsInRoot())
                                        }
                                        else -> Modifier
                                    }
                                    NavigationBarItem(
                                        modifier = navModifier,
                                        selected = currentRoute == item.screen.route,
                                        onClick = {
                                            // Контентное событие для рекламы (интерстишл раз в N; no-op в rustore)
                                            ru.dachakalend.app.ads.Ads.onContentEvent(this@MainActivity)
                                            navController.navigate(item.screen.route) {
                                                popUpTo(Screen.Today.route) { saveState = true }
                                                launchSingleTop = true
                                                restoreState = true
                                            }
                                        },
                                        icon = {
                                            if (showBadge) {
                                                BadgedBox(badge = { Badge { Text(activePlantings.toString()) } }) {
                                                    Icon(item.icon, contentDescription = item.label)
                                                }
                                            } else {
                                                Icon(item.icon, contentDescription = item.label)
                                            }
                                        },
                                        label = { Text(item.label) }
                                    )
                                }
                            }
                            }
                        }
                    }
                ) { innerPadding ->
                    NavHost(
                        navController = navController,
                        startDestination = Screen.Splash.route,
                        modifier = Modifier.padding(innerPadding)
                    ) {
                        // Splash (always shown on cold start)
                        composable(Screen.Splash.route) {
                            SplashScreen(onDone = {
                                navController.navigate(realStartDestination) {
                                    popUpTo(Screen.Splash.route) { inclusive = true }
                                }
                            })
                        }

                        // Intro slides (first launch only)
                        composable(Screen.Intro.route) {
                            TutorialIntroScreen(
                                onRegister = {
                                    tokenStorage.setIntroDone()
                                    navController.navigate(Screen.Register.route) {
                                        popUpTo(Screen.Intro.route) { inclusive = true }
                                    }
                                },
                                onLogin = {
                                    tokenStorage.setIntroDone()
                                    navController.navigate(Screen.Login.route) {
                                        popUpTo(Screen.Intro.route) { inclusive = true }
                                    }
                                },
                                onSkip = {
                                    tokenStorage.setIntroDone()
                                    navController.navigate(Screen.Login.route) {
                                        popUpTo(Screen.Intro.route) { inclusive = true }
                                    }
                                }
                            )
                        }

                        // Auth flow
                        composable(Screen.Login.route) {
                            LoginScreen(
                                onLoginSuccess = {
                                    // SuccessHasGarden: gardenId уже восстановлен в AuthViewModel
                                    navController.navigate(Screen.Today.route) {
                                        popUpTo(Screen.Login.route) { inclusive = true }
                                    }
                                },
                                onLoginNeedGarden = {
                                    // SuccessNoGarden: нет участка на сервере
                                    navController.navigate(Screen.CreateGarden.route) {
                                        popUpTo(Screen.Login.route) { inclusive = true }
                                    }
                                },
                                onGoToRegister = { navController.navigate(Screen.Register.route) },
                                onForgotPassword = { navController.navigate(Screen.PasswordReset.route) }
                            )
                        }
                        composable(Screen.Register.route) {
                            RegisterScreen(
                                onRegisterSuccess = { email ->
                                    // Мягкий гейт: после регистрации предлагаем подтвердить email,
                                    // но даём «Позже» → переход к созданию участка.
                                    navController.navigate(Screen.VerifyEmail.route(email, fromRegister = true)) {
                                        popUpTo(Screen.Login.route) { inclusive = true }
                                    }
                                },
                                onBack = { navController.popBackStack() }
                            )
                        }
                        composable(
                            route = Screen.VerifyEmail.route,
                            arguments = listOf(
                                navArgument(Screen.VerifyEmail.ARG_EMAIL) {
                                    type = NavType.StringType; defaultValue = ""
                                },
                                navArgument(Screen.VerifyEmail.ARG_FROM_REGISTER) {
                                    type = NavType.BoolType; defaultValue = false
                                }
                            )
                        ) { backStackEntry ->
                            val email = backStackEntry.arguments?.getString(Screen.VerifyEmail.ARG_EMAIL)?.ifBlank { null }
                            val fromRegister = backStackEntry.arguments?.getBoolean(Screen.VerifyEmail.ARG_FROM_REGISTER) ?: false
                            VerifyEmailScreen(
                                email = email,
                                onVerified = {
                                    if (fromRegister) {
                                        navController.navigate(Screen.CreateGarden.route) {
                                            popUpTo(Screen.VerifyEmail.route) { inclusive = true }
                                        }
                                    } else {
                                        navController.popBackStack()
                                    }
                                },
                                onSkip = if (fromRegister) ({
                                    navController.navigate(Screen.CreateGarden.route) {
                                        popUpTo(Screen.VerifyEmail.route) { inclusive = true }
                                    }
                                }) else null
                            )
                        }
                        composable(Screen.PasswordReset.route) {
                            PasswordResetScreen(
                                onDone = {
                                    // Пароль изменён → возвращаемся ко входу
                                    navController.navigate(Screen.Login.route) {
                                        popUpTo(Screen.PasswordReset.route) { inclusive = true }
                                    }
                                },
                                onBack = { navController.popBackStack() }
                            )
                        }
                        composable(Screen.CreateGarden.route) {
                            CreateGardenScreen(
                                onGardenCreated = {
                                    navController.navigate(Screen.OnboardingCrops.route) {
                                        popUpTo(Screen.CreateGarden.route) { inclusive = true }
                                    }
                                }
                            )
                        }
                        composable(Screen.OnboardingCrops.route) {
                            OnboardingCropsScreen(
                                onDone = {
                                    navController.navigate(Screen.Today.fromOnboarding()) {
                                        popUpTo(Screen.OnboardingCrops.route) { inclusive = true }
                                    }
                                }
                            )
                        }
                        composable(Screen.GardenEdit.route) {
                            GardenEditScreen(
                                onSaved = { navController.popBackStack() },
                                onBack = { navController.popBackStack() }
                            )
                        }
                        composable(Screen.Settings.route) {
                            SettingsScreen(
                                onBack = { navController.popBackStack() },
                                onLogout = {
                                    navController.navigate(Screen.Login.route) {
                                        popUpTo(0) { inclusive = true }
                                        launchSingleTop = true
                                    }
                                },
                                onOpenPaywall = { navController.navigate(Screen.Paywall.route) },
                                onOpenAnalytics = { navController.navigate(Screen.Analytics.route) },
                                onVerifyEmail = { email ->
                                    navController.navigate(Screen.VerifyEmail.route(email, fromRegister = false))
                                }
                            )
                        }
                        composable(Screen.Journal.route) {
                            JournalScreen(onBack = { navController.popBackStack() })
                        }

                        // Main app
                        composable(Screen.Today.route) {
                            TodayScreen(
                                coachMarkController = coachMarkController,
                                showCoachMark       = showCoachMark,
                                onEditGarden        = { navController.navigate(Screen.GardenEdit.route) },
                                onOpenSettings      = { navController.navigate(Screen.Settings.route) },
                                onOpenJournal       = { navController.navigate(Screen.Journal.route) },
                                onAddPlanting       = { navController.navigate(Screen.Crops.route) }
                            )
                        }
                        composable(
                            route = Screen.Today.routeWithArgs,
                            arguments = listOf(navArgument(Screen.Today.ARG_FROM_ONBOARDING) {
                                type = NavType.BoolType; defaultValue = false
                            })
                        ) { backStackEntry ->
                            val fromOnboarding = backStackEntry.arguments?.getBoolean(Screen.Today.ARG_FROM_ONBOARDING) ?: false
                            TodayScreen(
                                showOnboardingHint  = fromOnboarding,
                                coachMarkController = coachMarkController,
                                showCoachMark       = showCoachMark,
                                onEditGarden        = { navController.navigate(Screen.GardenEdit.route) },
                                onOpenSettings      = { navController.navigate(Screen.Settings.route) },
                                onOpenJournal       = { navController.navigate(Screen.Journal.route) },
                                onAddPlanting       = { navController.navigate(Screen.Crops.route) }
                            )
                        }
                        composable(Screen.Calendar.route) { CalendarScreen() }
                        composable(Screen.Plantings.route) {
                            PlantingsScreen(
                                onAddCrop = { navController.navigate(Screen.Crops.route) },
                                onCropDetail = { cropId -> navController.navigate(Screen.CropDetail.route(cropId, showPlantButton = false)) },
                                onOpenHarvest = { navController.navigate(Screen.Harvest.route) },
                                onOpenPlantingInfo = { plantingId -> navController.navigate(Screen.PlantingInfo.route(plantingId)) }
                            )
                        }
                        composable(
                            route = Screen.Plantings.routeWithArgs,
                            arguments = listOf(navArgument(Screen.Plantings.ARG_NEW_CROP_ID) {
                                type = NavType.IntType; defaultValue = -1
                            })
                        ) {
                            PlantingsScreen(
                                onAddCrop = { navController.navigate(Screen.Crops.route) },
                                onCropDetail = { cropId -> navController.navigate(Screen.CropDetail.route(cropId, showPlantButton = false)) },
                                onOpenHarvest = { navController.navigate(Screen.Harvest.route) },
                                onOpenPlantingInfo = { plantingId -> navController.navigate(Screen.PlantingInfo.route(plantingId)) }
                            )
                        }
                        composable(Screen.Harvest.route) {
                            HarvestScreen(
                                onAddPlanting = { navController.navigate(Screen.Crops.route) },
                                onBack = { navController.popBackStack() }
                            )
                        }
                        composable(Screen.Info.route) {
                            InfoHubScreen(
                                onOpenCrops     = { navController.navigate(Screen.Crops.route) },
                                onOpenGuide     = { navController.navigate(Screen.Guide.route) },
                                onOpenAnalytics = { navController.navigate(Screen.Analytics.route) }
                            )
                        }
                        // Справочник проблем — без фильтра (из «Информации»)
                        composable(Screen.Guide.route) {
                            GuideScreen(
                                onBack = { navController.popBackStack() },
                                onEntryClick = { slug -> navController.navigate(Screen.GuideDetail.route(slug)) }
                            )
                        }
                        // Справочник проблем — отфильтрованный по культуре (из карточки культуры)
                        composable(
                            route = Screen.Guide.routeWithArgs,
                            arguments = listOf(
                                navArgument(Screen.Guide.ARG_CROP_ID) { type = NavType.IntType; defaultValue = -1 },
                                navArgument(Screen.Guide.ARG_CROP) { type = NavType.StringType; defaultValue = "" }
                            )
                        ) { backStackEntry ->
                            val cropId = backStackEntry.arguments?.getInt(Screen.Guide.ARG_CROP_ID) ?: -1
                            val cropName = backStackEntry.arguments?.getString(Screen.Guide.ARG_CROP)?.takeIf { it.isNotBlank() }
                            GuideScreen(
                                cropId = cropId,
                                cropName = cropName,
                                onBack = { navController.popBackStack() },
                                onClearCrop = {
                                    navController.navigate(Screen.Guide.route) {
                                        popUpTo(Screen.Guide.routeWithArgs) { inclusive = true }
                                    }
                                },
                                onEntryClick = { slug -> navController.navigate(Screen.GuideDetail.route(slug)) }
                            )
                        }
                        composable(
                            route = Screen.PlantingInfo.route,
                            arguments = listOf(navArgument(Screen.PlantingInfo.ARG_PLANTING_ID) { type = NavType.IntType })
                        ) { backStackEntry ->
                            val pid = backStackEntry.arguments?.getInt(Screen.PlantingInfo.ARG_PLANTING_ID) ?: return@composable
                            PlantingInfoScreen(
                                plantingId = pid,
                                onBack = { navController.popBackStack() },
                                onOpenGuide = { cropId, cropName -> navController.navigate(Screen.Guide.withCrop(cropId, cropName)) }
                            )
                        }
                        composable(
                            route = Screen.GuideDetail.route,
                            arguments = listOf(navArgument(Screen.GuideDetail.ARG_SLUG) { type = NavType.StringType })
                        ) { backStackEntry ->
                            val slug = backStackEntry.arguments?.getString(Screen.GuideDetail.ARG_SLUG) ?: return@composable
                            GuideDetailScreen(
                                slug = slug,
                                onBack = { navController.popBackStack() },
                                onCropClick = { cropId -> navController.navigate(Screen.CropDetail.route(cropId, showPlantButton = false)) }
                            )
                        }
                        composable(Screen.Analytics.route) {
                            AnalyticsScreen(onBack = { navController.popBackStack() })
                        }
                        composable(Screen.Paywall.route) {
                            PaywallScreen(
                                onAccessGranted = {
                                    navController.navigate(Screen.Today.route) {
                                        popUpTo(Screen.Paywall.route) { inclusive = true }
                                        launchSingleTop = true
                                    }
                                }
                            )
                        }

                        composable(Screen.Crops.route) {
                            val cropsViewModel: CropsViewModel = hiltViewModel()
                            CropsScreen(
                                viewModel = cropsViewModel,
                                onBack = { navController.popBackStack() },
                                onCropClick = { crop ->
                                    cropsViewModel.selectCrop(crop)
                                    navController.navigate(Screen.CropDetail.route(crop.id))
                                }
                            )
                        }
                        composable(
                            route = Screen.CropDetail.routeWithArgs,
                            arguments = listOf(
                                navArgument("cropId") { type = NavType.IntType },
                                navArgument(Screen.CropDetail.ARG_SHOW_PLANT) {
                                    type = NavType.BoolType; defaultValue = true
                                }
                            )
                        ) { backStackEntry ->
                            val cropId = backStackEntry.arguments?.getInt("cropId") ?: return@composable
                            val showPlantButton = backStackEntry.arguments?.getBoolean(Screen.CropDetail.ARG_SHOW_PLANT) ?: true
                            val cropsViewModel: CropsViewModel = hiltViewModel()
                            LaunchedEffect(cropId) { cropsViewModel.loadCropById(cropId) }
                            val state by cropsViewModel.uiState.collectAsState()
                            val crop = state.selectedCrop
                            when {
                                state.isLoading || crop == null -> Box(
                                    Modifier.fillMaxSize(),
                                    contentAlignment = androidx.compose.ui.Alignment.Center
                                ) { CircularProgressIndicator() }
                                else -> CropDetailScreen(
                                    crop = crop,
                                    climateZone = state.climateZone,
                                    onBack = {
                                        cropsViewModel.clearSelectedCrop()
                                        navController.popBackStack()
                                    },
                                    onPlant = if (showPlantButton) ({ selectedCrop ->
                                        navController.navigate(Screen.Plantings.withNewCrop(selectedCrop.id)) {
                                            popUpTo(Screen.Today.route)
                                        }
                                    }) else null,
                                    onOpenGuide = { navController.navigate(Screen.Guide.withCrop(crop.id, crop.name)) }
                                )
                            }
                        }
                    }
                }

                // Coach mark overlay — drawn above Scaffold (covers nav bar too)
                if (coachMarkController.isVisible) {
                    CoachMarkOverlay(
                        controller = coachMarkController,
                        onDone     = { tokenStorage.setCoachDone() }
                    )
                }
                } // end Box
            }
        }
    }

    private fun TokenStorage.isLoggedIn() = getToken() != null
}
