package com.oplus.battery.controller.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Power
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.oplus.battery.controller.analytics.BatteryHealthReport
import com.oplus.battery.controller.analytics.ChargingSession
import com.oplus.battery.controller.analytics.LongevityRecommendation
import com.oplus.battery.controller.analytics.RecommendationImpact
import com.oplus.battery.controller.viewmodel.ChargingViewModel

@Composable
fun HealthAnalyticsScreen(
    viewModel: ChargingViewModel,
    onApplyRecommendation: (currentLimitMa: Int?, voltageLimitMv: Int?) -> Unit
) {
    val healthReport by viewModel.healthReport.collectAsState()
    val sessions by viewModel.chargingSessions.collectAsState()
    val activeSession by viewModel.activeSession.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // 1. Health Status Hero Card
        HealthOverviewCard(report = healthReport)

        // 2. Active Session Live Tracker (if connected)
        activeSession?.let { active ->
            ActiveSessionCard(session = active)
        }

        // 3. Tailored Longevity Recommendations
        RecommendationsSection(
            recommendations = healthReport.recommendations,
            onApply = onApplyRecommendation
        )

        // 4. Historical Charging Sessions Log
        SessionsHistorySection(sessions = sessions)
    }
}

@Composable
fun HealthOverviewCard(report: BatteryHealthReport) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        )
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(
                        Icons.Default.Favorite,
                        contentDescription = null,
                        tint = Color(0xFF00DC82),
                        modifier = Modifier.size(20.dp)
                    )
                    Text(
                        text = "Battery Health Estimation",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                    )
                }
                Text(
                    text = "Oppo Dual-Cell",
                    style = MaterialTheme.typography.labelSmall,
                    color = Color.Gray,
                    fontFamily = FontFamily.Monospace
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Circular Gauge
                Box(
                    modifier = Modifier.size(110.dp),
                    contentAlignment = Alignment.Center
                ) {
                    val animatedHealth by animateFloatAsState(
                        targetValue = report.healthPercentage / 100f,
                        animationSpec = tween(800),
                        label = "health"
                    )
                    CircularProgressIndicator(
                        progress = { animatedHealth },
                        modifier = Modifier.size(100.dp),
                        strokeWidth = 9.dp,
                        color = when {
                            report.healthPercentage >= 90f -> Color(0xFF00DC82)
                            report.healthPercentage >= 80f -> Color(0xFFFFB703)
                            else -> Color(0xFFE63946)
                        },
                        trackColor = Color.DarkGray.copy(alpha = 0.3f)
                    )
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "${report.healthPercentage}%",
                            style = MaterialTheme.typography.titleLarge.copy(
                                fontWeight = FontWeight.Black,
                                fontFamily = FontFamily.Monospace
                            )
                        )
                        Text(
                            text = "State of Health",
                            style = MaterialTheme.typography.labelSmall,
                            fontSize = 8.sp,
                            color = Color.Gray
                        )
                    }
                }

                // Micro metrics breakdown
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    MetricTextRow(
                        label = "Capacity",
                        value = "${report.estimatedCapacityMah} / ${report.designCapacityMah} mAh"
                    )
                    MetricTextRow(
                        label = "Cycles (EFC)",
                        value = "${report.cycleCountEquivalent} cycles"
                    )
                    MetricTextRow(
                        label = "Full Saturation",
                        value = "${report.totalTimeAtFullChargeHours} hrs @ 100%"
                    )
                    MetricTextRow(
                        label = "Peak Temp Ever",
                        value = "${report.peakEverTemperatureCelsius}°C",
                        isWarning = report.peakEverTemperatureCelsius >= 43.0f
                    )
                }
            }
        }
    }
}

@Composable
fun MetricTextRow(label: String, value: String, isWarning: Boolean = false) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(text = label, style = MaterialTheme.typography.bodySmall, color = Color.Gray)
        Text(
            text = value,
            style = MaterialTheme.typography.bodySmall.copy(
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                color = if (isWarning) Color(0xFFE63946) else Color.White
            )
        )
    }
}

@Composable
fun ActiveSessionCard(session: ChargingSession) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF0F261E))
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Icon(Icons.Default.Power, contentDescription = null, tint = Color(0xFF00DC82), modifier = Modifier.size(16.dp))
                    Text(
                        text = "Current Charging Session Active",
                        style = MaterialTheme.typography.titleSmall.copy(
                            color = Color(0xFF00DC82),
                            fontWeight = FontWeight.Bold
                        )
                    )
                }
                Text(
                    text = "${session.durationMinutes} min",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    color = Color(0xFF00DC82)
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "${session.startPercentage}% -> ${session.endPercentage}% (+${session.deltaPercentage}%)",
                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold)
                )
                Text(
                    text = "Peak: ${session.peakCurrentMa}mA | ${session.maxTemperatureCelsius}°C",
                    style = MaterialTheme.typography.bodySmall.copy(
                        fontFamily = FontFamily.Monospace,
                        color = Color.LightGray
                    )
                )
            }

            if (session.timeAtFullChargeMinutes > 0) {
                Text(
                    text = "High Voltage Saturation: ${session.timeAtFullChargeMinutes} min resting at 100%",
                    style = MaterialTheme.typography.labelSmall,
                    color = Color(0xFFFFB703)
                )
            }
        }
    }
}

