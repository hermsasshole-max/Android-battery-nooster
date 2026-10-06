package com.oplus.battery.controller.analytics

import android.content.Context
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

/**
 * BatteryHealthRepository: Centralized manager for charging session logs and health calculations.
 * Thread-safe, executes on Dispatchers.IO.
 */
class BatteryHealthRepository private constructor(private val context: Context) {

    private val mutex = Mutex()
    private val scope = CoroutineScope(Dispatchers.IO)

    // Historical sessions
    private val _sessions = MutableStateFlow<List<ChargingSession>>(emptyList())
    val sessions: StateFlow<List<ChargingSession>> = _sessions.asStateFlow()

    // Currently active recording session (null if unplugged)
    private val _activeSession = MutableStateFlow<ChargingSession?>(null)
    val activeSession: StateFlow<ChargingSession?> = _activeSession.asStateFlow()

    // Calculated health analytics report
    private val _healthReport = MutableStateFlow(
        BatteryHealthEstimator.calculateHealthReport(emptyList())
    )
    val healthReport: StateFlow<BatteryHealthReport> = _healthReport.asStateFlow()

    // Accumulators for active session
    private var currentSamples = mutableListOf<Int>()
    private var voltageSamples = mutableListOf<Int>()
    private var tempSamples = mutableListOf<Float>()
    private var activeStartTimeMs: Long = 0L
    private var activeStartPct: Int = 0
    private var activeSecondsAbove40: Int = 0
    private var activeSecondsAbove43: Int = 0
    private var activeSecondsAtFullCharge: Int = 0
    private var accumulatedEnergyMah: Double = 0.0

