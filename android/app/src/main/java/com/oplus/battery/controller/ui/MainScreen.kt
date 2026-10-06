package com.oplus.battery.controller.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.PowerOff
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Thermostat
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.oplus.battery.controller.executor.ExecutionMode
import com.oplus.battery.controller.manager.BatteryHardwareMetrics
import com.oplus.battery.controller.manager.HardwareSafetyConstants
import com.oplus.battery.controller.viewmodel.ChargingUiState
import com.oplus.battery.controller.viewmodel.ChargingViewModel
import kotlin.math.roundToInt

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(viewModel: ChargingViewModel) {
    val uiState by viewModel.uiState.collectAsState()
    val metrics = uiState.metrics

    var selectedTabIndex by remember { mutableIntStateOf(0) }

    // Local slider states bounded to hardware safety limits
    var currentSliderValue by remember(uiState.targetCurrentMa) {
        mutableFloatStateOf(uiState.targetCurrentMa.toFloat())
    }
    var voltageSliderValue by remember(uiState.targetVoltageMv) {
        mutableFloatStateOf(uiState.targetVoltageMv.toFloat())
    }

    val isOverheated = (metrics?.temperatureCelsius ?: 0f) >= HardwareSafetyConstants.THERMAL_THROTTLE_THRESHOLD_CELSIUS

    Scaffold(
        topBar = {
            Column {
                TopAppBar(
                    title = {
                        Column {
                            Text(
                                text = "VOOC Charge Architect",
                                style = MaterialTheme.typography.titleLarge.copy(
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = (-0.5).sp
                                )
                            )
                            Text(
                                text = "ColorOS Hardware Kernel Subsystem",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    },
                    actions = {
                        IconButtonWithBadge(
                            mode = uiState.executionMode,
                            onRequestShizuku = { viewModel.requestShizukuPermission() }
                        )
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.surface
                    )
                )

                TabRow(
                    selectedTabIndex = selectedTabIndex,
                    containerColor = MaterialTheme.colorScheme.surface,
                    contentColor = Color(0xFF00DC82),
                    indicator = { tabPositions ->
                        TabRowDefaults.SecondaryIndicator(
                            Modifier.tabIndicatorOffset(tabPositions[selectedTabIndex]),
                            color = Color(0xFF00DC82)
                        )
                    }
                ) {
                    Tab(
                        selected = selectedTabIndex == 0,
                        onClick = { selectedTabIndex = 0 },
                        text = { Text("Hardware Control", fontWeight = FontWeight.Bold, fontSize = 12.sp) }
                    )
                    Tab(
                        selected = selectedTabIndex == 1,
                        onClick = { selectedTabIndex = 1 },
                        text = { Text("Battery Health", fontWeight = FontWeight.Bold, fontSize = 12.sp) }
                    )
                }
            }
        }
    ) { innerPadding ->
        if (selectedTabIndex == 1) {
            Box(modifier = Modifier.padding(innerPadding)) {
                HealthAnalyticsScreen(
                    viewModel = viewModel,
                    onApplyRecommendation = { cur, volt ->
                        viewModel.applyRecommendation(cur, volt)
                        selectedTabIndex = 0
                    }
                )
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
            // 1. Privilege Level Status Badge
            PrivilegeStatusBanner(
                mode = uiState.executionMode,
                onRequestShizuku = { viewModel.requestShizukuPermission() }
            )

            // 2. Real-Time Telemetry Gauges (Battery %, Voltage, Current, Temperature)
            TelemetryGaugesSection(metrics = metrics, isOverheated = isOverheated)

            // 3. Thermal Throttling Alert Banner (if >= 43°C)
            AnimatedVisibility(visible = isOverheated) {
                ThermalSafeguardCard(tempCelsius = metrics?.temperatureCelsius ?: 0f)
            }

            // 4. Dual Material 3 Safety Sliders
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f))
            ) {
                Column(
                    modifier = Modifier.padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = "Hardware Invariant Controls",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold)
                    )

                    // Current Slider (500mA - 3000mA, Step 100mA)
                    Column {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Current Limit (mA)",
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Medium
                            )
                            Text(
                                text = "${currentSliderValue.roundToInt()} mA",
                                style = MaterialTheme.typography.titleMedium.copy(
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF00DC82) // Oppo Emerald
                                )
                            )
                        }
                        Slider(
                            value = currentSliderValue,
                            onValueChange = { rawVal ->
                                val step = HardwareSafetyConstants.STEP_CURRENT_MA
                                val stepped = ((rawVal / step).roundToInt() * step).toFloat()
                                currentSliderValue = stepped.coerceIn(
                                    HardwareSafetyConstants.MIN_CURRENT_MA.toFloat(),
                                    HardwareSafetyConstants.MAX_CURRENT_MA.toFloat()
                                )
                            },
                            valueRange = HardwareSafetyConstants.MIN_CURRENT_MA.toFloat()..HardwareSafetyConstants.MAX_CURRENT_MA.toFloat(),
                            steps = ((HardwareSafetyConstants.MAX_CURRENT_MA - HardwareSafetyConstants.MIN_CURRENT_MA) / HardwareSafetyConstants.STEP_CURRENT_MA) - 1,
                            colors = SliderDefaults.colors(
                                thumbColor = Color(0xFF00DC82),
                                activeTrackColor = Color(0xFF00DC82)
                            )
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Min: 500 mA", style = MaterialTheme.typography.labelSmall, color = Color.Gray)
                            Text("Capped: 3000 mA (VOOC Guard)", style = MaterialTheme.typography.labelSmall, color = Color.Gray)
                        }
                    }

                    // Voltage Slider (4000mV - 4450mV, Step 50mV)
                    Column {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Cutoff Voltage (mV)",
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Medium
                            )
                            val voltageVolts = String.format("%.2f", voltageSliderValue / 1000f)
                            Text(
                                text = "${voltageSliderValue.roundToInt()} mV ($voltageVolts V)",
                                style = MaterialTheme.typography.titleMedium.copy(
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF00B4D8) // Cyan
                                )
                            )
                        }
                        Slider(
                            value = voltageSliderValue,
                            onValueChange = { rawVal ->
                                val step = HardwareSafetyConstants.STEP_VOLTAGE_MV
                                val stepped = ((rawVal / step).roundToInt() * step).toFloat()
                                voltageSliderValue = stepped.coerceIn(
                                    HardwareSafetyConstants.MIN_VOLTAGE_MV.toFloat(),
                                    HardwareSafetyConstants.MAX_VOLTAGE_MV.toFloat()
                                )
                            },
                            valueRange = HardwareSafetyConstants.MIN_VOLTAGE_MV.toFloat()..HardwareSafetyConstants.MAX_VOLTAGE_MV.toFloat(),
                            steps = ((HardwareSafetyConstants.MAX_VOLTAGE_MV - HardwareSafetyConstants.MIN_VOLTAGE_MV) / HardwareSafetyConstants.STEP_VOLTAGE_MV) - 1,
                            colors = SliderDefaults.colors(
                                thumbColor = Color(0xFF00B4D8),
                                activeTrackColor = Color(0xFF00B4D8)
                            )
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Min: 4.00 V (4000 mV)", style = MaterialTheme.typography.labelSmall, color = Color.Gray)
                            Text("Max Safe: 4.45 V (4450 mV)", style = MaterialTheme.typography.labelSmall, color = Color.Gray)
                        }
                    }
                }
            }

            // 5. Hardware Action Buttons
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                // Apply Limits Button
                Button(
                    onClick = {
                        viewModel.applyLimits(
                            targetCurrentMa = currentSliderValue.roundToInt(),
                            targetVoltageMv = voltageSliderValue.roundToInt()
                        )
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF00DC82),
                        contentColor = Color.Black
                    )
                ) {
                    Icon(Icons.Default.Bolt, contentDescription = null, modifier = Modifier.size(20.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Apply Hardware Limits",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    // Reset to Default
                    OutlinedButton(
                        onClick = {
                            currentSliderValue = HardwareSafetyConstants.DEFAULT_CURRENT_MA.toFloat()
                            voltageSliderValue = HardwareSafetyConstants.DEFAULT_VOLTAGE_MV.toFloat()
                            viewModel.resetToDefaults()
                        },
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Reset Default")
                    }

                    // Instant Stop Charging Button
                    Button(
                        onClick = { viewModel.instantEmergencyCutoff() },
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFFE63946),
                            contentColor = Color.White
                        )
                    ) {
                        Icon(Icons.Default.PowerOff, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Stop Charging", fontWeight = FontWeight.Bold)
                    }
                }
            }

            // 6. Active Sysfs Nodes Inspector Card
            SysfsInspectionCard(metrics = metrics)
        }
    }
}
}

