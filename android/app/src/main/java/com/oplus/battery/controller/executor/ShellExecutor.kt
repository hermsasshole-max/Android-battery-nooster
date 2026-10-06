package com.oplus.battery.controller.executor

import android.content.Context
import android.content.pm.PackageManager
import com.topjohnwu.superuser.Shell
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import rikka.shizuku.Shizuku
import java.io.BufferedReader
import java.io.InputStreamReader

/**
 * Execution privilege mode determined at runtime.
 */
enum class ExecutionMode(val displayName: String, val badgeColorName: String) {
    ROOT("Mode: Root Kernel Control", "Emerald"),
    SHIZUKU_SYSFS("Mode: Shizuku Privileged Shell", "Cyan"),
    SHIZUKU_ADB_FALLBACK("Mode: Shizuku / ADB Emulation", "Amber"),
    RESTRICTED("Mode: Restricted / Read-Only", "Rose")
}

/**
 * Encapsulates the execution result of any shell invocation.
 */
data class ShellResult(
    val exitCode: Int,
    val stdout: List<String>,
    val stderr: List<String>,
    val modeUsed: ExecutionMode,
    val isSuccess: Boolean = exitCode == 0
) {
    val singleLineOutput: String
        get() = stdout.firstOrNull()?.trim().orEmpty()
}

/**
 * ShellExecutor: Hybrid Root (LibSu) & Shizuku Binder Shell Execution Engine.
 *
 * Implements primary execution via LibSu persistent root sessions, seamlessly
 * falling back to Shizuku's privileged IPC binder shell. When SELinux policy
 * blocks write operations to /sys/class nodes under Shizuku's adb_domain context,
 * it safely falls back to Android framework battery service emulation (dumpsys battery).
 */
class ShellExecutor(private val context: Context) {

    private var currentMode: ExecutionMode = ExecutionMode.RESTRICTED
    private var isShizukuPermissionGranted: Boolean = false

    companion object {
        private const val SHIZUKU_PERMISSION_REQUEST_CODE = 4001

        init {
            // Configure LibSu default flags: non-blocking, fast initialization
            Shell.enableVerboseLogging = false
            Shell.setDefaultBuilder(
                Shell.Builder.create()
                    .setFlags(Shell.FLAG_MOUNT_MASTER)
                    .setTimeout(10)
            )
        }
    }

    /**
     * Inspects system capabilities to resolve the highest accessible privilege tier.
     * Guaranteed to execute entirely off the main thread on Dispatchers.IO.
     */
    suspend fun resolveExecutionMode(): ExecutionMode = withContext(Dispatchers.IO) {
        // 1. Probe Native Root (LibSu)
        val hasRoot = try {
            Shell.isAppGrantedRoot() == true || Shell.cmd("id").exec().out.any { it.contains("uid=0(root)") }
        } catch (e: Exception) {
            false
        }

        if (hasRoot) {
            currentMode = ExecutionMode.ROOT
            return@withContext currentMode
        }

        // 2. Probe Shizuku Service Availability & Binder Authentication
        val isShizukuAlive = try {
            Shizuku.pingBinder()
        } catch (e: Throwable) {
            false
        }

        if (isShizukuAlive) {
            val hasShizukuPerm = try {
                if (Shizuku.isPre_V11()) {
                    context.checkCallingOrSelfPermission(Shizuku.KEY_BINDER) == PackageManager.PERMISSION_GRANTED
                } else {
                    Shizuku.checkSelfPermission() == PackageManager.PERMISSION_GRANTED
                }
            } catch (e: Throwable) {
                false
            }

            isShizukuPermissionGranted = hasShizukuPerm

            if (hasShizukuPerm) {
                // Test if Shizuku can write to sysfs (SELinux check)
                val testSysfs = executeShizukuCommand("echo 1 > /sys/class/power_supply/battery/charging_enabled 2>&1")
                val isSelinuxBlocked = testSysfs.stderr.any { it.contains("Permission denied") } ||
                        testSysfs.stdout.any { it.contains("Permission denied") }

                currentMode = if (isSelinuxBlocked) {
                    ExecutionMode.SHIZUKU_ADB_FALLBACK
                } else {
                    ExecutionMode.SHIZUKU_SYSFS
                }
                return@withContext currentMode
            }
        }

        // 3. Fallback to unprivileged / read-only mode
        currentMode = ExecutionMode.RESTRICTED
        return@withContext currentMode
    }

