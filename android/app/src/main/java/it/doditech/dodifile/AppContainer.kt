package it.doditech.dodifile

import android.content.Context
import it.doditech.dodifile.data.local.AppDatabase
import it.doditech.dodifile.data.repository.DocumentRepository
import it.doditech.dodifile.data.repository.FileStorage
import it.doditech.dodifile.data.repository.SettingsStore
import it.doditech.dodifile.domain.OcrEngine
import it.doditech.dodifile.reminder.ReminderScheduler

/** Dependency injection manuale: semplice, senza librerie extra, facile da leggere. */
class AppContainer(context: Context) {
    private val app = context.applicationContext

    val storage = FileStorage(app)
    val settings = SettingsStore(app)
    val repository = DocumentRepository(
        dao = AppDatabase.get(app).documentDao(),
        storage = storage,
        ocr = OcrEngine(app),
        scheduler = ReminderScheduler(app)
    )
}
