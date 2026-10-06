import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Zap, 
  Flame, 
  PowerOff, 
  RotateCcw, 
  Cpu, 
  BatteryCharging, 
  CheckCircle2, 
  AlertTriangle,
  Heart,
  History,
  Lightbulb
} from 'lucide-react';
import { ExecutionMode, BatteryHardwareMetrics, BatteryHealthReport, ChargingSession } from '../types/charging';

interface DeviceSimulatorProps {
  metrics: BatteryHardwareMetrics;
  executionMode: ExecutionMode;
  targetCurrentMa: number;
  targetVoltageMv: number;
  onCurrentChange: (val: number) => void;
  onVoltageChange: (val: number) => void;
  onApplyLimits: () => void;
  onResetDefaults: () => void;
  onEmergencyStop: () => void;
  onRequestShizuku: () => void;
  statusMessage: string | null;
  healthReport?: BatteryHealthReport;
  sessions?: ChargingSession[];
  onApplyRecommendation?: (currentLimitMa?: number, voltageLimitMv?: number) => void;
}

export const DeviceSimulator: React.FC<DeviceSimulatorProps> = ({
  metrics,
  executionMode,
  targetCurrentMa,
  targetVoltageMv,
  onCurrentChange,
  onVoltageChange,
  onApplyLimits,
  onResetDefaults,
  onEmergencyStop,
  onRequestShizuku,
  statusMessage,
  healthReport,
  sessions = [],
  onApplyRecommendation,
}) => {
  const [phoneTab, setPhoneTab] = useState<'CONTROL' | 'HEALTH'>('CONTROL');
  const isOverheated = metrics.temperatureCelsius >= 43.0;

  // Mode badge styles
  const getBadgeInfo = () => {
    switch (executionMode) {
      case 'ROOT':
        return {
          title: 'Mode: Root Kernel Control',
          subtitle: 'LibSu persistent su master shell active',
          bg: 'bg-emerald-950/80 border-emerald-500/40 text-emerald-400',
          chip: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        };
      case 'SHIZUKU_SYSFS':
        return {
          title: 'Mode: Shizuku Privileged Shell',
          subtitle: 'Rikka Shizuku IPC binder session connected',
          bg: 'bg-cyan-950/80 border-cyan-500/40 text-cyan-400',
          chip: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
        };
      case 'SHIZUKU_ADB_FALLBACK':
        return {
          title: 'Mode: Shizuku / ADB Emulation',
          subtitle: 'SELinux Enforced: dumpsys battery fallback active',
          bg: 'bg-amber-950/80 border-amber-500/40 text-amber-400',
          chip: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        };
      case 'RESTRICTED':
      default:
        return {
          title: 'Mode: Restricted / Read-Only',
          subtitle: 'Grant Root or bind Shizuku for sysfs writes',
          bg: 'bg-rose-950/80 border-rose-500/40 text-rose-400',
          chip: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
        };
    }
  };

  const badge = getBadgeInfo();
  const strokeDashoffset = 251.2 - (251.2 * metrics.percentage) / 100;

  return (
    <div className="relative mx-auto w-full max-w-[410px] select-none">
      {/* Phone Hardware Shell (ColorOS Find X / Reno flagship frame) */}
      <div className="relative rounded-[48px] bg-neutral-950 p-3 shadow-2xl ring-1 ring-white/10 shadow-black/80">
        {/* Camera punch hole */}
        <div className="absolute top-5 left-1/2 z-30 h-4 w-4 -translate-x-1/2 rounded-full bg-black ring-1 ring-white/10 flex items-center justify-center">
          <div className="h-1.5 w-1.5 rounded-full bg-neutral-800" />
        </div>

        {/* Glossy edge highlight */}
        <div className="pointer-events-none absolute inset-0 rounded-[48px] ring-1 ring-inset ring-white/10" />

        {/* Screen Bezel & Display */}
        <div className="relative flex min-h-[780px] flex-col overflow-hidden rounded-[40px] bg-[#0c1015] text-slate-100 shadow-inner">
          
          {/* Status Bar */}
          <div className="flex h-10 items-center justify-between px-6 pt-2 text-[11px] font-medium text-slate-400">
            <span className="font-mono">18:46</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[10px] text-emerald-400">5G+</span>
              <span className="text-[10px]">WiFi 6E</span>
              <div className="flex items-center gap-1">
                <span className="font-mono text-[10px]">{metrics.percentage}%</span>
                <div className="h-2.5 w-5 rounded-[3px] border border-slate-400 p-[1px]">
                  <div 
                    className={`h-full rounded-[1px] transition-all duration-300 ${isOverheated ? 'bg-rose-500' : 'bg-emerald-400'}`}
                    style={{ width: `${Math.min(100, Math.max(5, metrics.percentage))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Jetpack Compose TopAppBar */}
          <div className="border-b border-white/5 bg-[#121820]">
            <div className="flex items-center justify-between px-4 py-2.5">
              <div>
                <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                  VOOC Charge Architect
                </h1>
                <p className="text-[10px] text-slate-400 font-medium">ColorOS Hardware Kernel Subsystem</p>
              </div>
              <div className={`rounded-md border px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider ${badge.chip}`}>
                {executionMode}
              </div>
            </div>

            {/* Material 3 TabRow */}
            <div className="flex border-t border-white/5 bg-[#141b24] text-xs font-semibold">
              <button
                onClick={() => setPhoneTab('CONTROL')}
                className={`flex-1 py-2 text-center transition border-b-2 ${
                  phoneTab === 'CONTROL'
                    ? 'border-emerald-400 text-emerald-400 font-bold'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                Hardware Control
              </button>
              <button
                onClick={() => setPhoneTab('HEALTH')}
                className={`flex-1 py-2 text-center transition border-b-2 ${
                  phoneTab === 'HEALTH'
                    ? 'border-emerald-400 text-emerald-400 font-bold'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                Battery Health
              </button>
            </div>
          </div>

          {/* Scrollable Screen Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin scrollbar-thumb-white/10">

            {phoneTab === 'CONTROL' ? (
              <>
                {/* 1. Privilege Status Banner */}
                <div className={`rounded-2xl border p-3 transition-all ${badge.bg}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 rounded-lg bg-black/30 p-1.5">
                        <ShieldCheck className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="text-xs font-bold leading-tight">{badge.title}</h2>
                        <p className="text-[10px] opacity-80 mt-0.5">{badge.subtitle}</p>
                      </div>
                    </div>
                    {executionMode === 'RESTRICTED' && (
                      <button
                        onClick={onRequestShizuku}
                        className="shrink-0 rounded-lg bg-rose-500 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm hover:bg-rose-600 transition"
                      >
                        Bind Shizuku
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Real-Time Telemetry Section */}
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Battery Percentage Circular Gauge */}
                  <div className="relative flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-[#161e28] p-3 text-center">
                    <div className="relative h-24 w-24 flex items-center justify-center">
                      <svg className="h-24 w-24 -rotate-90 transform">
                        <circle
                          cx="48"
                          cy="48"
                          r="40"
                          stroke="currentColor"
                          strokeWidth="7"
                          className="text-slate-800"
                          fill="transparent"
                        />
                        <circle
                          cx="48"
                          cy="48"
                          r="40"
                          stroke="currentColor"
                          strokeWidth="7"
                          strokeDasharray="251.2"
                          strokeDashoffset={strokeDashoffset}
                          strokeLinecap="round"
                          className={`transition-all duration-700 ${isOverheated ? 'text-rose-500' : 'text-emerald-400'}`}
                          fill="transparent"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="font-mono text-2xl font-black text-white">{metrics.percentage}%</span>
                        <span className={`text-[9px] font-semibold flex items-center gap-0.5 ${metrics.isCharging ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {metrics.isCharging && <BatteryCharging className="h-3 w-3 inline" />}
                          {metrics.isCharging ? 'Charging' : 'Discharging'}
                        </span>
                      </div>
                    </div>
                    <span className="mt-1 text-[9px] text-slate-400 font-mono">
                      {metrics.isPlugged ? 'SUPERVOOC Attached' : 'Cell on Battery'}
                    </span>
                  </div>

                  {/* Metric Mini Cards */}
                  <div className="flex flex-col justify-between gap-1.5">
                    {/* Voltage Card */}
                    <div className="flex items-center justify-between rounded-xl border border-white/5 bg-[#161e28] px-2.5 py-2">
                      <div className="flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-cyan-400" />
                        <span className="text-[10px] text-slate-400 font-medium">Voltage</span>
                      </div>
                      <span className="font-mono text-xs font-bold text-cyan-400">{metrics.voltageMv} mV</span>
                    </div>

                    {/* Current Card */}
                    <div className="flex items-center justify-between rounded-xl border border-white/5 bg-[#161e28] px-2.5 py-2">
                      <div className="flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-[10px] text-slate-400 font-medium">Current</span>
                      </div>
                      <span className="font-mono text-xs font-bold text-emerald-400">{metrics.currentMa} mA</span>
                    </div>

                    {/* Temperature Card with Safeguard Badge */}
                    <div className={`flex items-center justify-between rounded-xl border px-2.5 py-2 transition-all ${
                      isOverheated 
                        ? 'border-rose-500/50 bg-rose-950/40 text-rose-300' 
                        : 'border-white/5 bg-[#161e28] text-amber-400'
                    }`}>
                      <div className="flex items-center gap-1.5">
                        <Flame className={`h-3.5 w-3.5 ${isOverheated ? 'text-rose-400 animate-pulse' : 'text-amber-400'}`} />
                        <span className="text-[10px] text-slate-400 font-medium">Cell Temp</span>
                      </div>
                      <div className="flex items-center gap-1 font-mono text-xs font-bold">
                        {isOverheated && <AlertTriangle className="h-3 w-3 text-rose-400" />}
                        <span>{metrics.temperatureCelsius.toFixed(1)}°C</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Thermal Safeguard Alert Banner */}
                {isOverheated && (
                  <div className="rounded-2xl border border-rose-500/50 bg-gradient-to-r from-rose-950/90 to-red-900/60 p-3 text-rose-200 shadow-md">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                      <div>
                        <h2 className="text-xs font-bold text-rose-300">THERMAL SAFEGUARD TRIPPED (&gt;= 43°C)</h2>
                        <p className="text-[10px] text-rose-200/90 leading-relaxed mt-0.5">
                          Temperature at {metrics.temperatureCelsius.toFixed(1)}°C! Foreground watchdog throttled current to 500 mA to protect VOOC cell.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Dual Material 3 Safety Sliders */}
                <div className="rounded-2xl border border-white/5 bg-[#161e28] p-3.5 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Hardware Invariant Controls</span>
                    <span className="text-[9px] font-mono text-slate-400">Strictly Bounded</span>
                  </div>

                  {/* Current Slider */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-300">Current Limit (mA)</span>
                      <span className="font-mono font-bold text-emerald-400">{targetCurrentMa} mA</span>
                    </div>
                    <input
                      type="range"
                      min="500"
                      max="3000"
                      step="100"
                      value={targetCurrentMa}
                      onChange={(e) => onCurrentChange(Number(e.target.value))}
                      className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-emerald-400"
                    />
                    <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                      <span>Min: 500 mA</span>
                      <span className="text-emerald-500">VOOC Cap: 3000 mA</span>
                    </div>
                  </div>

                  {/* Voltage Slider */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-300">Cutoff Voltage (mV)</span>
                      <span className="font-mono font-bold text-cyan-400">
                        {targetVoltageMv} mV ({(targetVoltageMv / 1000).toFixed(2)} V)
                      </span>
                    </div>
                    <input
                      type="range"
                      min="4000"
                      max="4450"
                      step="50"
                      value={targetVoltageMv}
                      onChange={(e) => onVoltageChange(Number(e.target.value))}
                      className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-cyan-400"
                    />
                    <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                      <span>Min: 4.00 V (4000 mV)</span>
                      <span className="text-cyan-500">Max Safe: 4.45 V (4450 mV)</span>
                    </div>
                  </div>
                </div>

                {/* 5. Hardware Action Buttons */}
                <div className="space-y-2 pt-1">
                  <button
                    onClick={onApplyLimits}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black py-2.5 text-xs font-bold shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition"
                  >
                    <Zap className="h-4 w-4" />
                    Apply Hardware Limits
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={onResetDefaults}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-slate-800/80 hover:bg-slate-700 text-slate-200 py-2 text-xs font-medium active:scale-[0.98] transition"
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                      Reset Default
                    </button>

                    <button
                      onClick={onEmergencyStop}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white py-2 text-xs font-bold shadow-md shadow-rose-600/20 active:scale-[0.98] transition"
                    >
                      <PowerOff className="h-3.5 w-3.5" />
                      Stop Charging
                    </button>
                  </div>
                </div>

                {/* Status Message toast inside device */}
                {statusMessage && (
                  <div className="flex items-center gap-2 rounded-xl bg-slate-800/90 border border-white/10 p-2 text-[10px] text-slate-300">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">{statusMessage}</span>
                  </div>
                )}

                {/* 6. Active Sysfs Nodes Inspector Card */}
                <div className="rounded-2xl border border-white/5 bg-[#161e28]/70 p-3 text-[10px] font-mono space-y-1 text-slate-400">
                  <div className="flex items-center gap-1.5 font-bold text-slate-300 font-sans mb-1">
                    <Cpu className="h-3.5 w-3.5 text-slate-400" />
                    Active ColorOS Sysfs Nodes
                  </div>
                  <p className="truncate"><span className="text-slate-500">I_LIM:</span> {metrics.activeCurrentNode}</p>
                  <p className="truncate"><span className="text-slate-500">V_CUT:</span> {metrics.activeVoltageNode}</p>
                  <p className="truncate"><span className="text-slate-500">SW_EN:</span> {metrics.activeSwitchNode}</p>
                </div>
              </>
            ) : (
              /* HEALTH ANALYTICS PHONE TAB */
              <div className="space-y-3.5">
                {/* Health % Overview */}
                <div className="rounded-2xl border border-white/5 bg-[#161e28] p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Heart className="h-4 w-4 text-emerald-400 fill-current" />
                      Battery Health Grade
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400">
                      {healthReport ? `${healthReport.healthPercentage}%` : '96.8%'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="relative h-16 w-16 shrink-0 flex items-center justify-center">
                      <span className="font-mono text-lg font-bold text-white">
                        {healthReport?.healthPercentage ?? 96.8}%
                      </span>
                    </div>
                    <div className="space-y-1 text-[10px] text-slate-400 font-mono">
                      <p>Est Capacity: <span className="text-white font-bold">{healthReport?.estimatedCapacityMah ?? 4840} mAh</span></p>
                      <p>Design: <span className="text-white">5,000 mAh</span></p>
                      <p>Cycles (EFC): <span className="text-cyan-400 font-bold">{healthReport?.cycleCountEquivalent ?? 84.2}</span></p>
                    </div>
                  </div>
                </div>

                {/* Longevity Recommendations inside phone */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Lightbulb className="h-3.5 w-3.5 text-amber-400" />
                    Tailored Longevity Tips
                  </span>
                  {(healthReport?.recommendations || []).slice(0, 2).map((r) => (
                    <div key={r.id} className="rounded-xl border border-white/5 bg-[#161e28] p-2.5 text-[11px] space-y-1.5">
                      <div className="flex items-center justify-between font-bold text-slate-200">
                        <span>{r.title}</span>
                        <span className="text-[9px] font-mono text-amber-400">{r.impact}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed">{r.description}</p>
                      {onApplyRecommendation && (r.recommendedCurrentLimitMa || r.recommendedVoltageLimitMv) && (
                        <button
                          onClick={() => {
                            onApplyRecommendation(r.recommendedCurrentLimitMa, r.recommendedVoltageLimitMv);
                            setPhoneTab('CONTROL');
                          }}
                          className="w-full rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-black py-1 text-[10px] font-bold transition"
                        >
                          Apply Safe Limits ({r.recommendedCurrentLimitMa || 'keep'}mA / {r.recommendedVoltageLimitMv || 'keep'}mV)
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Recent Sessions list inside phone */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <History className="h-3.5 w-3.5 text-slate-400" />
                    Recent Sessions ({sessions.length})
                  </span>
                  {sessions.slice(0, 3).map((s) => (
                    <div key={s.id} className="rounded-xl border border-white/5 bg-[#161e28]/70 p-2.5 text-[10px] font-mono space-y-1">
                      <div className="flex items-center justify-between font-bold text-slate-300">
                        <span>{s.startPercentage}% &rarr; {s.endPercentage}% (+{s.deltaPercentage}%)</span>
                        <span className="text-cyan-400">{s.chargerProtocol}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Duration: {s.durationMinutes}m</span>
                        <span className={s.maxTemperatureCelsius >= 43 ? 'text-rose-400 font-bold' : ''}>
                          Max: {s.maxTemperatureCelsius}°C
                        </span>
                      </div>
                      {s.timeAtFullChargeMinutes > 0 && (
                        <p className="text-amber-400 font-sans">Sat @ 100%: {s.timeAtFullChargeMinutes} min</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Android Home Navigation Bar */}
          <div className="flex h-5 items-center justify-center pb-2">
            <div className="h-1 w-28 rounded-full bg-slate-600/70" />
          </div>

        </div>
      </div>
    </div>
  );
};
