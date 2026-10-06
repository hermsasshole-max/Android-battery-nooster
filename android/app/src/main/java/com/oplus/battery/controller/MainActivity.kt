package com.oplus.battery.controller

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.ui.graphics.Color
import com.oplus.battery.controller.ui.MainScreen
import com.oplus.battery.controller.viewmodel.ChargingViewModel

class MainActivity : ComponentActivity() {

    private val viewModel: ChargingViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            // Material 3 Dark theme inspired by ColorOS 14 / Aquamorphic Design
            MaterialTheme(
                colorScheme = darkColorScheme(
                    primary = Color(0xFF00DC82),       // Oppo signature Emerald
                    onPrimary = Color(0xFF00391F),
                    secondary = Color(0xFF00B4D8),     // VOOC flash charge Cyan
                    onSecondary = Color(0xFF003544),
                    tertiary = Color(0xFFFFB703),      // Thermal warning Amber
                    surface = Color(0xFF0E1318),        // Deep Obsidian
                    onSurface = Color(0xFFE2E8F0),
                    surfaceVariant = Color(0xFF1E2630),
                    onSurfaceVariant = Color(0xFF94A3B8),
                    error = Color(0xFFE63946),
                    onError = Color.White
                )
            ) {
                MainScreen(viewModel = viewModel)
            }
        }
    }

    override fun onResume() {
        super.onResume()
        viewModel.checkPrivilegesAndStartDaemon()
    }
}
