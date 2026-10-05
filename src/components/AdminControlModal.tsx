import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Power,
  Cloud,
  Cpu,
  Server,
  Activity,
  HardDrive,
  RefreshCw,
  LogOut,
  X,
  CheckCircle2,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import {
  AdminUser,
  SystemStats,
  fetchSystemStats,
  toggleCloudConversion,
  logoutAdmin,
} from '../services/adminAuth';

interface AdminControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  admin: AdminUser | null;
  cloudConversionEnabled: boolean;
  onUpdateCloudConversion: (enabled: boolean) => void;
  onSignOut: () => void;
}

export const AdminControlModal: React.FC<AdminControlModalProps> = ({
  isOpen,
  onClose,
  admin,
  cloudConversionEnabled,
  onUpdateCloudConversion,
  onSignOut,
}) => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [togglingCloud, setTogglingCloud] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadStats = async () => {
    setLoadingStats(true);
    setErrorMsg(null);
    const data = await fetchSystemStats();
    if (data) {
      setStats(data);
    }
    setLoadingStats(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadStats();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleCloud = async () => {
    setTogglingCloud(true);
    setErrorMsg(null);
    const newTarget = !cloudConversionEnabled;
    const res = await toggleCloudConversion(newTarget);
    setTogglingCloud(false);

    if (res.success) {
      onUpdateCloudConversion(res.cloudConversionEnabled);
      if (stats) {
        setStats({ ...stats, cloudConversionEnabled: res.cloudConversionEnabled });
      }
    } else {
      setErrorMsg(res.error || 'Failed to update cloud conversion setting.');
    }
  };

  const handleSignOutClick = async () => {
    await logoutAdmin();
    onSignOut();
    onClose();
  };

  const formatUptime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const hours = Math.floor(mins / 60);
    if (hours > 0) return `${hours}h ${mins % 60}m`;
    return `${mins}m ${Math.floor(seconds % 60)}s`;
  };

  return (
    <div
      id="admin-control-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="admin-control-modal"
        className="relative w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl transition"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4 pr-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-sm ring-4 ring-zinc-100">
              <ShieldCheck className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-zinc-900">Admin Control Console</h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Authenticated
                </span>
              </div>
              <p className="text-xs text-zinc-500 font-mono">
                {admin?.email || 'admin@transcriber.internal'} • {admin?.role || 'System Administrator'}
              </p>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="mt-5 space-y-5">
          {/* Cloud Conversion Engine Switch (Primary Requested Control) */}
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 transition">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    cloudConversionEnabled
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-200 text-zinc-600'
                  }`}
                >
                  <Cloud className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-zinc-900">
                      Cloud Conversion Engine (Gemini)
                    </h3>
                    {cloudConversionEnabled ? (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                        Temporarily Disabled
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
                    Controls whether users and background streaming can invoke cloud-based Gemini audio transcription.
                    When disabled, the application forces 100% on-device (client-side) Whisper processing.
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                type="button"
                role="switch"
                aria-checked={cloudConversionEnabled}
                onClick={handleToggleCloud}
                disabled={togglingCloud}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  cloudConversionEnabled ? 'bg-blue-600' : 'bg-zinc-300'
                } ${togglingCloud ? 'opacity-50' : ''}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    cloudConversionEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-zinc-200/60 pt-2.5 text-[11px] text-zinc-500">
              <span className="flex items-center gap-1 font-medium">
                <Cpu className="h-3.5 w-3.5 text-emerald-600" />
                Default Fallback: On-Device Transformers.js Whisper (Always Ready)
              </span>
              <span>{togglingCloud ? 'Updating...' : cloudConversionEnabled ? 'Allowing Cloud API' : 'Cloud Locked'}</span>
            </div>
          </div>

          {/* System Diagnostic Metrics */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-zinc-500" />
                Server Health &amp; Runtime Metrics
              </h3>
              <button
                type="button"
                onClick={loadStats}
                disabled={loadingStats}
                className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-800 transition"
              >
                <RefreshCw className={`h-3 w-3 ${loadingStats ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-xs">
                <p className="text-[11px] text-zinc-400">Server Uptime</p>
                <p className="mt-1 text-sm font-semibold text-zinc-900 font-mono">
                  {stats ? formatUptime(stats.uptimeSeconds) : '...'}
                </p>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-xs">
                <p className="text-[11px] text-zinc-400">Memory (Heap)</p>
                <p className="mt-1 text-sm font-semibold text-zinc-900 font-mono">
                  {stats ? `${stats.memoryUsageMb.heapUsed} MB` : '...'}
                </p>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-xs">
                <p className="text-[11px] text-zinc-400">Gemini Key</p>
                <p className="mt-1 text-xs font-semibold text-zinc-900 flex items-center gap-1">
                  {stats?.geminiKeyConfigured ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Configured</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      <span>Not Set</span>
                    </>
                  )}
                </p>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-xs">
                <p className="text-[11px] text-zinc-400">Zero-Limit Storage</p>
                <p className="mt-1 text-xs font-semibold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  <span>50 GB Buffer</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-4">
          <button
            type="button"
            onClick={handleSignOutClick}
            className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out Admin</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
