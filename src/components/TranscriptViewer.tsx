import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Copy,
  Check,
  Download,
  Play,
  Edit2,
  FileText,
  Subtitles,
  AlignLeft,
  Users,
  Sparkles,
} from 'lucide-react';
import { TranscriptSegment, TranscriptionResult } from '../types';
import { formatSeconds } from '../utils/audioHelpers';

interface TranscriptViewerProps {
  result: TranscriptionResult;
  currentTime: number;
  onSeek: (seconds: number) => void;
  onOpenExport: () => void;
  onOpenInsights: () => void;
  onUpdateSegments: (newSegments: TranscriptSegment[]) => void;
}

export const TranscriptViewer: React.FC<TranscriptViewerProps> = ({
  result,
  currentTime,
  onSeek,
  onOpenExport,
  onOpenInsights,
  onUpdateSegments,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'timestamped' | 'continuous' | 'subtitles'>('timestamped');
  const [copied, setCopied] = useState(false);
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null);

  // Distinct speakers list
  const uniqueSpeakers = useMemo(() => {
    const set = new Set<string>();
    result.segments.forEach((s) => set.add(s.speaker));
    return Array.from(set);
  }, [result.segments]);

  // Filtered segments based on search and speaker
  const filteredSegments = useMemo(() => {
    return result.segments.filter((seg) => {
      const matchesSpeaker = selectedSpeaker === 'all' || seg.speaker === selectedSpeaker;
      const matchesSearch =
        !searchQuery ||
        seg.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        seg.speaker.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSpeaker && matchesSearch;
    });
  }, [result.segments, selectedSpeaker, searchQuery]);

  // Find currently active segment according to audio currentTime
  const activeSegmentIndex = useMemo(() => {
    for (let i = result.segments.length - 1; i >= 0; i--) {
      if (currentTime >= result.segments[i].startSeconds) {
        return i;
      }
    }
    return -1;
  }, [result.segments, currentTime]);

  const activeSegmentId = activeSegmentIndex >= 0 ? result.segments[activeSegmentIndex]?.id : null;

  const handleCopyAll = () => {
    const fullText = result.segments
      .map((s) => `[${s.timestamp}] ${s.speaker}: ${s.text}`)
      .join('\n');
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTextChange = (id: string, newText: string) => {
    const updated = result.segments.map((seg) =>
      seg.id === id ? { ...seg, text: newText } : seg
    );
    onUpdateSegments(updated);
  };

  const handleSpeakerChange = (id: string, newSpeaker: string) => {
    const updated = result.segments.map((seg) =>
      seg.id === id ? { ...seg, speaker: newSpeaker } : seg
    );
    onUpdateSegments(updated);
    setEditingSpeakerId(null);
  };

  // Word count & stats
  const totalWords = useMemo(() => {
    return result.segments.reduce((acc, seg) => acc + seg.text.trim().split(/\s+/).length, 0);
  }, [result.segments]);

  return (
    <div id="transcript-viewer-container" className="flex flex-col rounded-2xl border border-zinc-200 bg-white shadow-sm">
      {/* Header bar with meta info and action buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 p-4 sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-zinc-900 truncate max-w-md">
              {result.fileName}
            </h2>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 font-medium">
              {result.fileSizeFormatted}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
            <span>{totalWords.toLocaleString()} words</span>
            <span>•</span>
            <span>{result.segments.length} speech segments</span>
            <span>•</span>
            <span>{uniqueSpeakers.length} speaker{uniqueSpeakers.length > 1 ? 's' : ''} detected</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="view-insights-btn"
            onClick={onOpenInsights}
            className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 transition hover:bg-purple-100"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI Summary & Insights</span>
          </button>

          <button
            id="copy-transcript-btn"
            onClick={handleCopyAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-emerald-700">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-zinc-500" />
                <span>Copy</span>
              </>
            )}
          </button>

          <button
            id="open-export-modal-btn"
            onClick={onOpenExport}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-zinc-800"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Toolbar: Search, Speaker filter, View mode toggles */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 bg-zinc-50/50 p-3 sm:px-6">
        {/* Search input */}
        <div className="relative min-w-[220px] flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
          <input
            id="transcript-search-input"
            type="text"
            placeholder="Search words in transcript..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8.5 w-full rounded-lg border border-zinc-200 bg-white pl-8 pr-3 text-xs text-zinc-800 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none"
          />
        </div>

        {/* Filters and View Modes */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Speaker filter */}
          {uniqueSpeakers.length > 1 && (
            <div className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5 text-zinc-400" />
              <select
                id="speaker-filter-select"
                value={selectedSpeaker}
                onChange={(e) => setSelectedSpeaker(e.target.value)}
                className="h-8 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-700 focus:outline-none"
              >
                <option value="all">All Speakers ({uniqueSpeakers.length})</option>
                {uniqueSpeakers.map((spk) => (
                  <option key={spk} value={spk}>
                    {spk}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* View mode toggle */}
          <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 text-xs">
            <button
              onClick={() => setViewMode('timestamped')}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition ${
                viewMode === 'timestamped'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
              title="Timestamped conversation view"
            >
              <FileText className="h-3 w-3" />
              <span className="hidden sm:inline">Timestamps</span>
            </button>
            <button
              onClick={() => setViewMode('continuous')}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition ${
                viewMode === 'continuous'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
              title="Clean paragraph reading view"
            >
              <AlignLeft className="h-3 w-3" />
              <span className="hidden sm:inline">Reading</span>
            </button>
            <button
              onClick={() => setViewMode('subtitles')}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition ${
                viewMode === 'subtitles'
                  ? 'bg-zinc-900 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
              title="Subtitle timing codes view"
            >
              <Subtitles className="h-3 w-3" />
              <span className="hidden sm:inline">Subtitles</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-h-[600px] overflow-y-auto p-4 sm:p-6">
        {filteredSegments.length === 0 ? (
          <div className="py-12 text-center text-zinc-500">
            <p className="text-sm font-medium">No speech segments match your search.</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedSpeaker('all');
              }}
              className="mt-2 text-xs font-semibold text-zinc-900 underline"
            >
              Clear filters
            </button>
          </div>
        ) : null}

        {/* View Mode 1: Timestamped and Speaker View */}
        {viewMode === 'timestamped' && (
          <div className="space-y-3">
            {filteredSegments.map((seg) => {
              const isActive = seg.id === activeSegmentId;
              const isEditing = seg.id === editingSegmentId;

              return (
                <div
                  key={seg.id}
                  id={`segment-${seg.id}`}
                  className={`group relative flex items-start gap-3 rounded-xl border p-3.5 transition ${
                    isActive
                      ? 'border-zinc-900 bg-zinc-50/90 shadow-sm ring-1 ring-zinc-900/10'
                      : 'border-zinc-100 bg-white hover:border-zinc-200 hover:bg-zinc-50/50'
                  }`}
                >
                  {/* Clickable Timestamp & Play Button */}
                  <button
                    onClick={() => onSeek(seg.startSeconds)}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 font-mono text-xs font-semibold transition ${
                      isActive
                        ? 'bg-zinc-900 text-white'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900'
                    }`}
                    title={`Jump audio to ${seg.timestamp}`}
                  >
                    <Play className="h-2.5 w-2.5 fill-current" />
                    <span>{seg.timestamp}</span>
                  </button>

                  <div className="min-w-0 flex-1">
                    {/* Speaker Header */}
                    <div className="mb-1 flex items-center gap-2">
                      {editingSpeakerId === seg.id ? (
                        <input
                          type="text"
                          defaultValue={seg.speaker}
                          autoFocus
                          onBlur={(e) => handleSpeakerChange(seg.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSpeakerChange(seg.id, (e.target as any).value);
                            if (e.key === 'Escape') setEditingSpeakerId(null);
                          }}
                          className="h-6 rounded border border-zinc-300 px-1.5 text-xs font-semibold text-zinc-900 focus:outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => setEditingSpeakerId(seg.id)}
                          className="rounded px-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
                          title="Click to rename speaker"
                        >
                          {seg.speaker}
                        </button>
                      )}
                    </div>

                    {/* Segment Text */}
                    {isEditing ? (
                      <textarea
                        defaultValue={seg.text}
                        autoFocus
                        rows={2}
                        onBlur={(e) => {
                          handleTextChange(seg.id, e.target.value);
                          setEditingSegmentId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleTextChange(seg.id, (e.target as any).value);
                            setEditingSegmentId(null);
                          }
                        }}
                        className="w-full rounded-md border border-zinc-300 p-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none"
                      />
                    ) : (
                      <p
                        onClick={() => setEditingSegmentId(seg.id)}
                        className="text-sm leading-relaxed text-zinc-800 cursor-text hover:text-zinc-950"
                        title="Click text to edit typo"
                      >
                        {seg.text}
                      </p>
                    )}
                  </div>

                  {/* Inline edit trigger icon */}
                  <button
                    onClick={() => setEditingSegmentId(seg.id)}
                    className="opacity-0 transition group-hover:opacity-100 p-1 text-zinc-400 hover:text-zinc-700"
                    title="Edit text"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* View Mode 2: Continuous Paragraphs */}
        {viewMode === 'continuous' && (
          <div className="prose prose-zinc max-w-none space-y-4">
            {filteredSegments.map((seg) => (
              <p key={seg.id} className="text-base leading-relaxed text-zinc-800">
                <span
                  onClick={() => onSeek(seg.startSeconds)}
                  className="mr-2 cursor-pointer font-mono text-xs font-semibold text-zinc-400 hover:text-zinc-800 hover:underline"
                >
                  [{seg.timestamp}]
                </span>
                <strong className="mr-1.5 font-semibold text-zinc-900">{seg.speaker}:</strong>
                {seg.text}
              </p>
            ))}
          </div>
        )}

        {/* View Mode 3: Subtitles / SRT Format */}
        {viewMode === 'subtitles' && (
          <div className="space-y-3 font-mono text-xs text-zinc-800">
            {filteredSegments.map((seg, idx) => {
              const nextSeg = result.segments[idx + 1];
              const endSec = nextSeg ? nextSeg.startSeconds : seg.startSeconds + 4;

              return (
                <div key={seg.id} className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3">
                  <div className="text-zinc-400 font-semibold mb-1">#{idx + 1}</div>
                  <div className="text-emerald-700 font-medium mb-1">
                    {formatSeconds(seg.startSeconds)},000 --&gt; {formatSeconds(endSec)},000
                  </div>
                  <div className="text-zinc-900 font-sans text-sm">
                    [{seg.speaker}] {seg.text}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
