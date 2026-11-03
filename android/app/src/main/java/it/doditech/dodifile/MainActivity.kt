package it.doditech.dodifile

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import it.doditech.dodifile.data.repository.AppSettings
import it.doditech.dodifile.ui.navigation.DodiFileNavHost
import it.doditech.dodifile.ui.theme.DodiFileTheme

class MainActivity : ComponentActivity() {

    private val docIdFromIntent = mutableStateOf<Long?>(null)

    private val notificationPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { /* l'app funziona anche senza */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        docIdFromIntent.value = intent.docId()
        askNotificationPermission()

        val container = (application as DodiFileApp).container
        setContent {
            val settings by container.settings.settings.collectAsStateWithLifecycle(AppSettings())
            DodiFileTheme(settings) {
                DodiFileNavHost(
                    container = container,
                    openDocId = docIdFromIntent.value,
                    onDocOpened = { docIdFromIntent.value = null }
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        docIdFromIntent.value = intent.docId()
    }

    private fun askNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    private fun Intent.docId(): Long? = getLongExtra(EXTRA_DOC_ID, -1L).takeIf { it >= 0 }

    companion object {
        const val EXTRA_DOC_ID = "docId"
    }
}
