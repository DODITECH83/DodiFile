package it.doditech.dodifile.data.repository

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.floatPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "settings")

enum class ThemeMode { SYSTEM, LIGHT, DARK }

data class AppSettings(
    /** Moltiplicatore applicato alla scala dei caratteri di sistema: 1.0 / 1.25 / 1.5 */
    val textScale: Float = 1f,
    val theme: ThemeMode = ThemeMode.SYSTEM
)

class SettingsStore(private val context: Context) {
    private val scaleKey = floatPreferencesKey("text_scale")
    private val themeKey = stringPreferencesKey("theme")

    val settings: Flow<AppSettings> = context.dataStore.data.map { p ->
        AppSettings(
            textScale = p[scaleKey] ?: 1f,
            theme = p[themeKey]?.let { runCatching { ThemeMode.valueOf(it) }.getOrNull() } ?: ThemeMode.SYSTEM
        )
    }

    suspend fun setTextScale(value: Float) {
        context.dataStore.edit { it[scaleKey] = value }
    }

    suspend fun setTheme(mode: ThemeMode) {
        context.dataStore.edit { it[themeKey] = mode.name }
    }
}
