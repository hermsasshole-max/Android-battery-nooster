package com.oplus.battery.controller

import android.app.Application
import com.topjohnwu.superuser.Shell

class ChargingApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Initialize LibSu global configuration
        Shell.enableVerboseLogging = false
        Shell.setDefaultBuilder(
            Shell.Builder.create()
                .setFlags(Shell.FLAG_MOUNT_MASTER)
                .setTimeout(10)
        )
    }
}
