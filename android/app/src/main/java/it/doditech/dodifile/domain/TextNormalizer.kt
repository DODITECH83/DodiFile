package it.doditech.dodifile.domain

import java.text.Normalizer

object TextNormalizer {
    private val accents = Regex("\\p{Mn}+")
    private val spaces = Regex("\\s+")

    /** minuscolo, senza accenti, spazi singoli: "Scadenza\nÈ" → "scadenza e" */
    fun normalize(s: String): String =
        Normalizer.normalize(s.lowercase(), Normalizer.Form.NFD)
            .replace(accents, "")
            .replace(spaces, " ")
}
