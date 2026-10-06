import React, { useState } from 'react';
import { 
  FileCode, 
  Copy, 
  Check, 
  Download, 
  Archive, 
  FolderTree, 
  Layers, 
  ExternalLink 
} from 'lucide-react';
import JSZip from 'jszip';
import confetti from 'canvas-confetti';
import { ANDROID_SOURCE_FILES } from '../data/androidFiles';
import { AndroidSourceFile } from '../types/charging';

export const CodeInspector: React.FC = () => {
  const [selectedFileId, setSelectedFileId] = useState<string>(ANDROID_SOURCE_FILES[0].id);
  const [copied, setCopied] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);

  const selectedFile = ANDROID_SOURCE_FILES.find((f) => f.id === selectedFileId) || ANDROID_SOURCE_FILES[0];

  const handleCopyCode = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSingle = (file: AndroidSourceFile) => {
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadZip = async () => {
    try {
      setIsZipping(true);
      const zip = new JSZip();

      // Add all project files at their relative paths
      ANDROID_SOURCE_FILES.forEach((file) => {
        zip.file(file.path, file.content);
      });

      // Add README.md
      zip.file(
        'README.md',
        `# Oppo VOOC Battery Charging Controller & Sysfs Architect
Complete Android Studio project implementing Root (LibSu) & Shizuku binder IPC hardware battery control,
strict safety bounds clamping (500-3000mA, 4000-4450mV), and automated thermal runaway safeguarding (>=43°C).

## Key Deliverables Included:
1. \`build.gradle.kts\` - App-level build script with LibSu 5.2.1 and Shizuku 13.1.5
2. \`AndroidManifest.xml\` - Shizuku provider, specialUse foreground service, boot receiver
3. \`ShellExecutor.kt\` - Hybrid Root & Shizuku binder shell dispatcher with ADB fallback
4. \`ChargingManager.kt\` - Sysfs hardware abstraction layer & clamp engine
5. \`ChargingMonitorService.kt\` - 3-second watchdog daemon counteracting ColorOS kernel overrides
6. \`MainScreen.kt\` - Jetpack Compose & Material 3 UI with dual sliders & live telemetry
7. \`ChargingViewModel.kt\` - MVI/MVVM StateFlow manager
8. \`MainActivity.kt\` & \`ChargingApplication.kt\`
`
      );

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Oplus_VOOC_Battery_Controller_Source.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 },
      });
    } catch (err) {
      console.error('Failed to generate ZIP bundle:', err);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[780px] rounded-2xl border border-white/10 bg-[#0c1017] p-4 shadow-2xl">
      {/* File Tree Navigation Sidebar */}
      <div className="w-full lg:w-80 flex flex-col rounded-xl border border-white/5 bg-[#10151f] p-3 space-y-3">
        <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
          <div className="flex items-center gap-2">
            <FolderTree className="h-4 w-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-white tracking-wider uppercase">Project Tree</h3>
          </div>
          <button
            onClick={handleDownloadZip}
            disabled={isZipping}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-black border border-emerald-500/30 px-2.5 py-1 text-[11px] font-bold transition disabled:opacity-50"
          >
            <Archive className="h-3.5 w-3.5" />
            <span>{isZipping ? 'Bundling...' : 'Zip Project'}</span>
          </button>
        </div>

        {/* File items list */}
        <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-white/10 pr-1">
          {ANDROID_SOURCE_FILES.map((file) => {
            const isSelected = file.id === selectedFileId;
            return (
              <button
                key={file.id}
                onClick={() => setSelectedFileId(file.id)}
                className={`w-full flex flex-col items-start rounded-xl p-2.5 text-left transition-all border ${
                  isSelected
                    ? 'border-emerald-500/40 bg-emerald-950/30 text-white shadow-sm'
                    : 'border-transparent hover:bg-white/[0.03] text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2 font-mono text-xs font-semibold">
                    <FileCode className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-emerald-400' : 'text-slate-500'}`} />
                    <span className="truncate">{file.filename}</span>
                  </div>
                  <span className="rounded bg-black/40 px-1.5 py-0.5 text-[9px] font-mono text-slate-400">
                    {file.language}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 font-sans mt-1 line-clamp-1">
                  {file.description}
                </span>
              </button>
            );
          })}
        </div>

        {/* Meta summary */}
        <div className="rounded-lg bg-black/40 border border-white/5 p-2.5 text-[10px] text-slate-400 space-y-1 font-mono">
          <p><span className="text-slate-500">Target SDK:</span> 35 (Android 15)</p>
          <p><span className="text-slate-500">Compile SDK:</span> 35</p>
          <p><span className="text-slate-500">Min SDK:</span> 26 (Android 8.0)</p>
          <p><span className="text-slate-500">Root Layer:</span> LibSu 5.2.1</p>
          <p><span className="text-slate-500">Non-Root IPC:</span> Shizuku 13.1.5</p>
        </div>
      </div>

      {/* Code Viewer Panel */}
      <div className="flex-1 flex flex-col rounded-xl border border-white/5 bg-[#090d14] overflow-hidden">
        {/* Code Header Bar */}
        <div className="flex items-center justify-between border-b border-white/10 bg-[#10151f] px-4 py-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-emerald-400">
                {selectedFile.path}
              </span>
              <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                {selectedFile.category}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans mt-0.5">
              {selectedFile.description}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 text-xs font-medium transition"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>

            <button
              onClick={() => handleDownloadSingle(selectedFile)}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 px-3 py-1.5 text-xs font-medium transition"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download</span>
            </button>
          </div>
        </div>

        {/* Code Syntax Block */}
        <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed text-slate-200 bg-[#090d14] scrollbar-thin scrollbar-thumb-white/10">
          <pre className="whitespace-pre">
            <code>{selectedFile.content}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
