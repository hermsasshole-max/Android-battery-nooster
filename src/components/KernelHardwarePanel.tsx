import React from 'react';
import { 
  Cpu, 
  ShieldAlert, 
  Flame, 
  Activity, 
  Plug, 
  HardDrive, 
  RefreshCw,
  Terminal,
  Lock,
  Unlock
} from 'lucide-react';
import { ExecutionMode, SysfsNodeState } from '../types/charging';

interface KernelHardwarePanelProps {
  executionMode: ExecutionMode;
  onSetExecutionMode: (mode: ExecutionMode) => void;
  isPlugged: boolean;
  chargerType: 'VOOC_80W' | 'USB_PD_18W' | 'UNPLUGGED';
  onSetChargerType: (type: 'VOOC_80W' | 'USB_PD_18W' | 'UNPLUGGED') => void;
  temperature: number;
  onSetTemperature: (temp: number) => void;
  daemonTicks: number;
  overrideCatches: number;
  sysfsNodes: SysfsNodeState[];
  isSelinuxEnforcing: boolean;
  onToggleSelinux: () => void;
}

export const KernelHardwarePanel: React.FC<KernelHardwarePanelProps> = ({
  executionMode,
  onSetExecutionMode,
  chargerType,
  onSetChargerType,
  temperature,
  onSetTemperature,
  daemonTicks,
  overrideCatches,
  sysfsNodes,
  isSelinuxEnforcing,
  onToggleSelinux,
}) => {
  return (
    <div className="space-y-5 rounded-2xl border border-white/10 bg-[#0f141c] p-5 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">
              Kernel &amp; HAL Hardware Injection Testbed
            </h2>
            <p className="text-xs text-slate-400">
              Simulate Oppo ColorOS kernel events, SELinux enforcement, and thermal conditions
            </p>
          </div>
        </div>

        {/* 3s Daemon Heartbeat indicator */}
        <div className="flex items-center gap-2 rounded-xl bg-slate-900 border border-white/5 px-3 py-1.5 text-xs font-mono">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-slate-300">Daemon:</span>
          <span className="font-bold text-emerald-400">3s Tick #{daemonTicks}</span>
        </div>
      </div>

      {/* Grid of Simulation Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* 1. Privilege Level Architecture Selection */}
        <div className="rounded-xl border border-white/5 bg-[#141b24] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4 text-emerald-400" />
              Runtime Privilege Level
            </span>
            <span className="text-[10px] font-mono text-slate-500">Hybrid IPC</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => onSetExecutionMode('ROOT')}
              className={`rounded-lg p-2.5 text-left border transition-all ${
                executionMode === 'ROOT'
                  ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300 font-bold'
                  : 'border-white/5 bg-slate-900/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>Native Root</span>
                <span className="text-[10px] text-emerald-400 font-mono">LibSu</span>
              </div>
              <p className="text-[10px] opacity-70 mt-1 font-normal">Direct RW to /sys/class</p>
            </button>

            <button
              onClick={() => onSetExecutionMode('SHIZUKU_SYSFS')}
              className={`rounded-lg p-2.5 text-left border transition-all ${
                executionMode === 'SHIZUKU_SYSFS'
                  ? 'border-cyan-500 bg-cyan-950/40 text-cyan-300 font-bold'
                  : 'border-white/5 bg-slate-900/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>Shizuku Shell</span>
                <span className="text-[10px] text-cyan-400 font-mono">Binder</span>
              </div>
              <p className="text-[10px] opacity-70 mt-1 font-normal">Privileged binder process</p>
            </button>

            <button
              onClick={() => onSetExecutionMode('SHIZUKU_ADB_FALLBACK')}
              className={`rounded-lg p-2.5 text-left border transition-all ${
                executionMode === 'SHIZUKU_ADB_FALLBACK'
                  ? 'border-amber-500 bg-amber-950/40 text-amber-300 font-bold'
                  : 'border-white/5 bg-slate-900/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>ADB Fallback</span>
                <span className="text-[10px] text-amber-400 font-mono">dumpsys</span>
              </div>
              <p className="text-[10px] opacity-70 mt-1 font-normal">SELinux blocks sysfs write</p>
            </button>

            <button
              onClick={() => onSetExecutionMode('RESTRICTED')}
              className={`rounded-lg p-2.5 text-left border transition-all ${
                executionMode === 'RESTRICTED'
                  ? 'border-rose-500 bg-rose-950/40 text-rose-300 font-bold'
                  : 'border-white/5 bg-slate-900/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>Restricted</span>
                <span className="text-[10px] text-rose-400 font-mono">Read-Only</span>
              </div>
              <p className="text-[10px] opacity-70 mt-1 font-normal">No su/Shizuku available</p>
            </button>
          </div>

          {/* SELinux Enforcement Toggle */}
          <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
            <div className="flex items-center gap-1.5 text-slate-300">
              {isSelinuxEnforcing ? <Lock className="h-3.5 w-3.5 text-amber-400" /> : <Unlock className="h-3.5 w-3.5 text-emerald-400" />}
              <span>SELinux Mode:</span>
              <span className={`font-mono font-bold ${isSelinuxEnforcing ? 'text-amber-400' : 'text-emerald-400'}`}>
                {isSelinuxEnforcing ? 'Enforcing (sysfs write avc:denied)' : 'Permissive'}
              </span>
            </div>
            <button
              onClick={onToggleSelinux}
              className="text-[11px] rounded bg-slate-800 hover:bg-slate-700 px-2 py-0.5 text-slate-200 font-medium transition"
            >
              Toggle
            </button>
          </div>
        </div>

        {/* 2. Charger Circuitry & VOOC Handshake */}
        <div className="rounded-xl border border-white/5 bg-[#141b24] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Plug className="h-4 w-4 text-cyan-400" />
              Charger Protocol &amp; Circuit
            </span>
            <span className="text-[10px] font-mono text-cyan-400">Oppo VOOC / PD</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <button
              onClick={() => onSetChargerType('VOOC_80W')}
              className={`rounded-lg p-2 text-center border transition-all ${
                chargerType === 'VOOC_80W'
                  ? 'border-cyan-500 bg-cyan-950/40 text-cyan-300 font-bold'
                  : 'border-white/5 bg-slate-900/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="text-xs font-bold">SUPERVOOC</div>
              <div className="text-[10px] text-cyan-400 font-mono">80W Flash</div>
              <p className="text-[9px] text-slate-500 mt-1">Periodic kernel override</p>
            </button>

            <button
              onClick={() => onSetChargerType('USB_PD_18W')}
              className={`rounded-lg p-2 text-center border transition-all ${
                chargerType === 'USB_PD_18W'
                  ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300 font-bold'
                  : 'border-white/5 bg-slate-900/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="text-xs font-bold">Standard PD</div>
              <div className="text-[10px] text-emerald-400 font-mono">18W USB-C</div>
              <p className="text-[9px] text-slate-500 mt-1">Passive handshake</p>
            </button>

            <button
              onClick={() => onSetChargerType('UNPLUGGED')}
              className={`rounded-lg p-2 text-center border transition-all ${
                chargerType === 'UNPLUGGED'
                  ? 'border-rose-500 bg-rose-950/40 text-rose-300 font-bold'
                  : 'border-white/5 bg-slate-900/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="text-xs font-bold">Disconnected</div>
              <div className="text-[10px] text-rose-400 font-mono">Discharging</div>
              <p className="text-[9px] text-slate-500 mt-1">Battery-only</p>
            </button>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs text-slate-400">
            <span>VOOC Overrides Countered:</span>
            <span className="font-mono font-bold text-cyan-400">{overrideCatches} re-asserts</span>
          </div>
        </div>

        {/* 3. Thermal Stress Testing */}
        <div className="rounded-xl border border-white/5 bg-[#141b24] p-4 space-y-3 md:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Flame className="h-4 w-4 text-amber-400" />
              Thermal Stress Injection (Automated Guard Target: 43.0°C)
            </span>
            <span className="font-mono text-xs font-bold text-amber-400">
              {temperature.toFixed(1)}°C
            </span>
          </div>

          <div className="flex items-center gap-4">
            <input
              type="range"
              min="25"
              max="48"
              step="0.5"
              value={temperature}
              onChange={(e) => onSetTemperature(Number(e.target.value))}
              className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-slate-800 accent-amber-400"
            />
            <div className="flex gap-2">
              <button
                onClick={() => onSetTemperature(32.0)}
                className="rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-700"
              >
                Cool (32°C)
              </button>
              <button
                onClick={() => onSetTemperature(39.0)}
                className="rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-700"
              >
                Warm (39°C)
              </button>
              <button
                onClick={() => onSetTemperature(44.5)}
                className="rounded-lg bg-rose-600/30 border border-rose-500/50 px-2.5 py-1 text-[11px] text-rose-300 font-bold hover:bg-rose-600/50"
              >
                Overheat (44.5°C)
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Sysfs Virtual File System Table */}
      <div className="rounded-xl border border-white/5 bg-[#141b24] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <HardDrive className="h-4 w-4 text-emerald-400" />
            ColorOS Linux Sysfs Kernel Nodes (Real-Time State)
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            /sys/class/power_supply &amp; /sys/class/oplus_chg
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 text-[11px]">
                <th className="pb-2 font-medium">Node Path</th>
                <th className="pb-2 font-medium">Description</th>
                <th className="pb-2 font-medium">Current Value</th>
                <th className="pb-2 font-medium">SELinux Context</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {sysfsNodes.map((node) => (
                <tr key={node.path} className="hover:bg-white/[0.02]">
                  <td className="py-2 pr-3 text-emerald-400 font-bold truncate max-w-[280px]">
                    {node.path}
                  </td>
                  <td className="py-2 pr-3 text-slate-400 text-[11px] font-sans">
                    {node.description}
                  </td>
                  <td className="py-2 pr-3">
                    <span className="rounded bg-black/40 px-2 py-0.5 text-white font-bold">
                      {node.currentValue} {node.unit}
                    </span>
                  </td>
                  <td className="py-2 text-[10px] text-slate-500 truncate max-w-[200px]">
                    {node.selinuxContext}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
