import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Square,
  Play,
  Pause,
  RefreshCw,
  Sparkles,
  Loader2,
  AlertCircle,
  Radio,
  Cpu,
  Cloud,
  ShieldCheck,
} from 'lucide-react';
import { TranscriptionOptions, TranscriptionResult, TranscriptionEngine } from '../types';
import { formatSeconds } from '../utils/audioHelpers';
import { transcribeAudioClientSide } from '../services/localTranscriber';
import { WebSpeechRecognizer } from '../services/webSpeechService';

interface AudioRecorderProps {
  options: TranscriptionOptions;
  onChangeEngine?: (engine: TranscriptionEngine) => void;
  onTranscriptionComplete: (result: TranscriptionResult, audioUrl?: string) => void;
  isProcessing: boolean;
  setIsProcessing: (val: boolean) => void;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  options,
  onChangeEngine,
  onTranscriptionComplete,
  isProcessing,
  setIsProcessing,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [liveInterimSpeech, setLiveInterimSpeech] = useState<string>('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const webSpeechRef = useRef<WebSpeechRecognizer | null>(null);

  useEffect(() => {
    return () => {
      stopCanvasVisualization();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (previewAudioUrl) URL.revokeObjectURL(previewAudioUrl);
      if (webSpeechRef.current) webSpeechRef.current.stop();
    };
  }, [previewAudioUrl]);

  const startCanvasVisualization = (stream: MediaStream) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        animationFrameRef.current = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 2;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height * 0.85;

          ctx.fillStyle = '#18181b'; // zinc-900
          ctx.beginPath();
          ctx.roundRect(x, (canvas.height - barHeight) / 2, barWidth - 2, Math.max(barHeight, 4), 2);
          ctx.fill();

          x += barWidth;
        }
      };

      draw();
    } catch (e) {
      console.warn('Canvas audio visualization not supported:', e);
    }
  };

  const stopCanvasVisualization = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const startRecording = async () => {
    setErrorMessage(null);
    setRecordedBlob(null);
    setLiveInterimSpeech('');
    if (previewAudioUrl) {
      URL.revokeObjectURL(previewAudioUrl);
      setPreviewAudioUrl(null);
    }
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const fullBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setRecordedBlob(fullBlob);
        const url = URL.createObjectURL(fullBlob);
        setPreviewAudioUrl(url);

        // Stop all tracks on the stream
        stream.getTracks().forEach((track) => track.stop());
        stopCanvasVisualization();
      };

      mediaRecorder.start(250); // Collect in 250ms chunks
      setIsRecording(true);
      setIsPaused(false);
      setRecordDuration(0);

      timerIntervalRef.current = window.setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);

      startCanvasVisualization(stream);

      // Start optional Web Speech live listener for live speech preview
      if (WebSpeechRecognizer.isSupported()) {
        try {
          const speech = new WebSpeechRecognizer();
          webSpeechRef.current = speech;
          speech.start(options.language, {
            onInterimResult: (txt) => setLiveInterimSpeech(txt),
            onFinalResult: (txt) => setLiveInterimSpeech((prev) => (prev ? `${prev} ${txt}` : txt)),
            onError: () => {},
            onEnd: () => {},
          });
        } catch {}
      }
    } catch (err: any) {
      console.error('Microphone access failed:', err);
      setErrorMessage(
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? 'Microphone access was denied. Please allow microphone permissions in your browser.'
          : 'Could not access microphone: ' + (err.message || 'Unknown error')
      );
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerIntervalRef.current = window.setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (webSpeechRef.current) {
      webSpeechRef.current.stop();
      webSpeechRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  const resetRecording = () => {
    stopRecording();
    setRecordedBlob(null);
    setLiveInterimSpeech('');
    if (previewAudioUrl) {
      URL.revokeObjectURL(previewAudioUrl);
      setPreviewAudioUrl(null);
    }
    setRecordDuration(0);
    setErrorMessage(null);
  };

  const transcribeRecording = async () => {
    if (!recordedBlob) return;

    setIsProcessing(true);
    setErrorMessage(null);

    // 1. CLIENT-SIDE ON-DEVICE (Zero Upload)
    if (options.engine === 'client') {
      try {
        setProcessingStage('Decoding recording locally in browser...');
        const file = new File([recordedBlob], `voice-recording-${Date.now()}.webm`, {
          type: recordedBlob.type || 'audio/webm',
        });

        const result = await transcribeAudioClientSide(
          file,
          'Voice Recording (On-Device)',
          options,
          ({ stage, message }) => {
            setProcessingStage(message);
          }
        );

        setIsProcessing(false);
        onTranscriptionComplete(result, previewAudioUrl || undefined);
      } catch (err: any) {
        console.error('Client-side recording transcription error:', err);

        // Fallback: If Web Speech API captured spoken text during recording, recover seamlessly
        if (liveInterimSpeech && liveInterimSpeech.trim().length > 0) {
          const fallbackResult: TranscriptionResult = {
            id: `rec-${Date.now()}`,
            fileName: 'Voice Recording (Web Speech)',
            fileSize: recordedBlob.size,
            fileSizeFormatted: `${(recordedBlob.size / 1024).toFixed(1)} KB`,
            durationSeconds: recordDuration,
            durationFormatted: formatSeconds(recordDuration),
            detectedLanguage: options.language === 'auto' ? 'English (Auto-detected)' : options.language,
            createdAt: new Date().toISOString(),
            fullText: liveInterimSpeech.trim(),
            segments: [
              {
                id: 'seg-fallback-0',
                speaker: 'Speaker 1',
                startSeconds: 0,
                timestamp: `00:00 - ${formatSeconds(recordDuration)}`,
                text: liveInterimSpeech.trim(),
              },
            ],
          };
          setIsProcessing(false);
          onTranscriptionComplete(fallbackResult, previewAudioUrl || undefined);
          return;
        }

        setIsProcessing(false);
        const msg = err?.message || '';
        if (msg.includes('TransposeDQWeightsForMatMulNBits') || msg.includes('scale')) {
          setErrorMessage(
            'ONNX quantized model session error encountered. We have updated the precision to FP32. Please click Transcribe again, or switch to Cloud mode.'
          );
        } else {
          setErrorMessage(
            msg || 'On-device transcription failed. Please click Transcribe again or switch to Cloud mode.'
          );
        }
      }
      return;
    }

    // 2. CLOUD GEMINI STREAMING
    try {
      setProcessingStage('Streaming recording to Cloud AI engine...');
      const file = new File([recordedBlob], `voice-recording-${Date.now()}.webm`, {
        type: recordedBlob.type || 'audio/webm',
      });

      const formData = new FormData();
      formData.append('audio', file);
      formData.append('language', options.language);
      formData.append('detectSpeakers', String(options.detectSpeakers));
      formData.append('timestampGranularity', options.timestampGranularity);
      formData.append('customVocabulary', options.customVocabulary);

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server responded with ${response.status}`);
      }

      const result: TranscriptionResult = await response.json();
      setIsProcessing(false);
      onTranscriptionComplete(result, previewAudioUrl || undefined);
    } catch (err: any) {
      console.error('Recording transcription error:', err);
      setIsProcessing(false);
      setErrorMessage(err.message || 'Failed to transcribe recording.');
    }
  };

  const togglePreviewPlayback = () => {
    if (!previewAudioRef.current) return;
    if (isPlayingPreview) {
      previewAudioRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      previewAudioRef.current.play();
      setIsPlayingPreview(true);
    }
  };

  return (
    <div id="audio-recorder-card" className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-zinc-900">Live Microphone Recording</h2>
            {options.engine === 'client' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
                <ShieldCheck className="h-3 w-3" />
                On-Device (100% Private)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-600/20">
                <Cloud className="h-3 w-3" />
                Cloud Engine
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            {options.engine === 'client'
              ? 'Transcribe locally on your device with no backend upload or cloud fees.'
              : 'Record and transcribe using Gemini cloud intelligence.'}
          </p>
        </div>

        {/* Engine Switcher Quick Pill */}
        {onChangeEngine && (
          <div className="flex items-center rounded-xl bg-zinc-100 p-1">
            <button
              type="button"
              onClick={() => onChangeEngine('client')}
              disabled={isProcessing || isRecording}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                options.engine === 'client'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Cpu className="h-3.5 w-3.5 text-emerald-600" />
              <span>On-Device</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeEngine('cloud')}
              disabled={isProcessing || isRecording}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                options.engine === 'cloud'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Cloud className="h-3.5 w-3.5 text-blue-600" />
              <span>Cloud</span>
            </button>
          </div>
        )}
      </div>

      {/* Recording Stage / Visualizer */}
      <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50/60 p-6">
        <canvas
          ref={canvasRef}
          width={360}
          height={64}
          className="h-16 w-full max-w-sm rounded-lg"
        />

        {/* Duration Timer */}
        <div className="mt-3 font-mono text-3xl font-bold tracking-tight text-zinc-900">
          {formatSeconds(recordDuration)}
        </div>

        <p className="mt-1 text-xs text-zinc-500">
          {isRecording
            ? isPaused
              ? 'Recording paused'
              : 'Recording in progress (zero duration limit)...'
            : recordedBlob
            ? 'Recording finished. Ready to transcribe.'
            : 'Click Start Recording to begin'}
        </p>

        {/* Live speech preview if available */}
        {isRecording && liveInterimSpeech && (
          <div className="mt-3 max-w-md rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-700 shadow-xs">
            <span className="font-semibold text-zinc-900">Live preview: </span>
            <span className="italic">{liveInterimSpeech}</span>
          </div>
        )}

        {/* Controls */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {!isRecording && !recordedBlob && (
            <button
              id="start-mic-record-btn"
              onClick={startRecording}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-50"
            >
              <Mic className="h-4 w-4 text-rose-400" />
              Start Recording
            </button>
          )}

          {isRecording && (
            <>
              {isPaused ? (
                <button
                  id="resume-record-btn"
                  onClick={resumeRecording}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Resume
                </button>
              ) : (
                <button
                  id="pause-record-btn"
                  onClick={pauseRecording}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  <Pause className="h-3.5 w-3.5" />
                  Pause
                </button>
              )}

              <button
                id="stop-record-btn"
                onClick={stopRecording}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                Stop &amp; Review
              </button>
            </>
          )}

          {recordedBlob && !isRecording && (
            <>
              <button
                id="preview-record-btn"
                onClick={togglePreviewPlayback}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                {isPlayingPreview ? (
                  <>
                    <Pause className="h-3.5 w-3.5" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-current" />
                    Play Preview
                  </>
                )}
              </button>

              <button
                id="restart-record-btn"
                onClick={resetRecording}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retake
              </button>

              <button
                id="transcribe-record-btn"
                onClick={transcribeRecording}
                disabled={isProcessing}
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {processingStage || 'Transcribing...'}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                    {options.engine === 'client' ? 'Transcribe On Device' : 'Transcribe Audio'}
                  </>
                )}
              </button>
            </>
          )}
        </div>

        {/* Hidden Audio element for preview playback */}
        {previewAudioUrl && (
          <audio
            ref={previewAudioRef}
            src={previewAudioUrl}
            onEnded={() => setIsPlayingPreview(false)}
            className="hidden"
          />
        )}
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div id="mic-error-alert" className="mt-4 flex flex-col gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            <div className="flex-1">
              <p className="font-semibold">
                {errorMessage.toLowerCase().includes('microphone') ? 'Microphone Issue' : 'Transcription Notice'}
              </p>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
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
                  transcribeRecording();
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
