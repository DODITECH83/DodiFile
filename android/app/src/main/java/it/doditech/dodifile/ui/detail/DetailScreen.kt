package it.doditech.dodifile.ui.detail

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.OpenInNew
import androidx.compose.material.icons.rounded.PictureAsPdf
import androidx.compose.material.icons.rounded.Save
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import it.doditech.dodifile.data.local.DocumentEntity
import it.doditech.dodifile.data.repository.FileStorage
import it.doditech.dodifile.domain.Category
import it.doditech.dodifile.domain.formatDay
import it.doditech.dodifile.ui.components.DueChip
import it.doditech.dodifile.ui.components.icon

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun DetailScreen(viewModel: DetailViewModel, onBack: () -> Unit) {
    val stored by viewModel.document.collectAsStateWithLifecycle()
    var draft by remember { mutableStateOf<DocumentEntity?>(null) }
    LaunchedEffect(stored?.id) { if (draft == null && stored != null) draft = stored }

    var showDatePicker by remember { mutableStateOf(false) }
    var showDelete by remember { mutableStateOf(false) }
    var showText by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val d = draft

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Controlla il documento") },
                navigationIcon = {
                    IconButton(onClick = onBack, modifier = Modifier.size(56.dp)) {
                        Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Indietro", modifier = Modifier.size(30.dp))
                    }
                }
            )
        }
    ) { padding ->
        if (d == null) {
            Box(Modifier.padding(padding).fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            return@Scaffold
        }
        Column(
            modifier = Modifier.padding(padding).verticalScroll(rememberScrollState()).padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // Anteprima
            Box(
                modifier = Modifier.fillMaxWidth().heightIn(min = 120.dp, max = 320.dp).clip(RoundedCornerShape(20.dp)),
                contentAlignment = Alignment.Center
            ) {
                if (d.mimeType.startsWith("image/")) {
                    AsyncImage(
                        model = FileStorage.resolve(context, d.fileName),
                        contentDescription = "Anteprima del documento",
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.fillMaxWidth().heightIn(max = 320.dp)
                    )
                } else {
                    Icon(Icons.Rounded.PictureAsPdf, contentDescription = "Documento PDF", modifier = Modifier.size(96.dp), tint = MaterialTheme.colorScheme.primary)
                }
            }

            Text(
                "Ho letto il documento. Controlla che titolo, categoria e scadenza siano giusti, poi salva.",
                style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            OutlinedTextField(
                value = d.title,
                onValueChange = { draft = d.copy(title = it) },
                label = { Text("Titolo") },
                textStyle = MaterialTheme.typography.bodyLarge,
                modifier = Modifier.fillMaxWidth()
            )

            Text("Categoria", style = MaterialTheme.typography.titleMedium)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Category.entries.forEach { cat ->
                    FilterChip(
                        selected = Category.fromName(d.category) == cat,
                        onClick = { draft = d.copy(category = cat.name) },
                        modifier = Modifier.heightIn(min = 48.dp),
                        label = { Text(cat.label, style = MaterialTheme.typography.labelLarge) },
                        leadingIcon = { Icon(cat.icon(), contentDescription = null, modifier = Modifier.size(22.dp)) }
                    )
                }
            }

            // Scadenza
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Scadenza e promemoria", style = MaterialTheme.typography.titleMedium)
                    if (d.dueEpochDay != null) {
                        Text("${d.dueLabel ?: "Scadenza"}: ${formatDay(d.dueEpochDay)}", style = MaterialTheme.typography.bodyLarge)
                        DueChip(d.dueEpochDay)
                        Text("Ti avviserò 7 giorni prima, il giorno prima e il giorno stesso alle 9:00.", style = MaterialTheme.typography.bodyMedium)
                    } else {
                        Text("Nessuna scadenza trovata. Se il documento ne ha una, impostala tu.", style = MaterialTheme.typography.bodyLarge)
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = { showDatePicker = true }, modifier = Modifier.heightIn(min = 52.dp)) {
                            Icon(Icons.Rounded.CalendarMonth, contentDescription = null)
                            Spacer(Modifier.width(8.dp))
                            Text(if (d.dueEpochDay == null) "Imposta data" else "Cambia data")
                        }
                        if (d.dueEpochDay != null) {
                            TextButton(
                                onClick = { draft = d.copy(dueEpochDay = null, dueLabel = null) },
                                modifier = Modifier.heightIn(min = 52.dp)
                            ) { Text("Rimuovi") }
                        }
                    }
                }
            }

            OutlinedTextField(
                value = d.note,
                onValueChange = { draft = d.copy(note = it) },
                label = { Text("Nota (facoltativa)") },
                textStyle = MaterialTheme.typography.bodyLarge,
                minLines = 2,
                modifier = Modifier.fillMaxWidth()
            )

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(onClick = { openDocument(context, d) }, modifier = Modifier.weight(1f).heightIn(min = 56.dp)) {
                    Icon(Icons.Rounded.OpenInNew, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Apri")
                }
                OutlinedButton(onClick = { shareDocument(context, d) }, modifier = Modifier.weight(1f).heightIn(min = 56.dp)) {
                    Icon(Icons.Rounded.Share, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Condividi")
                }
            }

            Button(
                onClick = { viewModel.save(d, onBack) },
                modifier = Modifier.fillMaxWidth().heightIn(min = 64.dp),
                shape = RoundedCornerShape(20.dp)
            ) {
                Icon(Icons.Rounded.Save, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text("Salva", style = MaterialTheme.typography.titleMedium)
            }

            if (d.ocrText.isNotBlank()) {
                TextButton(onClick = { showText = !showText }) {
                    Text(if (showText) "Nascondi testo letto" else "Mostra testo letto dal documento")
                }
                if (showText) {
                    Text(d.ocrText, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            TextButton(
                onClick = { showDelete = true },
                colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error),
                modifier = Modifier.heightIn(min = 52.dp)
            ) {
                Icon(Icons.Rounded.Delete, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text("Elimina documento")
            }
        }

        if (showDatePicker) {
            val millisPerDay = 86_400_000L // il DatePicker lavora in UTC: giorno-epoca × ms/giorno
            val pickerState = rememberDatePickerState(
                initialSelectedDateMillis = (d.dueEpochDay ?: java.time.LocalDate.now().toEpochDay()) * millisPerDay
            )
            DatePickerDialog(
                onDismissRequest = { showDatePicker = false },
                confirmButton = {
                    TextButton(onClick = {
                        pickerState.selectedDateMillis?.let {
                            draft = d.copy(dueEpochDay = Math.floorDiv(it, millisPerDay), dueLabel = d.dueLabel ?: "Scadenza")
                        }
                        showDatePicker = false
                    }) { Text("OK") }
                },
                dismissButton = { TextButton(onClick = { showDatePicker = false }) { Text("Annulla") } }
            ) { DatePicker(state = pickerState) }
        }

        if (showDelete) {
            AlertDialog(
                onDismissRequest = { showDelete = false },
                title = { Text("Eliminare il documento?") },
                text = { Text("Il file e i suoi promemoria saranno cancellati dal telefono. Non si può annullare.") },
                confirmButton = {
                    TextButton(
                        onClick = { showDelete = false; viewModel.delete(d, onBack) },
                        colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)
                    ) { Text("Elimina") }
                },
                dismissButton = { TextButton(onClick = { showDelete = false }) { Text("Annulla") } }
            )
        }
    }
}
