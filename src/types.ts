export interface TranscriptSegment {
  id: string;
  startSeconds: number;
  timestamp: string; // e.g. "00:15"
  speaker: string; // e.g. "Speaker 1"
  text: string;
}

export interface TranscriptionResult {
  id: string;
  fileName: string;
  fileSize: number;
  fileSizeFormatted: string;
  durationSeconds?: number;
  durationFormatted?: string;
  languageDetected?: string;
  detectedLanguage?: string;
  createdAt: string;
  fullText: string;
  segments: TranscriptSegment[];
  summary?: string;
  actionItems?: string[];
  keyTopics?: string[];
  audioUrl?: string; // object URL or data URL for playback
}

export interface TranscriptionOptions {
  language: string; // 'auto' or language code/name
  detectSpeakers: boolean;
  timestampGranularity: 'detailed' | 'paragraph' | 'sentence';
  customVocabulary: string;
}

export interface AudioSample {
  id: string;
  title: string;
  category: string;
  duration: string;
  description: string;
  dataUri?: string;
}