    /**
     * Executes an arbitrary shell command according to the active privilege level.
     * Runs strictly on Dispatchers.IO.
     */
    suspend fun execute(command: String): ShellResult = withContext(Dispatchers.IO) {
        when (currentMode) {
            ExecutionMode.ROOT -> {
                val libSuResult = Shell.cmd(command).exec()
                ShellResult(
                    exitCode = libSuResult.code,
                    stdout = libSuResult.out,
                    stderr = libSuResult.err,
                    modeUsed = ExecutionMode.ROOT
                )
            }
            ExecutionMode.SHIZUKU_SYSFS, ExecutionMode.SHIZUKU_ADB_FALLBACK -> {
                executeShizukuCommand(command)
            }
            ExecutionMode.RESTRICTED -> {
                // Read-only operations can still be attempted via standard runtime
                try {
                    val process = Runtime.getRuntime().exec(arrayOf("sh", "-c", command))
                    val stdout = BufferedReader(InputStreamReader(process.inputStream)).readLines()
                    val stderr = BufferedReader(InputStreamReader(process.errorStream)).readLines()
                    val code = process.waitFor()
                    ShellResult(code, stdout, stderr, ExecutionMode.RESTRICTED)
                } catch (e: Exception) {
                    ShellResult(1, emptyList(), listOf(e.localizedMessage ?: "Execution error"), ExecutionMode.RESTRICTED)
                }
            }
        }
    }

    /**
     * Writes an integer or string payload to a specified sysfs path.
     * Incorporates SELinux error detection and fallback routing to ADB battery emulation.
     */
    suspend fun writeSysfs(nodePath: String, value: String): ShellResult = withContext(Dispatchers.IO) {
        val cmd = "echo $value > $nodePath"
        val initialResult = execute(cmd)

        // Check if write failed due to SELinux denial under Shizuku
        val isDenied = !initialResult.isSuccess ||
                initialResult.stderr.any { it.contains("Permission denied", ignoreCase = true) } ||
                initialResult.stdout.any { it.contains("Permission denied", ignoreCase = true) }

        if (isDenied && currentMode == ExecutionMode.SHIZUKU_SYSFS) {
            // Demote mode to ADB fallback and perform dumpsys battery emulation
            currentMode = ExecutionMode.SHIZUKU_ADB_FALLBACK
            return@withContext executeAdbBatteryFallback(nodePath, value)
        }

        if (isDenied && currentMode == ExecutionMode.SHIZUKU_ADB_FALLBACK) {
            return@withContext executeAdbBatteryFallback(nodePath, value)
        }

        return@withContext initialResult
    }

    /**
     * Reads the current contents of a sysfs node safely on Dispatchers.IO.
     */
    suspend fun readSysfs(nodePath: String): String? = withContext(Dispatchers.IO) {
        val result = execute("cat $nodePath 2>/dev/null")
        if (result.isSuccess && result.stdout.isNotEmpty()) {
            result.singleLineOutput
        } else {
            null
        }
    }

    /**
     * Fallback layer: Translates sysfs intent into Android Framework 'dumpsys battery' controls.
     * Supported commands:
     * - Disabling charging: dumpsys battery set ac 0; dumpsys battery set usb 0
     * - Re-enabling charging: dumpsys battery reset
     * - Emulating level/status for testing: dumpsys battery set level <N>
     */
    private suspend fun executeAdbBatteryFallback(nodePath: String, value: String): ShellResult {
        val fallbackCmd = when {
            nodePath.contains("charging_enabled") && value == "0" -> {
                "dumpsys battery set ac 0 && dumpsys battery set usb 0"
            }
            nodePath.contains("charging_enabled") && value == "1" -> {
                "dumpsys battery reset"
            }
            nodePath.contains("current_max") && value.toIntOrNull()?.let { it <= 500000 } == true -> {
                // Emulate low-current throttling via USB-only profile
                "dumpsys battery set ac 0"
            }
            else -> {
                "dumpsys battery reset"
            }
        }
        val result = executeShizukuCommand(fallbackCmd)
        return result.copy(modeUsed = ExecutionMode.SHIZUKU_ADB_FALLBACK)
    }

    /**
     * Dispatches command through Shizuku's privileged IPC binder using Shizuku.newProcess().
     */
    private fun executeShizukuCommand(command: String): ShellResult {
        return try {
            val process = Shizuku.newProcess(arrayOf("sh", "-c", command), null, null)
            val stdout = BufferedReader(InputStreamReader(process.inputStream)).readLines()
            val stderr = BufferedReader(InputStreamReader(process.errorStream)).readLines()
            val exitCode = process.waitFor()

            ShellResult(
                exitCode = exitCode,
                stdout = stdout,
                stderr = stderr,
                modeUsed = currentMode
            )
        } catch (e: Throwable) {
            ShellResult(
                exitCode = 1,
                stdout = emptyList(),
                stderr = listOf(e.localizedMessage ?: "Shizuku IPC binder dispatch failure"),
                modeUsed = currentMode
            )
        }
    }

    fun requestShizukuPermission() {
        if (Shizuku.pingBinder() && !isShizukuPermissionGranted) {
            Shizuku.requestPermission(SHIZUKU_PERMISSION_REQUEST_CODE)
        }
    }

    fun getCurrentMode(): ExecutionMode = currentMode
}
