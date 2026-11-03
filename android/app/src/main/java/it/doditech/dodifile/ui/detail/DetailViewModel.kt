package it.doditech.dodifile.ui.detail

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import it.doditech.dodifile.data.local.DocumentEntity
import it.doditech.dodifile.data.repository.DocumentRepository
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class DetailViewModel(private val repository: DocumentRepository, id: Long) : ViewModel() {

    val document: StateFlow<DocumentEntity?> =
        repository.observe(id).stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    fun save(doc: DocumentEntity, onDone: () -> Unit) {
        viewModelScope.launch {
            repository.update(doc)
            onDone()
        }
    }

    fun delete(doc: DocumentEntity, onDone: () -> Unit) {
        viewModelScope.launch {
            repository.delete(doc)
            onDone()
        }
    }
}
