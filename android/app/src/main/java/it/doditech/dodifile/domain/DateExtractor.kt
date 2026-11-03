package it.doditech.dodifile.domain

import java.time.LocalDate
import kotlin.math.max

data class ExtractedDate(val date: LocalDate, val label: String)

/**
 * Trova la scadenza nel testo OCR (italiano).
 * 1. Cerca date (12/03/2026, 12-03-26, 12 marzo 2026) precedute da parole come "scadenza", "entro il"…
 * 2. Se non trova nulla ma c'è "garanzia 24 mesi", calcola la fine garanzia dalla data d'acquisto.
 * Non inventa mai scadenze: se non è sicuro restituisce null.
 */
object DateExtractor {
    private val months = mapOf(
        "gennaio" to 1, "febbraio" to 2, "marzo" to 3, "aprile" to 4, "maggio" to 5, "giugno" to 6,
        "luglio" to 7, "agosto" to 8, "settembre" to 9, "ottobre" to 10, "novembre" to 11, "dicembre" to 12
    )
    private val numeric = Regex("""(?<!\d)(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4}|\d{2})(?!\d)""")
    private val textual = Regex("""(?<!\d)(\d{1,2}) (${months.keys.joinToString("|")}) (\d{4})""")
    private val warranty = Regex("""garanzia[^0-9]{0,25}(\d{1,2}) (mesi|mese|anni|anno)""")

    private val contexts = listOf(
        Regex("scadenz|scade|scadra") to "Scadenza",
        Regex("entro il|entro e non oltre|pagare entro|pagabile entro|pagamento entro") to "Pagamento entro",
        Regex("valid[oa] fino|valido al|fino al") to "Valido fino al",
        Regex("garanzia") to "Fine garanzia"
    )

    private data class Found(val index: Int, val date: LocalDate)

    private fun toDate(y: Int, mo: Int, d: Int): LocalDate? {
        val year = if (y < 100) 2000 + y else y
        if (year !in 2000..2100) return null
        return runCatching { LocalDate.of(year, mo, d) }.getOrNull()
    }

    private fun findDates(t: String): List<Found> {
        val out = mutableListOf<Found>()
        numeric.findAll(t).forEach { m ->
            toDate(m.groupValues[3].toInt(), m.groupValues[2].toInt(), m.groupValues[1].toInt())
                ?.let { out += Found(m.range.first, it) }
        }
        textual.findAll(t).forEach { m ->
            toDate(m.groupValues[3].toInt(), months.getValue(m.groupValues[2]), m.groupValues[1].toInt())
                ?.let { out += Found(m.range.first, it) }
        }
        return out
    }

    fun extract(rawText: String, today: LocalDate): ExtractedDate? {
        val t = TextNormalizer.normalize(rawText)
        val dates = findDates(t)

        // 1) date con una parola-chiave nei 50 caratteri precedenti (vince la parola più vicina)
        val tagged = dates.mapNotNull { f ->
            val window = t.substring(max(0, f.index - 50), f.index)
            val label = contexts
                .mapNotNull { (re, l) -> re.findAll(window).lastOrNull()?.let { it.range.last to l } }
                .maxByOrNull { it.first }?.second
            label?.let { f.date to it }
        }
        val upcoming = tagged.filter { !it.first.isBefore(today) }.minByOrNull { it.first }
        val chosen = upcoming ?: tagged.maxByOrNull { it.first } // altrimenti la più recente (già scaduta)
        if (chosen != null) return ExtractedDate(chosen.first, chosen.second)

        // 2) "garanzia 24 mesi" + data di acquisto
        val m = warranty.find(t)
        if (m != null) {
            val n = m.groupValues[1].toLong()
            val duration = if (m.groupValues[2].startsWith("ann")) n * 12 else n
            val purchase = dates.map { it.date }.filter { !it.isAfter(today.plusDays(1)) }.minOrNull()
            if (purchase != null) return ExtractedDate(purchase.plusMonths(duration), "Fine garanzia")
        }
        return null
    }
}
