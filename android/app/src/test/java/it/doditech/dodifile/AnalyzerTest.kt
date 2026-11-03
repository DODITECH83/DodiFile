package it.doditech.dodifile

import it.doditech.dodifile.data.local.DocumentEntity
import it.doditech.dodifile.domain.Category
import it.doditech.dodifile.domain.Categorizer
import it.doditech.dodifile.domain.DateExtractor
import it.doditech.dodifile.domain.SemanticSearch
import it.doditech.dodifile.domain.TextNormalizer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class AnalyzerTest {
    private val today = LocalDate.of(2026, 10, 17)

    @Test
    fun findsDeadlineNextToKeyword() {
        val r = DateExtractor.extract("ENEL ENERGIA\nBolletta luce\nScadenza 15/12/2026\nTotale 82,40", today)
        assertEquals(LocalDate.of(2026, 12, 15), r?.date)
        assertEquals("Scadenza", r?.label)
    }

    @Test
    fun computesWarrantyEnd() {
        val r = DateExtractor.extract("Lavatrice Candy\nData 12/03/2026\nGaranzia 24 mesi", today)
        assertEquals(LocalDate.of(2028, 3, 12), r?.date)
        assertEquals("Fine garanzia", r?.label)
    }

    @Test
    fun doesNotInventDeadlines() {
        assertNull(DateExtractor.extract("Scontrino del 12/03/2026 totale 10,00", today))
    }

    @Test
    fun categorizes() {
        assertEquals(Category.CASA, Categorizer.classify("Bolletta del gas caldaia"))
        assertEquals(Category.AUTO, Categorizer.classify("Assicurazione RCA targa AB123CD"))
    }

    @Test
    fun searchExpandsSynonymsAndTolerance() {
        fun doc(id: Long, title: String, text: String) = DocumentEntity(
            id = id, title = title, category = "CASA", fileName = "x.jpg", mimeType = "image/jpeg",
            ocrText = text, searchText = TextNormalizer.normalize("$title $text"), createdAt = 0
        )
        val docs = listOf(doc(1, "Manutenzione", "controllo annuale riscaldamento"), doc(2, "Scontrino", "pane latte"))
        assertEquals(listOf(1L), SemanticSearch.rank(docs, "caldaia").map { it.id })
        assertTrue(SemanticSearch.withinOne("scaldamento", "riscaldamento").not())
        assertTrue(SemanticSearch.withinOne("lavatrise", "lavatrice"))
    }
}
