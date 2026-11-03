package it.doditech.dodifile.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "documents")
data class DocumentEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val title: String,
    /** Nome di [it.doditech.dodifile.domain.Category] */
    val category: String,
    /** Nome del file dentro filesDir/docs */
    val fileName: String,
    val mimeType: String,
    val ocrText: String,
    /** Testo normalizzato (minuscolo, senza accenti) usato dalla ricerca */
    val searchText: String,
    /** Scadenza come giorno-epoca locale (LocalDate.toEpochDay) */
    val dueEpochDay: Long? = null,
    val dueLabel: String? = null,
    val createdAt: Long,
    val note: String = ""
)
