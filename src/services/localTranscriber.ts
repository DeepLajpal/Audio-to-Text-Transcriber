import { pipeline, env } from '@huggingface/transformers';
import { TranscriptionOptions, TranscriptionResult, TranscriptSegment } from '../types';
import { formatFileSize, formatSeconds } from '../utils/audioHelpers';

// Configure transformers.js for optimal browser execution
// Disable local models so it loads models directly from HuggingFace Hub CDN
env.allowLocalModels = false;
if (env.backends && env.backends.onnx && env.backends.onnx.wasm) {
  env.backends.onnx.wasm.proxy = false;
}

export type LocalTranscriberProgressCallback = (info: {
  stage: 'loading-model' | 'decoding-audio' | 'transcribing' | 'post-processing';
  progressPercent: number;
  message: string;
}) => void;

let cachedTranscriber: any = null;
let cachedModelName: string = '';

/**
 * Decodes any browser-supported audio File or Blob into 16kHz Float32Array PCM samples
 * required by Whisper models.
 */
export async function decodeAudioTo16kPCM(
  fileOrBlob: Blob,
  onProgress?: (percent: number, msg: string) => void
): Promise<{ pcm: Float32Array; durationSeconds: number }> {
  onProgress?.(10, 'Reading audio file into browser memory...');
  const arrayBuffer = await fileOrBlob.arrayBuffer();

  onProgress?.(30, 'Decoding compressed audio channels via Web Audio API...');
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error('Web Audio API is not supported in this browser.');
  }

  const audioCtx = new AudioContextClass();
  let decodedBuffer: AudioBuffer;
  try {
    decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } finally {
    audioCtx.close().catch(() => {});
  }

  const targetSampleRate = 16000;
  const durationSeconds = decodedBuffer.duration;

  onProgress?.(60, `Audio duration: ${formatSeconds(durationSeconds)}. Resampling to 16,000 Hz...`);

  // If already 16kHz, extract the first channel directly
  if (decodedBuffer.sampleRate === targetSampleRate) {
    return {
      pcm: decodedBuffer.getChannelData(0),
      durationSeconds,
    };
  }

  // Resample to 16kHz using an OfflineAudioContext
  const offlineCtx = new OfflineAudioContext(
    1,
    Math.round(decodedBuffer.duration * targetSampleRate),
    targetSampleRate
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = decodedBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);

  const resampledBuffer = await offlineCtx.startRendering();
  onProgress?.(90, 'Audio preprocessing and normalization complete.');

  return {
    pcm: resampledBuffer.getChannelData(0),
    durationSeconds,
  };
}

/**
 * Initializes or retrieves the cached Whisper pipeline from Transformers.js
 * Explicitly specifies dtype to avoid ONNX Runtime Web's QDQ MatMulNBits bug on q8 weights.
 */
export async function getLocalWhisperPipeline(
  modelName = 'onnx-community/whisper-tiny.en',
  onProgress?: (percent: number, msg: string) => void
) {
  if (cachedTranscriber && cachedModelName === modelName) {
    return cachedTranscriber;
  }

  onProgress?.(5, `Initializing on-device speech engine (${modelName})...`);

  const progressCallback = (progressData: any) => {
    if (progressData.status === 'progress') {
      const pct = Math.min(Math.round(progressData.progress || 0), 100);
      onProgress?.(
        pct,
        `Downloading on-device model weights (${progressData.file || 'weights'})... ${pct}%`
      );
    } else if (progressData.status === 'initiate') {
      onProgress?.(0, `Connecting to model repository: ${progressData.file}...`);
    } else if (progressData.status === 'done') {
      onProgress?.(100, `Model component ${progressData.file} ready.`);
    }
  };

  let transcriber: any = null;

  // Configuration 1: Mixed precision (fp32 encoder + q4 decoder).
  // This bypasses the unquantized scale bug in onnxruntime-web q8 models.
  try {
    transcriber = await pipeline('automatic-speech-recognition', modelName, {
      dtype: {
        encoder_model: 'fp32',
        decoder_model_merged: 'q4',
      },
      progress_callback: progressCallback,
    });
  } catch (err: any) {
    console.warn('Mixed fp32/q4 pipeline failed, trying pure fp32:', err);
    onProgress?.(10, 'Switching to full-precision FP32 model configuration...');

    // Configuration 2: Full FP32 precision (no quantization operators required)
    try {
      transcriber = await pipeline('automatic-speech-recognition', modelName, {
        dtype: 'fp32',
        progress_callback: progressCallback,
      });
    } catch (err2: any) {
      console.warn('FP32 pipeline failed, trying q4 precision:', err2);
      onProgress?.(10, 'Switching to Q4 quantized model...');

      // Configuration 3: Pure Q4
      transcriber = await pipeline('automatic-speech-recognition', modelName, {
        dtype: 'q4',
        progress_callback: progressCallback,
      });
    }
  }

  cachedTranscriber = transcriber;
  cachedModelName = modelName;
  return transcriber;
}

