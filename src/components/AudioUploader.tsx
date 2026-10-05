import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  FileAudio,
  AlertCircle,
  CheckCircle2,
  Loader2,
  HardDrive,
  Clock,
  Radio,
  X,
  Cpu,
  Cloud,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { TranscriptionOptions, TranscriptionResult, TranscriptionEngine } from '../types';
import { formatFileSize } from '../utils/audioHelpers';
import { transcribeAudioClientSide } from '../services/localTranscriber';
import { getStoredAdminToken } from '../services/adminAuth';

interface AudioUploaderProps {
  options: TranscriptionOptions;
  onChangeEngine?: (engine: TranscriptionEngine) => void;
  onTranscriptionComplete: (result: TranscriptionResult, audioFileUrl?: string) => void;
  isProcessing: boolean;
  setIsProcessing: (val: boolean) => void;
  cloudConversionEnabled?: boolean;
  isAdmin?: boolean;
}

export const AudioUploader: React.FC<AudioUploaderProps> = ({
  options,
  onChangeEngine,
  onTranscriptionComplete,
  isProcessing,
  setIsProcessing,
  cloudConversionEnabled = false,
  isAdmin = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadSpeed, setUploadSpeed] = useState<string>('');
  const [stageText, setStageText] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeXhrRef = useRef<XMLHttpRequest | null>(null);

  const handleFile = (file: File) => {
    if (!file) return;
    setErrorMessage(null);
    setSelectedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleCancel = () => {
    if (activeXhrRef.current) {
      activeXhrRef.current.abort();
      activeXhrRef.current = null;
    }
    setIsProcessing(false);
    setUploadProgress(0);
    setStageText('');
  };

  const startTranscription = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setUploadProgress(0);

    // Create a local object URL for playback
    const localAudioUrl = URL.createObjectURL(selectedFile);

    // 1. CLIENT-SIDE ON-DEVICE TRANSCRIPTION (Zero Backend Upload, 100% In-Browser)
    if (options.engine === 'client') {
      try {
        setStageText('Reading audio and decoding locally via Web Audio API...');
        const result = await transcribeAudioClientSide(
          selectedFile,
          selectedFile.name,
          options,
          ({ stage, progressPercent, message }) => {
            setUploadProgress(progressPercent);
            setStageText(message);
          }
        );

        setIsProcessing(false);
        setUploadProgress(100);
        onTranscriptionComplete(result, localAudioUrl);
      } catch (err: any) {
        console.error('Client-side transcription error:', err);
        setIsProcessing(false);
        setErrorMessage(
          err?.message || 'Client-side transcription failed. Try switching to Cloud mode or retry.'
        );
      }
      return;
    }

    // 2. CLOUD BACKEND TRANSCRIPTION (Streaming via Gemini)
    setStageText('Uploading audio stream to zero-limit server buffer...');

    const formData = new FormData();
    formData.append('audio', selectedFile);
    formData.append('language', options.language);
    formData.append('detectSpeakers', String(options.detectSpeakers));
    formData.append('timestampGranularity', options.timestampGranularity);
    formData.append('customVocabulary', options.customVocabulary);

    const xhr = new XMLHttpRequest();
    activeXhrRef.current = xhr;

    let startTime = Date.now();
    let prevLoaded = 0;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percent);

        const currentTime = Date.now();
        const durationSec = (currentTime - startTime) / 1000;
        if (durationSec > 0.5) {
          const bytesDiff = event.loaded - prevLoaded;
          const speed = bytesDiff / durationSec;
          setUploadSpeed(`${formatFileSize(speed)}/s`);
          startTime = currentTime;
          prevLoaded = event.loaded;
        }

        if (percent >= 100) {
          setStageText('Processing & transcribing with Gemini Speech Engine...');
        } else {
          setStageText(
            `Streaming audio payload (${formatFileSize(event.loaded)} / ${formatFileSize(event.total)})...`
          );
        }
      }
    };

    xhr.onload = () => {
      activeXhrRef.current = null;
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          setIsProcessing(false);
          setUploadProgress(100);
          onTranscriptionComplete(data, localAudioUrl);
        } catch (e: any) {
          setIsProcessing(false);
          setErrorMessage('Could not parse server response: ' + e.message);
        }
      } else {
        setIsProcessing(false);
        try {
          const errData = JSON.parse(xhr.responseText);
          setErrorMessage(errData.error || `Server error (${xhr.status})`);
        } catch {
          setErrorMessage(`Transcription failed with status ${xhr.status}.`);
        }
      }
    };

    xhr.onerror = () => {
      activeXhrRef.current = null;
      setIsProcessing(false);
      setErrorMessage('Network connection error while uploading. Please retry.');
    };

    xhr.onabort = () => {
      activeXhrRef.current = null;
      setIsProcessing(false);
    };

    xhr.open('POST', '/api/transcribe');
    const token = getStoredAdminToken();
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    xhr.send(formData);
  };

  const isCloudAllowed = cloudConversionEnabled || isAdmin;

  return (
    <div
      id="audio-uploader-card"
      className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:border-zinc-300"
    >
      {/* Header Info with Engine Mode Badge & Selector */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-zinc-900">Upload Audio File</h2>
            {options.engine === 'client' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
                <ShieldCheck className="h-3 w-3" />
                On-Device (Zero Upload / 100% Private)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-600/20">
                <Cloud className="h-3 w-3" />
                Cloud Server Engine
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            {options.engine === 'client'
              ? 'Audio runs directly inside your browser via Transformers.js Whisper. No files are uploaded to any server.'
              : 'Uncapped file size stream pipeline powered by Gemini Cloud speech intelligence.'}
          </p>
        </div>

        {/* Engine Switcher Quick Pill */}
        {onChangeEngine && (
          <div className="flex items-center rounded-xl bg-zinc-100 p-1">
            <button
              type="button"
              onClick={() => onChangeEngine('client')}
              disabled={isProcessing}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                options.engine === 'client'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Cpu className="h-3.5 w-3.5 text-emerald-600" />
              <span>On-Device (Client)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (isCloudAllowed) {
                  onChangeEngine('cloud');
                }
              }}
              disabled={isProcessing || !isCloudAllowed}
              title={
                isCloudAllowed
                  ? 'Switch to Cloud Gemini Engine'
                  : 'Cloud conversion is temporarily paused by administrator. On-Device Whisper is active.'
              }
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                options.engine === 'cloud'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : isCloudAllowed
                  ? 'text-zinc-600 hover:text-zinc-900'
                  : 'text-zinc-400 cursor-not-allowed opacity-60'
              }`}
            >
              {!isCloudAllowed ? (
                <Lock className="h-3 w-3 text-zinc-400" />
              ) : (
                <Cloud className="h-3.5 w-3.5 text-blue-600" />
              )}
              <span>Cloud (Gemini)</span>
              {!isCloudAllowed && (
                <span className="rounded bg-zinc-200 px-1 py-0.2 text-[9px] font-normal text-zinc-600">
                  Paused
                </span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Drag and Drop Zone */}
      {!selectedFile && !isProcessing ? (
        <div
          id="dropzone-area"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition ${
            isDragOver
              ? 'border-zinc-900 bg-zinc-50 scale-[1.005]'
              : 'border-zinc-300 bg-zinc-50/50 hover:border-zinc-400 hover:bg-zinc-50'
          }`}
        >
          <input
            id="audio-file-input"
            ref={fileInputRef}
            type="file"
            accept="audio/*,video/mp4,video/quicktime,video/x-matroska,.mp3,.wav,.m4a,.aac,.ogg,.flac,.webm,.wma,.mp4,.mov,.mkv"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFile(e.target.files[0]);
              }
            }}
          />

          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200 transition group-hover:scale-105">
            <UploadCloud className="h-7 w-7 text-zinc-700" />
          </div>

          <p className="text-sm font-medium text-zinc-800">
            Drag and drop your audio or video file here, or{' '}
            <span className="text-zinc-900 underline underline-offset-2">browse</span>
          </p>

          <p className="mt-2 text-xs text-zinc-500">
            Supports MP3, WAV, M4A, AAC, OGG, FLAC, WEBM, WMA, MP4, MOV
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] text-zinc-600">
            {options.engine === 'client' ? (
              <>
                <span className="rounded-full bg-emerald-50 text-emerald-800 px-2.5 py-0.5 border border-emerald-200 font-medium">
                  100% In-Browser Processing
                </span>
                <span className="rounded-full bg-white px-2.5 py-0.5 border border-zinc-200">
                  Zero Server Upload
                </span>
                <span className="rounded-full bg-white px-2.5 py-0.5 border border-zinc-200">
                  WASM &amp; WebGPU Accelerated
                </span>
              </>
            ) : (
              <>
                <span className="rounded-full bg-white px-2.5 py-0.5 border border-zinc-200">
                  50MB • 500MB • 2GB+
                </span>
                <span className="rounded-full bg-white px-2.5 py-0.5 border border-zinc-200">
                  Auto Language Detection
                </span>
                <span className="rounded-full bg-white px-2.5 py-0.5 border border-zinc-200">
                  Speaker Diarization
                </span>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* Selected File State (Ready to Transcribe) */}
      {selectedFile && !isProcessing && (
        <div id="file-selected-box" className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-zinc-700 shadow-sm border border-zinc-200">
                <FileAudio className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-900">{selectedFile.name}</p>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span>{formatFileSize(selectedFile.size)}</span>
                  <span>•</span>
                  <span>{selectedFile.type || 'audio'}</span>
                  <span>•</span>
                  <span className="text-emerald-700 font-medium">
                    {options.engine === 'client' ? 'Ready (Local In-Browser)' : 'Ready (Cloud Stream)'}
                  </span>
                </div>
              </div>
            </div>

            <button
              id="remove-selected-file-btn"
              onClick={() => setSelectedFile(null)}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-600"
              title="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-3">
            <div className="text-xs text-zinc-500">
              {options.engine === 'client'
                ? 'Will transcribe 100% on device using client-side Whisper (no upload).'
                : 'Using streaming upload pipeline with timestamps and speaker detection.'}
            </div>
            <div className="flex items-center gap-2">
              <button
                id="choose-different-file-btn"
                onClick={() => setSelectedFile(null)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
              >
                Change File
              </button>
              <button
                id="start-transcription-btn"
                onClick={startTranscription}
                className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-zinc-800"
              >
                {options.engine === 'client' ? 'Transcribe On Device' : 'Start Cloud Transcription'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Uploading & Processing State */}
      {isProcessing && (
        <div id="processing-progress-box" className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <Loader2 className="h-4 w-4 animate-spin text-zinc-800" />
              <span className="text-sm font-medium text-zinc-900">
                {selectedFile?.name || 'Processing Audio'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {uploadSpeed && (
                <span className="text-xs font-mono text-zinc-500">{uploadSpeed}</span>
              )}
              <span className="text-xs font-semibold text-zinc-900 font-mono">
                {uploadProgress}%
              </span>
              <button
                id="cancel-upload-btn"
                onClick={handleCancel}
                className="ml-2 rounded border border-zinc-300 bg-white px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-100"
              >
                Cancel
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200">
            <div
              className="h-full bg-zinc-900 transition-all duration-300 ease-out"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
            <span>{stageText}</span>
            <span>{options.engine === 'client' ? 'Client-Side On-Device' : 'No upload limit active'}</span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div id="upload-error-alert" className="mt-4 flex flex-col gap-2 rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 text-xs text-rose-800">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            <div className="flex-1">
              <p className="font-semibold">Transcription Notice</p>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-500 hover:text-rose-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {options.engine === 'client' && onChangeEngine && (
            <div className="mt-1 flex items-center gap-2 pl-6">
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  onChangeEngine('cloud');
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-rose-700 border border-rose-300 shadow-xs hover:bg-rose-100"
              >
                Switch to Cloud (Gemini) Engine
              </button>
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  startTranscription();
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-rose-700 px-2.5 py-1 text-xs font-semibold text-white shadow-xs hover:bg-rose-800"
              >
                Retry On-Device
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
