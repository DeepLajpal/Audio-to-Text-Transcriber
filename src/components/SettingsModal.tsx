import React from 'react';
import {
  SlidersHorizontal,
  Globe,
  Users,
  Clock,
  BookOpen,
  X,
  HardDrive,
  Info,
} from 'lucide-react';
import { TranscriptionOptions } from '../types';

interface SettingsModalProps {
  options: TranscriptionOptions;
  setOptions: React.Dispatch<React.SetStateAction<TranscriptionOptions>>;
  isOpen: boolean;
  onClose: () => void;
}

const LANGUAGES = [
  { code: 'auto', name: 'Auto-Detect (100+ Languages)' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish (Español)' },
  { code: 'fr', name: 'French (Français)' },
  { code: 'de', name: 'German (Deutsch)' },
  { code: 'it', name: 'Italian (Italiano)' },
  { code: 'pt', name: 'Portuguese (Português)' },
  { code: 'zh', name: 'Mandarin Chinese (中文)' },
  { code: 'ja', name: 'Japanese (日本語)' },
  { code: 'ko', name: 'Korean (한국어)' },
  { code: 'hi', name: 'Hindi (हिन्दी)' },
  { code: 'ar', name: 'Arabic (العربية)' },
  { code: 'ru', name: 'Russian (Русский)' },
  { code: 'nl', name: 'Dutch (Nederlands)' },
  { code: 'pl', name: 'Polish (Polski)' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  options,
  setOptions,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="settings-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4 backdrop-blur-xs"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between border-b border-zinc-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Transcription Settings</h2>
              <p className="text-xs text-zinc-500">Configure language, speakers, and timing options</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Language Selection */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-zinc-700">
              <Globe className="h-3.5 w-3.5 text-zinc-500" />
              Spoken Audio Language
            </label>
            <select
              id="language-select"
              value={options.language}
              onChange={(e) => setOptions((prev) => ({ ...prev, language: e.target.value }))}
              className="w-full rounded-xl border border-zinc-300 bg-white p-2.5 text-xs text-zinc-900 focus:border-zinc-500 focus:outline-none"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>

          {/* Speaker Diarization */}
          <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50/50 p-3.5">
            <div className="flex items-center gap-2.5">
              <Users className="h-4 w-4 text-zinc-500" />
              <div>
                <p className="text-xs font-semibold text-zinc-900">Speaker Diarization</p>
                <p className="text-[11px] text-zinc-500">
                  Detect multiple speakers and assign [Speaker 1], [Speaker 2] labels
                </p>
              </div>
            </div>
            <input
              id="speaker-diarization-toggle"
              type="checkbox"
              checked={options.detectSpeakers}
              onChange={(e) =>
                setOptions((prev) => ({ ...prev, detectSpeakers: e.target.checked }))
              }
              className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
            />
          </div>

          {/* Timestamp Granularity */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-zinc-700">
              <Clock className="h-3.5 w-3.5 text-zinc-500" />
              Timestamp Frequency
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  setOptions((prev) => ({ ...prev, timestampGranularity: 'detailed' }))
                }
                className={`rounded-xl border p-3 text-left transition ${
                  options.timestampGranularity === 'detailed'
                    ? 'border-zinc-900 bg-zinc-900 text-white'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                <p className="text-xs font-semibold">Sentence by Sentence</p>
                <p
                  className={`text-[11px] mt-0.5 ${
                    options.timestampGranularity === 'detailed'
                      ? 'text-zinc-300'
                      : 'text-zinc-500'
                  }`}
                >
                  High precision timestamps
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  setOptions((prev) => ({ ...prev, timestampGranularity: 'paragraph' }))
                }
                className={`rounded-xl border p-3 text-left transition ${
                  options.timestampGranularity === 'paragraph'
                    ? 'border-zinc-900 bg-zinc-900 text-white'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                <p className="text-xs font-semibold">Paragraph by Paragraph</p>
                <p
                  className={`text-[11px] mt-0.5 ${
                    options.timestampGranularity === 'paragraph'
                      ? 'text-zinc-300'
                      : 'text-zinc-500'
                  }`}
                >
                  Broader section timestamps
                </p>
              </button>
            </div>
          </div>

          {/* Custom Vocabulary Hints */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-zinc-700">
              <BookOpen className="h-3.5 w-3.5 text-zinc-500" />
              Custom Vocabulary &amp; Keywords
            </label>
            <input
              id="custom-vocab-input"
              type="text"
              placeholder="e.g. Kubernetes, React, DeepMind, CEO names (comma separated)"
              value={options.customVocabulary}
              onChange={(e) =>
                setOptions((prev) => ({ ...prev, customVocabulary: e.target.value }))
              }
              className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-zinc-500">
              Helps model recognize unusual terms, acronyms, and specialized brand names.
            </p>
          </div>

          {/* Architecture Note */}
          <div className="flex items-start gap-2 rounded-xl bg-zinc-50 p-3 text-[11px] text-zinc-600 border border-zinc-200">
            <Info className="h-4 w-4 shrink-0 text-zinc-500 mt-0.5" />
            <div>
              <span className="font-semibold text-zinc-900">Zero Upload Limit Architecture:</span> Audio streams directly to ephemeral server disk storage with no body-parser limits, then bridges to the Gemini Files API.
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end border-t border-zinc-100 pt-4">
          <button
            onClick={onClose}
            className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
          >
            Save &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
};