@Composable
fun RecommendationsSection(
    recommendations: List<LongevityRecommendation>,
    onApply: (currentLimitMa: Int?, voltageLimitMv: Int?) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(Icons.Default.Lightbulb, contentDescription = null, tint = Color(0xFFFFB703), modifier = Modifier.size(18.dp))
            Text(
                text = "Longevity Recommendations",
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
            )
        }

        recommendations.forEach { rec ->
            RecommendationItemCard(rec = rec, onApply = onApply)
        }
    }
}

@Composable
fun RecommendationItemCard(
    rec: LongevityRecommendation,
    onApply: (currentLimitMa: Int?, voltageLimitMv: Int?) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f))
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = rec.title,
                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold)
                )
                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = when (rec.impact) {
                        RecommendationImpact.HIGH -> Color(0xFFE63946).copy(alpha = 0.2f)
                        RecommendationImpact.MEDIUM -> Color(0xFFFFB703).copy(alpha = 0.2f)
                        RecommendationImpact.PREVENTATIVE -> Color(0xFF00DC82).copy(alpha = 0.2f)
                    }
                ) {
                    Text(
                        text = rec.impact.label,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.Bold,
                            color = when (rec.impact) {
                                RecommendationImpact.HIGH -> Color(0xFFFF4D6D)
                                RecommendationImpact.MEDIUM -> Color(0xFFFFB703)
                                RecommendationImpact.PREVENTATIVE -> Color(0xFF00DC82)
                            }
                        )
                    )
                }
            }

            Text(
                text = rec.description,
                style = MaterialTheme.typography.bodySmall,
                color = Color.LightGray
            )

            if (rec.recommendedCurrentLimitMa != null || rec.recommendedVoltageLimitMv != null) {
                OutlinedButton(
                    onClick = { onApply(rec.recommendedCurrentLimitMa, rec.recommendedVoltageLimitMv) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Icon(Icons.Default.Bolt, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Apply Safe Setting (${rec.recommendedCurrentLimitMa ?: "keep"}mA / ${rec.recommendedVoltageLimitMv ?: "keep"}mV)",
                        style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold)
                    )
                }
            }
        }
    }
}

@Composable
fun SessionsHistorySection(sessions: List<ChargingSession>) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(Icons.Default.History, contentDescription = null, tint = Color.Gray, modifier = Modifier.size(18.dp))
            Text(
                text = "Recent Charging Sessions (${sessions.size})",
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
            )
        }

        if (sessions.isEmpty()) {
            Text(
                text = "No sessions recorded yet. Plug in your charger to start automatic logging.",
                style = MaterialTheme.typography.bodySmall,
                color = Color.Gray
            )
        } else {
            sessions.take(5).forEach { session ->
                SessionCardItem(session = session)
            }
        }
    }
}

@Composable
fun SessionCardItem(session: ChargingSession) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.25f))
    ) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = session.formattedStartTime,
                    style = MaterialTheme.typography.labelSmall,
                    color = Color.Gray,
                    fontFamily = FontFamily.Monospace
                )
                Text(
                    text = session.chargerProtocol,
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF00B4D8)
                    )
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "${session.startPercentage}% -> ${session.endPercentage}% (+${session.deltaPercentage}%)",
                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold)
                )
                Text(
                    text = "${session.durationMinutes} mins",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.LightGray
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "Peak: ${session.peakCurrentMa} mA",
                    style = MaterialTheme.typography.labelSmall,
                    color = Color.Gray,
                    fontFamily = FontFamily.Monospace
                )
                Text(
                    text = "Max Temp: ${session.maxTemperatureCelsius}°C",
                    style = MaterialTheme.typography.labelSmall.copy(
                        color = if (session.isOverheated) Color(0xFFE63946) else Color.Gray,
                        fontWeight = if (session.isOverheated) FontWeight.Bold else FontWeight.Normal
                    ),
                    fontFamily = FontFamily.Monospace
                )
            }

            if (session.timeAtFullChargeMinutes > 0) {
                Text(
                    text = "Saturated at 100%: ${session.timeAtFullChargeMinutes} min",
                    style = MaterialTheme.typography.labelSmall,
                    color = Color(0xFFFFB703),
                    fontSize = 10.sp
                )
            }
        }
    }
}
