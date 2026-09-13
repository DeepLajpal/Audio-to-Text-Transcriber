import { TranscriptSegment } from '../types';

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function formatSeconds(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

export function parseTimestampToSeconds(ts: string): number {
  const parts = ts.replace(/[\[\]]/g, '').trim().split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

export function parseTranscriptionText(rawText: string): TranscriptSegment[] {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const segments: TranscriptSegment[] = [];
  let currentSpeaker = 'Speaker 1';
  let segmentCount = 0;

  // Pattern matching: e.g. [00:15] Speaker 1: Hello world or [01:23] Text or Speaker 1: Text
  const linePattern = /(?:\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?)?\s*(?:\[?(Speaker\s*\w+|Host|Guest|Interviewer|Interviewee|Person\s*\d+)\]?:?)?\s*(.*)/i;

  for (const line of lines) {
    const match = line.match(linePattern);
    if (match) {
      const timestampStr = match[1] || '';
      const speakerStr = match[2] || '';
      const text = match[3] || line;

      if (!text || text.length < 2) continue;

      if (speakerStr) {
        currentSpeaker = speakerStr.replace(/[:\[\]]/g, '').trim();
      }

      const seconds = timestampStr ? parseTimestampToSeconds(timestampStr) : segmentCount * 5;
      const formattedTimestamp = timestampStr || formatSeconds(seconds);

      segmentCount++;
      segments.push({
        id: `seg-${segmentCount}`,
        timestamp: formattedTimestamp,
        startSeconds: seconds,
        speaker: currentSpeaker,
        text: text.trim(),
      });
    } else {
      segmentCount++;
      segments.push({
        id: `seg-${segmentCount}`,
        timestamp: formatSeconds(segmentCount * 5),
        startSeconds: segmentCount * 5,
        speaker: currentSpeaker,
        text: line,
      });
    }
  }

  if (segments.length === 0 && rawText.trim().length > 0) {
    // If no line splits, break by sentence or paragraph
    const sentences = rawText.match(/[^.!?]+[.!?]+(\s|$)/g) || [rawText];
    return sentences.map((sentence, idx) => ({
      id: `seg-${idx + 1}`,
      timestamp: formatSeconds(idx * 6),
      startSeconds: idx * 6,
      speaker: 'Speaker 1',
      text: sentence.trim(),
    }));
  }

  return segments;
}

export function exportToSRT(segments: TranscriptSegment[]): string {
  return segments
    .map((seg, index) => {
      const startSec = seg.startSeconds;
      const nextSeg = segments[index + 1];
      const endSec = nextSeg ? nextSeg.startSeconds : startSec + 4;

      const formatTimeSrt = (sec: number) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = Math.floor(sec % 60);
        const ms = Math.floor((sec % 1) * 1000);
        const pad = (n: number, z = 2) => n.toString().padStart(z, '0');
        return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
      };

      return `${index + 1}\n${formatTimeSrt(startSec)} --> ${formatTimeSrt(endSec)}\n[${seg.speaker}] ${seg.text}\n`;
    })
    .join('\n');
}

export function exportToVTT(segments: TranscriptSegment[]): string {
  const header = 'WEBVTT\n\n';
  const body = segments
    .map((seg, index) => {
      const startSec = seg.startSeconds;
      const nextSeg = segments[index + 1];
      const endSec = nextSeg ? nextSeg.startSeconds : startSec + 4;

      const formatTimeVtt = (sec: number) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = Math.floor(sec % 60);
        const ms = Math.floor((sec % 1) * 1000);
        const pad = (n: number, z = 2) => n.toString().padStart(z, '0');
        return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
      };

      return `${index + 1}\n${formatTimeVtt(startSec)} --> ${formatTimeVtt(endSec)}\n<v ${seg.speaker}>${seg.text}\n`;
    })
    .join('\n');

  return header + body;
}

export function exportToMarkdown(result: { fileName: string; createdAt: string; segments: TranscriptSegment[]; summary?: string }): string {
  let md = `# Transcription: ${result.fileName}\n\n`;
  md += `*Recorded on ${new Date(result.createdAt).toLocaleString()}*\n\n`;

  if (result.summary) {
    md += `## Summary\n\n${result.summary}\n\n---\n\n`;
  }

  md += `## Full Transcript\n\n`;
  result.segments.forEach(seg => {
    md += `**[${seg.timestamp}] ${seg.speaker}:** ${seg.text}\n\n`;
  });

  return md;
}

export function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Generates a simple spoken or melodic tone WAV buffer for instant testing
export function createSyntheticSampleAudio(durationSec = 3, freq = 440): Blob {
  const sampleRate = 16000;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF identifier
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Generate an alternating melodic frequency wave so it sounds like speech modulation
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const modulatedFreq = freq + 150 * Math.sin(2 * Math.PI * 2 * t);
    const sample = Math.sin(2 * Math.PI * modulatedFreq * t) * 0.4;
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    view.setInt16(44 + i * 2, intSample, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}
