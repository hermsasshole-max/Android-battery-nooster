import React from 'react';
import { 
  Heart, 
  BatteryCharging, 
  Flame, 
  Clock, 
  Lightbulb, 
  ArrowUpRight, 
  AlertTriangle, 
  History, 
  Zap, 
  Plus, 
  RotateCcw,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { BatteryHealthReport, ChargingSession } from '../types/charging';

interface HealthAnalyticsPanelProps {
  report: BatteryHealthReport;
  sessions: ChargingSession[];
  activeSession: ChargingSession | null;
  onApplyRecommendation: (currentLimitMa?: number, voltageLimitMv?: number) => void;
  onSimulateSession: (type: 'OVERNIGHT_100' | 'HOT_VOOC' | 'GENTLE_CYCLE') => void;
  onResetSessions: () => void;
}

export const HealthAnalyticsPanel: React.FC<HealthAnalyticsPanelProps> = ({
  report,
  sessions,
  activeSession,
  onApplyRecommendation,
  onSimulateSession,
  onResetSessions,
}) => {
  const strokeDashoffset = 251.2 - (251.2 * report.healthPercentage) / 100;

  return (
    <div className="space-y-6">
      
      {/* Top Hero Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Main Health % Circular Gauge Card */}
        <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-gradient-to-br from-[#101723] to-[#0a0f18] p-6 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400">
                <Heart className="h-5 w-5 fill-current" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-wide">
                  Oppo Dual-Cell Battery Health Estimation
                </h2>
                <p className="text-xs text-slate-400">
                  Electrochemical degradation modeled from cycle wear, float saturation &amp; thermal index
                </p>
              </div>
            </div>
            <span className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-xs font-mono font-bold text-emerald-400">
              5,000 mAh Nominal
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6 py-4">
            {/* Circular Gauge */}
            <div className="relative h-32 w-32 shrink-0 flex items-center justify-center">
              <svg className="h-32 w-32 -rotate-90 transform">
                <circle
                  cx="64"
                  cy="64"
                  r="52"
                  stroke="currentColor"
                  strokeWidth="10"
                  className="text-slate-800"
                  fill="transparent"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="52"
                  stroke="currentColor"
                  strokeWidth="10"
                  strokeDasharray="326.7"
                  strokeDashoffset={326.7 - (326.7 * report.healthPercentage) / 100}
                  strokeLinecap="round"
                  className={`transition-all duration-1000 ${
                    report.healthPercentage >= 90
                      ? 'text-emerald-400'
                      : report.healthPercentage >= 80
                      ? 'text-amber-400'
                      : 'text-rose-500'
                  }`}
                  fill="transparent"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-mono text-3xl font-black text-white">
                  {report.healthPercentage}%
                </span>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  State of Health
                </span>
              </div>
            </div>

            {/* Metrics Breakdown Grid */}
            <div className="flex-1 grid grid-cols-2 gap-3 text-xs w-full">
              <div className="rounded-xl bg-slate-900/60 border border-white/5 p-3">
                <span className="text-slate-400 text-[10px] block">Estimated Capacity</span>
                <span className="font-mono text-sm font-bold text-emerald-400 mt-0.5 block">
                  {report.estimatedCapacityMah} mAh
                </span>
                <span className="text-[10px] text-slate-500">Design: {report.designCapacityMah} mAh</span>
              </div>

              <div className="rounded-xl bg-slate-900/60 border border-white/5 p-3">
                <span className="text-slate-400 text-[10px] block">Equivalent Cycles (EFC)</span>
                <span className="font-mono text-sm font-bold text-cyan-400 mt-0.5 block">
                  {report.cycleCountEquivalent} cycles
                </span>
                <span className="text-[10px] text-slate-500">Across {report.totalSessionsLogged} sessions</span>
              </div>

              <div className="rounded-xl bg-slate-900/60 border border-white/5 p-3">
                <span className="text-slate-400 text-[10px] block">High-Voltage Float Saturation</span>
                <span className="font-mono text-sm font-bold text-amber-400 mt-0.5 block">
                  {report.totalTimeAtFullChargeHours} hrs @ 100%
                </span>
                <span className="text-[10px] text-slate-500">Electrolyte oxidation stress</span>
              </div>

              <div className="rounded-xl bg-slate-900/60 border border-white/5 p-3">
                <span className="text-slate-400 text-[10px] block">Peak Temperature Ever</span>
                <span className={`font-mono text-sm font-bold mt-0.5 block ${report.peakEverTemperatureCelsius >= 43 ? 'text-rose-400' : 'text-slate-200'}`}>
                  {report.peakEverTemperatureCelsius}°C
                </span>
                <span className="text-[10px] text-slate-500">
                  {report.peakEverTemperatureCelsius >= 43 ? 'Thermal safeguard tripped' : 'Within normal bounds'}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-black/40 border border-white/5 p-2.5 text-[11px] text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>Cell Health Grade: <strong>{report.healthPercentage >= 90 ? 'Excellent' : report.healthPercentage >= 80 ? 'Good' : 'Degraded'}</strong></span>
            </span>
            <span className="font-mono text-slate-400 text-[10px]">Thermal Stress Index: {(report.thermalStressIndex * 100).toFixed(0)}%</span>
          </div>
        </div>

        {/* Interactive Scenario Injector */}
        <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-[#0f141f] p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Zap className="h-4 w-4 text-cyan-400" />
                Session Simulator &amp; Stress Injector
              </h3>
              <button
                onClick={onResetSessions}
                className="text-[10px] flex items-center gap-1 text-slate-400 hover:text-white transition"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Inject real-world scenarios to observe electrochemical degradation math and recommendation updates in real time:
            </p>

            <div className="space-y-2">
              <button
                onClick={() => onSimulateSession('OVERNIGHT_100')}
                className="w-full text-left rounded-xl border border-amber-500/20 bg-amber-950/20 hover:bg-amber-950/40 p-3 text-xs transition"
              >
                <div className="flex items-center justify-between font-bold text-amber-300">
                  <span>Overnight Overcharge Session</span>
                  <span className="text-[10px] font-mono text-amber-400">+5h @ 100% Saturation</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Simulates device left on charger for 8 hours with 5 hours at 100% (high float wear).
                </p>
              </button>

              <button
                onClick={() => onSimulateSession('HOT_VOOC')}
                className="w-full text-left rounded-xl border border-rose-500/20 bg-rose-950/20 hover:bg-rose-950/40 p-3 text-xs transition"
              >
                <div className="flex items-center justify-between font-bold text-rose-300">
                  <span>Hot High-Wattage VOOC Session</span>
                  <span className="text-[10px] font-mono text-rose-400">Peak 43.8°C / 2900mA</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Simulates rapid fast charge with elevated ambient temperature, tripping thermal penalties.
                </p>
              </button>

              <button
                onClick={() => onSimulateSession('GENTLE_CYCLE')}
                className="w-full text-left rounded-xl border border-emerald-500/20 bg-emerald-950/20 hover:bg-emerald-950/40 p-3 text-xs transition"
              >
                <div className="flex items-center justify-between font-bold text-emerald-300">
                  <span>Gentle 20% &rarr; 80% Healthy Cycle</span>
                  <span className="text-[10px] font-mono text-emerald-400">Cool 32.5°C / 1500mA</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Ideal cycling practice with minimal mechanical cell expansion and zero float stress.
                </p>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Longevity Recommendations Section */}
      <div className="rounded-2xl border border-white/10 bg-[#0f141f] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-400" />
          <div>
            <h3 className="text-sm font-bold text-white">Actionable Longevity Recommendations</h3>
            <p className="text-xs text-slate-400">Generated from your logged charging habits and thermal history</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {report.recommendations.map((rec) => {
            const isHigh = rec.impact === 'HIGH';
            const isMedium = rec.impact === 'MEDIUM';

            return (
              <div
                key={rec.id}
                className="rounded-xl border border-white/5 bg-slate-900/60 p-4 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-100">{rec.title}</span>
                    <span
                      className={`text-[9px] font-mono font-bold rounded px-1.5 py-0.5 ${
                        isHigh
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : isMedium
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {rec.impact}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                    {rec.description}
                  </p>
                </div>

                {(rec.recommendedCurrentLimitMa || rec.recommendedVoltageLimitMv) && (
                  <button
                    onClick={() => onApplyRecommendation(rec.recommendedCurrentLimitMa, rec.recommendedVoltageLimitMv)}
                    className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 hover:text-black border border-emerald-500/30 text-emerald-300 py-1.5 text-xs font-bold transition"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    <span>
                      Apply Safe Limits ({rec.recommendedCurrentLimitMa || 'keep'}mA / {rec.recommendedVoltageLimitMv || 'keep'}mV)
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Charging Sessions History Table */}
      <div className="rounded-2xl border border-white/10 bg-[#0f141f] p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">
              Charging Sessions History Log ({sessions.length} recorded)
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Automatically captured by ChargingMonitorService
          </span>
        </div>

        {sessions.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            No charging sessions recorded yet. Plug in device or click a simulation scenario above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 text-[11px]">
                  <th className="pb-2 font-medium">Timestamp</th>
                  <th className="pb-2 font-medium">Charge Delta</th>
                  <th className="pb-2 font-medium">Duration</th>
                  <th className="pb-2 font-medium">Current (Avg / Peak)</th>
                  <th className="pb-2 font-medium">Max Temp</th>
                  <th className="pb-2 font-medium">Time @ 100%</th>
                  <th className="pb-2 font-medium">Protocol</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {sessions.map((s) => {
                  const isHot = s.maxTemperatureCelsius >= 43;
                  const isLongSat = s.timeAtFullChargeMinutes > 30;

                  return (
                    <tr key={s.id} className="hover:bg-white/[0.02]">
                      <td className="py-2.5 text-slate-400 font-sans text-[11px]">
                        {s.startTime}
                      </td>
                      <td className="py-2.5 font-bold text-white">
                        {s.startPercentage}% &rarr; {s.endPercentage}% (+{s.deltaPercentage}%)
                      </td>
                      <td className="py-2.5 text-slate-300">
                        {s.durationMinutes} min
                      </td>
                      <td className="py-2.5 text-emerald-400">
                        {s.avgCurrentMa} / {s.peakCurrentMa} mA
                      </td>
                      <td className="py-2.5">
                        <span className={`inline-flex items-center gap-1 font-bold ${isHot ? 'text-rose-400' : 'text-slate-300'}`}>
                          {isHot && <AlertTriangle className="h-3 w-3" />}
                          {s.maxTemperatureCelsius}°C
                        </span>
                      </td>
                      <td className="py-2.5">
                        <span className={`font-bold ${isLongSat ? 'text-amber-400' : 'text-slate-400'}`}>
                          {s.timeAtFullChargeMinutes} min
                        </span>
                      </td>
                      <td className="py-2.5 text-cyan-400 font-bold">
                        {s.chargerProtocol}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
