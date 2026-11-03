package it.doditech.dodifile.data.repository

import android.net.Uri
import it.doditech.dodifile.data.local.DocumentDao
import it.doditech.dodifile.data.local.DocumentEntity
import it.doditech.dodifile.domain.Category
import it.doditech.dodifile.domain.DocumentAnalyzer
import it.doditech.dodifile.domain.OcrEngine
import it.doditech.dodifile.domain.TextNormalizer
import it.doditech.dodifile.reminder.ReminderScheduler
import kotlinx.coroutines.flow.Flow
import java.time.LocalDate

class DocumentRepository(
    private val dao: DocumentDao,
    private val storage: FileStorage,
    private val ocr: OcrEngine,
    private val scheduler: ReminderScheduler
) {
    val documents: Flow<List<DocumentEntity>> = dao.observeAll()

    fun observe(id: Long): Flow<DocumentEntity?> = dao.observe(id)

    /** Pipeline completa: copia privata → OCR locale → categoria + scadenza → salvataggio → promemoria. */
    suspend fun addDocument(source: Uri, mime: String): Long {
        val fileName = storage.import(source, mime)
        val storedMime = when {
            mime == "application/pdf" -> mime
            mime.contains("png") -> "image/png"
            else -> "image/jpeg"
        }
        val text = runCatching { ocr.recognize(storage.file(fileName), storedMime) }.getOrDefault("")
        val analysis = DocumentAnalyzer.analyze(text, LocalDate.now())

        val entity = DocumentEntity(
            title = analysis.title,
            category = analysis.category.name,
            fileName = fileName,
            mimeType = storedMime,
            ocrText = text,
            searchText = buildSearchText(analysis.title, analysis.category, text, ""),
            dueEpochDay = analysis.due?.date?.toEpochDay(),
            dueLabel = analysis.due?.label,
            createdAt = System.currentTimeMillis()
        )
        val id = dao.insert(entity)
        scheduler.schedule(entity.copy(id = id))
        return id
    }

    suspend fun update(doc: DocumentEntity) {
        val updated = doc.copy(
            searchText = buildSearchText(doc.title, Category.fromName(doc.category), doc.ocrText, doc.note)
        )
        dao.update(updated)
        scheduler.schedule(updated) // ripianifica (o cancella se la scadenza è stata rimossa)
    }

    suspend fun delete(doc: DocumentEntity) {
        scheduler.cancel(doc.id)
        storage.delete(doc.fileName)
        dao.delete(doc)
    }

    private fun buildSearchText(title: String, category: Category, ocr: String, note: String) =
        TextNormalizer.normalize("$title ${category.label} $note $ocr")
}
