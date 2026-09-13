import React, { useState } from 'react';
import {
  Download,
  Copy,
  Check,
  FileText,
  Subtitles,
  FileCode,
  X,
  Share2,
} from 'lucide-react';
import { TranscriptionResult } from '../types';
import {
  exportToSRT,
  exportToVTT,
  exportToMarkdown,
  downloadFile,
} from '../utils/audioHelpers';

interface ExportModalProps {
  result: TranscriptionResult;
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  result,
  isOpen,
  onClose,
}) => {
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  if (!isOpen) return null;

  const baseFileName = result.fileName.replace(/\.[^/.]+$/, '');

  const handleDownload = (format: 'txt' | 'srt' | 'vtt' | 'md' | 'json') => {
    switch (format) {
      case 'txt': {
        const text = result.segments
          .map((s) => `[${s.timestamp}] ${s.speaker}: ${s.text}`)
          .join('\n\n');
        downloadFile(`${baseFileName}-transcript.txt`, text, 'text/plain');
        break;
      }
      case 'srt': {
        const srt = exportToSRT(result.segments);
        downloadFile(`${baseFileName}.srt`, srt, 'application/x-subrip');
        break;
      }
      case 'vtt': {
        const vtt = exportToVTT(result.segments);
        downloadFile(`${baseFileName}.vtt`, vtt, 'text/vtt');
        break;
      }
      case 'md': {
        const md = exportToMarkdown({
          fileName: result.fileName,
          createdAt: result.createdAt,
          segments: result.segments,
          summary: result.summary,
        });
        downloadFile(`${baseFileName}.md`, md, 'text/markdown');
        break;
      }
      case 'json': {
        const json = JSON.stringify(result, null, 2);
        downloadFile(`${baseFileName}-transcript.json`, json, 'application/json');
        break;
      }
    }
  };

  const handleCopy = (format: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedFormat(format);
    setTimeout(() => setCopiedFormat(null), 2000);
  };

  const exportOptions = [
    {
      id: 'txt',
      title: 'Plain Text (.txt)',
      desc: 'Clean text transcription with timestamps & speaker labels',
      icon: FileText,
      ext: '.txt',
      action: () => handleDownload('txt'),
      getContent: () =>
        result.segments.map((s) => `[${s.timestamp}] ${s.speaker}: ${s.text}`).join('\n\n'),
    },
    {
      id: 'srt',
      title: 'Subtitles (.srt)',
      desc: 'SubRip format for Premiere Pro, Final Cut, DaVinci, YouTube captions',
      icon: Subtitles,
      ext: '.srt',
      action: () => handleDownload('srt'),
      getContent: () => exportToSRT(result.segments),
    },
    {
      id: 'vtt',
      title: 'WebVTT (.vtt)',
      desc: 'Web-native subtitles for HTML5 video & web players',
      icon: Subtitles,
      ext: '.vtt',
      action: () => handleDownload('vtt'),
      getContent: () => exportToVTT(result.segments),
    },
    {
      id: 'md',
      title: 'Markdown Document (.md)',
      desc: 'Formatted notes with summary, speakers, and timestamps for Notion/Obsidian',
      icon: FileText,
      ext: '.md',
      action: () => handleDownload('md'),
      getContent: () =>
        exportToMarkdown({
          fileName: result.fileName,
          createdAt: result.createdAt,
          segments: result.segments,
          summary: result.summary,
        }),
    },
    {
      id: 'json',
      title: 'Structured JSON (.json)',
      desc: 'Raw machine-readable data with segments, timings, and metadata',
      icon: FileCode,
      ext: '.json',
      action: () => handleDownload('json'),
      getContent: () => JSON.stringify(result, null, 2),
    },
  ];

  return (
    <div
      id="export-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4 backdrop-blur-xs"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between border-b border-zinc-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white">
              <Download className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Export Transcript</h2>
              <p className="text-xs text-zinc-500">Download in your preferred media format</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2.5">
          {exportOptions.map((opt) => {
            const Icon = opt.icon;
            const isCopied = copiedFormat === opt.id;

            return (
              <div
                key={opt.id}
                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50/50 p-3.5 transition hover:border-zinc-300 hover:bg-zinc-50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white border border-zinc-200 text-zinc-700 shadow-xs">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-zinc-900">{opt.title}</h3>
                    <p className="text-[11px] text-zinc-500">{opt.desc}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleCopy(opt.id, opt.getContent())}
                    className="rounded-lg border border-zinc-200 bg-white p-2 text-zinc-600 shadow-xs hover:bg-zinc-100"
                    title="Copy to clipboard"
                  >
                    {isCopied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>

                  <button
                    onClick={opt.action}
                    className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-zinc-800"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex justify-end border-t border-zinc-100 pt-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
