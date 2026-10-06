package com.oplus.battery.controller.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.oplus.battery.controller.manager.HardwareSafetyConstants
import com.oplus.battery.controller.service.ChargingMonitorService

/**
 * Ensures the hardware charging guard persists across device reboots.
 */
class BootCompletedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == "android.intent.action.QUICKBOOT_POWERON"
        ) {
            ChargingMonitorService.startService(
                context = context,
                targetCurrentMa = HardwareSafetyConstants.DEFAULT_CURRENT_MA,
                targetVoltageMv = HardwareSafetyConstants.DEFAULT_VOLTAGE_MV
            )
        }
    }
}
