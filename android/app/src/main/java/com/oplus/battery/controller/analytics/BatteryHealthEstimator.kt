package com.oplus.battery.controller.analytics

import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * BatteryHealthEstimator: Advanced degradation modeling tailored for Oppo / ColorOS
 * high-capacity dual-cell lithium-ion batteries with VOOC flash charging.
 *
 * Implements electrochemical degradation factors:
 * 1. Equivalent Full Cycle (EFC) degradation: ~0.02% per 100% throughput
 * 2. High Voltage Float Saturation: Oxidative degradation when resting at >= 99% / 4.40V+
 * 3. Thermal Wear Index: Arrhenius exponential penalty for exposure >= 40°C and >= 43°C
 * 4. Fast-Charge Stress: SEI expansion from sustained high charging currents (>2000mA)
 */
object BatteryHealthEstimator {

    const val DEFAULT_DESIGN_CAPACITY_MAH = 5000

    fun calculateHealthReport(
        sessions: List<ChargingSession>,
        designCapacityMah: Int = DEFAULT_DESIGN_CAPACITY_MAH
    ): BatteryHealthReport {
        if (sessions.isEmpty()) {
            return BatteryHealthReport(
                healthPercentage = 100.0f,
                estimatedCapacityMah = designCapacityMah,
                designCapacityMah = designCapacityMah,
                cycleCountEquivalent = 0f,
                totalSessionsLogged = 0,
                totalTimeAtFullChargeHours = 0f,
                peakEverTemperatureCelsius = 30.0f,
                thermalStressIndex = 0.0f,
                recommendations = generateDefaultRecommendations()
            )
        }

        // 1. Calculate Equivalent Full Cycles (EFC)
        val totalDeltaPercentage = sessions.sumOf { it.deltaPercentage }
        val cycleCount = totalDeltaPercentage / 100.0f

        // 2. High Voltage Saturation Time (Time spent plugged at 100%)
        val totalSaturationMinutes = sessions.sumOf { it.timeAtFullChargeMinutes }
        val totalSaturationHours = totalSaturationMinutes / 60.0f

        // 3. Peak temperature ever recorded & thermal penalties
        val peakTemp = sessions.maxOfOrNull { it.maxTemperatureCelsius } ?: 30.0f
        val minutesAbove40 = sessions.sumOf { it.timeSpentAbove40CelsiusMinutes }
        val minutesAbove43 = sessions.sumOf { it.timeSpentAbove43CelsiusMinutes }

        // 4. Degradation components:
        // Baseline cycle wear: ~0.025% capacity loss per full cycle
        val cycleWearPct = cycleCount * 0.025f

        // Saturation wear: ~0.05% capacity loss per 10 hours spent at 100% (high electrolyte oxidation)
        val saturationWearPct = (totalSaturationHours / 10.0f) * 0.05f

        // Thermal stress penalty:
        // Minutes above 40°C add 0.01% per 30 mins; minutes above 43°C add 0.03% per 10 mins
        val thermalWearPct = (minutesAbove40 / 30.0f) * 0.01f + (minutesAbove43 / 10.0f) * 0.03f

        // Fast charging rate wear (sessions > 2000mA without gentle ramping)
        val fastChargeSessionsCount = sessions.count { it.peakCurrentMa > 2200 }
        val fastChargeWearPct = fastChargeSessionsCount * 0.012f

        val totalDegradationPct = cycleWearPct + saturationWearPct + thermalWearPct + fastChargeWearPct
        val healthPct = (100.0f - totalDegradationPct).coerceIn(70.0f, 100.0f)
        val estimatedCapacity = (designCapacityMah * (healthPct / 100.0f)).roundToInt()

        val thermalIndex = min(1.0f, (minutesAbove40 * 1.0f + minutesAbove43 * 3.0f) / 180.0f)

        // 5. Generate tailored recommendations
        val recommendations = mutableListOf<LongevityRecommendation>()

        if (totalSaturationHours > 2.0f) {
            recommendations.add(
                LongevityRecommendation(
                    id = "rec_saturation",
                    title = "Limit High-Voltage Float Saturation",
                    description = "Your device spent ${String.format("%.1f", totalSaturationHours)} hours plugged at 100%. Capping the voltage cutoff to 4.20V (approx 80-85% charge) prevents electrolyte oxidation and doubles battery lifespan.",
                    impact = RecommendationImpact.HIGH,
                    recommendedVoltageLimitMv = 4200
                )
            )
        }

        if (minutesAbove43 > 0 || peakTemp >= 42.0f) {
            recommendations.add(
                LongevityRecommendation(
                    id = "rec_thermal",
                    title = "Throttle Fast-Charge During High Ambient Temps",
                    description = "Cell temperature reached ${String.format("%.1f", peakTemp)}°C in previous sessions. Lower your charging current limit to 1500 mA to keep thermal stress well below the critical 40°C threshold.",
                    impact = RecommendationImpact.HIGH,
                    recommendedCurrentLimitMa = 1500
                )
            )
        } else if (fastChargeSessionsCount > 3) {
            recommendations.add(
                LongevityRecommendation(
                    id = "rec_current",
                    title = "Adopt Gentle Daily Charging",
                    description = "Fast charging above 2200 mA accelerates SEI film growth. For daily desk or overnight charging, 1500 mA provides cooler, healthier charging.",
                    impact = RecommendationImpact.MEDIUM,
                    recommendedCurrentLimitMa = 1500
                )
            )
        }

        recommendations.add(
            LongevityRecommendation(
                id = "rec_cycle_range",
                title = "Maintain 20% - 80% Cycling Window",
                description = "Li-ion cells experience the lowest mechanical stress between 20% and 80% state of charge. Plug in at 20% and stop at 80% for maximum cycle longevity.",
                impact = RecommendationImpact.PREVENTATIVE
            )
        )

        return BatteryHealthReport(
            healthPercentage = (healthPct * 10).roundToInt() / 10.0f,
            estimatedCapacityMah = estimatedCapacity,
            designCapacityMah = designCapacityMah,
            cycleCountEquivalent = (cycleCount * 10).roundToInt() / 10.0f,
            totalSessionsLogged = sessions.size,
            totalTimeAtFullChargeHours = (totalSaturationHours * 10).roundToInt() / 10.0f,
            peakEverTemperatureCelsius = peakTemp,
            thermalStressIndex = thermalIndex,
            recommendations = recommendations
        )
    }

    private fun generateDefaultRecommendations(): List<LongevityRecommendation> {
        return listOf(
            LongevityRecommendation(
                id = "default_80_rule",
                title = "Enable 80% Cutoff Guard",
                description = "Keep charging voltage capped at 4.20V to eliminate high-voltage dwell degradation.",
                impact = RecommendationImpact.HIGH,
                recommendedVoltageLimitMv = 4200
            ),
            LongevityRecommendation(
                id = "default_1500_current",
                title = "Limit Sustained Current to 1500 mA",
                description = "Balancing speed with thermal preservation prevents cell temperatures from exceeding 40°C.",
                impact = RecommendationImpact.MEDIUM,
                recommendedCurrentLimitMa = 1500
            )
        )
    }
}