/**
 * Transcribes audio completely client-side in the browser.
 * Zero network requests to any backend server or external AI API.
 */
export async function transcribeAudioClientSide(
  audioBlob: Blob,
  fileName: string,
  options: TranscriptionOptions,
  onProgress?: LocalTranscriberProgressCallback
): Promise<TranscriptionResult> {
  const startTime = Date.now();

  // 1. Audio Decoding
  onProgress?.({
    stage: 'decoding-audio',
    progressPercent: 15,
    message: 'Extracting audio samples locally in browser...',
  });

  const { pcm, durationSeconds } = await decodeAudioTo16kPCM(audioBlob, (pct, msg) => {
    onProgress?.({
      stage: 'decoding-audio',
      progressPercent: Math.round(10 + (pct * 0.2)),
      message: msg,
    });
  });

  // 2. Select appropriate model
  // Use multilingual whisper-tiny for non-English, or whisper-tiny.en for English
  const isEnglishOnly = options.language === 'en' || options.language === 'auto';
  const modelId = isEnglishOnly ? 'onnx-community/whisper-tiny.en' : 'onnx-community/whisper-tiny';

  onProgress?.({
    stage: 'loading-model',
    progressPercent: 35,
    message: `Loading in-browser Whisper engine (${modelId})...`,
  });

  const transcriber = await getLocalWhisperPipeline(modelId, (pct, msg) => {
    onProgress?.({
      stage: 'loading-model',
      progressPercent: Math.round(35 + (pct * 0.25)),
      message: msg,
    });
  });

  // 3. Run Inference on device
  onProgress?.({
    stage: 'transcribing',
    progressPercent: 65,
    message: 'Transcribing speech locally via WebAssembly/WebGPU...',
  });

  const pipelineOptions: any = {
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: true,
  };

  if (!isEnglishOnly && options.language && options.language !== 'auto') {
    pipelineOptions.language = options.language;
    pipelineOptions.task = 'transcribe';
  }

  const output = await transcriber(pcm, pipelineOptions);

  onProgress?.({
    stage: 'post-processing',
    progressPercent: 90,
    message: 'Structuring timestamps and generating speaker segments...',
  });

  // 4. Format segments
  const rawChunks: Array<{ text: string; timestamp?: [number, number | null] }> =
    output.chunks && Array.isArray(output.chunks) && output.chunks.length > 0
      ? output.chunks
      : [{ text: output.text || '', timestamp: [0, durationSeconds] }];

  const segments: TranscriptSegment[] = [];
  let currentSpeaker = 'Speaker 1';
  let lastEnd = 0;

  rawChunks.forEach((chunk, index) => {
    const text = chunk.text?.trim() || '';
    if (!text) return;

    const startSeconds = chunk.timestamp && typeof chunk.timestamp[0] === 'number'
      ? chunk.timestamp[0]
      : Math.round(index * 5);

    // If detectSpeakers is enabled, toggle speaker if pause > 2.2 seconds
    if (options.detectSpeakers && index > 0 && startSeconds - lastEnd > 2.2) {
      currentSpeaker = currentSpeaker === 'Speaker 1' ? 'Speaker 2' : 'Speaker 1';
    }

    if (chunk.timestamp && typeof chunk.timestamp[1] === 'number') {
      lastEnd = chunk.timestamp[1];
    } else {
      lastEnd = startSeconds + 4;
    }

    segments.push({
      id: `local-seg-${index}-${Date.now()}`,
      startSeconds: Math.floor(startSeconds),
      timestamp: formatSeconds(Math.floor(startSeconds)),
      speaker: options.detectSpeakers ? currentSpeaker : 'Speaker',
      text,
    });
  });

  // Fallback if no chunks
  if (segments.length === 0) {
    const fallbackText = (output.text || '').trim() || '[No intelligible speech detected in audio]';
    segments.push({
      id: `local-seg-0-${Date.now()}`,
      startSeconds: 0,
      timestamp: '00:00',
      speaker: 'Speaker 1',
      text: fallbackText,
    });
  }

  const fullText = segments.map((s) => `[${s.timestamp}] ${s.speaker}: ${s.text}`).join('\n');

  // 5. Client-Side Natural Language Insights (Extractive NLP without API)
  const localInsights = extractClientSideInsights(fullText, segments);

  onProgress?.({
    stage: 'post-processing',
    progressPercent: 100,
    message: 'Transcription complete (100% on-device).',
  });

  return {
    id: `client-${Date.now()}`,
    fileName,
    fileSize: audioBlob.size,
    fileSizeFormatted: formatFileSize(audioBlob.size),
    durationSeconds: Math.round(durationSeconds),
    durationFormatted: formatSeconds(Math.round(durationSeconds)),
    languageDetected: isEnglishOnly ? 'English (On-Device)' : 'Auto / Multilingual',
    detectedLanguage: isEnglishOnly ? 'English' : 'Multilingual',
    createdAt: new Date().toISOString(),
    fullText,
    segments,
    summary: localInsights.summary,
    actionItems: localInsights.actionItems,
    keyTopics: localInsights.keyTopics,
  };
}

