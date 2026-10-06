package com.oplus.battery.controller.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.oplus.battery.controller.MainActivity
import com.oplus.battery.controller.analytics.BatteryHealthRepository
import com.oplus.battery.controller.executor.ShellExecutor
import com.oplus.battery.controller.manager.BatteryHardwareMetrics
import com.oplus.battery.controller.manager.ChargingManager
import com.oplus.battery.controller.manager.HardwareSafetyConstants
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * ChargingMonitorService: Persistent Foreground Watchdog Daemon.
 *
 * Runs on a 3-second tick loop on Dispatchers.IO to:
 * 1. Read real-time telemetry (voltage, current, temperature, charging state).
 * 2. Record detailed charging session logs & calculate battery health analytics.
 * 3. Neutralize Oppo/ColorOS VOOC fast-charge driver resets.
 * 4. Enforce immediate thermal cutoff if cell temperature breaches 43°C.
 */
class ChargingMonitorService : Service() {

    private val serviceScope = CoroutineScope(Dispatchers.IO + Job())
    private var monitorJob: Job? = null

    private lateinit var shellExecutor: ShellExecutor
    private lateinit var chargingManager: ChargingManager
    private lateinit var notificationManager: NotificationManager
    private lateinit var healthRepository: BatteryHealthRepository

    private var wasPluggedLastTick: Boolean = false

