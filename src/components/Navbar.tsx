import React from 'react';
import {
  FileAudio,
  Sparkles,
  SlidersHorizontal,
  ShieldCheck,
  Lock,
  Settings,
  Cpu,
  CloudOff,
} from 'lucide-react';
import { AdminUser } from '../services/adminAuth';

interface NavbarProps {
  onOpenSettings: () => void;
  onReset: () => void;
  hasActiveTranscript: boolean;
  isAdmin: boolean;
  adminUser: AdminUser | null;
  cloudConversionEnabled: boolean;
  onOpenAdminSignIn: () => void;
  onOpenAdminControl: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenSettings,
  onReset,
  hasActiveTranscript,
  isAdmin,
  adminUser,
  cloudConversionEnabled,
  onOpenAdminSignIn,
  onOpenAdminControl,
}) => {
  return (
    <header id="app-header" className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand & Identity */}
        <div className="flex items-center gap-3">
          <button
            id="brand-logo-btn"
            onClick={onReset}
            className="flex items-center gap-2.5 text-left transition hover:opacity-90"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-sm">
              <FileAudio className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold tracking-tight text-zinc-900 sm:text-lg">
                  Audio to Text
                </span>
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/20">
                  <ShieldCheck className="mr-1 h-3 w-3" />
                  On-Device Mode
                </span>
              </div>
              <p className="hidden text-xs text-zinc-500 sm:block">
                Unlimited file size & length • Timestamps • In-browser transcription
              </p>
            </div>
          </button>
        </div>

        {/* Action Controls & Admin Sign In */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Engine Status indicator */}
          {!cloudConversionEnabled ? (
            <div
              className="hidden items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200/60 px-2.5 py-1 text-[11px] font-medium text-amber-800 md:flex"
              title="Cloud conversion temporarily paused. 100% on-device processing active."
            >
              <Cpu className="h-3 w-3 text-emerald-600" />
              <span>On-Device Active</span>
              <span className="text-amber-500">•</span>
              <span className="text-amber-700">Cloud Paused</span>
            </div>
          ) : (
            <div className="hidden items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 text-[11px] font-medium text-emerald-800 md:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Dual Engines Active</span>
            </div>
          )}

          {hasActiveTranscript && (
            <button
              id="new-transcription-btn"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
            >
              <Sparkles className="h-3.5 w-3.5 text-zinc-500" />
              <span className="hidden sm:inline">New Audio</span>
            </button>
          )}

          <button
            id="open-settings-btn"
            onClick={onOpenSettings}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-100"
            title="Transcription Settings"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-600" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          {/* Admin Sign In / Admin Console Button (Only show sign in admin) */}
          {isAdmin ? (
            <button
              id="admin-console-btn"
              onClick={onOpenAdminControl}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-zinc-800"
              title="Admin Control Center"
            >
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Admin Console</span>
            </button>
          ) : (
            <button
              id="admin-signin-btn"
              onClick={onOpenAdminSignIn}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 shadow-xs transition hover:border-zinc-400 hover:bg-zinc-50"
              title="Sign in as Administrator"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-zinc-700" />
              <span>Admin Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