@Composable
fun PrivilegeStatusBanner(mode: ExecutionMode, onRequestShizuku: () -> Unit) {
    val (bg, fg, label) = when (mode) {
        ExecutionMode.ROOT -> Triple(Color(0xFF0F382A), Color(0xFF00DC82), "Mode: Root Kernel Control (Direct Sysfs RW)")
        ExecutionMode.SHIZUKU_SYSFS -> Triple(Color(0xFF0E3344), Color(0xFF00B4D8), "Mode: Shizuku Privileged Shell")
        ExecutionMode.SHIZUKU_ADB_FALLBACK -> Triple(Color(0xFF38290E), Color(0xFFFFB703), "Mode: Shizuku / ADB Emulation (SELinux Enforcing)")
        ExecutionMode.RESTRICTED -> Triple(Color(0xFF3D161A), Color(0xFFFF4D6D), "Mode: Restricted / Read-Only (Unprivileged)")
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = bg)
    ) {
        Row(
            modifier = Modifier
                .padding(14.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                Icon(Icons.Default.Security, contentDescription = null, tint = fg, modifier = Modifier.size(24.dp))
                Spacer(modifier = Modifier.width(10.dp))
                Column {
                    Text(
                        text = label,
                        color = fg,
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Text(
                        text = when (mode) {
                            ExecutionMode.ROOT -> "LibSu persistent su master shell active"
                            ExecutionMode.SHIZUKU_SYSFS -> "Rikka Shizuku IPC binder session connected"
                            ExecutionMode.SHIZUKU_ADB_FALLBACK -> "Fallback active: dumpsys battery emulation enabled"
                            ExecutionMode.RESTRICTED -> "Grant Root or bind Shizuku for sysfs writes"
                        },
                        color = fg.copy(alpha = 0.8f),
                        style = MaterialTheme.typography.labelSmall
                    )
                }
            }
            if (mode == ExecutionMode.RESTRICTED) {
                Button(
                    onClick = onRequestShizuku,
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = fg, contentColor = Color.Black)
                ) {
                    Text("Bind", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
fun TelemetryGaugesSection(metrics: BatteryHardwareMetrics?, isOverheated: Boolean) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Battery Percentage Hero Card
        Card(
            modifier = Modifier
                .weight(1f)
                .height(136.dp),
            shape = RoundedCornerShape(18.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
        ) {
            Box(modifier = Modifier.fillMaxSize().padding(14.dp), contentAlignment = Alignment.Center) {
                val pct = metrics?.percentage ?: 0
                val animatedPct by animateFloatAsState(targetValue = pct / 100f, animationSpec = tween(600), label = "pct")
                CircularProgressIndicator(
                    progress = { animatedPct },
                    modifier = Modifier.size(80.dp),
                    strokeWidth = 7.dp,
                    color = if (isOverheated) Color(0xFFE63946) else Color(0xFF00DC82),
                    trackColor = Color.DarkGray.copy(alpha = 0.3f)
                )
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "$pct%",
                        style = MaterialTheme.typography.headlineMedium.copy(
                            fontWeight = FontWeight.ExtraBold,
                            fontFamily = FontFamily.Monospace
                        )
                    )
                    Text(
                        text = if (metrics?.isCharging == true) "Charging" else "Discharging",
                        style = MaterialTheme.typography.labelSmall,
                        color = if (metrics?.isCharging == true) Color(0xFF00DC82) else Color.Gray
                    )
                }
            }
        }

        // Live Metric Mini Cards Column
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Voltage Card
            MetricMiniCard(
                icon = Icons.Default.Bolt,
                title = "Live Voltage",
                value = "${metrics?.voltageMv ?: 0} mV",
                color = Color(0xFF00B4D8)
            )

            // Current Card
            MetricMiniCard(
                icon = Icons.Default.Bolt,
                title = "Live Current",
                value = "${metrics?.currentMa ?: 0} mA",
                color = Color(0xFF00DC82)
            )

            // Temperature Card with Warning
            MetricMiniCard(
                icon = Icons.Default.Thermostat,
                title = "Cell Temp",
                value = "${metrics?.temperatureCelsius ?: 0f}°C",
                color = if (isOverheated) Color(0xFFE63946) else Color(0xFFFFB703),
                warning = isOverheated
            )
        }
    }
}

@Composable
fun MetricMiniCard(icon: ImageVector, title: String, value: String, color: Color, warning: Boolean = false) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 7.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text(title, style = MaterialTheme.typography.labelSmall, color = Color.Gray)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (warning) {
                    Icon(Icons.Default.Warning, contentDescription = null, tint = Color(0xFFE63946), modifier = Modifier.size(14.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                }
                Text(
                    text = value,
                    style = MaterialTheme.typography.labelMedium.copy(
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold,
                        color = color
                    )
                )
            }
        }
    }
}

