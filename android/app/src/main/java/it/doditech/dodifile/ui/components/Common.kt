package it.doditech.dodifile.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AccountBalance
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.DirectionsCar
import androidx.compose.material.icons.rounded.Folder
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.Info
import androidx.compose.material.icons.rounded.MedicalServices
import androidx.compose.material.icons.rounded.Receipt
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.Warning
import androidx.compose.material.icons.rounded.Work
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import it.doditech.dodifile.domain.Category
import it.doditech.dodifile.domain.Urgency
import it.doditech.dodifile.domain.daysLabel
import it.doditech.dodifile.domain.urgencyOf
import java.time.LocalDate

fun Category.icon(): ImageVector = when (this) {
    Category.CASA -> Icons.Rounded.Home
    Category.AUTO -> Icons.Rounded.DirectionsCar
    Category.SALUTE -> Icons.Rounded.MedicalServices
    Category.TASSE -> Icons.Rounded.AccountBalance
    Category.SPESE -> Icons.Rounded.Receipt
    Category.LAVORO -> Icons.Rounded.Work
    Category.ALTRO -> Icons.Rounded.Folder
}

data class UrgencyColors(val content: Color, val container: Color)

/** Il semaforo non si affida solo al colore: ogni stato ha anche icona e testo (accessibilità daltonici). */
@Composable
fun Urgency.colors(): UrgencyColors {
    val dark = MaterialTheme.colorScheme.background.luminance() < 0.5f
    return when (this) {
        Urgency.OVERDUE -> if (dark) UrgencyColors(Color(0xFFFFB4AB), Color(0xFF5C1A14))
        else UrgencyColors(Color(0xFF8C1D18), Color(0xFFFFDAD6))
        Urgency.SOON -> if (dark) UrgencyColors(Color(0xFFFFD27A), Color(0xFF4A3500))
        else UrgencyColors(Color(0xFF6B4500), Color(0xFFFFE9B8))
        Urgency.LATER -> if (dark) UrgencyColors(Color(0xFF9BE2A8), Color(0xFF0F3D1B))
        else UrgencyColors(Color(0xFF14532D), Color(0xFFCFF2D6))
        Urgency.NONE -> UrgencyColors(MaterialTheme.colorScheme.onSurfaceVariant, MaterialTheme.colorScheme.surfaceVariant)
    }
}

fun Urgency.icon(): ImageVector = when (this) {
    Urgency.OVERDUE -> Icons.Rounded.Warning
    Urgency.SOON -> Icons.Rounded.Schedule
    Urgency.LATER -> Icons.Rounded.CheckCircle
    Urgency.NONE -> Icons.Rounded.Info
}

@Composable
fun DueChip(epochDay: Long, modifier: Modifier = Modifier) {
    val days = epochDay - LocalDate.now().toEpochDay()
    val urgency = urgencyOf(days)
    val c = urgency.colors()
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(50))
            .background(c.container)
            .padding(horizontal = 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(urgency.icon(), contentDescription = null, tint = c.content, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(6.dp))
        Text(daysLabel(days), color = c.content, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
    }
}
