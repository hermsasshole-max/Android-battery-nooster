export type ExecutionMode = 
  | 'ROOT' 
  | 'SHIZUKU_SYSFS' 
  | 'SHIZUKU_ADB_FALLBACK' 
  | 'RESTRICTED';

export interface BatteryHardwareMetrics {
  percentage: number;
  voltageMv: number;
  currentMa: number;
  temperatureCelsius: number;
  isCharging: boolean;
  isPlugged: boolean;
  isThrottled: boolean;
  activeCurrentNode: string;
  activeVoltageNode: string;
  activeSwitchNode: string;
  executionMode: ExecutionMode;
}

export interface ShellLogEntry {
  id: string;
  timestamp: string;
  command: string;
  mode: ExecutionMode;
  exitCode: number;
  output: string;
  isError?: boolean;
}

export interface SysfsNodeState {
  path: string;
  description: string;
  currentValue: string;
  unit: string;
  lastUpdated: string;
  writable: boolean;
  selinuxContext: string;
}

export interface LongevityRecommendation {
  id: string;
  title: string;
  description: string;
  impact: 'HIGH' | 'MEDIUM' | 'PREVENTATIVE';
  recommendedCurrentLimitMa?: number;
  recommendedVoltageLimitMv?: number;
}

export interface ChargingSession {
  id: string;
  startTime: string;
  durationMinutes: number;
  startPercentage: number;
  endPercentage: number;
  deltaPercentage: number;
  avgCurrentMa: number;
  peakCurrentMa: number;
  avgVoltageMv: number;
  peakVoltageMv: number;
  maxTemperatureCelsius: number;
  avgTemperatureCelsius: number;
  timeSpentAbove40CelsiusMinutes: number;
  timeSpentAbove43CelsiusMinutes: number;
  timeAtFullChargeMinutes: number;
  estimatedEnergyMah: number;
  chargerProtocol: string;
}

export interface BatteryHealthReport {
  healthPercentage: number;
  estimatedCapacityMah: number;
  designCapacityMah: number;
  cycleCountEquivalent: number;
  totalSessionsLogged: number;
  totalTimeAtFullChargeHours: number;
  peakEverTemperatureCelsius: number;
  thermalStressIndex: number;
  recommendations: LongevityRecommendation[];
}

export interface AndroidSourceFile {
  id: string;
  filename: string;
  path: string;
  language: 'kotlin' | 'xml' | 'gradle' | 'json' | 'yaml';
  category: 'Configuration' | 'Core Engine' | 'Service & HAL' | 'UI / Compose' | 'Analytics & Health' | 'CI/CD Workflow';
  description: string;
  content: string;
}
