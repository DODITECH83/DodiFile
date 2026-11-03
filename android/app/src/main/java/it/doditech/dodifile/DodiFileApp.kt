package it.doditech.dodifile

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import it.doditech.dodifile.reminder.ReminderWorker

class DodiFileApp : Application() {

    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        createNotificationChannel()
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            ReminderWorker.CHANNEL_ID,
            getString(R.string.channel_deadlines),
            NotificationManager.IMPORTANCE_HIGH
        ).apply { description = getString(R.string.channel_deadlines_desc) }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }
}
