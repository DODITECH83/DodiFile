package it.doditech.dodifile.domain

import it.doditech.dodifile.data.local.DocumentEntity
import kotlin.math.abs

/**
 * Ricerca "semantica semplificata", 100% offline:
 *  - cerca nel titolo e nel testo letto dall'OCR;
 *  - espande i sinonimi ("caldaia" trova anche "gas", "riscaldamento"…);
 *  - tollera un errore di battitura/OCR (distanza 1) sulle parole lunghe;
 *  - con più parole, ognuna deve trovare qualcosa (logica AND).
 */
object SemanticSearch {
    private val groups: List<Set<String>> = listOf(
        setOf("caldaia", "gas", "riscaldamento", "termosifone", "boiler", "metano", "manutenzione"),
        setOf("lavatrice", "lavastoviglie", "frigorifero", "forno", "asciugatrice", "elettrodomestico", "garanzia"),
        setOf("luce", "energia", "elettricita", "kwh", "enel", "bolletta"),
        setOf("acqua", "idrico", "idrica", "bolletta"),
        setOf("auto", "macchina", "bollo", "assicurazione", "rca", "revisione", "tagliando", "targa", "patente"),
        setOf("medico", "visita", "ricetta", "farmaco", "analisi", "referto", "ospedale", "salute", "asl"),
        setOf("tasse", "imu", "tari", "irpef", "isee", "fisco", "f24", "730"),
        setOf("affitto", "locazione", "contratto", "condominio", "casa"),
        setOf("scontrino", "spesa", "ricevuta", "fattura", "pagamento")
    )

    fun rank(docs: List<DocumentEntity>, query: String): List<DocumentEntity> {
        val tokens = TextNormalizer.normalize(query).split(' ').filter { it.isNotBlank() }
        if (tokens.isEmpty()) return docs
        return docs.map { it to score(it, tokens) }
            .filter { it.second > 0 }
            .sortedByDescending { it.second }
            .map { it.first }
    }

    private fun expand(token: String): Set<String> {
        val out = mutableSetOf<String>()
        for (g in groups) {
            if (g.any { it == token || (token.length >= 3 && it.startsWith(token)) }) out += g
        }
        out.remove(token)
        return out
    }

    private fun score(doc: DocumentEntity, tokens: List<String>): Int {
        val title = TextNormalizer.normalize(doc.title)
        val hay = doc.searchText
        val words by lazy { hay.split(Regex("[^a-z0-9]+")).toHashSet() }
        var total = 0
        for (tok in tokens) {
            var s = 0
            if (title.contains(tok)) s += 4
            if (hay.contains(tok)) s += 2
            else if (tok.length >= 5 && words.any { withinOne(it, tok) }) s += 1
            expand(tok).forEach { if (hay.contains(it)) s += 1 }
            if (s == 0) return 0 // ogni parola deve trovare qualcosa
            total += s
        }
        return total
    }

    /** true se le due parole differiscono al massimo di 1 carattere (inserimento, cancellazione o sostituzione). */
    internal fun withinOne(a: String, b: String): Boolean {
        if (abs(a.length - b.length) > 1) return false
        var i = 0
        var j = 0
        var edits = 0
        while (i < a.length && j < b.length) {
            if (a[i] == b[j]) {
                i++; j++
            } else {
                if (++edits > 1) return false
                when {
                    a.length > b.length -> i++
                    a.length < b.length -> j++
                    else -> { i++; j++ }
                }
            }
        }
        return edits + (a.length - i) + (b.length - j) <= 1
    }
}
