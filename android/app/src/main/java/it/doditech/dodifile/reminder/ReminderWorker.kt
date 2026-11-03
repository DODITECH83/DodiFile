package it.doditech.dodifile.reminder

import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.Worker
import androidx.work.WorkerParameters
import it.doditech.dodifile.MainActivity
import it.doditech.dodifile.R

class ReminderWorker(context: Context, params: WorkerParameters) : Worker(context, params) {

    @SuppressLint("MissingPermission") // controllato con areNotificationsEnabled()
    override fun doWork(): Result {
        val id = inputData.getLong(KEY_ID, -1)
        val title = inputData.getString(KEY_TITLE) ?: return Result.success()
        val label = inputData.getString(KEY_LABEL) ?: "Scadenza"
        val days = inputData.getInt(KEY_DAYS, 0)

        val manager = NotificationManagerCompat.from(applicationContext)
        if (!manager.areNotificationsEnabled()) return Result.success()

        val whenText = when (days) {
            0 -> "oggi"
            1 -> "domani"
            else -> "tra $days giorni"
        }
        val intent = Intent(applicationContext, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(MainActivity.EXTRA_DOC_ID, id)
        }
        val pending = PendingIntent.getActivity(
            applicationContext, (id * 10 + days).toInt(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = NotificationCompat.Builder(applicationContext, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("$label $whenText")
            .setContentText(title)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pending)
            .build()
        try {
            manager.notify((id * 10 + days).toInt(), notification)
        } catch (_: SecurityException) {
            // permesso revocato nel frattempo: niente da fare
        }
        return Result.success()
    }

    companion object {
        const val CHANNEL_ID = "deadlines"
        const val KEY_ID = "id"
        const val KEY_TITLE = "title"
        const val KEY_LABEL = "label"
        const val KEY_DAYS = "days"
    }
}
