import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, RefreshCw, Sparkles, Loader2, AlertCircle, Radio } from 'lucide-react';
import { TranscriptionOptions, TranscriptionResult } from '../types';
import { formatSeconds } from '../utils/audioHelpers';

interface AudioRecorderProps {
  options: TranscriptionOptions;
  onTranscriptionComplete: (result: TranscriptionResult, audioUrl?: string) => void;
  isProcessing: boolean;
  setIsProcessing: (val: boolean) => void;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  options,
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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      stopCanvasVisualization();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (previewAudioUrl) URL.revokeObjectURL(previewAudioUrl);
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

    try {
      // Send as FormData file to /api/transcribe (which has zero file size limits)
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
      <div className="mb-4 flex items-center justify-between border-b border-zinc-100 pb-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Live Microphone Recording</h2>
          <p className="text-xs text-zinc-500">Record without duration limits directly in browser</p>
        </div>
        {isRecording && (
          <span className="flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-600/20 animate-pulse">
            <Radio className="h-3 w-3" />
            LIVE REC
          </span>
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
              : 'Recording in progress (uncapped duration)...'
            : recordedBlob
            ? 'Recording finished. Ready to transcribe.'
            : 'Click Start Recording to begin'}
        </p>

        {/* Controls */}
        <div className="mt-6 flex items-center gap-3">
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
                Stop & Review
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
                    Transcribing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                    Transcribe Audio
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
        <div id="mic-error-alert" className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <div className="flex-1">
            <p className="font-semibold">Microphone Error</p>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
};
