package it.doditech.dodifile.domain

/** Le parole chiave sono già in minuscolo e senza accenti (come il testo normalizzato). */
enum class Category(val label: String, val keywords: List<String>) {
    CASA(
        "Casa",
        listOf("bolletta", "luce", "energia", "gas", "acqua", "condominio", "affitto", "locazione", "caldaia",
            "elettricita", "fornitura", "pod", "pdr", "canone", "internet", "fibra", "telefono", "utenza")
    ),
    AUTO(
        "Auto",
        listOf("auto", "targa", "bollo", "assicurazione", "rca", "revisione", "tagliando", "carburante",
            "patente", "veicolo", "autoveicolo", "pneumatici", "officina", "kasko")
    ),
    SALUTE(
        "Salute",
        listOf("visita", "medico", "ricetta", "farmaco", "referto", "analisi", "ospedale", "asl", "clinica",
            "terapia", "prescrizione", "tessera sanitaria", "dentista", "paziente", "diagnosi")
    ),
    TASSE(
        "Tasse",
        listOf("tasse", "imposta", "irpef", "imu", "tari", "isee", "f24", "agenzia delle entrate", "730",
            "dichiarazione", "tributi", "fisco", "certificazione unica", "contributi", "inps")
    ),
    SPESE(
        "Spese",
        listOf("scontrino", "ricevuta", "fattura", "garanzia", "acquisto", "totale", "iva", "pagamento",
            "carta di credito", "importo", "negozio", "ordine")
    ),
    LAVORO(
        "Lavoro",
        listOf("busta paga", "contratto di lavoro", "stipendio", "cedolino", "assunzione", "tfr",
            "curriculum", "azienda", "dipendente")
    ),
    ALTRO("Altro", emptyList());

    companion object {
        fun fromName(name: String): Category = entries.firstOrNull { it.name == name } ?: ALTRO
    }
}

object Categorizer {
    /** Assegna la categoria con più parole chiave presenti nel testo; in caso di parità vince la prima. */
    fun classify(text: String): Category {
        val t = TextNormalizer.normalize(text)
        var best = Category.ALTRO
        var bestScore = 0
        for (c in Category.entries) {
            val score = c.keywords.count { t.contains(it) }
            if (score > bestScore) {
                best = c
                bestScore = score
            }
        }
        return best
    }
}