    companion object {
        @Volatile
        private var INSTANCE: BatteryHealthRepository? = null

        fun getInstance(context: Context): BatteryHealthRepository {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: BatteryHealthRepository(context.applicationContext).also {
                    INSTANCE = it
                    it.loadInitialSampleData()
                }
            }
        }
    }

    /**
     * Seeds initial realistic data if no sessions exist, representing recent real-world Oppo usage.
     */
    private fun loadInitialSampleData() {
        scope.launch {
            val now = System.currentTimeMillis()
            val hour = 3600 * 1000L
            val day = 24 * hour

            val sampleSessions = listOf(
                ChargingSession(
                    startTimeMs = now - 3 * day,
                    endTimeMs = now - 3 * day + 45 * 60 * 1000L,
                    startPercentage = 18,
                    endPercentage = 85,
                    avgCurrentMa = 1850,
                    peakCurrentMa = 2600,
                    avgVoltageMv = 4150,
                    peakVoltageMv = 4320,
                    maxTemperatureCelsius = 38.2f,
                    avgTemperatureCelsius = 34.5f,
                    timeSpentAbove40CelsiusMinutes = 0,
                    timeSpentAbove43CelsiusMinutes = 0,
                    timeAtFullChargeMinutes = 0,
                    estimatedEnergyMah = 3350,
                    chargerProtocol = "VOOC_FLASH"
                ),
                ChargingSession(
                    startTimeMs = now - 2 * day,
                    endTimeMs = now - 2 * day + 7 * hour,
                    startPercentage = 25,
                    endPercentage = 100,
                    avgCurrentMa = 1200,
                    peakCurrentMa = 2100,
                    avgVoltageMv = 4280,
                    peakVoltageMv = 4420,
                    maxTemperatureCelsius = 41.5f,
                    avgTemperatureCelsius = 35.8f,
                    timeSpentAbove40CelsiusMinutes = 18,
                    timeSpentAbove43CelsiusMinutes = 0,
                    timeAtFullChargeMinutes = 320, // Overnight plugged at 100%
                    estimatedEnergyMah = 3750,
                    chargerProtocol = "STANDARD"
                ),
                ChargingSession(
                    startTimeMs = now - 1 * day,
                    endTimeMs = now - 1 * day + 35 * 60 * 1000L,
                    startPercentage = 15,
                    endPercentage = 78,
                    avgCurrentMa = 2400,
                    peakCurrentMa = 2950,
                    avgVoltageMv = 4180,
                    peakVoltageMv = 4380,
                    maxTemperatureCelsius = 43.6f, // Thermal event
                    avgTemperatureCelsius = 39.2f,
                    timeSpentAbove40CelsiusMinutes = 14,
                    timeSpentAbove43CelsiusMinutes = 4,
                    timeAtFullChargeMinutes = 0,
                    estimatedEnergyMah = 3150,
                    chargerProtocol = "VOOC_FLASH"
                )
            )

            mutex.withLock {
                _sessions.value = sampleSessions
                _healthReport.value = BatteryHealthEstimator.calculateHealthReport(sampleSessions)
            }
        }
    }

    /**
     * Triggered when charger is plugged in.
     */
    suspend fun startSession(initialPercentage: Int, initialTemp: Float, protocol: String = "VOOC_FLASH") = withContext(Dispatchers.IO) {
        mutex.withLock {
            activeStartTimeMs = System.currentTimeMillis()
            activeStartPct = initialPercentage
            currentSamples.clear()
            voltageSamples.clear()
            tempSamples.clear()
            activeSecondsAbove40 = 0
            activeSecondsAbove43 = 0
            activeSecondsAtFullCharge = 0
            accumulatedEnergyMah = 0.0

            val session = ChargingSession(
                startTimeMs = activeStartTimeMs,
                endTimeMs = activeStartTimeMs,
                startPercentage = initialPercentage,
                endPercentage = initialPercentage,
                avgCurrentMa = 0,
                peakCurrentMa = 0,
                avgVoltageMv = 0,
                peakVoltageMv = 0,
                maxTemperatureCelsius = initialTemp,
                avgTemperatureCelsius = initialTemp,
                timeSpentAbove40CelsiusMinutes = 0,
                timeSpentAbove43CelsiusMinutes = 0,
                timeAtFullChargeMinutes = 0,
                estimatedEnergyMah = 0,
                chargerProtocol = protocol
            )
            _activeSession.value = session
        }
    }

    /**
     * Invoked every 3-second cycle by ChargingMonitorService while charging.
     */
    suspend fun recordTelemetrySample(
        percentage: Int,
        currentMa: Int,
        voltageMv: Int,
        tempCelsius: Float,
        sampleIntervalSeconds: Int = 3
    ) = withContext(Dispatchers.IO) {
        mutex.withLock {
            if (_activeSession.value == null) return@withContext

            currentSamples.add(currentMa)
            voltageSamples.add(voltageMv)
            tempSamples.add(tempCelsius)

            if (tempCelsius >= 43.0f) {
                activeSecondsAbove43 += sampleIntervalSeconds
            }
            if (tempCelsius >= 40.0f) {
                activeSecondsAbove40 += sampleIntervalSeconds
            }
            if (percentage >= 99) {
                activeSecondsAtFullCharge += sampleIntervalSeconds
            }

            // Energy integration: mA * (seconds / 3600) = mAh
            accumulatedEnergyMah += (currentMa.toDouble() * (sampleIntervalSeconds.toDouble() / 3600.0))

            val avgCur = if (currentSamples.isNotEmpty()) currentSamples.average().toInt() else currentMa
            val peakCur = currentSamples.maxOrNull() ?: currentMa
            val avgVolt = if (voltageSamples.isNotEmpty()) voltageSamples.average().toInt() else voltageMv
            val peakVolt = voltageSamples.maxOrNull() ?: voltageMv
            val maxT = tempSamples.maxOrNull() ?: tempCelsius
            val avgT = if (tempSamples.isNotEmpty()) tempSamples.average().toFloat() else tempCelsius

            val updated = _activeSession.value?.copy(
                endTimeMs = System.currentTimeMillis(),
                endPercentage = percentage,
                avgCurrentMa = avgCur,
                peakCurrentMa = peakCur,
                avgVoltageMv = avgVolt,
                peakVoltageMv = peakVolt,
                maxTemperatureCelsius = maxT,
                avgTemperatureCelsius = avgT,
                timeSpentAbove40CelsiusMinutes = activeSecondsAbove40 / 60,
                timeSpentAbove43CelsiusMinutes = activeSecondsAbove43 / 60,
                timeAtFullChargeMinutes = activeSecondsAtFullCharge / 60,
                estimatedEnergyMah = accumulatedEnergyMah.toInt()
            )
            _activeSession.value = updated
        }
    }

    /**
     * Triggered when charger is disconnected.
     */
    suspend fun endSession(finalPercentage: Int) = withContext(Dispatchers.IO) {
        mutex.withLock {
            val sessionToFinalize = _activeSession.value ?: return@withContext
            val finalizedSession = sessionToFinalize.copy(
                endTimeMs = System.currentTimeMillis(),
                endPercentage = finalPercentage
            )

            val updatedList = listOf(finalizedSession) + _sessions.value
            _sessions.value = updatedList
            _activeSession.value = null
            _healthReport.value = BatteryHealthEstimator.calculateHealthReport(updatedList)
        }
    }
}
