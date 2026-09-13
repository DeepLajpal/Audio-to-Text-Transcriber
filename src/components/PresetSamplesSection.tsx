import React from 'react';
import { Sparkles, Users, Clock, PlayCircle } from 'lucide-react';
import { PRESET_SAMPLES, PresetSample } from '../data/sampleAudios';
import { TranscriptionResult } from '../types';
import { createSyntheticSampleAudio } from '../utils/audioHelpers';

interface PresetSamplesSectionProps {
  onSelectSample: (result: TranscriptionResult, audioUrl: string) => void;
  disabled?: boolean;
}

export const PresetSamplesSection: React.FC<PresetSamplesSectionProps> = ({
  onSelectSample,
  disabled,
}) => {
  const handleLoadSample = (sample: PresetSample) => {
    // Generate synthetic audio blob for interactive player playback
    const audioBlob = createSyntheticSampleAudio(165, 300); // 2:45 synthetic wav
    const audioUrl = URL.createObjectURL(audioBlob);

    const result: TranscriptionResult = {
      id: `sample-${sample.id}`,
      fileName: `${sample.title}.mp3`,
      fileSize: 4200000,
      fileSizeFormatted: '4.2 MB',
      durationSeconds: 165,
      durationFormatted: sample.duration,
      createdAt: new Date().toISOString(),
      fullText: sample.simulatedTranscript.segments
        .map((s) => `[${s.timestamp}] ${s.speaker}: ${s.text}`)
        .join('\n'),
      segments: sample.simulatedTranscript.segments.map((s, idx) => {
        const parts = s.timestamp.split(':').map(Number);
        const sec = parts[0] * 60 + parts[1];
        return {
          id: `sample-seg-${idx + 1}`,
          timestamp: s.timestamp,
          startSeconds: sec,
          speaker: s.speaker,
          text: s.text,
        };
      }),
      summary: sample.simulatedTranscript.summary,
      actionItems: sample.simulatedTranscript.actionItems,
      keyTopics: sample.simulatedTranscript.keyTopics,
      detectedLanguage: 'English',
    };

    onSelectSample(result, audioUrl);
  };

  return (
    <div id="preset-samples-card" className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-purple-600" />
            Try Preloaded Audio Samples
          </h3>
          <p className="text-xs text-zinc-500">
            No audio file on your device? Test the interactive transcriber instantly in 1 click
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {PRESET_SAMPLES.map((sample) => (
          <button
            key={sample.id}
            id={`preset-sample-${sample.id}`}
            onClick={() => handleLoadSample(sample)}
            disabled={disabled}
            className="group flex flex-col justify-between rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 text-left transition hover:border-zinc-400 hover:bg-zinc-50 disabled:opacity-50"
          >
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold text-zinc-700 border border-zinc-200">
                  {sample.category}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-zinc-500 font-mono">
                  <Clock className="h-3 w-3" />
                  {sample.duration}
                </span>
              </div>
              <h4 className="text-sm font-semibold text-zinc-900 group-hover:text-zinc-950 line-clamp-1">
                {sample.title}
              </h4>
              <p className="mt-1 text-xs text-zinc-500 line-clamp-2">
                {sample.description}
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-zinc-200/60 pt-3">
              <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                <Users className="h-3 w-3 text-zinc-400" />
                {sample.speakerCount} speakers
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-900 group-hover:underline">
                <PlayCircle className="h-3.5 w-3.5" />
                Load Sample
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
