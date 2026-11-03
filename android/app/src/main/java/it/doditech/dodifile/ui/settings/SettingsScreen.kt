package it.doditech.dodifile.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import it.doditech.dodifile.data.repository.ThemeMode

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(viewModel: SettingsViewModel, scrollToDev: Boolean, onBack: () -> Unit) {
    val settings by viewModel.settings.collectAsStateWithLifecycle()
    val scroll = rememberScrollState()

    // Arrivando dal link "DEV" della Home scorre direttamente alla scheda sviluppatore
    LaunchedEffect(scrollToDev) {
        if (scrollToDev) scroll.animateScrollTo(scroll.maxValue)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Impostazioni") },
                navigationIcon = {
                    IconButton(onClick = onBack, modifier = Modifier.size(56.dp)) {
                        Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Indietro", modifier = Modifier.size(30.dp))
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier.padding(padding).verticalScroll(scroll).padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            Section("Dimensione del testo") {
                listOf(1f to "Normale", 1.25f to "Grande", 1.5f to "Molto grande").forEach { (value, label) ->
                    OptionRow(label, selected = settings.textScale == value) { viewModel.setTextScale(value) }
                }
            }

            Section("Aspetto") {
                listOf(ThemeMode.SYSTEM to "Come il telefono", ThemeMode.LIGHT to "Chiaro", ThemeMode.DARK to "Scuro")
                    .forEach { (mode, label) ->
                        OptionRow(label, selected = settings.theme == mode) { viewModel.setTheme(mode) }
                    }
            }

            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.Top) {
                    Icon(Icons.Rounded.Lock, contentDescription = null, modifier = Modifier.size(32.dp), tint = MaterialTheme.colorScheme.primary)
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text("I tuoi dati restano tuoi", style = MaterialTheme.typography.titleMedium)
                        Text(
                            "Documenti, testo letto e promemoria sono salvati solo su questo telefono. " +
                                "DodiFile non usa server, non ha account e non richiede internet.",
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }
            }

            // ----- Sezione DEV -----
            DevSection()
        }
    }
}

@Composable
private fun Section(title: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(title, style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(bottom = 4.dp))
        content()
    }
}

@Composable
private fun OptionRow(label: String, selected: Boolean, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 56.dp)
            .selectable(selected = selected, onClick = onClick, role = Role.RadioButton),
        verticalAlignment = Alignment.CenterVertically
    ) {
        RadioButton(selected = selected, onClick = null)
        Spacer(Modifier.width(12.dp))
        Text(label, style = MaterialTheme.typography.bodyLarge)
    }
}
