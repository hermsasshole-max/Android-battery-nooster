import React, { useState } from 'react';
import { Terminal, Trash2, Filter, Copy, Check, Play } from 'lucide-react';
import { ShellLogEntry, ExecutionMode } from '../types/charging';

interface ShellTerminalProps {
  logs: ShellLogEntry[];
  onClearLogs: () => void;
  onExecuteManualCommand: (cmd: string) => void;
}

export const ShellTerminal: React.FC<ShellTerminalProps> = ({
  logs,
  onClearLogs,
  onExecuteManualCommand,
}) => {
  const [filterMode, setFilterMode] = useState<string>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState<string>('');

  const filteredLogs = logs.filter((log) => {
    if (filterMode === 'ALL') return true;
    return log.mode === filterMode;
  });

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    onExecuteManualCommand(manualInput.trim());
    setManualInput('');
  };

  return (
    <div className="flex flex-col h-[580px] rounded-2xl border border-white/10 bg-[#0a0d13] font-mono text-xs shadow-2xl overflow-hidden">
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between border-b border-white/10 bg-[#10151f] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 mr-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <Terminal className="h-4 w-4 text-emerald-400" />
          <span className="font-bold text-slate-200">
            Privileged Shell Dispatch Stream (LibSu / Shizuku IPC / ADB)
          </span>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
            {filteredLogs.length} events
          </span>
        </div>

        {/* Filter and Clear */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-slate-900 border border-white/5 p-0.5 text-[10px]">
            {['ALL', 'ROOT', 'SHIZUKU_SYSFS', 'SHIZUKU_ADB_FALLBACK'].map((m) => (
              <button
                key={m}
                onClick={() => setFilterMode(m)}
                className={`rounded px-2 py-0.5 transition ${
                  filterMode === m ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                {m === 'ALL' ? 'ALL' : m.replace('SHIZUKU_', '')}
              </button>
            ))}
          </div>

          <button
            onClick={onClearLogs}
            title="Clear Terminal"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-rose-400 transition"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Stream Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-[11px] leading-relaxed scrollbar-thin scrollbar-thumb-white/10">
        {filteredLogs.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-slate-500">
            <Terminal className="h-8 w-8 mb-2 opacity-40" />
            <p>No shell commands dispatched yet</p>
            <p className="text-[10px] mt-1">Interact with sliders or trigger actions in the simulator</p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isRoot = log.mode === 'ROOT';
            const isShizuku = log.mode === 'SHIZUKU_SYSFS';
            const isAdb = log.mode === 'SHIZUKU_ADB_FALLBACK';

            const badgeColor = isRoot
              ? 'text-emerald-400 border-emerald-500/30 bg-emerald-950/40'
              : isShizuku
              ? 'text-cyan-400 border-cyan-500/30 bg-cyan-950/40'
              : isAdb
              ? 'text-amber-400 border-amber-500/30 bg-amber-950/40'
              : 'text-rose-400 border-rose-500/30 bg-rose-950/40';

            return (
              <div
                key={log.id}
                className="group relative rounded-xl border border-white/5 bg-[#0f141f] p-3 hover:border-white/10 transition"
              >
                <div className="flex items-center justify-between text-[10px] text-slate-400 pb-1.5 mb-1.5 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">{log.timestamp}</span>
                    <span className={`rounded border px-1.5 py-0.2 font-bold ${badgeColor}`}>
                      {log.mode}
                    </span>
                    <span className={`font-mono ${log.exitCode === 0 ? 'text-emerald-400' : 'text-rose-400 font-bold'}`}>
                      exitCode: {log.exitCode}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopy(log.command, log.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white transition flex items-center gap-1 text-[10px]"
                  >
                    {copiedId === log.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedId === log.id ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                {/* Command text */}
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 select-none font-bold">
                    {isRoot ? '#' : '$'}
                  </span>
                  <span className="text-slate-100 font-semibold break-all">{log.command}</span>
                </div>

                {/* Command output */}
                {log.output && (
                  <div className={`mt-2 rounded-lg bg-black/50 p-2 text-[10px] leading-relaxed whitespace-pre-wrap ${
                    log.isError ? 'text-rose-300 font-sans' : 'text-slate-300'
                  }`}>
                    {log.output}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Manual Test Command Dispatch Bar */}
      <form onSubmit={handleManualSubmit} className="flex items-center gap-2 border-t border-white/10 bg-[#10151f] p-2.5">
        <span className="text-emerald-400 pl-2 font-bold">#</span>
        <input
          type="text"
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          placeholder="Dispatch test shell command (e.g. cat /sys/class/power_supply/battery/current_max)"
          className="flex-1 bg-transparent px-2 text-xs text-white placeholder-slate-500 focus:outline-none font-mono"
        />
        <button
          type="submit"
          className="flex items-center gap-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-black px-3 py-1.5 text-xs font-bold transition"
        >
          <Play className="h-3 w-3" />
          Exec
        </button>
      </form>
    </div>
  );
};
