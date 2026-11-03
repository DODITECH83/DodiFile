package it.doditech.dodifile.domain

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import java.io.File

/** OCR on-device con ML Kit Text Recognition (modello incluso nell'app: funziona anche senza rete). */
class OcrEngine(private val context: Context) {
    private val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

    suspend fun recognize(file: File, mime: String): String = withContext(Dispatchers.IO) {
        if (mime == "application/pdf") recognizePdf(file) else recognizeImage(file)
    }

    private suspend fun recognizeImage(file: File): String {
        val image = InputImage.fromFilePath(context, Uri.fromFile(file)) // gestisce anche la rotazione EXIF
        return recognizer.process(image).await().text
    }

    /** Disegna le prime pagine del PDF in una bitmap e le legge con l'OCR. */
    private suspend fun recognizePdf(file: File): String {
        val sb = StringBuilder()
        ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY).use { pfd ->
            PdfRenderer(pfd).use { renderer ->
                for (i in 0 until minOf(renderer.pageCount, MAX_PDF_PAGES)) {
                    renderer.openPage(i).use { page ->
                        val bmp = Bitmap.createBitmap(page.width * 2, page.height * 2, Bitmap.Config.ARGB_8888)
                        bmp.eraseColor(Color.WHITE)
                        page.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                        sb.appendLine(recognizer.process(InputImage.fromBitmap(bmp, 0)).await().text)
                        bmp.recycle()
                    }
                }
            }
        }
        return sb.toString()
    }

    private companion object {
        const val MAX_PDF_PAGES = 5
    }
}
