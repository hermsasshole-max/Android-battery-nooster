import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  Terminal, 
  FileCode, 
  BookOpen, 
  Cpu, 
  ShieldCheck, 
  BatteryCharging, 
  Zap, 
  Flame, 
  Heart,
  ExternalLink,
  Layers,
  Sparkles,
  GitBranch
} from 'lucide-react';
import { DeviceSimulator } from './components/DeviceSimulator';
import { KernelHardwarePanel } from './components/KernelHardwarePanel';
import { ShellTerminal } from './components/ShellTerminal';
import { CodeInspector } from './components/CodeInspector';
import { ArchitectureGuide } from './components/ArchitectureGuide';
import { HealthAnalyticsPanel } from './components/HealthAnalyticsPanel';
import { 
  ExecutionMode, 
  BatteryHardwareMetrics, 
  ShellLogEntry, 
  SysfsNodeState,
  ChargingSession,
  BatteryHealthReport,
  LongevityRecommendation
} from './types/charging';

export default function App() {
  const [activeTab, setActiveTab] = useState<'DEVICE' | 'HEALTH' | 'TESTBED' | 'TERMINAL' | 'CODE' | 'GUIDE'>('DEVICE');

  // Simulation State
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('ROOT');
  const [targetCurrentMa, setTargetCurrentMa] = useState<number>(1500);
  const [targetVoltageMv, setTargetVoltageMv] = useState<number>(4200);
  const [chargerType, setChargerType] = useState<'VOOC_80W' | 'USB_PD_18W' | 'UNPLUGGED'>('VOOC_80W');
  const [temperature, setTemperature] = useState<number>(33.5);
  const [isChargingEnabled, setIsChargingEnabled] = useState<boolean>(true);
  const [isSelinuxEnforcing, setIsSelinuxEnforcing] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string | null>('Hardware daemon online');
  
  const [daemonTicks, setDaemonTicks] = useState<number>(1);
  const [overrideCatches, setOverrideCatches] = useState<number>(0);
  const [batteryPercentage, setBatteryPercentage] = useState<number>(68);

  // Initial historical sessions representing ColorOS usage
  const [sessions, setSessions] = useState<ChargingSession[]>([
    {
      id: 'sess-1',
      startTime: 'Yesterday, 14:20',
      durationMinutes: 42,
      startPercentage: 15,
      endPercentage: 85,
      deltaPercentage: 70,
      avgCurrentMa: 1950,
      peakCurrentMa: 2650,
      avgVoltageMv: 4180,
      peakVoltageMv: 4350,
      maxTemperatureCelsius: 38.4,
      avgTemperatureCelsius: 34.6,
      timeSpentAbove40CelsiusMinutes: 0,
      timeSpentAbove43CelsiusMinutes: 0,
      timeAtFullChargeMinutes: 0,
      estimatedEnergyMah: 3450,
      chargerProtocol: 'VOOC_FLASH',
    },
    {
      id: 'sess-2',
      startTime: '2 days ago, 23:10',
      durationMinutes: 480,
      startPercentage: 22,
      endPercentage: 100,
      deltaPercentage: 78,
      avgCurrentMa: 1100,
      peakCurrentMa: 2200,
      avgVoltageMv: 4320,
      peakVoltageMv: 4430,
      maxTemperatureCelsius: 41.2,
      avgTemperatureCelsius: 35.1,
      timeSpentAbove40CelsiusMinutes: 16,
      timeSpentAbove43CelsiusMinutes: 0,
      timeAtFullChargeMinutes: 285, // Saturated overnight at 100%
      estimatedEnergyMah: 3850,
      chargerProtocol: 'STANDARD',
    },
    {
      id: 'sess-3',
      startTime: '4 days ago, 09:15',
      durationMinutes: 34,
      startPercentage: 18,
      endPercentage: 80,
      deltaPercentage: 62,
      avgCurrentMa: 2450,
      peakCurrentMa: 2950,
      avgVoltageMv: 4210,
      peakVoltageMv: 4390,
      maxTemperatureCelsius: 43.6, // Overheat event
      avgTemperatureCelsius: 39.4,
      timeSpentAbove40CelsiusMinutes: 12,
      timeSpentAbove43CelsiusMinutes: 5,
      timeAtFullChargeMinutes: 0,
      estimatedEnergyMah: 3100,
      chargerProtocol: 'VOOC_FLASH',
    },
  ]);

  // Compute live battery health report from sessions
  const computeHealthReport = (sessList: ChargingSession[]): BatteryHealthReport => {
    const totalDeltaPct = sessList.reduce((acc, s) => acc + s.deltaPercentage, 0);
    const cycleCount = Number((totalDeltaPct / 100).toFixed(1));
    const totalSaturationMinutes = sessList.reduce((acc, s) => acc + s.timeAtFullChargeMinutes, 0);
    const totalSaturationHours = Number((totalSaturationMinutes / 60).toFixed(1));
    const peakTempEver = sessList.length > 0 ? Math.max(...sessList.map((s) => s.maxTemperatureCelsius)) : 33.5;
    const minutesAbove40 = sessList.reduce((acc, s) => acc + s.timeSpentAbove40CelsiusMinutes, 0);
    const minutesAbove43 = sessList.reduce((acc, s) => acc + s.timeSpentAbove43CelsiusMinutes, 0);

    // Degradation math
    const cycleWear = cycleCount * 0.025;
    const saturationWear = (totalSaturationHours / 10) * 0.05;
    const thermalWear = (minutesAbove40 / 30) * 0.01 + (minutesAbove43 / 10) * 0.03;
    const fastChargeSessions = sessList.filter((s) => s.peakCurrentMa > 2400).length;
    const fastChargeWear = fastChargeSessions * 0.015;

    const totalDegradation = cycleWear + saturationWear + thermalWear + fastChargeWear;
    const healthPercentage = Number(Math.max(75, Math.min(100, 100 - totalDegradation)).toFixed(1));
    const estimatedCapacityMah = Math.round(5000 * (healthPercentage / 100));

    // Recommendations generator
    const recommendations: LongevityRecommendation[] = [];

    if (totalSaturationHours > 1.5) {
      recommendations.push({
        id: 'rec-sat',
        title: 'Limit High-Voltage Float Saturation',
        description: `Your device spent ${totalSaturationHours} hours resting plugged at 100%. Capping the voltage cutoff to 4.20V (approx 80-85% charge) prevents electrolyte oxidation and doubles battery lifespan.`,
        impact: 'HIGH',
        recommendedVoltageLimitMv: 4200,
      });
    }

    if (peakTempEver >= 42.0 || minutesAbove43 > 0) {
      recommendations.push({
        id: 'rec-thermal',
        title: 'Throttle Fast-Charge During High Ambient Temps',
        description: `Cell temperature peaked at ${peakTempEver.toFixed(1)}°C. Lowering current limit to 1500 mA keeps thermal stress safely below the 40°C threshold.`,
        impact: 'HIGH',
        recommendedCurrentLimitMa: 1500,
      });
    } else {
      recommendations.push({
        id: 'rec-current',
        title: 'Adopt Gentle 1500 mA Daily Charging',
        description: 'Limiting sustained charging current to 1500 mA significantly reduces thermal wear and SEI layer stress on high-capacity cells.',
        impact: 'MEDIUM',
        recommendedCurrentLimitMa: 1500,
      });
    }

    recommendations.push({
      id: 'rec-cycle',
      title: 'Maintain 20% - 80% Cycling Window',
      description: 'Li-ion dual-cells experience the least mechanical expansion stress when cycled between 20% and 80% state of charge.',
      impact: 'PREVENTATIVE',
    });

    return {
      healthPercentage,
      estimatedCapacityMah,
      designCapacityMah: 5000,
      cycleCountEquivalent: cycleCount,
      totalSessionsLogged: sessList.length,
      totalTimeAtFullChargeHours: totalSaturationHours,
      peakEverTemperatureCelsius: peakTempEver,
      thermalStressIndex: Math.min(1.0, (minutesAbove40 + minutesAbove43 * 3) / 120),
      recommendations,
    };
  };

  const [healthReport, setHealthReport] = useState<BatteryHealthReport>(() => computeHealthReport(sessions));

  const [shellLogs, setShellLogs] = useState<ShellLogEntry[]>([
    {
      id: 'init-1',
      timestamp: '18:46:12.304',
      command: 'su -c "id"',
      mode: 'ROOT',
      exitCode: 0,
      output: 'uid=0(root) gid=0(root) groups=0(root) context=u:r:su:s0'
    },
    {
      id: 'init-2',
      timestamp: '18:46:12.418',
      command: 'cat /sys/class/power_supply/battery/current_max',
      mode: 'ROOT',
      exitCode: 0,
      output: '1500000'
    },
    {
      id: 'init-3',
      timestamp: '18:46:12.510',
      command: 'cat /sys/class/power_supply/battery/voltage_max',
      mode: 'ROOT',
      exitCode: 0,
      output: '4200000'
    }
  ]);

  const addShellLog = (cmd: string, mode: ExecutionMode, exitCode: number, output: string, isError = false) => {
    const now = new Date();
    const timeStr = `${now.toTimeString().split(' ')[0]}.${String(now.getMilliseconds()).padStart(3, '0')}`;
    const newEntry: ShellLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: timeStr,
      command: cmd,
      mode,
      exitCode,
      output,
      isError,
    };
    setShellLogs((prev) => [newEntry, ...prev.slice(0, 99)]);
  };

  // Active sysfs nodes state table
  const sysfsNodes: SysfsNodeState[] = [
    {
      path: '/sys/class/power_supply/battery/current_max',
      description: 'Primary hardware charge current cap (uA)',
      currentValue: `${targetCurrentMa * 1000}`,
      unit: 'uA',
      lastUpdated: '18:46:31',
      writable: executionMode === 'ROOT' || (executionMode === 'SHIZUKU_SYSFS' && !isSelinuxEnforcing),
      selinuxContext: 'u:object_r:sysfs_batteryinfo:s0',
    },
    {
      path: '/sys/class/power_supply/battery/constant_charge_current_max',
      description: 'Secondary constant current driver stage',
      currentValue: `${targetCurrentMa * 1000}`,
      unit: 'uA',
      lastUpdated: '18:46:31',
      writable: executionMode === 'ROOT',
      selinuxContext: 'u:object_r:sysfs_batteryinfo:s0',
    },
    {
      path: '/sys/class/power_supply/battery/voltage_max',
      description: 'Battery termination cutoff voltage (uV)',
      currentValue: `${targetVoltageMv * 1000}`,
      unit: 'uV',
      lastUpdated: '18:46:31',
      writable: executionMode === 'ROOT' || (executionMode === 'SHIZUKU_SYSFS' && !isSelinuxEnforcing),
      selinuxContext: 'u:object_r:sysfs_batteryinfo:s0',
    },
    {
      path: '/sys/class/power_supply/battery/charging_enabled',
      description: 'Physical hardware battery circuit isolation switch',
      currentValue: isChargingEnabled ? '1' : '0',
      unit: 'binary',
      lastUpdated: '18:46:31',
      writable: executionMode === 'ROOT' || (executionMode === 'SHIZUKU_SYSFS' && !isSelinuxEnforcing),
      selinuxContext: 'u:object_r:sysfs_batteryinfo:s0',
    },
    {
      path: '/sys/class/oplus_chg/battery/mmi_charging_enabled',
      description: 'Oppo ColorOS factory MMI charging switch',
      currentValue: isChargingEnabled ? '1' : '0',
      unit: 'binary',
      lastUpdated: '18:46:31',
      writable: executionMode === 'ROOT',
      selinuxContext: 'u:object_r:sysfs_oplus_chg:s0',
    },
  ];

  const isOverheated = temperature >= 43.0;
  const isPlugged = chargerType !== 'UNPLUGGED';
  const effectiveCurrent = isOverheated ? 500 : (!isChargingEnabled || !isPlugged ? 0 : targetCurrentMa);

  const metrics: BatteryHardwareMetrics = {
    percentage: batteryPercentage,
    voltageMv: isPlugged ? Math.min(targetVoltageMv, 3950 + Math.round((batteryPercentage / 100) * 350)) : 3850,
    currentMa: effectiveCurrent,
    temperatureCelsius: temperature,
    isCharging: isPlugged && isChargingEnabled && !isOverheated,
    isPlugged,
    isThrottled: isOverheated,
    activeCurrentNode: '/sys/class/power_supply/battery/current_max',
    activeVoltageNode: '/sys/class/power_supply/battery/voltage_max',
    activeSwitchNode: '/sys/class/power_supply/battery/charging_enabled',
    executionMode,
  };

  // 3-Second Foreground Watchdog Daemon Loop
  useEffect(() => {
    const interval = setInterval(() => {
      setDaemonTicks((t) => t + 1);

      // Thermal watchdog enforcement
      if (temperature >= 43.0) {
        if (targetCurrentMa > 500) {
          setTargetCurrentMa(500);
          addShellLog(
            'echo 500000 > /sys/class/power_supply/battery/current_max',
            executionMode,
            0,
            '[ChargingMonitorService] AUTOMATIC THERMAL THROTTLE: Cell >= 43°C! Dropped to 500mA.'
          );
        }
      } else if (chargerType === 'VOOC_80W' && isPlugged) {
        // Simulate ColorOS VOOC kernel override attempt every few ticks
        const roll = Math.random();
        if (roll < 0.25) {
          setOverrideCatches((c) => c + 1);
          addShellLog(
            `echo ${targetCurrentMa * 1000} > /sys/class/power_supply/battery/current_max`,
            executionMode,
            0,
            `[ChargingMonitorService 3s Tick] KERNEL OVERRIDE DETECTED: VOOC handshake attempted reset. User limit (${targetCurrentMa}mA) re-asserted.`
          );
        }
      }

      // Battery slow tick simulation
      if (isPlugged && isChargingEnabled && !isOverheated) {
        setBatteryPercentage((prev) => (prev < 100 ? prev + 1 : 100));
      } else if (!isPlugged) {
        setBatteryPercentage((prev) => (prev > 5 ? prev - 1 : 5));
      }

    }, 3000);

    return () => clearInterval(interval);
  }, [temperature, chargerType, isPlugged, isChargingEnabled, targetCurrentMa, executionMode]);

  // Handle Apply Limits
  const handleApplyLimits = (cur = targetCurrentMa, volt = targetVoltageMv) => {
    const clampedMa = Math.min(3000, Math.max(500, cur));
    const clampedMv = Math.min(4450, Math.max(4000, volt));

    if (executionMode === 'ROOT') {
      addShellLog(`echo ${clampedMa * 1000} > /sys/class/power_supply/battery/current_max`, 'ROOT', 0, `Current limit set to ${clampedMa} mA`);
      addShellLog(`echo ${clampedMv * 1000} > /sys/class/power_supply/battery/voltage_max`, 'ROOT', 0, `Voltage cutoff set to ${clampedMv} mV`);
      addShellLog('echo 1 > /sys/class/power_supply/battery/charging_enabled', 'ROOT', 0, 'Charging switch enabled (1)');
      setIsChargingEnabled(true);
      setStatusMessage(`Applied ${clampedMa}mA & ${clampedMv}mV via LibSu root`);
    } else if (executionMode === 'SHIZUKU_SYSFS') {
      if (isSelinuxEnforcing) {
        addShellLog(`echo ${clampedMa * 1000} > /sys/class/power_supply/battery/current_max`, 'SHIZUKU_SYSFS', 1, 'sh: write error: Permission denied (SELinux avc: denied)', true);
        setExecutionMode('SHIZUKU_ADB_FALLBACK');
        addShellLog('dumpsys battery reset', 'SHIZUKU_ADB_FALLBACK', 0, '[Fallback] Dispatched dumpsys battery reset');
        setStatusMessage('SELinux enforced: Fallback to ADB dumpsys');
      } else {
        addShellLog(`echo ${clampedMa * 1000} > /sys/class/power_supply/battery/current_max`, 'SHIZUKU_SYSFS', 0, `Shizuku binder executed: ${clampedMa} mA`);
        setIsChargingEnabled(true);
        setStatusMessage(`Applied ${clampedMa}mA via Shizuku binder`);
      }
    } else if (executionMode === 'SHIZUKU_ADB_FALLBACK') {
      addShellLog('dumpsys battery reset', 'SHIZUKU_ADB_FALLBACK', 0, 'dumpsys battery reset (framework sync)');
      setIsChargingEnabled(true);
      setStatusMessage('ADB Emulation applied (dumpsys battery)');
    } else {
      addShellLog(`echo ${clampedMa * 1000} > /sys/class/power_supply/battery/current_max`, 'RESTRICTED', 1, 'Permission denied (read-only)', true);
      setStatusMessage('Error: Restricted mode (Read-Only)');
    }
  };

  const handleResetDefaults = () => {
    setTargetCurrentMa(1500);
    setTargetVoltageMv(4200);
    setIsChargingEnabled(true);

    if (executionMode === 'ROOT') {
      addShellLog('echo 1500000 > /sys/class/power_supply/battery/current_max', 'ROOT', 0, 'Reset current to 1500 mA');
      addShellLog('echo 4200000 > /sys/class/power_supply/battery/voltage_max', 'ROOT', 0, 'Reset voltage to 4200 mV');
    }
    setStatusMessage('Reset to ColorOS default limits (1500mA / 4.20V)');
  };

  const handleEmergencyStop = () => {
    setIsChargingEnabled(false);
    if (executionMode === 'ROOT') {
      addShellLog('echo 0 > /sys/class/power_supply/battery/charging_enabled', 'ROOT', 0, '[EMERGENCY STOP] Isolated battery circuit (0)');
    } else {
      addShellLog('dumpsys battery set ac 0 && dumpsys battery set usb 0', 'SHIZUKU_ADB_FALLBACK', 0, '[EMERGENCY STOP] Disconnected charging via dumpsys');
    }
    setStatusMessage('EMERGENCY CUTOFF: Charging circuit opened');
  };

  const handleRequestShizuku = () => {
    setExecutionMode('SHIZUKU_SYSFS');
    addShellLog('Shizuku.requestPermission(4001)', 'SHIZUKU_SYSFS', 0, 'Shizuku binder permission granted: UID 2000 (shell)');
    setStatusMessage('Shizuku binder authenticated');
  };

  const handleManualCommand = (cmd: string) => {
    if (cmd.startsWith('cat')) {
      const path = cmd.split(' ')[1] || '';
      const matchedNode = sysfsNodes.find((n) => n.path === path);
      const output = matchedNode ? matchedNode.currentValue : '1500000';
      addShellLog(cmd, executionMode, 0, output);
    } else if (cmd.includes('dumpsys battery')) {
      addShellLog(cmd, 'SHIZUKU_ADB_FALLBACK', 0, 'Battery Service state synchronized');
    } else {
      addShellLog(cmd, executionMode, 0, 'Command executed successfully');
    }
  };

  // Scenario Simulator
  const handleSimulateSession = (type: 'OVERNIGHT_100' | 'HOT_VOOC' | 'GENTLE_CYCLE') => {
    let newSess: ChargingSession;
    if (type === 'OVERNIGHT_100') {
      newSess = {
        id: `sess-${Date.now()}`,
        startTime: 'Just now (Simulated)',
        durationMinutes: 480,
        startPercentage: 30,
        endPercentage: 100,
        deltaPercentage: 70,
        avgCurrentMa: 1200,
        peakCurrentMa: 2100,
        avgVoltageMv: 4320,
        peakVoltageMv: 4420,
        maxTemperatureCelsius: 39.5,
        avgTemperatureCelsius: 34.0,
        timeSpentAbove40CelsiusMinutes: 0,
        timeSpentAbove43CelsiusMinutes: 0,
        timeAtFullChargeMinutes: 300, // 5 hours saturation
        estimatedEnergyMah: 3500,
        chargerProtocol: 'STANDARD',
      };
      addShellLog('BatteryHealthRepository: Logged session with 300m float saturation at 100%', 'ROOT', 0, 'High voltage saturation wear index updated');
    } else if (type === 'HOT_VOOC') {
      newSess = {
        id: `sess-${Date.now()}`,
        startTime: 'Just now (Simulated)',
        durationMinutes: 35,
        startPercentage: 12,
        endPercentage: 82,
        deltaPercentage: 70,
        avgCurrentMa: 2500,
        peakCurrentMa: 2950,
        avgVoltageMv: 4220,
        peakVoltageMv: 4400,
        maxTemperatureCelsius: 43.8,
        avgTemperatureCelsius: 40.2,
        timeSpentAbove40CelsiusMinutes: 18,
        timeSpentAbove43CelsiusMinutes: 6,
        timeAtFullChargeMinutes: 0,
        estimatedEnergyMah: 3500,
        chargerProtocol: 'VOOC_FLASH',
      };
      addShellLog('BatteryHealthRepository: Logged thermal excursion session (peak 43.8°C)', 'ROOT', 0, 'Arrhenius thermal wear penalty applied');
    } else {
      newSess = {
        id: `sess-${Date.now()}`,
        startTime: 'Just now (Simulated)',
        durationMinutes: 45,
        startPercentage: 20,
        endPercentage: 80,
        deltaPercentage: 60,
        avgCurrentMa: 1500,
        peakCurrentMa: 1600,
        avgVoltageMv: 4100,
        peakVoltageMv: 4200,
        maxTemperatureCelsius: 32.8,
        avgTemperatureCelsius: 31.5,
        timeSpentAbove40CelsiusMinutes: 0,
        timeSpentAbove43CelsiusMinutes: 0,
        timeAtFullChargeMinutes: 0,
        estimatedEnergyMah: 3000,
        chargerProtocol: 'USB_PD',
      };
      addShellLog('BatteryHealthRepository: Logged optimal gentle cycle (20-80%)', 'ROOT', 0, 'Clean cycle wear recorded with minimal stress');
    }

    const updated = [newSess, ...sessions];
    setSessions(updated);
    setHealthReport(computeHealthReport(updated));
    setStatusMessage('Added simulated session to health analytics');
  };

  const handleResetSessions = () => {
    setSessions([]);
    setHealthReport(computeHealthReport([]));
    setStatusMessage('Cleared historical sessions log');
  };

  return (
    <div className="min-h-screen bg-[#070a0f] text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
      
      {/* Top Global Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0e16]/95 backdrop-blur-md px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          
          {/* App Branding */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 text-black shadow-lg shadow-emerald-500/20">
              <Zap className="h-5 w-5 font-black fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black tracking-tight text-white">
                  Oppo VOOC Battery Charging Controller
                </h1>
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-400">
                  ColorOS / Android 15
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Staff Systems Architecture &bull; Health Analytics &bull; Root LibSu &bull; Shizuku Binder IPC
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 rounded-xl bg-slate-900/90 border border-white/5 p-1 text-xs overflow-x-auto max-w-full">
            <button
              onClick={() => setActiveTab('DEVICE')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition shrink-0 ${
                activeTab === 'DEVICE'
                  ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>Compose UI &amp; Simulator</span>
            </button>

            <button
              onClick={() => setActiveTab('HEALTH')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition shrink-0 ${
                activeTab === 'HEALTH'
                  ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Heart className="h-3.5 w-3.5 fill-current text-rose-400" />
              <span>Battery Health ({healthReport.healthPercentage}%)</span>
            </button>

            <button
              onClick={() => setActiveTab('TESTBED')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition shrink-0 ${
                activeTab === 'TESTBED'
                  ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Cpu className="h-3.5 w-3.5" />
              <span>Kernel Testbed</span>
            </button>

            <button
              onClick={() => setActiveTab('TERMINAL')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition shrink-0 ${
                activeTab === 'TERMINAL'
                  ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Terminal className="h-3.5 w-3.5" />
              <span>Shell Stream</span>
            </button>

            <button
              onClick={() => setActiveTab('CODE')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition shrink-0 ${
                activeTab === 'CODE'
                  ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileCode className="h-3.5 w-3.5" />
              <span>Source &amp; CI/CD (10)</span>
            </button>

            <button
              onClick={() => setActiveTab('GUIDE')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition shrink-0 ${
                activeTab === 'GUIDE'
                  ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Architecture Guide</span>
            </button>
          </nav>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6">
        
        {/* Tab 1: Interactive Device & Compose UI */}
        {activeTab === 'DEVICE' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left: Device Simulator rendering Compose MainScreen.kt & Health Tab */}
            <div className="lg:col-span-5 flex justify-center">
              <DeviceSimulator
                metrics={metrics}
                executionMode={executionMode}
                targetCurrentMa={targetCurrentMa}
                targetVoltageMv={targetVoltageMv}
                onCurrentChange={setTargetCurrentMa}
                onVoltageChange={setTargetVoltageMv}
                onApplyLimits={() => handleApplyLimits(targetCurrentMa, targetVoltageMv)}
                onResetDefaults={handleResetDefaults}
                onEmergencyStop={handleEmergencyStop}
                onRequestShizuku={handleRequestShizuku}
                statusMessage={statusMessage}
                healthReport={healthReport}
                sessions={sessions}
                onApplyRecommendation={(cur, volt) => {
                  if (cur) setTargetCurrentMa(cur);
                  if (volt) setTargetVoltageMv(volt);
                  handleApplyLimits(cur || targetCurrentMa, volt || targetVoltageMv);
                }}
              />
            </div>

            {/* Right: Diagnostics & Quick Controls */}
            <div className="lg:col-span-7 space-y-5">
              
              {/* Quick Telemetry & Health Badge Card */}
              <div className="rounded-2xl border border-white/10 bg-[#0f141f] p-5 shadow-xl">
                <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
                  <div>
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-emerald-400" />
                      Live Android Systems Architect Diagnostics
                    </h2>
                    <p className="text-xs text-slate-400">
                      Real-time observation of battery degradation index and 3s watchdog
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
                      Tick #{daemonTicks} (3s loop)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-xl bg-slate-900/70 border border-white/5 p-3">
                    <span className="text-slate-500 text-[10px] block">Health Estimation</span>
                    <span className="font-bold text-emerald-400 font-mono mt-0.5 block truncate">
                      {healthReport.healthPercentage}% ({healthReport.estimatedCapacityMah} mAh)
                    </span>
                  </div>
                  <div className="rounded-xl bg-slate-900/70 border border-white/5 p-3">
                    <span className="text-slate-500 text-[10px] block">Equivalent Cycles</span>
                    <span className="font-bold text-cyan-400 font-mono mt-0.5 block">
                      {healthReport.cycleCountEquivalent} EFC
                    </span>
                  </div>
                  <div className="rounded-xl bg-slate-900/70 border border-white/5 p-3">
                    <span className="text-slate-500 text-[10px] block">Time @ 100% (Float)</span>
                    <span className="font-bold text-amber-400 font-mono mt-0.5 block">
                      {healthReport.totalTimeAtFullChargeHours} hrs
                    </span>
                  </div>
                  <div className="rounded-xl bg-slate-900/70 border border-white/5 p-3">
                    <span className="text-slate-500 text-[10px] block">VOOC Overrides Blocked</span>
                    <span className="font-bold text-cyan-400 font-mono mt-0.5 block">
                      {overrideCatches} re-asserts
                    </span>
                  </div>
                </div>
              </div>

              {/* Side-by-side Kernel Control Panel */}
              <KernelHardwarePanel
                executionMode={executionMode}
                onSetExecutionMode={setExecutionMode}
                isPlugged={isPlugged}
                chargerType={chargerType}
                onSetChargerType={setChargerType}
                temperature={temperature}
                onSetTemperature={setTemperature}
                daemonTicks={daemonTicks}
                overrideCatches={overrideCatches}
                sysfsNodes={sysfsNodes}
                isSelinuxEnforcing={isSelinuxEnforcing}
                onToggleSelinux={() => setIsSelinuxEnforcing((s) => !s)}
              />

              {/* Real-time Shell Log Mini Stream */}
              <ShellTerminal
                logs={shellLogs}
                onClearLogs={() => setShellLogs([])}
                onExecuteManualCommand={handleManualCommand}
              />

            </div>

          </div>
        )}

        {/* Tab 2: Battery Health & Longevity Analytics */}
        {activeTab === 'HEALTH' && (
          <HealthAnalyticsPanel
            report={healthReport}
            sessions={sessions}
            activeSession={null}
            onApplyRecommendation={(cur, volt) => {
              if (cur) setTargetCurrentMa(cur);
              if (volt) setTargetVoltageMv(volt);
              handleApplyLimits(cur || targetCurrentMa, volt || targetVoltageMv);
              setActiveTab('DEVICE');
            }}
            onSimulateSession={handleSimulateSession}
            onResetSessions={handleResetSessions}
          />
        )}

        {/* Tab 3: Full-Width Kernel Testbed */}
        {activeTab === 'TESTBED' && (
          <div className="space-y-6">
            <KernelHardwarePanel
              executionMode={executionMode}
              onSetExecutionMode={setExecutionMode}
              isPlugged={isPlugged}
              chargerType={chargerType}
              onSetChargerType={setChargerType}
              temperature={temperature}
              onSetTemperature={setTemperature}
              daemonTicks={daemonTicks}
              overrideCatches={overrideCatches}
              sysfsNodes={sysfsNodes}
              isSelinuxEnforcing={isSelinuxEnforcing}
              onToggleSelinux={() => setIsSelinuxEnforcing((s) => !s)}
            />
          </div>
        )}

        {/* Tab 4: Shell Terminal */}
        {activeTab === 'TERMINAL' && (
          <div className="space-y-4">
            <ShellTerminal
              logs={shellLogs}
              onClearLogs={() => setShellLogs([])}
              onExecuteManualCommand={handleManualCommand}
            />
          </div>
        )}

        {/* Tab 5: Full Codebase Inspector & CI/CD */}
        {activeTab === 'CODE' && (
          <div>
            <CodeInspector />
          </div>
        )}

        {/* Tab 6: Architecture Guide */}
        {activeTab === 'GUIDE' && (
          <div>
            <ArchitectureGuide />
          </div>
        )}

      </main>

      {/* Footer with GitHub Actions indicator */}
      <footer className="border-t border-white/5 bg-[#080b11] py-4 px-6 text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Oppo VOOC Battery Charging Controller &bull; Built with Kotlin, Jetpack Compose, Material 3</span>
          <span className="flex items-center gap-1.5 text-emerald-400">
            <GitBranch className="h-3.5 w-3.5" />
            <span>CI/CD: .github/workflows/build-debug-apk.yml (Ready for GitHub Actions)</span>
          </span>
        </div>
      </footer>

    </div>
  );
}
