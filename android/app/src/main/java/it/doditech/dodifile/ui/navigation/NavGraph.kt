package it.doditech.dodifile.ui.navigation

import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import it.doditech.dodifile.AppContainer
import it.doditech.dodifile.ui.detail.DetailScreen
import it.doditech.dodifile.ui.detail.DetailViewModel
import it.doditech.dodifile.ui.home.HomeScreen
import it.doditech.dodifile.ui.home.HomeViewModel
import it.doditech.dodifile.ui.settings.SettingsScreen
import it.doditech.dodifile.ui.settings.SettingsViewModel

object Routes {
    const val HOME = "home"
    const val DETAIL = "detail/{id}"
    const val SETTINGS = "settings?dev={dev}"
    fun detail(id: Long) = "detail/$id"
    fun settings(scrollToDev: Boolean) = "settings?dev=$scrollToDev"
}

@Composable
fun DodiFileNavHost(container: AppContainer, openDocId: Long?, onDocOpened: () -> Unit) {
    val nav = rememberNavController()

    // Tocco su una notifica → apre direttamente il documento
    LaunchedEffect(openDocId) {
        if (openDocId != null) {
            nav.navigate(Routes.detail(openDocId))
            onDocOpened()
        }
    }

    NavHost(
        navController = nav,
        startDestination = Routes.HOME,
        enterTransition = { slideInHorizontally { it / 4 } + fadeIn() },
        exitTransition = { fadeOut() },
        popEnterTransition = { fadeIn() },
        popExitTransition = { slideOutHorizontally { it / 4 } + fadeOut() }
    ) {
        composable(Routes.HOME) {
            val vm: HomeViewModel = viewModel(factory = viewModelFactory {
                initializer { HomeViewModel(container.repository) }
            })
            HomeScreen(
                viewModel = vm,
                onOpenDocument = { nav.navigate(Routes.detail(it)) },
                onOpenSettings = { nav.navigate(Routes.settings(it)) }
            )
        }
        composable(Routes.DETAIL, arguments = listOf(navArgument("id") { type = NavType.LongType })) { entry ->
            val id = entry.arguments?.getLong("id") ?: -1L
            val vm: DetailViewModel = viewModel(factory = viewModelFactory {
                initializer { DetailViewModel(container.repository, id) }
            })
            DetailScreen(viewModel = vm, onBack = { nav.popBackStack() })
        }
        composable(
            Routes.SETTINGS,
            arguments = listOf(navArgument("dev") { type = NavType.BoolType; defaultValue = false })
        ) { entry ->
            val vm: SettingsViewModel = viewModel(factory = viewModelFactory {
                initializer { SettingsViewModel(container.settings) }
            })
            SettingsScreen(
                viewModel = vm,
                scrollToDev = entry.arguments?.getBoolean("dev") ?: false,
                onBack = { nav.popBackStack() }
            )
        }
    }
}
