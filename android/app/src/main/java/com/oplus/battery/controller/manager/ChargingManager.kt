package com.oplus.battery.controller.manager

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import com.oplus.battery.controller.executor.ExecutionMode
import com.oplus.battery.controller.executor.ShellExecutor
import com.oplus.battery.controller.executor.ShellResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import kotlin.math.roundToInt

/**
 * Real-time hardware telemetry snapshot from Oppo/ColorOS battery subsystem.
 */
data class BatteryHardwareMetrics(
    val percentage: Int,
    val voltageMv: Int,
    val currentMa: Int,
    val temperatureCelsius: Float,
    val isCharging: Boolean,
    val isPlugged: Boolean,
    val isThrottled: Boolean,
    val activeCurrentNode: String?,
    val activeVoltageNode: String?,
    val activeSwitchNode: String?,
    val executionMode: ExecutionMode
)

/**
 * Hardware boundaries and constants to prevent cell damage on high-capacity VOOC cells.
 */
object HardwareSafetyConstants {
    const val MIN_CURRENT_MA = 500
    const val MAX_CURRENT_MA = 3000 // Capped strictly to protect 45W/65W VOOC thermal boundaries
    const val STEP_CURRENT_MA = 100
    const val DEFAULT_CURRENT_MA = 1500

    const val MIN_VOLTAGE_MV = 4000
    const val MAX_VOLTAGE_MV = 4450 // Standard Li-ion / Li-Po maximum safe threshold
    const val STEP_VOLTAGE_MV = 50
    const val DEFAULT_VOLTAGE_MV = 4200

    const val THERMAL_THROTTLE_THRESHOLD_CELSIUS = 43.0f
    const val THERMAL_THROTTLE_CURRENT_MA = 500
}

/**
 * ChargingManager: Hardware Abstraction Layer for Oppo / ColorOS battery controllers.
 * Handles sysfs node resolution, hardware clamping, thermal throttling, and telemetry reads.
 */
