import React from 'react';
import { 
  Cpu, 
  ShieldCheck, 
  Zap, 
  AlertTriangle, 
  Terminal, 
  CheckCircle2, 
  Flame, 
  ArrowRight,
  GitBranch,
  Layers
} from 'lucide-react';

export const ArchitectureGuide: React.FC = () => {
  return (
    <div className="space-y-6 text-slate-200">
      {/* Overview Hero */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#101724] to-[#0a0e17] p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-mono text-emerald-400 font-bold">
              <Cpu className="h-3.5 w-3.5" />
              Staff Android Systems Architect Reference Architecture
            </div>
            <h2 className="text-xl font-black tracking-tight text-white">
              ColorOS / Oppo VOOC Subsystem &amp; Kernel sysfs Abstraction Layer
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Oppo and OnePlus devices equipped with VOOC, SuperVOOC, and Warp Charge rely on specialized charge pump ICs (e.g. SC8547, BQ25970, or TI BQ25890) paired with kernel-level drivers located in <code className="text-emerald-400 font-mono">/sys/class/power_supply/battery/</code> and <code className="text-cyan-400 font-mono">/sys/class/oplus_chg/battery/</code>. This architectural specification details the hybrid execution pipeline, SELinux enforcement, and thermal watchdog safeguards.
            </p>
          </div>
        </div>
      </div>

      {/* 1. Hybrid Permission & Execution Architecture */}
      <div className="rounded-2xl border border-white/10 bg-[#0f141f] p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-cyan-500/10 p-2 text-cyan-400">
            <GitBranch className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">1. Hybrid Execution &amp; Privilege Resolution Pipeline</h3>
            <p className="text-xs text-slate-400">Automatic fallback from LibSu root to Shizuku IPC binder and ADB emulation</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* Root LibSu */}
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-400 text-sm">Tier 1: Native Root</span>
              <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">Primary</span>
            </div>
            <p className="text-xs text-slate-300">
              Dispatches via <code className="font-mono text-emerald-300">com.github.topjohnwu.libsu:core</code>. Executes under the privileged <code className="font-mono text-emerald-300">u:r:su:s0</code> SELinux domain with <code className="font-mono">FLAG_MOUNT_MASTER</code>.
            </p>
            <div className="rounded bg-black/40 p-2 font-mono text-[10px] text-emerald-300">
              # echo 1800000 &gt; /sys/class/power_supply/battery/current_max
            </div>
          </div>

          {/* Shizuku API */}
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-cyan-400 text-sm">Tier 2: Shizuku Binder</span>
              <span className="text-[10px] font-mono bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded">Secondary</span>
            </div>
            <p className="text-xs text-slate-300">
              Bypasses non-root restrictions using <code className="font-mono text-cyan-300">rikka.shizuku:api</code>. Obtains a remote binder token to fork processes under ADB's shell context (<code className="font-mono text-cyan-300">u:r:shell:s0</code>).
            </p>
            <div className="rounded bg-black/40 p-2 font-mono text-[10px] text-cyan-300">
              val p = Shizuku.newProcess(cmd, null, null)
            </div>
          </div>

          {/* ADB Fallback */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-400 text-sm">Tier 3: ADB Fallback</span>
              <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">Fail-safe</span>
            </div>
            <p className="text-xs text-slate-300">
              When SELinux policy enforces read-only access on <code className="font-mono text-amber-300">sysfs_batteryinfo</code>, fallback routes immediately to Android Framework battery emulation.
            </p>
            <div className="rounded bg-black/40 p-2 font-mono text-[10px] text-amber-300">
              $ dumpsys battery set ac 0 &amp;&amp; dumpsys battery set usb 0
            </div>
          </div>
        </div>
      </div>

      {/* 2. ColorOS VOOC Handshake & The 3-Second Daemon */}
      <div className="rounded-2xl border border-white/10 bg-[#0f141f] p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">2. ColorOS VOOC Handshake &amp; Why a 3-Second Daemon is Required</h3>
            <p className="text-xs text-slate-400">Neutralizing kernel charger IC renegotiation loops</p>
          </div>
        </div>

        <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
          <p>
            On Oppo ColorOS devices, when a VOOC 4.0 or SuperVOOC 2.0 / 80W / 100W flash charger is plugged in:
          </p>
          <ol className="list-decimal pl-5 space-y-1.5 text-slate-300 font-sans">
            <li>
              The device and adapter initiate a bi-directional pulse handshake over the USB D+/D- data lines.
            </li>
            <li>
              Upon successful negotiation, the kernel driver (<code className="font-mono text-emerald-400">oplus_chg</code>) updates the hardware charge controller registers, <strong>overwriting any prior user limits</strong> back to maximum (e.g. 6500 mA or 8000 mA).
            </li>
            <li>
              If the device sleeps or screens off, thermal management routines periodically reset <code className="font-mono text-emerald-400">current_max</code>.
            </li>
          </ol>
          <div className="rounded-xl bg-slate-900 border border-white/5 p-3 flex items-start gap-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-slate-300 text-[11px]">
              <strong>Architectural Solution:</strong> <code className="font-mono text-emerald-400">ChargingMonitorService.kt</code> runs a continuous, non-blocking 3-second watchdog loop on <code className="font-mono text-emerald-400">Dispatchers.IO</code>. Whenever the telemetry indicates charger attach or register deviation, the service re-asserts the user-selected clamped values (<code className="font-mono text-emerald-400">targetCurrentMa</code> &amp; <code className="font-mono text-emerald-400">targetVoltageMv</code>).
            </p>
          </div>
        </div>
      </div>

      {/* 3. Strict Safety Bounds & Thermal Runaway Math */}
      <div className="rounded-2xl border border-white/10 bg-[#0f141f] p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-rose-500/10 p-2 text-rose-400">
            <Flame className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">3. Strict Safety Boundaries &amp; Thermal Runaway Protection</h3>
            <p className="text-xs text-slate-400">Mathematical invariants enforced before any shell invocation</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-white/5 bg-slate-900/60 p-4 space-y-2">
            <span className="text-xs font-bold text-slate-300">Current Limits</span>
            <div className="space-y-1 font-mono text-xs">
              <p className="text-emerald-400 font-bold">Min: 500 mA</p>
              <p className="text-rose-400 font-bold">Max: 3000 mA (Cap)</p>
              <p className="text-slate-400">Step: 100 mA</p>
              <p className="text-cyan-400">Default: 1500 mA</p>
            </div>
            <p className="text-[11px] text-slate-400 font-sans">
              Limits current far below unthrottled 65W/80W rates, preventing dendritic lithium plating and heat build-up.
            </p>
          </div>

          <div className="rounded-xl border border-white/5 bg-slate-900/60 p-4 space-y-2">
            <span className="text-xs font-bold text-slate-300">Voltage Cutoff</span>
            <div className="space-y-1 font-mono text-xs">
              <p className="text-emerald-400 font-bold">Min: 4000 mV (4.00V)</p>
              <p className="text-rose-400 font-bold">Max: 4450 mV (4.45V)</p>
              <p className="text-slate-400">Step: 50 mV</p>
              <p className="text-cyan-400">Default: 4200 mV (4.20V)</p>
            </div>
            <p className="text-[11px] text-slate-400 font-sans">
              4.20V default extends cell life cycle from 500 cycles to over 1500+ cycles by avoiding cathode structural strain.
            </p>
          </div>

          <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 space-y-2">
            <span className="text-xs font-bold text-rose-300">Thermal Watchdog</span>
            <div className="space-y-1 font-mono text-xs">
              <p className="text-rose-400 font-bold">Threshold: &gt;= 43.0°C</p>
              <p className="text-amber-400">Throttle Target: 500 mA</p>
              <p className="text-rose-300">Cut Switch: 0 (Isolate)</p>
            </div>
            <p className="text-[11px] text-rose-200/80 font-sans">
              Immediately triggers upon BatteryManager or sysfs thermal report breach, overriding all other user settings.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Android 14+ Foreground Service Architecture */}
      <div className="rounded-2xl border border-white/10 bg-[#0f141f] p-6 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-slate-800 p-2 text-slate-200">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">4. Android 14+ (API 34/35) Special Use Foreground Service</h3>
            <p className="text-xs text-slate-400">Compliance with Google Play and Android OS background restrictions</p>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Under Android 14 (API 34) and Android 15 (API 35), foreground services must declare a specific subtype. For a hardware charging controller daemon:
        </p>

        <div className="rounded-xl bg-black/60 p-3 font-mono text-[11px] text-slate-300 border border-white/5 space-y-1">
          <p className="text-slate-500">&lt;!-- AndroidManifest.xml --&gt;</p>
          <p>&lt;service</p>
          <p className="pl-4">android:name=&quot;.service.ChargingMonitorService&quot;</p>
          <p className="pl-4">android:foregroundServiceType=&quot;specialUse&quot;&gt;</p>
          <p className="pl-4 text-emerald-400">&lt;property</p>
          <p className="pl-8 text-emerald-400">android:name=&quot;android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE&quot;</p>
          <p className="pl-8 text-emerald-400">android:value=&quot;battery_hardware_charge_controller_and_thermal_guard&quot; /&gt;</p>
          <p>&lt;/service&gt;</p>
        </div>
      </div>
    </div>
  );
};
