package it.doditech.dodifile.domain

import java.time.LocalDate
import java.time.format.DateTimeFormatter

data class Analysis(val title: String, val category: Category, val due: ExtractedDate?)

object DocumentAnalyzer {
    private val hasWord = Regex("\\p{L}{4,}")

    fun analyze(text: String, today: LocalDate): Analysis {
        val title = text.lines().map { it.trim() }
            .firstOrNull { it.length in 4..60 && hasWord.containsMatchIn(it) }
            ?: "Documento del ${today.format(DateTimeFormatter.ofPattern("dd/MM/yyyy"))}"
        return Analysis(
            title = title,
            category = Categorizer.classify(text),
            due = DateExtractor.extract(text, today)
        )
    }
}
