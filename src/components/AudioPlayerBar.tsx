import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Gauge } from 'lucide-react';
import { formatSeconds } from '../utils/audioHelpers';

interface AudioPlayerBarProps {
  audioUrl?: string;
  currentTime: number;
  onTimeUpdate: (seconds: number) => void;
  onSeek: (seconds: number) => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  audioUrl,
  currentTime,
  onTimeUpdate,
  onSeek,
  audioRef,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const handleTimeUpdate = () => {
      onTimeUpdate(audio.currentTime);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioRef, onTimeUpdate]);

  if (!audioUrl) return null;

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.error);
    }
  };

  const jump = (deltaSeconds: number) => {
    if (!audioRef.current) return;
    const newTime = Math.max(0, Math.min(audioRef.current.currentTime + deltaSeconds, duration || 9999));
    audioRef.current.currentTime = newTime;
    onSeek(newTime);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
    onSeek(val);
  };

  const cyclePlaybackRate = () => {
    const rates = [0.75, 1.0, 1.25, 1.5, 2.0];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIdx];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    audioRef.current.muted = nextMuted;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
      if (val === 0) setIsMuted(true);
      else if (isMuted) setIsMuted(false);
    }
  };

  return (
    <div
      id="synced-audio-player"
      className="sticky bottom-4 z-30 mx-auto w-full max-w-4xl rounded-2xl border border-zinc-200 bg-white/95 p-3.5 shadow-xl backdrop-blur-md transition"
    >
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      <div className="flex flex-col gap-2">
        {/* Progress scrub bar */}
        <div className="flex items-center gap-3">
          <span className="w-12 text-right font-mono text-xs font-medium text-zinc-500">
            {formatSeconds(currentTime)}
          </span>

          <input
            id="audio-scrub-slider"
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSliderChange}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-200 accent-zinc-900 transition focus:outline-none"
          />

          <span className="w-12 font-mono text-xs font-medium text-zinc-500">
            {formatSeconds(duration)}
          </span>
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              id="jump-backward-btn"
              onClick={() => jump(-5)}
              className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              title="Rewind 5 seconds"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            <button
              id="toggle-play-btn"
              onClick={togglePlay}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-sm transition hover:bg-zinc-800"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4 fill-current" />
              ) : (
                <Play className="ml-0.5 h-4 w-4 fill-current" />
              )}
            </button>

            <button
              id="jump-forward-btn"
              onClick={() => jump(5)}
              className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              title="Fast-forward 5 seconds"
            >
              <RotateCw className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            {/* Playback speed toggle */}
            <button
              id="playback-speed-btn"
              onClick={cyclePlaybackRate}
              className="flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
              title="Playback speed"
            >
              <Gauge className="h-3 w-3 text-zinc-500" />
              <span>{playbackRate}x</span>
            </button>

            {/* Volume control */}
            <div className="hidden items-center gap-1.5 sm:flex">
              <button
                id="mute-toggle-btn"
                onClick={toggleMute}
                className="rounded p-1 text-zinc-500 hover:text-zinc-800"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>
              <input
                id="volume-slider"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="h-1 w-16 cursor-pointer appearance-none rounded-lg bg-zinc-200 accent-zinc-800"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
