package it.doditech.dodifile.ui.home

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CameraAlt
import androidx.compose.material.icons.rounded.Clear
import androidx.compose.material.icons.rounded.Code
import androidx.compose.material.icons.rounded.DocumentScanner
import androidx.compose.material.icons.rounded.FolderOpen
import androidx.compose.material.icons.rounded.PictureAsPdf
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material.icons.rounded.UploadFile
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult
import it.doditech.dodifile.data.local.DocumentEntity
import it.doditech.dodifile.data.repository.FileStorage
import it.doditech.dodifile.domain.Category
import it.doditech.dodifile.domain.Urgency
import it.doditech.dodifile.ui.components.DueChip
import it.doditech.dodifile.ui.components.colors
import it.doditech.dodifile.ui.components.icon

private tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    viewModel: HomeViewModel,
    onOpenDocument: (Long) -> Unit,
    onOpenSettings: (scrollToDev: Boolean) -> Unit
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    val context = LocalContext.current
    var showSheet by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                is HomeEvent.Saved -> onOpenDocument(event.id)
                is HomeEvent.Message -> snackbar.showSnackbar(event.text)
            }
        }
    }

    // --- Scanner di documenti ML Kit (ritaglio automatico, correzione prospettiva, multi-pagina)
    val scanLauncher = rememberLauncherForActivityResult(ActivityResultContracts.StartIntentSenderForResult()) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val scan = GmsDocumentScanningResult.fromActivityResultIntent(result.data)
            val pages = scan?.pages.orEmpty()
            val pdf = scan?.pdf
            when {
                pages.size > 1 && pdf != null -> viewModel.importFile(pdf.uri, "application/pdf")
                pages.isNotEmpty() -> viewModel.importFile(pages.first().imageUri, "image/jpeg")
            }
        }
    }

    // --- Caricamento di un PDF o di una foto già presente nel telefono
    val pickLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        uri?.let { viewModel.importFile(it, context.contentResolver.getType(it) ?: "image/jpeg") }
    }

    fun startScan() {
        val activity = context.findActivity() ?: return
        val options = GmsDocumentScannerOptions.Builder()
            .setGalleryImportAllowed(true)
            .setPageLimit(5)
            .setResultFormats(GmsDocumentScannerOptions.RESULT_FORMAT_JPEG, GmsDocumentScannerOptions.RESULT_FORMAT_PDF)
            .setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_FULL)
            .build()
        GmsDocumentScanning.getClient(options).getStartScanIntent(activity)
            .addOnSuccessListener { scanLauncher.launch(IntentSenderRequest.Builder(it).build()) }
            .addOnFailureListener {
                viewModel.showMessage("Lo scanner non è disponibile su questo telefono. Usa «Carica PDF o foto».")
            }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            TopAppBar(
                title = { Text("DodiFile", fontWeight = FontWeight.Bold) },
                actions = {
                    IconButton(onClick = { onOpenSettings(false) }, modifier = Modifier.size(56.dp)) {
                        Icon(Icons.Rounded.Settings, contentDescription = "Impostazioni", modifier = Modifier.size(32.dp))
                    }
                }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.padding(padding).fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item { ScanHero(busy = state.busy, onClick = { showSheet = true }) }
            item { SearchField(state.query, viewModel::onQueryChange) }
            if (state.overdue + state.soon + state.later > 0 && state.query.isBlank()) {
                item { DeadlineSummary(state) }
            }
            if (state.totalCount > 0) {
                item { CategoryRow(state.category, viewModel::onCategoryChange) }
            }
            if (state.documents.isEmpty()) {
                item { EmptyState(isFiltering = state.query.isNotBlank() || state.category != null) }
            } else {
                items(state.documents, key = { it.id }) { doc ->
                    DocumentCard(doc, onClick = { onOpenDocument(doc.id) })
                }
            }
            item { DevFooter(onClick = { onOpenSettings(true) }) }
        }
    }

    if (showSheet) {
        ModalBottomSheet(onDismissRequest = { showSheet = false }) {
            Column(Modifier.padding(horizontal = 20.dp).padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                SheetAction(Icons.Rounded.CameraAlt, "Scatta o scansiona", "Usa la fotocamera: ritaglio automatico") {
                    showSheet = false
                    startScan()
                }
                SheetAction(Icons.Rounded.UploadFile, "Carica PDF o foto", "Scegli un file già nel telefono") {
                    showSheet = false
                    pickLauncher.launch(arrayOf("application/pdf", "image/*"))
                }
            }
        }
    }
}

/** L'unico grande tasto centrale. */
@Composable
private fun ScanHero(busy: Boolean, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        enabled = !busy,
        shape = RoundedCornerShape(32.dp),
        modifier = Modifier.fillMaxWidth().heightIn(min = 148.dp),
        colors = ButtonDefaults.buttonColors(
            disabledContainerColor = MaterialTheme.colorScheme.primary,
            disabledContentColor = MaterialTheme.colorScheme.onPrimary
        ),
        contentPadding = PaddingValues(24.dp)
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (busy) {
                CircularProgressIndicator(color = MaterialTheme.colorScheme.onPrimary, modifier = Modifier.size(52.dp))
                Text("Sto leggendo il documento…", style = MaterialTheme.typography.titleLarge, textAlign = TextAlign.Center)
            } else {
                Icon(Icons.Rounded.DocumentScanner, contentDescription = null, modifier = Modifier.size(56.dp))
                Text("Scansiona o carica", style = MaterialTheme.typography.headlineSmall)
                Text("Bolletta, scontrino, garanzia, PDF…", style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.Center)
            }
        }
    }
}

