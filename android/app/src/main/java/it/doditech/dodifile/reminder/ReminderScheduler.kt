package it.doditech.dodifile.reminder

import android.content.Context
import androidx.work.Data
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import it.doditech.dodifile.data.local.DocumentEntity
import java.time.LocalDate
import java.time.ZoneId
import java.util.concurrent.TimeUnit

/**
 * Promemoria multipli: 7 giorni prima, 1 giorno prima e il giorno stesso, alle 9:00.
 * Usa WorkManager: i promemoria sopravvivono a riavvii e non richiedono il permesso "sveglie esatte".
 */
class ReminderScheduler(context: Context) {
    private val workManager = WorkManager.getInstance(context.applicationContext)

    fun schedule(doc: DocumentEntity) {
        cancel(doc.id)
        val epochDay = doc.dueEpochDay ?: return
        val zone = ZoneId.systemDefault()
        val due = LocalDate.ofEpochDay(epochDay)
        for (daysBefore in OFFSETS) {
            val fireAt = due.minusDays(daysBefore.toLong()).atTime(9, 0).atZone(zone).toInstant().toEpochMilli()
            val delay = fireAt - System.currentTimeMillis()
            if (delay <= 0) continue
            val request = OneTimeWorkRequestBuilder<ReminderWorker>()
                .setInitialDelay(delay, TimeUnit.MILLISECONDS)
                .setInputData(
                    Data.Builder()
                        .putLong(ReminderWorker.KEY_ID, doc.id)
                        .putString(ReminderWorker.KEY_TITLE, doc.title)
                        .putString(ReminderWorker.KEY_LABEL, doc.dueLabel ?: "Scadenza")
                        .putInt(ReminderWorker.KEY_DAYS, daysBefore)
                        .build()
                )
                .build()
            workManager.enqueueUniqueWork(workName(doc.id, daysBefore), androidx.work.ExistingWorkPolicy.REPLACE, request)
        }
    }

    fun cancel(docId: Long) {
        OFFSETS.forEach { workManager.cancelUniqueWork(workName(docId, it)) }
    }

    private fun workName(id: Long, daysBefore: Int) = "doc_${id}_$daysBefore"

    private companion object {
        val OFFSETS = listOf(7, 1, 0)
    }
}
