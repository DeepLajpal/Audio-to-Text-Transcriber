import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  Mic,
  FileAudio,
  Sparkles,
  HardDrive,
  Clock,
  Volume2,
  CheckCircle2,
  ShieldCheck,
  History,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { Navbar } from './components/Navbar';
import { AudioUploader } from './components/AudioUploader';
import { AudioRecorder } from './components/AudioRecorder';
import { PresetSamplesSection } from './components/PresetSamplesSection';
import { TranscriptViewer } from './components/TranscriptViewer';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { ExportModal } from './components/ExportModal';
import { AIInsightsPanel } from './components/AIInsightsPanel';
import { SettingsModal } from './components/SettingsModal';
import { TranscriptionOptions, TranscriptionResult, TranscriptSegment } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'upload' | 'record'>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeResult, setActiveResult] = useState<TranscriptionResult | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | undefined>(undefined);
  const [currentTime, setCurrentTime] = useState(0);

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);

  // Session history of transcripts
  const [history, setHistory] = useState<TranscriptionResult[]>([]);

  // Transcription options - default to client-side on-device
  const [options, setOptions] = useState<TranscriptionOptions>({
    engine: 'client',
    language: 'auto',
    detectSpeakers: true,
    timestampGranularity: 'detailed',
    customVocabulary: '',
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleTranscriptionComplete = (result: TranscriptionResult, localAudioUrl?: string) => {
    setActiveResult(result);
    setAudioUrl(localAudioUrl);
    setCurrentTime(0);

    // Add to session history
    setHistory((prev) => [result, ...prev.filter((h) => h.id !== result.id)]);
  };

  const handleSeek = (seconds: number) => {
    setCurrentTime(seconds);
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      audioRef.current.play().catch(() => {});
    }
  };

  const handleUpdateSegments = (newSegments: TranscriptSegment[]) => {
    if (!activeResult) return;
    const updated = {
      ...activeResult,
      segments: newSegments,
      fullText: newSegments.map((s) => `[${s.timestamp}] ${s.speaker}: ${s.text}`).join('\n'),
    };
    setActiveResult(updated);
  };

  const handleUpdateActiveResult = (updated: Partial<TranscriptionResult>) => {
    if (!activeResult) return;
    setActiveResult({
      ...activeResult,
      ...updated,
    });
  };

  const handleReset = () => {
    setActiveResult(null);
    setAudioUrl(undefined);
    setCurrentTime(0);
  };

  const handleSelectFromHistory = (item: TranscriptionResult) => {
    setActiveResult(item);
    setCurrentTime(0);
  };

  return (
    <div className="min-h-screen bg-zinc-50/50 text-zinc-900 selection:bg-zinc-900 selection:text-white flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        onOpenSettings={() => setIsSettingsOpen(true)}
        onReset={handleReset}
        hasActiveTranscript={Boolean(activeResult)}
      />

      {/* Main Content Area */}
      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {activeResult ? (
          /* Active Transcript View */
          <div className="space-y-6 pb-24">
            <TranscriptViewer
              result={activeResult}
              currentTime={currentTime}
              onSeek={handleSeek}
              onOpenExport={() => setIsExportOpen(true)}
              onOpenInsights={() => setIsInsightsOpen(true)}
              onUpdateSegments={handleUpdateSegments}
            />
          </div>
        ) : (
          /* Upload / Record Home View */
          <div className="space-y-8 max-w-4xl mx-auto">
            {/* Value Proposition Hero */}
            <div className="text-center space-y-3 pt-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-semibold text-emerald-800 shadow-xs">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>100% On-Device In-Browser Mode • Zero Backend Upload • Zero API Fees</span>
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
                Convert Audio to Text Instantly
              </h1>

              <p className="mx-auto max-w-2xl text-sm leading-relaxed text-zinc-600 sm:text-base">
                Transcribe recordings on-device directly in your browser using Transformers.js Whisper (no backend or API required),
                or switch to the Cloud Gemini engine for multi-hour recordings.
              </p>
            </div>

            {/* Input Method Selector Tabs */}
            <div className="flex justify-center">
              <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-1 shadow-xs">
                <button
                  id="tab-upload-file"
                  onClick={() => setActiveTab('upload')}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
                    activeTab === 'upload'
                      ? 'bg-zinc-900 text-white shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  <UploadCloud className="h-4 w-4" />
                  <span>Upload Audio File</span>
                </button>

                <button
                  id="tab-record-mic"
                  onClick={() => setActiveTab('record')}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
                    activeTab === 'record'
                      ? 'bg-zinc-900 text-white shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  <Mic className="h-4 w-4" />
                  <span>Record Microphone</span>
                </button>
              </div>
            </div>

            {/* Input Component (Uploader or Recorder) */}
            <div>
              {activeTab === 'upload' ? (
                <AudioUploader
                  options={options}
                  onChangeEngine={(engine) => setOptions((prev) => ({ ...prev, engine }))}
                  onTranscriptionComplete={handleTranscriptionComplete}
                  isProcessing={isProcessing}
                  setIsProcessing={setIsProcessing}
                />
              ) : (
                <AudioRecorder
                  options={options}
                  onChangeEngine={(engine) => setOptions((prev) => ({ ...prev, engine }))}
                  onTranscriptionComplete={handleTranscriptionComplete}
                  isProcessing={isProcessing}
                  setIsProcessing={setIsProcessing}
                />
              )}
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs">
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-semibold text-zinc-900">100% On-Device &amp; Private</h3>
                <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
                  Uses Transformers.js Whisper WASM/WebGPU to transcribe audio entirely inside your browser. Audio never leaves your computer.
                </p>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs">
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-900">
                  <Clock className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-semibold text-zinc-900">Interactive Click-to-Seek</h3>
                <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
                  Every sentence is mapped to audio timestamps so you can jump to exact moments in playback with 1 click.
                </p>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs">
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-900">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-semibold text-zinc-900">Dual Processing Engines</h3>
                <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
                  Switch between instant local browser processing (zero API keys required) and the cloud Gemini speech model at any time.
                </p>
              </div>
            </div>

            {/* 1-Click Preset Samples */}
            <PresetSamplesSection
              onSelectSample={handleTranscriptionComplete}
              disabled={isProcessing}
            />

            {/* Session History (if any) */}
            {history.length > 0 && (
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                    <History className="h-4 w-4 text-zinc-500" />
                    Session Transcriptions ({history.length})
                  </h3>
                </div>

                <div className="divide-y divide-zinc-100">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleSelectFromHistory(item)}
                      className="flex cursor-pointer items-center justify-between py-3 transition hover:bg-zinc-50 px-2 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <FileAudio className="h-5 w-5 text-zinc-400" />
                        <div>
                          <p className="text-xs font-semibold text-zinc-900">{item.fileName}</p>
                          <p className="text-[11px] text-zinc-500">
                            {item.fileSizeFormatted} • {item.segments.length} segments • {new Date(item.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      <span className="flex items-center gap-1 text-xs font-medium text-zinc-900">
                        View
                        <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating Audio Player (Active when an audio file is loaded) */}
      <AudioPlayerBar
        audioUrl={audioUrl}
        currentTime={currentTime}
        onTimeUpdate={setCurrentTime}
        onSeek={handleSeek}
        audioRef={audioRef}
      />

      {/* Modals */}
      <SettingsModal
        options={options}
        setOptions={setOptions}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {activeResult && (
        <>
          <ExportModal
            result={activeResult}
            isOpen={isExportOpen}
            onClose={() => setIsExportOpen(false)}
          />

          <AIInsightsPanel
            result={activeResult}
            isOpen={isInsightsOpen}
            onClose={() => setIsInsightsOpen(false)}
            onUpdateResult={handleUpdateActiveResult}
          />
        </>
      )}

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white py-4 text-center text-xs text-zinc-500">
        <p>Audio to Text Transcriber • No Upload Limit • Verbatim AI Transcription</p>
      </footer>
    </div>
  );
}
