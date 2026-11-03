package it.doditech.dodifile.domain

import it.doditech.dodifile.data.local.DocumentEntity
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

/** "Semaforo scadenze": rosso = scaduto, giallo = entro 7 giorni, verde = più avanti. */
enum class Urgency { OVERDUE, SOON, LATER, NONE }

fun urgencyOf(daysLeft: Long?): Urgency = when {
    daysLeft == null -> Urgency.NONE
    daysLeft < 0 -> Urgency.OVERDUE
    daysLeft <= 7 -> Urgency.SOON
    else -> Urgency.LATER
}

fun DocumentEntity.daysLeft(today: LocalDate = LocalDate.now()): Long? =
    dueEpochDay?.let { it - today.toEpochDay() }

fun DocumentEntity.urgency(today: LocalDate = LocalDate.now()): Urgency = urgencyOf(daysLeft(today))

fun daysLabel(days: Long): String = when {
    days == -1L -> "Scaduto ieri"
    days < 0 -> "Scaduto da ${-days} giorni"
    days == 0L -> "Scade oggi"
    days == 1L -> "Scade domani"
    else -> "Scade tra $days giorni"
}

fun formatDay(epochDay: Long): String =
    LocalDate.ofEpochDay(epochDay).format(DateTimeFormatter.ofPattern("d MMMM yyyy", Locale.getDefault()))