@Composable
private fun SheetAction(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, subtitle: String, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
    ) {
        Row(Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(40.dp), tint = MaterialTheme.colorScheme.onPrimaryContainer)
            Spacer(Modifier.width(16.dp))
            Column {
                Text(title, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onPrimaryContainer)
                Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onPrimaryContainer)
            }
        }
    }
}

@Composable
private fun SearchField(query: String, onChange: (String) -> Unit) {
    OutlinedTextField(
        value = query,
        onValueChange = onChange,
        modifier = Modifier.fillMaxWidth().heightIn(min = 64.dp),
        singleLine = true,
        shape = RoundedCornerShape(20.dp),
        textStyle = MaterialTheme.typography.bodyLarge,
        placeholder = { Text("Cerca: caldaia, lavatrice, bollo…", style = MaterialTheme.typography.bodyLarge) },
        leadingIcon = { Icon(Icons.Rounded.Search, contentDescription = null, modifier = Modifier.size(28.dp)) },
        trailingIcon = {
            if (query.isNotEmpty()) {
                IconButton(onClick = { onChange("") }) {
                    Icon(Icons.Rounded.Clear, contentDescription = "Cancella ricerca", modifier = Modifier.size(28.dp))
                }
            }
        }
    )
}

@Composable
private fun DeadlineSummary(state: HomeUiState) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Le tue scadenze", style = MaterialTheme.typography.titleLarge)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SummaryTile(Urgency.OVERDUE, state.overdue, "Scadute", Modifier.weight(1f))
                SummaryTile(Urgency.SOON, state.soon, "Entro 7 giorni", Modifier.weight(1f))
                SummaryTile(Urgency.LATER, state.later, "Più avanti", Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun SummaryTile(urgency: Urgency, count: Int, label: String, modifier: Modifier) {
    val c = urgency.colors()
    Column(
        modifier = modifier
            .semantics(mergeDescendants = true) { contentDescription = "$label: $count" }
            .clip(RoundedCornerShape(16.dp))
            .background(c.container)
            .padding(vertical = 12.dp, horizontal = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(urgency.icon(), contentDescription = null, tint = c.content, modifier = Modifier.size(28.dp))
        Text("$count", style = MaterialTheme.typography.headlineMedium, color = c.content)
        Text(label, style = MaterialTheme.typography.bodySmall, color = c.content, textAlign = TextAlign.Center)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CategoryRow(selected: Category?, onSelect: (Category?) -> Unit) {
    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        item {
            FilterChip(
                selected = selected == null,
                onClick = { onSelect(null) },
                modifier = Modifier.heightIn(min = 48.dp),
                label = { Text("Tutti", style = MaterialTheme.typography.labelLarge) }
            )
        }
        items(Category.entries.toList()) { cat ->
            FilterChip(
                selected = selected == cat,
                onClick = { onSelect(if (selected == cat) null else cat) },
                modifier = Modifier.heightIn(min = 48.dp),
                label = { Text(cat.label, style = MaterialTheme.typography.labelLarge) },
                leadingIcon = { Icon(cat.icon(), contentDescription = null, modifier = Modifier.size(22.dp)) }
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DocumentCard(doc: DocumentEntity, onClick: () -> Unit) {
    val context = LocalContext.current
    val category = Category.fromName(doc.category)
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(72.dp).clip(RoundedCornerShape(16.dp)),
                contentAlignment = Alignment.Center
            ) {
                if (doc.mimeType.startsWith("image/")) {
                    AsyncImage(
                        model = FileStorage.resolve(context, doc.fileName),
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize()
                    )
                } else {
                    Icon(
                        Icons.Rounded.PictureAsPdf, contentDescription = null,
                        modifier = Modifier.size(44.dp), tint = MaterialTheme.colorScheme.primary
                    )
                }
            }
            Spacer(Modifier.width(16.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(doc.title, style = MaterialTheme.typography.titleMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(category.icon(), contentDescription = null, modifier = Modifier.size(20.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.width(6.dp))
                    Text(category.label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                doc.dueEpochDay?.let { DueChip(it) }
            }
        }
    }
}

@Composable
private fun EmptyState(isFiltering: Boolean) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Icon(Icons.Rounded.FolderOpen, contentDescription = null, modifier = Modifier.size(64.dp), tint = MaterialTheme.colorScheme.outline)
        Text(
            if (isFiltering) "Nessun documento trovato" else "Il tuo cassetto è vuoto",
            style = MaterialTheme.typography.titleLarge, textAlign = TextAlign.Center
        )
        Text(
            if (isFiltering) "Prova con un'altra parola o togli il filtro."
            else "Tocca il grande pulsante in alto per aggiungere la tua prima bolletta, scontrino o garanzia.",
            style = MaterialTheme.typography.bodyLarge, textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

/** Accesso rapido alla sezione DEV (si apre direttamente in fondo alle Impostazioni). */
@Composable
private fun DevFooter(onClick: () -> Unit) {
    Box(Modifier.fillMaxWidth().padding(top = 8.dp), contentAlignment = Alignment.Center) {
        TextButton(onClick = onClick, modifier = Modifier.heightIn(min = 48.dp)) {
            Icon(Icons.Rounded.Code, contentDescription = null, modifier = Modifier.size(22.dp))
            Spacer(Modifier.width(8.dp))
            Text("DEV · Info sviluppatore", style = MaterialTheme.typography.labelLarge)
        }
    }
}