class ChargingManager(
    private val context: Context,
    private val shellExecutor: ShellExecutor
) {

    // Sysfs candidate nodes ordered by preference for Oppo/ColorOS hardware
    private val currentControlCandidates = listOf(
        "/sys/class/power_supply/battery/current_max",
        "/sys/class/power_supply/battery/constant_charge_current_max",
        "/sys/class/oplus_chg/battery/call_mode"
    )

    private val voltageCutoffCandidates = listOf(
        "/sys/class/power_supply/battery/voltage_max",
        "/sys/class/power_supply/battery/voltage_max_design"
    )

    private val chargingSwitchCandidates = listOf(
        "/sys/class/power_supply/battery/charging_enabled",
        "/sys/class/oplus_chg/battery/mmi_charging_enabled"
    )

    // Cached active nodes after system discovery
    private var activeCurrentNode: String? = null
    private var activeVoltageNode: String? = null
    private var activeSwitchNode: String? = null

    /**
     * Discovers active sysfs hardware nodes on the device.
     * Executes on Dispatchers.IO.
     */
    suspend fun probeHardwareNodes(): Unit = withContext(Dispatchers.IO) {
        activeCurrentNode = findFirstAccessibleNode(currentControlCandidates)
        activeVoltageNode = findFirstAccessibleNode(voltageCutoffCandidates)
        activeSwitchNode = findFirstAccessibleNode(chargingSwitchCandidates)
    }

    private suspend fun findFirstAccessibleNode(candidates: List<String>): String? {
        for (path in candidates) {
            val exists = try {
                File(path).exists() || shellExecutor.readSysfs(path) != null
            } catch (e: Exception) {
                shellExecutor.readSysfs(path) != null
            }
            if (exists) return path
        }
        return candidates.firstOrNull() // Default to primary candidate if blind write is needed
    }

    /**
     * Reads real-time hardware telemetry combining sysfs with Android BatteryManager.
     * Guaranteed to execute on Dispatchers.IO.
     */
    suspend fun readTelemetry(): BatteryHardwareMetrics = withContext(Dispatchers.IO) {
        val batteryStatusIntent = context.registerReceiver(
            null,
            IntentFilter(Intent.ACTION_BATTERY_CHANGED)
        )

        val level = batteryStatusIntent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: 0
        val scale = batteryStatusIntent?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: 100
        val percentage = if (level >= 0 && scale > 0) ((level.toFloat() / scale) * 100).roundToInt() else 0

        // Android reports temperature in tenths of a degree Celsius (e.g. 382 = 38.2°C)
        val rawTemp = batteryStatusIntent?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0) ?: 0
        val tempCelsius = rawTemp / 10.0f

        val rawVoltage = batteryStatusIntent?.getIntExtra(BatteryManager.EXTRA_VOLTAGE, 0) ?: 0
        val voltageMv = if (rawVoltage > 10000) rawVoltage / 1000 else rawVoltage

        // Read real-time microamperes from sysfs or BatteryManager
        val sysfsCurrent = activeCurrentNode?.let { node ->
            shellExecutor.readSysfs(node)?.toIntOrNull()
        }

        val batteryManager = context.getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
        val bmCurrentMicroAmps = batteryManager?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CURRENT_NOW) ?: 0
        val currentMa = when {
            sysfsCurrent != null && sysfsCurrent > 10000 -> sysfsCurrent / 1000
            sysfsCurrent != null -> sysfsCurrent
            bmCurrentMicroAmps != 0 -> kotlin.math.abs(bmCurrentMicroAmps) / 1000
            else -> 0
        }

        val status = batteryStatusIntent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        val isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
                status == BatteryManager.BATTERY_STATUS_FULL
        val plugged = batteryStatusIntent?.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) ?: 0
        val isPlugged = plugged != 0

        val isThrottled = tempCelsius >= HardwareSafetyConstants.THERMAL_THROTTLE_THRESHOLD_CELSIUS

        BatteryHardwareMetrics(
            percentage = percentage,
            voltageMv = voltageMv,
            currentMa = currentMa,
            temperatureCelsius = tempCelsius,
            isCharging = isCharging,
            isPlugged = isPlugged,
            isThrottled = isThrottled,
            activeCurrentNode = activeCurrentNode,
            activeVoltageNode = activeVoltageNode,
            activeSwitchNode = activeSwitchNode,
            executionMode = shellExecutor.getCurrentMode()
        )
    }

    /**
     * Sets charging current limit with strict hardware clamping.
     * Converts mA to microamperes (uA) as expected by Linux power_supply sysfs drivers.
     */
    suspend fun applyCurrentLimit(requestedMa: Int): ShellResult = withContext(Dispatchers.IO) {
        // Enforce strict hardware clamping
        val clampedMa = requestedMa.coerceIn(
            HardwareSafetyConstants.MIN_CURRENT_MA,
            HardwareSafetyConstants.MAX_CURRENT_MA
        )
        val valueUa = clampedMa * 1000

        val node = activeCurrentNode ?: currentControlCandidates.first()
        shellExecutor.writeSysfs(node, valueUa.toString())
    }

    /**
     * Sets voltage cutoff limit with strict hardware clamping.
     * Converts mV to microvolts (uV) as expected by Linux power_supply sysfs drivers.
     */
    suspend fun applyVoltageCutoff(requestedMv: Int): ShellResult = withContext(Dispatchers.IO) {
        // Enforce strict hardware clamping
        val clampedMv = requestedMv.coerceIn(
            HardwareSafetyConstants.MIN_VOLTAGE_MV,
            HardwareSafetyConstants.MAX_VOLTAGE_MV
        )
        val valueUv = clampedMv * 1000

        val node = activeVoltageNode ?: voltageCutoffCandidates.first()
        shellExecutor.writeSysfs(node, valueUv.toString())
    }

    /**
     * Instant toggle of the physical or emulated charging switch.
     * @param enabled true enables charging (1), false instantly isolates the battery circuit (0).
     */
    suspend fun setChargingEnabled(enabled: Boolean): ShellResult = withContext(Dispatchers.IO) {
        val node = activeSwitchNode ?: chargingSwitchCandidates.first()
        val payload = if (enabled) "1" else "0"
        shellExecutor.writeSysfs(node, payload)
    }

    /**
     * Thermal safety guard: automatically triggered when temperature >= 43°C.
     */
    suspend fun enforceThermalProtection(): ShellResult = withContext(Dispatchers.IO) {
        // Immediately drop current to 500mA baseline and disable charging switch if needed
        applyCurrentLimit(HardwareSafetyConstants.THERMAL_THROTTLE_CURRENT_MA)
        setChargingEnabled(false)
    }

    /**
     * Resets hardware registers to factory default profiles.
     */
    suspend fun resetToDefaults(): List<ShellResult> = withContext(Dispatchers.IO) {
        val results = mutableListOf<ShellResult>()
        results.add(setChargingEnabled(true))
        results.add(applyCurrentLimit(HardwareSafetyConstants.DEFAULT_CURRENT_MA))
        results.add(applyVoltageCutoff(HardwareSafetyConstants.DEFAULT_VOLTAGE_MV))
        results
    }

    fun getActiveCurrentNode(): String? = activeCurrentNode
    fun getActiveVoltageNode(): String? = activeVoltageNode
    fun getActiveSwitchNode(): String? = activeSwitchNode
}