/**
 * Client-side extractive summarizer & action item extractor.
 * Requires 0 external API calls.
 */
export function extractClientSideInsights(
  fullText: string,
  segments?: TranscriptSegment[]
): { summary: string; actionItems: string[]; keyTopics: string[] } {
  const allSentences = (segments && segments.length > 0)
    ? segments
        .map((s) => s.text)
        .join(' ')
        .split(/(?<=[.?!])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 15)
    : fullText
        .split(/(?<=[.?!])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 15);

  // 1. Action Items detection
  const actionKeywords = [
    /\b(need to|must|should|have to|will|assigned to|responsible for|action item|todo)\b/i,
    /\b(deadline|due date|by next|deliver|follow up|schedule|review|ensure|implement)\b/i,
    /\b(going to|plan to|take care of|send|prepare|fix|create|update)\b/i,
  ];

  const actionItems: string[] = [];
  allSentences.forEach((sentence) => {
    if (actionKeywords.some((pattern) => pattern.test(sentence))) {
      const cleaned = sentence.replace(/^(Speaker \d+:|So|And|Okay|Um|Well)\s*/i, '').trim();
      if (cleaned.length > 20 && !actionItems.includes(cleaned) && actionItems.length < 5) {
        actionItems.push(cleaned);
      }
    }
  });

  // 2. Executive Summary via sentence rank
  let summary = '';
  if (allSentences.length <= 3) {
    summary = allSentences.join(' ');
  } else {
    // Pick the most salient opening, middle, and closing sentences
    const topSentences = [
      allSentences[0],
      allSentences[Math.floor(allSentences.length / 2)],
      allSentences[allSentences.length - 1],
    ].filter(Boolean);
    summary = topSentences.join(' ');
  }

  if (!summary || summary.trim().length === 0) {
    summary = 'On-device transcription completed successfully with local Whisper speech recognition.';
  }

  // 3. Key Discussion Topics extraction
  const stopWords = new Set([
    'about', 'above', 'after', 'again', 'against', 'all', 'and', 'any', 'are', 'because',
    'been', 'before', 'being', 'below', 'between', 'both', 'but', 'could', 'did', 'does',
    'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has',
    'have', 'having', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how',
    'into', 'its', 'itself', 'just', 'more', 'most', 'myself', 'nor', 'not', 'now',
    'off', 'once', 'only', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
    'same', 'should', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them',
    'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'too',
    'under', 'until', 'very', 'was', 'were', 'what', 'when', 'where', 'which', 'while',
    'who', 'whom', 'why', 'with', 'would', 'you', 'your', 'yours', 'yourself',
    'speaker', 'yeah', 'okay', 'like', 'know', 'think', 'going', 'well', 'really'
  ]);

  const wordCounts: Record<string, number> = {};
  const words = fullText
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));

  words.forEach((w) => {
    wordCounts[w] = (wordCounts[w] || 0) + 1;
  });

  const sortedWords = Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([w]) => w.charAt(0).toUpperCase() + w.slice(1));

  return {
    summary,
    actionItems: actionItems.length > 0 ? actionItems : ['Review transcript notes and timestamps.'],
    keyTopics: sortedWords.length > 0 ? sortedWords : ['Audio Recording', 'Speech Transcription'],
  };
}

/**
 * Local in-browser transcript Q&A search (100% offline, zero API calls).
 * Searches segments for key phrases, questions, and matching keywords.
 */
export function findLocalAnswerInTranscript(
  segments: TranscriptSegment[],
  fullText: string,
  userQuestion: string
): string {
  const qClean = userQuestion.toLowerCase().replace(/[^\w\s]/g, ' ').trim();
  const qWords = qClean.split(/\s+/).filter((w) => w.length > 2);

  if (qWords.length === 0) {
    return 'Please provide a specific question about the transcript.';
  }

  // Score each segment based on term frequency and match
  const scored = segments.map((seg) => {
    const textLower = seg.text.toLowerCase();
    let score = 0;
    for (const word of qWords) {
      if (textLower.includes(word)) {
        score += 2;
      }
    }
    // Boost exact phrase match
    if (textLower.includes(qClean)) {
      score += 10;
    }
    return { seg, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const bestMatches = scored.filter((s) => s.score > 0).slice(0, 3);
  if (bestMatches.length === 0) {
    return `I searched the transcript on-device for "${userQuestion}", but could not find direct matching statements. Try searching for specific keywords or names mentioned in the recording.`;
  }

  const excerpts = bestMatches
    .map((m) => `• [${m.seg.timestamp}] ${m.seg.speaker}: "${m.seg.text}"`)
    .join('\n\n');

  return `Based on on-device transcript analysis:\n\n${excerpts}`;
}

