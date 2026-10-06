import { AndroidSourceFile } from '../types/charging';

export const ANDROID_SOURCE_FILES: AndroidSourceFile[] = [
  {
    id: 'github_action',
    filename: 'build-debug-apk.yml',
    path: '.github/workflows/build-debug-apk.yml',
    language: 'yaml',
    category: 'CI/CD Workflow',
    description: 'GitHub Actions workflow to automatically assemble and publish debug APK artifact on push/pull request',
    content: `name: Build Android Debug APK

on:
  push:
    branches: [ "main", "master" ]
  pull_request:
    branches: [ "main", "master" ]
  workflow_dispatch:

concurrency:
  group: \${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    name: Assemble Debug APK
    runs-on: ubuntu-latest
    timeout-minutes: 25

    env:
      ANDROID_HOME: /usr/local/lib/android/sdk
      ANDROID_SDK_ROOT: /usr/local/lib/android/sdk

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Set up Java Development Kit (JDK 17)
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      # NOTE: Do NOT use 'android-actions/setup-android@v3' here.
      # That action calls 'sdkmanager tools', but Google deprecated and deleted the legacy 'tools' package,
      # which causes: "Warning: Failed to find package 'tools' ... sdkmanager failed with exit code 1".
      # GitHub's ubuntu-latest runners already have the full Android SDK installed at /usr/local/lib/android/sdk.
      - name: Configure Android SDK & Accept Licenses
        run: |
          echo "Using pre-installed Android SDK at: $ANDROID_HOME"
          mkdir -p "$ANDROID_HOME/licenses" || true
          yes | "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" --licenses > /dev/null 2>&1 || true

      - name: Setup Gradle
        uses: gradle/actions/setup-gradle@v4
        with:
          gradle-version: '8.11.1'
          cache-read-only: false

      - name: Build Debug APK with Gradle
        run: |
          find . -name "gradlew" -exec chmod +x {} + || true

          if [ -f "./gradlew" ]; then
            echo "Building with root gradlew wrapper..."
            ./gradlew assembleDebug --stacktrace --no-daemon
          elif [ -f "./android/gradlew" ]; then
            echo "Building with android/gradlew wrapper..."
            cd android
            ./gradlew assembleDebug --stacktrace --no-daemon
            cd ..
          else
            echo "Building with Gradle 8.11.1 directly..."
            gradle assembleDebug --stacktrace --no-daemon
          fi

      - name: Locate Debug APK
        id: find_apk
        run: |
          APK_PATH=$(find . -name "*debug*.apk" -type f | head -n 1)
          if [ -z "$APK_PATH" ]; then
            echo "Error: Debug APK not found after build!"
            exit 1
          fi
          echo "Found APK at: $APK_PATH"
          echo "apk_path=$APK_PATH" >> $GITHUB_OUTPUT

      - name: Upload Debug APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: oplus-vooc-controller-debug-apk
          path: \${{ steps.find_apk.outputs.apk_path }}
          retention-days: 14
          if-no-files-found: error`
  },
  {
    id: 'charging_session',
    filename: 'ChargingSession.kt',
    path: 'android/app/src/main/java/com/oplus/battery/controller/analytics/ChargingSession.kt',
    language: 'kotlin',
    category: 'Analytics & Health',
    description: 'Data model logging charge/discharge rates, temperatures, energy (mAh), and high-voltage saturation dwell time',
    content: `package com.oplus.battery.controller.analytics

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

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
)`
  },
  {
    id: 'health_estimator',
    filename: 'BatteryHealthEstimator.kt',
    path: 'android/app/src/main/java/com/oplus/battery/controller/analytics/BatteryHealthEstimator.kt',
    language: 'kotlin',
    category: 'Analytics & Health',
    description: 'Electrochemical degradation modeling estimating health % from cycle wear, float saturation, and Arrhenius thermal penalties',
    content: `package com.oplus.battery.controller.analytics

import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

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
        val cycleWearPct = cycleCount * 0.025f
        val saturationWearPct = (totalSaturationHours / 10.0f) * 0.05f
        val thermalWearPct = (minutesAbove40 / 30.0f) * 0.01f + (minutesAbove43 / 10.0f) * 0.03f
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
                    description = "Your device spent \${String.format("%.1f", totalSaturationHours)} hours plugged at 100%. Capping the voltage cutoff to 4.20V (approx 80-85% charge) prevents electrolyte oxidation and doubles battery lifespan.",
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
                    description = "Cell temperature reached \${String.format("%.1f", peakTemp)}°C in previous sessions. Lower your charging current limit to 1500 mA to keep thermal stress well below the critical 40°C threshold.",
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
}`
  },
  {
    id: 'health_repo',
    filename: 'BatteryHealthRepository.kt',
    path: 'android/app/src/main/java/com/oplus/battery/controller/analytics/BatteryHealthRepository.kt',
    language: 'kotlin',
    category: 'Analytics & Health',
    description: 'Thread-safe repository recording active session metrics on Dispatchers.IO and exposing StateFlow',
    content: `package com.oplus.battery.controller.analytics

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

class BatteryHealthRepository private constructor(private val context: Context) {

    private val mutex = Mutex()
    private val scope = CoroutineScope(Dispatchers.IO)

    private val _sessions = MutableStateFlow<List<ChargingSession>>(emptyList())
    val sessions: StateFlow<List<ChargingSession>> = _sessions.asStateFlow()

    private val _activeSession = MutableStateFlow<ChargingSession?>(null)
    val activeSession: StateFlow<ChargingSession?> = _activeSession.asStateFlow()

    private val _healthReport = MutableStateFlow(
        BatteryHealthEstimator.calculateHealthReport(emptyList())
    )
    val healthReport: StateFlow<BatteryHealthReport> = _healthReport.asStateFlow()

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
                    timeAtFullChargeMinutes = 320,
                    estimatedEnergyMah = 3750,
                    chargerProtocol = "STANDARD"
                )
            )

            mutex.withLock {
                _sessions.value = sampleSessions
                _healthReport.value = BatteryHealthEstimator.calculateHealthReport(sampleSessions)
            }
        }
    }

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

            if (tempCelsius >= 43.0f) activeSecondsAbove43 += sampleIntervalSeconds
            if (tempCelsius >= 40.0f) activeSecondsAbove40 += sampleIntervalSeconds
            if (percentage >= 99) activeSecondsAtFullCharge += sampleIntervalSeconds

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
}`
  },
  {
    id: 'health_screen',
    filename: 'HealthAnalyticsScreen.kt',
    path: 'android/app/src/main/java/com/oplus/battery/controller/ui/HealthAnalyticsScreen.kt',
    language: 'kotlin',
    category: 'UI / Compose',
    description: 'Jetpack Compose Material 3 screen with Health % circular gauge, recommendations, active session tracker, and history list',
    content: `package com.oplus.battery.controller.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.oplus.battery.controller.analytics.BatteryHealthReport
import com.oplus.battery.controller.analytics.ChargingSession
import com.oplus.battery.controller.analytics.LongevityRecommendation
import com.oplus.battery.controller.analytics.RecommendationImpact
import com.oplus.battery.controller.viewmodel.ChargingViewModel

@Composable
fun HealthAnalyticsScreen(
    viewModel: ChargingViewModel,
    onApplyRecommendation: (currentLimitMa: Int?, voltageLimitMv: Int?) -> Unit
) {
    val healthReport by viewModel.healthReport.collectAsState()
    val sessions by viewModel.chargingSessions.collectAsState()
    val activeSession by viewModel.activeSession.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        HealthOverviewCard(report = healthReport)

        activeSession?.let { active ->
            ActiveSessionCard(session = active)
        }

        RecommendationsSection(
            recommendations = healthReport.recommendations,
            onApply = onApplyRecommendation
        )

        SessionsHistorySection(sessions = sessions)
    }
}`
  },
  {
    id: 'build_gradle',
    filename: 'build.gradle.kts',
    path: 'android/app/build.gradle.kts',
    language: 'gradle',
    category: 'Configuration',
    description: 'App-level Gradle script configured with Jetpack Compose, Material 3, LibSu 5.2.1, and Shizuku 13.1.5',
    content: `plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "com.oplus.battery.controller"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.oplus.battery.controller"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
        debug {
            applicationIdSuffix = ".debug"
            isDebuggable = true
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.extended)
    implementation("com.github.topjohnwu.libsu:core:5.2.1")
    implementation("dev.rikka.shizuku:api:13.1.5")
    implementation("dev.rikka.shizuku:provider:13.1.5")
}`
  },
  {
    id: 'manifest',
    filename: 'AndroidManifest.xml',
    path: 'android/app/src/main/AndroidManifest.xml',
    language: 'xml',
    category: 'Configuration',
    description: 'Declares Shizuku provider, Android 14+ specialUse foreground service, battery stats, and boot receiver',
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools"
    package="com.oplus.battery.controller">

    <uses-permission android:name="android.permission.BATTERY_STATS" tools:ignore="ProtectedPermissions" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <application
        android:name=".ChargingApplication"
        android:allowBackup="false"
        android:label="@string/app_name"
        android:theme="@style/Theme.OplusBatteryController">

        <provider
            android:name="rikka.shizuku.ShizukuProvider"
            android:authorities="\${applicationId}.shizuku"
            android:multiprocess="false"
            android:enabled="true"
            android:exported="true"
            android:permission="android.permission.INTERACT_ACROSS_USERS_FULL" />

        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <service
            android:name=".service.ChargingMonitorService"
            android:enabled="true"
            android:exported="false"
            android:foregroundServiceType="specialUse">
            <property
                android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
                android:value="battery_hardware_charge_controller_and_thermal_guard" />
        </service>

        <receiver
            android:name=".receiver.BootCompletedReceiver"
            android:enabled="true"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
            </intent-filter>
        </receiver>

    </application>

</manifest>`
  },
  {
    id: 'res_strings',
    filename: 'strings.xml',
    path: 'android/app/src/main/res/values/strings.xml',
    language: 'xml',
    category: 'Configuration',
    description: 'String resources defining app_name and accessibility labels',
    content: `<resources>
    <string name="app_name">VOOC Charge Controller</string>
</resources>`
  },
  {
    id: 'res_themes',
    filename: 'themes.xml',
    path: 'android/app/src/main/res/values/themes.xml',
    language: 'xml',
    category: 'Configuration',
    description: 'Theme definition for ColorOS Material 3 dark window styling',
    content: `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.OplusBatteryController" parent="Theme.Material3.DayNight.NoActionBar">
        <item name="android:statusBarColor">#0E1318</item>
        <item name="android:navigationBarColor">#0E1318</item>
        <item name="android:windowBackground">#0E1318</item>
    </style>
</resources>`
  },
  {
    id: 'shell_executor',
    filename: 'ShellExecutor.kt',
    path: 'android/app/src/main/java/com/oplus/battery/controller/executor/ShellExecutor.kt',
    language: 'kotlin',
    category: 'Core Engine',
    description: 'Hybrid Root (LibSu) & Shizuku Binder Shell dispatcher with automatic SELinux fallback to dumpsys battery',
    content: `package com.oplus.battery.controller.executor

import android.content.Context
import android.content.pm.PackageManager
import com.topjohnwu.superuser.Shell
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import rikka.shizuku.Shizuku
import java.io.BufferedReader
import java.io.InputStreamReader

enum class ExecutionMode(val displayName: String, val badgeColorName: String) {
    ROOT("Mode: Root Kernel Control", "Emerald"),
    SHIZUKU_SYSFS("Mode: Shizuku Privileged Shell", "Cyan"),
    SHIZUKU_ADB_FALLBACK("Mode: Shizuku / ADB Emulation", "Amber"),
    RESTRICTED("Mode: Restricted / Read-Only", "Rose")
}

data class ShellResult(
    val exitCode: Int,
    val stdout: List<String>,
    val stderr: List<String>,
    val modeUsed: ExecutionMode,
    val isSuccess: Boolean = exitCode == 0
)`
  },
  {
    id: 'charging_service',
    filename: 'ChargingMonitorService.kt',
    path: 'android/app/src/main/java/com/oplus/battery/controller/service/ChargingMonitorService.kt',
    language: 'kotlin',
    category: 'Service & HAL',
    description: 'Foreground watchdog polling every 3 seconds to maintain thresholds against ColorOS VOOC resets and recording health sessions',
    content: `package com.oplus.battery.controller.service

import android.app.Service
import android.content.Context
import android.content.Intent
import com.oplus.battery.controller.analytics.BatteryHealthRepository
import com.oplus.battery.controller.manager.ChargingManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class ChargingMonitorService : Service() {
    // Persistent foreground service monitoring sysfs, thermal cutoff, and logging session telemetry
}`
  }
];
