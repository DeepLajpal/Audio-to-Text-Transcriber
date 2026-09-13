import React from 'react';
import { FileAudio, Sparkles, SlidersHorizontal, CheckCircle2, ShieldCheck } from 'lucide-react';

interface NavbarProps {
  onOpenSettings: () => void;
  onReset: () => void;
  hasActiveTranscript: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenSettings,
  onReset,
  hasActiveTranscript,
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
                  No Upload Limit
                </span>
              </div>
              <p className="hidden text-xs text-zinc-500 sm:block">
                Unlimited file size & length • Timestamps • Speaker Diarization
              </p>
            </div>
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <div className="hidden items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 md:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Streaming Engine Active
          </div>

          {hasActiveTranscript && (
            <button
              id="new-transcription-btn"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
            >
              <Sparkles className="h-3.5 w-3.5 text-zinc-500" />
              New Audio
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
        </div>
      </div>
    </header>
  );
};
