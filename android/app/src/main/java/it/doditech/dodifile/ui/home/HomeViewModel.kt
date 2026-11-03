package it.doditech.dodifile.ui.home

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import it.doditech.dodifile.data.local.DocumentEntity
import it.doditech.dodifile.data.repository.DocumentRepository
import it.doditech.dodifile.domain.Category
import it.doditech.dodifile.domain.SemanticSearch
import it.doditech.dodifile.domain.Urgency
import it.doditech.dodifile.domain.urgency
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.LocalDate

data class HomeUiState(
    val query: String = "",
    val category: Category? = null,
    val documents: List<DocumentEntity> = emptyList(),
    val totalCount: Int = 0,
    val overdue: Int = 0,
    val soon: Int = 0,
    val later: Int = 0,
    val busy: Boolean = false
)

sealed interface HomeEvent {
    data class Saved(val id: Long) : HomeEvent
    data class Message(val text: String) : HomeEvent
}

class HomeViewModel(private val repository: DocumentRepository) : ViewModel() {
    private val query = MutableStateFlow("")
    private val category = MutableStateFlow<Category?>(null)
    private val busy = MutableStateFlow(false)

    private val _events = Channel<HomeEvent>(Channel.BUFFERED)
    val events = _events.receiveAsFlow()

    val uiState: StateFlow<HomeUiState> =
        combine(repository.documents, query, category, busy) { docs, q, cat, isBusy ->
            val today = LocalDate.now()
            val byCategory = if (cat == null) docs else docs.filter { Category.fromName(it.category) == cat }
            val shown = if (q.isBlank()) byCategory else SemanticSearch.rank(byCategory, q)
            val levels = docs.map { it.urgency(today) }
            HomeUiState(
                query = q,
                category = cat,
                documents = shown,
                totalCount = docs.size,
                overdue = levels.count { it == Urgency.OVERDUE },
                soon = levels.count { it == Urgency.SOON },
                later = levels.count { it == Urgency.LATER },
                busy = isBusy
            )
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), HomeUiState())

    fun onQueryChange(value: String) { query.value = value }
    fun onCategoryChange(value: Category?) { category.value = value }

    fun showMessage(text: String) {
        viewModelScope.launch { _events.send(HomeEvent.Message(text)) }
    }

    /** Scansione o PDF scelto: OCR + analisi + salvataggio, poi apre la scheda per un controllo rapido. */
    fun importFile(uri: Uri, mime: String) {
        if (busy.value) return
        viewModelScope.launch {
            busy.value = true
            try {
                val id = repository.addDocument(uri, mime)
                _events.send(HomeEvent.Saved(id))
            } catch (e: Exception) {
                _events.send(HomeEvent.Message("Non sono riuscito a salvare il documento. Riprova."))
            } finally {
                busy.value = false
            }
        }
    }
}
