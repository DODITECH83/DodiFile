package it.doditech.dodifile.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.Density
import androidx.core.view.WindowCompat
import it.doditech.dodifile.data.repository.AppSettings
import it.doditech.dodifile.data.repository.ThemeMode

// Palette a contrasto alto (rapporto > 7:1 per testo normale) pensata per la leggibilità.
private val LightColors = lightColorScheme(
    primary = Color(0xFF0B3D91),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFD9E5FF),
    onPrimaryContainer = Color(0xFF001B45),
    background = Color(0xFFFAFAFC),
    onBackground = Color(0xFF0B0B0F),
    surface = Color.White,
    onSurface = Color(0xFF0B0B0F),
    surfaceVariant = Color(0xFFE6EAF2),
    onSurfaceVariant = Color(0xFF2B303B),
    outline = Color(0xFF5B6272),
    error = Color(0xFFB00020)
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFFA9C7FF),
    onPrimary = Color(0xFF00214F),
    primaryContainer = Color(0xFF1B3A73),
    onPrimaryContainer = Color(0xFFD9E5FF),
    background = Color(0xFF0E1116),
    onBackground = Color(0xFFF2F4F8),
    surface = Color(0xFF161A22),
    onSurface = Color(0xFFF2F4F8),
    surfaceVariant = Color(0xFF252B36),
    onSurfaceVariant = Color(0xFFD0D5E0),
    outline = Color(0xFF9AA2B3),
    error = Color(0xFFFFB4AB)
)

@Composable
fun DodiFileTheme(settings: AppSettings, content: @Composable () -> Unit) {
    val dark = when (settings.theme) {
        ThemeMode.SYSTEM -> isSystemInDarkTheme()
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
    }
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            WindowCompat.getInsetsController(window, view).apply {
                isAppearanceLightStatusBars = !dark
                isAppearanceLightNavigationBars = !dark
            }
        }
    }
    // La scala scelta dall'utente si somma a quella impostata nel sistema Android.
    val density = LocalDensity.current
    CompositionLocalProvider(
        LocalDensity provides Density(density.density, density.fontScale * settings.textScale)
    ) {
        MaterialTheme(
            colorScheme = if (dark) DarkColors else LightColors,
            typography = DodiTypography,
            content = content
        )
    }
}
