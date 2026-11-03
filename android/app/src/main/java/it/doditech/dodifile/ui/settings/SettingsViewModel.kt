package it.doditech.dodifile.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import it.doditech.dodifile.data.repository.AppSettings
import it.doditech.dodifile.data.repository.SettingsStore
import it.doditech.dodifile.data.repository.ThemeMode
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class SettingsViewModel(private val store: SettingsStore) : ViewModel() {
    val settings: StateFlow<AppSettings> =
        store.settings.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), AppSettings())

    fun setTextScale(value: Float) { viewModelScope.launch { store.setTextScale(value) } }
    fun setTheme(mode: ThemeMode) { viewModelScope.launch { store.setTheme(mode) } }
}
