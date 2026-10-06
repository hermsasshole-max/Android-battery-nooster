package com.oplus.battery.controller.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.oplus.battery.controller.analytics.BatteryHealthReport
import com.oplus.battery.controller.analytics.BatteryHealthRepository
import com.oplus.battery.controller.analytics.ChargingSession
import com.oplus.battery.controller.executor.ExecutionMode
import com.oplus.battery.controller.executor.ShellExecutor
import com.oplus.battery.controller.manager.BatteryHardwareMetrics
import com.oplus.battery.controller.manager.ChargingManager
import com.oplus.battery.controller.manager.HardwareSafetyConstants
import com.oplus.battery.controller.service.ChargingMonitorService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class ChargingUiState(
    val executionMode: ExecutionMode = ExecutionMode.RESTRICTED,
    val metrics: BatteryHardwareMetrics? = null,
    val targetCurrentMa: Int = HardwareSafetyConstants.DEFAULT_CURRENT_MA,
    val targetVoltageMv: Int = HardwareSafetyConstants.DEFAULT_VOLTAGE_MV,
    val isServiceRunning: Boolean = false,
    val isEmergencyStopped: Boolean = false,
    val lastActionStatusMessage: String? = null
)

class ChargingViewModel(application: Application) : AndroidViewModel(application) {

    private val shellExecutor = ShellExecutor(application)
    private val chargingManager = ChargingManager(application, shellExecutor)
    private val healthRepository = BatteryHealthRepository.getInstance(application)

    private val _executionMode = MutableStateFlow(ExecutionMode.RESTRICTED)
    private val _targetCurrentMa = MutableStateFlow(HardwareSafetyConstants.DEFAULT_CURRENT_MA)
    private val _targetVoltageMv = MutableStateFlow(HardwareSafetyConstants.DEFAULT_VOLTAGE_MV)
    private val _isEmergencyStopped = MutableStateFlow(false)
    private val _statusMessage = MutableStateFlow<String?>("Hardware engine initialized")

    val uiState: StateFlow<ChargingUiState> = combine(
        _executionMode,
        ChargingMonitorService.telemetryState,
        _targetCurrentMa,
        _targetVoltageMv,
        ChargingMonitorService.isServiceRunning,
        _isEmergencyStopped,
        _statusMessage
    ) { mode, metrics, curMa, voltMv, running, emergency, msg ->
        ChargingUiState(
            executionMode = mode,
            metrics = metrics,
            targetCurrentMa = curMa,
            targetVoltageMv = voltMv,
            isServiceRunning = running,
            isEmergencyStopped = emergency,
            lastActionStatusMessage = msg
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = ChargingUiState()
    )

    // Battery Health Analytics Streams
    val chargingSessions: StateFlow<List<ChargingSession>> = healthRepository.sessions
    val activeSession: StateFlow<ChargingSession?> = healthRepository.activeSession
    val healthReport: StateFlow<BatteryHealthReport> = healthRepository.healthReport

    init {
        checkPrivilegesAndStartDaemon()
    }

    fun checkPrivilegesAndStartDaemon() {
        viewModelScope.launch {
            val mode = shellExecutor.resolveExecutionMode()
            _executionMode.value = mode
            chargingManager.probeHardwareNodes()

            ChargingMonitorService.startService(
                context = getApplication(),
                targetCurrentMa = _targetCurrentMa.value,
                targetVoltageMv = _targetVoltageMv.value
            )
        }
    }

    fun requestShizukuPermission() {
        shellExecutor.requestShizukuPermission()
    }

    fun applyLimits(targetCurrentMa: Int, targetVoltageMv: Int) {
        viewModelScope.launch {
            _targetCurrentMa.value = targetCurrentMa
            _targetVoltageMv.value = targetVoltageMv
            _isEmergencyStopped.value = false

            chargingManager.setChargingEnabled(true)
            chargingManager.applyCurrentLimit(targetCurrentMa)
            chargingManager.applyVoltageCutoff(targetVoltageMv)

            ChargingMonitorService.startService(
                context = getApplication(),
                targetCurrentMa = targetCurrentMa,
                targetVoltageMv = targetVoltageMv
            )

            _statusMessage.value = "Hardware limits enforced: ${targetCurrentMa}mA | ${targetVoltageMv}mV"
        }
    }

    fun applyRecommendation(currentLimitMa: Int?, voltageLimitMv: Int?) {
        val targetCur = currentLimitMa ?: _targetCurrentMa.value
        val targetVolt = voltageLimitMv ?: _targetVoltageMv.value
        applyLimits(targetCur, targetVolt)
    }

    fun resetToDefaults() {
        viewModelScope.launch {
            _targetCurrentMa.value = HardwareSafetyConstants.DEFAULT_CURRENT_MA
            _targetVoltageMv.value = HardwareSafetyConstants.DEFAULT_VOLTAGE_MV
            _isEmergencyStopped.value = false

            chargingManager.resetToDefaults()

            ChargingMonitorService.startService(
                context = getApplication(),
                targetCurrentMa = HardwareSafetyConstants.DEFAULT_CURRENT_MA,
                targetVoltageMv = HardwareSafetyConstants.DEFAULT_VOLTAGE_MV
            )

            _statusMessage.value = "Parameters reset to factory safe defaults"
        }
    }

    fun instantEmergencyCutoff() {
        viewModelScope.launch {
            _isEmergencyStopped.value = true
            chargingManager.setChargingEnabled(false)
            _statusMessage.value = "EMERGENCY: Battery charging switch opened (0)"
        }
    }
}
