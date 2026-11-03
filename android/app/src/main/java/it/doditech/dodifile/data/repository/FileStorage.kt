package it.doditech.dodifile.data.repository

import android.content.Context
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.util.UUID

/** Copia i documenti nell'archiviazione interna privata dell'app (nessun'altra app può leggerli). */
class FileStorage(private val context: Context) {

    suspend fun import(source: Uri, mime: String): String = withContext(Dispatchers.IO) {
        val ext = when {
            mime == "application/pdf" -> "pdf"
            mime.contains("png") -> "png"
            else -> "jpg"
        }
        val name = "${UUID.randomUUID()}.$ext"
        val input = requireNotNull(context.contentResolver.openInputStream(source)) { "File non leggibile" }
        input.use { i -> file(name).outputStream().use { o -> i.copyTo(o) } }
        name
    }

    fun file(name: String): File = resolve(context, name)

    fun delete(name: String) {
        file(name).delete()
    }

    companion object {
        fun resolve(context: Context, name: String): File =
            File(File(context.filesDir, "docs").apply { mkdirs() }, name)
    }
}
