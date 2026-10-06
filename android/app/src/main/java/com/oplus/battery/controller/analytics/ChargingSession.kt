package com.oplus.battery.controller.analytics

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Encapsulates a completed or active charging session log.
 */
data class ChargingSession(
    val id: String = java.util.UUID.randomUUID().toString(),
    val startTimeMs: Long,
    val endTimeMs: Long,
    val startPercentage: Int,
    val endPercentage: Int,
    val avgCurrentMa: Int,
    val peakCurrentMa: Int,
    val avgVoltageMv: Int,
    val peakVoltageMv: Int,
    val maxTemperatureCelsius: Float,
    val avgTemperatureCelsius: Float,
    val timeSpentAbove40CelsiusMinutes: Int,
    val timeSpentAbove43CelsiusMinutes: Int,
    val timeAtFullChargeMinutes: Int, // Minutes spent plugged in at >= 99% (saturation wear)
    val estimatedEnergyMah: Int,      // Coulomb-counted energy delivered
    val chargerProtocol: String       // "VOOC_FLASH", "USB_PD", "STANDARD"
) {
    val durationMinutes: Long
        get() = ((endTimeMs - startTimeMs) / (1000 * 60)).coerceAtLeast(1)

    val deltaPercentage: Int
        get() = (endPercentage - startPercentage).coerceAtLeast(0)

    val formattedStartTime: String
        get() {
            val sdf = SimpleDateFormat("MMM dd, HH:mm", Locale.getDefault())
            return sdf.format(Date(startTimeMs))
        }

    val isOverheated: Boolean
        get() = maxTemperatureCelsius >= 43.0f

    val isHighStressSession: Boolean
        get() = isOverheated || timeAtFullChargeMinutes > 30 || peakCurrentMa > 2500
}

/**
 * Actionable recommendation generated from real battery usage analytics.
 */
data class LongevityRecommendation(
    val id: String,
    val title: String,
    val description: String,
    val impact: RecommendationImpact,
    val recommendedCurrentLimitMa: Int? = null,
    val recommendedVoltageLimitMv: Int? = null
)

enum class RecommendationImpact(val label: String, val colorHex: String) {
    HIGH("High Impact", "#FF4D6D"),
    MEDIUM("Medium Impact", "#FFB703"),
    PREVENTATIVE("Preventative", "#00DC82")
}

/**
 * Comprehensive health report output.
 */
data class BatteryHealthReport(
    val healthPercentage: Float,               // e.g. 96.8%
    val estimatedCapacityMah: Int,            // e.g. 4840 mAh
    val designCapacityMah: Int = 5000,        // Standard Oppo 5000 mAh dual-cell
    val cycleCountEquivalent: Float,          // e.g. 84.2 cycles
    val totalSessionsLogged: Int,
    val totalTimeAtFullChargeHours: Float,     // Hours spent saturated at >= 99%
    val peakEverTemperatureCelsius: Float,
    val thermalStressIndex: Float,            // Normalized 0.0 - 1.0
    val recommendations: List<LongevityRecommendation>
)