@Composable
fun ThermalSafeguardCard(tempCelsius: Float) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF4A1016))
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(Icons.Default.Warning, contentDescription = null, tint = Color(0xFFFF4D6D), modifier = Modifier.size(28.dp))
            Spacer(modifier = Modifier.width(12.dp))
            Column {
                Text(
                    text = "CRITICAL THERMAL THROTTLING ($tempCelsius°C)",
                    color = Color(0xFFFF4D6D),
                    fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.bodyMedium
                )
                Text(
                    text = "Temperature >= 43°C breached! Foreground daemon automatically throttled current to 500mA to avoid VOOC cell degradation.",
                    color = Color(0xFFFFCCD5),
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    }
}

@Composable
fun SysfsInspectionCard(metrics: BatteryHardwareMetrics?) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f))
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Info, contentDescription = null, modifier = Modifier.size(16.dp), tint = Color.Gray)
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = "Active ColorOS Sysfs Hardware Nodes",
                    style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold)
                )
            }
            Text(
                text = "Current Node: ${metrics?.activeCurrentNode ?: "/sys/class/power_supply/battery/current_max"}",
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp,
                color = Color.LightGray
            )
            Text(
                text = "Voltage Node: ${metrics?.activeVoltageNode ?: "/sys/class/power_supply/battery/voltage_max"}",
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp,
                color = Color.LightGray
            )
            Text(
                text = "Switch Node:  ${metrics?.activeSwitchNode ?: "/sys/class/power_supply/battery/charging_enabled"}",
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp,
                color = Color.LightGray
            )
        }
    }
}

@Composable
fun IconButtonWithBadge(mode: ExecutionMode, onRequestShizuku: () -> Unit) {
    val tint = when (mode) {
        ExecutionMode.ROOT -> Color(0xFF00DC82)
        ExecutionMode.SHIZUKU_SYSFS -> Color(0xFF00B4D8)
        ExecutionMode.SHIZUKU_ADB_FALLBACK -> Color(0xFFFFB703)
        ExecutionMode.RESTRICTED -> Color(0xFFFF4D6D)
    }
    Box(
        modifier = Modifier
            .padding(end = 12.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(tint.copy(alpha = 0.15f))
            .border(1.dp, tint.copy(alpha = 0.4f), RoundedCornerShape(8.dp))
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Text(
            text = mode.name,
            color = tint,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace
        )
    }
}
