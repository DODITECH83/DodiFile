package it.doditech.dodifile.ui.detail

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.widget.Toast
import androidx.core.content.FileProvider
import it.doditech.dodifile.data.local.DocumentEntity
import it.doditech.dodifile.data.repository.FileStorage

private fun uriFor(context: Context, doc: DocumentEntity) = FileProvider.getUriForFile(
    context, "${context.packageName}.fileprovider", FileStorage.resolve(context, doc.fileName)
)

fun openDocument(context: Context, doc: DocumentEntity) {
    val intent = Intent(Intent.ACTION_VIEW)
        .setDataAndType(uriFor(context, doc), doc.mimeType)
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    try {
        context.startActivity(intent)
    } catch (_: ActivityNotFoundException) {
        Toast.makeText(context, "Nessuna app trovata per aprire questo file", Toast.LENGTH_LONG).show()
    }
}

fun shareDocument(context: Context, doc: DocumentEntity) {
    val intent = Intent(Intent.ACTION_SEND)
        .setType(doc.mimeType)
        .putExtra(Intent.EXTRA_STREAM, uriFor(context, doc))
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    context.startActivity(Intent.createChooser(intent, "Condividi documento"))
}