    companion object {
        const val CHANNEL_ID = "oplus_charging_guard_channel"
        const val NOTIFICATION_ID = 9001

        const val ACTION_START = "com.oplus.battery.controller.ACTION_START"
        const val ACTION_STOP = "com.oplus.battery.controller.ACTION_STOP"
        const val ACTION_EMERGENCY_STOP = "com.oplus.battery.controller.ACTION_EMERGENCY_STOP"

        const val EXTRA_TARGET_CURRENT_MA = "extra_target_current_ma"
        const val EXTRA_TARGET_VOLTAGE_MV = "extra_target_voltage_mv"

        private val _telemetryState = MutableStateFlow<BatteryHardwareMetrics?>(null)
        val telemetryState: StateFlow<BatteryHardwareMetrics?> = _telemetryState.asStateFlow()

        private val _isServiceRunning = MutableStateFlow(false)
        val isServiceRunning: StateFlow<Boolean> = _isServiceRunning.asStateFlow()

        fun startService(context: Context, targetCurrentMa: Int, targetVoltageMv: Int) {
            val intent = Intent(context, ChargingMonitorService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_TARGET_CURRENT_MA, targetCurrentMa)
                putExtra(EXTRA_TARGET_VOLTAGE_MV, targetVoltageMv)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stopService(context: Context) {
            val intent = Intent(context, ChargingMonitorService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }
    }

    private var targetCurrentMa: Int = HardwareSafetyConstants.DEFAULT_CURRENT_MA
    private var targetVoltageMv: Int = HardwareSafetyConstants.DEFAULT_VOLTAGE_MV
    private var isEmergencyStopped: Boolean = false

    override fun onCreate() {
        super.onCreate()
        notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        shellExecutor = ShellExecutor(applicationContext)
        chargingManager = ChargingManager(applicationContext, shellExecutor)
        healthRepository = BatteryHealthRepository.getInstance(applicationContext)

        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopMonitoring()
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_EMERGENCY_STOP -> {
                serviceScope.launch {
                    isEmergencyStopped = true
                    chargingManager.setChargingEnabled(false)
                    updateNotification("Emergency Cutoff Active", "Charging halted immediately")
                }
                return START_STICKY
            }
            ACTION_START, null -> {
                targetCurrentMa = intent?.getIntExtra(
                    EXTRA_TARGET_CURRENT_MA,
                    HardwareSafetyConstants.DEFAULT_CURRENT_MA
                ) ?: HardwareSafetyConstants.DEFAULT_CURRENT_MA

                targetVoltageMv = intent?.getIntExtra(
                    EXTRA_TARGET_VOLTAGE_MV,
                    HardwareSafetyConstants.DEFAULT_VOLTAGE_MV
                ) ?: HardwareSafetyConstants.DEFAULT_VOLTAGE_MV

                isEmergencyStopped = false
                startForegroundNotification()
                startMonitoring()
            }
        }
        return START_STICKY
    }

    private fun startForegroundNotification() {
        val notification = buildNotification(
            "ColorOS Charging Guard Active",
            "Target: ${targetCurrentMa}mA | ${targetVoltageMv}mV"
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun startMonitoring() {
        monitorJob?.cancel()
        _isServiceRunning.value = true

        monitorJob = serviceScope.launch {
            shellExecutor.resolveExecutionMode()
            chargingManager.probeHardwareNodes()

            chargingManager.applyCurrentLimit(targetCurrentMa)
            chargingManager.applyVoltageCutoff(targetVoltageMv)

            while (isActive) {
                try {
                    val metrics = chargingManager.readTelemetry()
                    _telemetryState.value = metrics

                    // Session transition logging for Battery Health Analytics
                    if (metrics.isPlugged && !wasPluggedLastTick) {
                        healthRepository.startSession(
                            initialPercentage = metrics.percentage,
                            initialTemp = metrics.temperatureCelsius,
                            protocol = if (metrics.currentMa > 2000) "VOOC_FLASH" else "STANDARD"
                        )
                    } else if (metrics.isPlugged && wasPluggedLastTick) {
                        healthRepository.recordTelemetrySample(
                            percentage = metrics.percentage,
                            currentMa = metrics.currentMa,
                            voltageMv = metrics.voltageMv,
                            tempCelsius = metrics.temperatureCelsius,
                            sampleIntervalSeconds = 3
                        )
                    } else if (!metrics.isPlugged && wasPluggedLastTick) {
                        healthRepository.endSession(finalPercentage = metrics.percentage)
                    }
                    wasPluggedLastTick = metrics.isPlugged

                    // Thermal Watchdog Check
                    if (metrics.temperatureCelsius >= HardwareSafetyConstants.THERMAL_THROTTLE_THRESHOLD_CELSIUS) {
                        chargingManager.enforceThermalProtection()
                        updateNotification(
                            "⚠️ Thermal Safeguard Triggered (${metrics.temperatureCelsius}°C)",
                            "Current throttled to 500mA to protect VOOC cell"
                        )
                    } else if (!isEmergencyStopped && metrics.isPlugged) {
                        // ColorOS VOOC kernel override counter-measure: reassert clamped limits
                        chargingManager.applyCurrentLimit(targetCurrentMa)
                        chargingManager.applyVoltageCutoff(targetVoltageMv)

                        updateNotification(
                            "VOOC Guard: ${metrics.currentMa}mA @ ${metrics.voltageMv}mV",
                            "Temp: ${metrics.temperatureCelsius}°C | Health Guard Active"
                        )
                    }
                } catch (e: Exception) {
                    // Safe guard
                }

                delay(3000L)
            }
        }
    }

    private fun stopMonitoring() {
        monitorJob?.cancel()
        monitorJob = null
        _isServiceRunning.value = false
    }

    private fun updateNotification(title: String, content: String) {
        val notification = buildNotification(title, content)
        notificationManager.notify(NOTIFICATION_ID, notification)
    }

    private fun buildNotification(title: String, content: String): Notification {
        val openAppIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val emergencyIntent = Intent(this, ChargingMonitorService::class.java).apply {
            action = ACTION_EMERGENCY_STOP
        }
        val emergencyPendingIntent = PendingIntent.getService(
            this,
            1,
            emergencyIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(content)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .addAction(
                android.R.drawable.ic_menu_close_clear_cancel,
                "Cut Charging",
                emergencyPendingIntent
            )
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "ColorOS VOOC Charging Protection Daemon",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Monitors battery temperature, enforces hardware clamps, and counters VOOC kernel overrides"
                setShowBadge(false)
            }
            notificationManager.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        stopMonitoring()
        serviceScope.cancel()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
