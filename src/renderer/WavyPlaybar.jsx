import React, { useRef, useEffect, useCallback } from 'react';
import './WavyPlaybar.css';

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function WavyPlaybar({
  track,
  isPlaying,
  currentTime = 0,
  duration = 0,
  volume = 0.8,
  onPlayPause,
  onNext,
  onPrev,
  onSeek,
  onVolumeChange,
}) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const phaseRef = useRef(0);
  const ampRef = useRef(0.2);
  const isDraggingRef = useRef(false);

  const colors = track?.colors || ['#00d2ff', '#7cff67', '#5227ff'];
  const progressRatio = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;

  // Render loop for wavy canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let destroyed = false;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const render = () => {
      if (destroyed) return;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      ctx.clearRect(0, 0, w, h);

      // Target amplitude: active wave when playing, gentle breathing when paused
      const targetAmp = isPlaying ? 1.0 : 0.25;
      ampRef.current += (targetAmp - ampRef.current) * 0.08;
      phaseRef.current += (isPlaying ? 0.045 : 0.015);

      const phase = phaseRef.current;
      const amp = ampRef.current;
      const centerY = h * 0.5;

      // Draw background ambient wave (secondary harmonic)
      ctx.beginPath();
      for (let x = 0; x <= w; x += 3) {
        const nx = x / w;
        const wave = Math.sin(nx * 8 + phase * 0.7) * (10 * amp) +
                     Math.cos(nx * 4 - phase * 0.5) * (6 * amp);
        const y = centerY + wave;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Main vibrant wave with track color gradient
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, colors[0] || '#00d2ff');
      grad.addColorStop(0.5, colors[1] || '#7cff67');
      grad.addColorStop(1, colors[2] || '#5227ff');

      ctx.beginPath();
      let currentScrubberY = centerY;
      const scrubberX = progressRatio * w;

      for (let x = 0; x <= w; x += 2) {
        const nx = x / w;
        const wave = Math.sin(nx * 12 + phase) * (14 * amp) +
                     Math.sin(nx * 20 - phase * 1.3) * (5 * amp);
        const y = centerY + wave;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);

        if (Math.abs(x - scrubberX) < 2) {
          currentScrubberY = y;
        }
      }

      // Unplayed portion: dim
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Played portion: illuminated gradient with glow
      if (scrubberX > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, scrubberX, h);
        ctx.clip();

        ctx.beginPath();
        for (let x = 0; x <= scrubberX; x += 2) {
          const nx = x / w;
          const wave = Math.sin(nx * 12 + phase) * (14 * amp) +
                       Math.sin(nx * 20 - phase * 1.3) * (5 * amp);
          const y = centerY + wave;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = grad;
        ctx.lineWidth = 3.5;
        ctx.shadowColor = colors[0] || '#00d2ff';
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.restore();
      }

      // Glowing Scrubber handle dot on the wave
      if (progressRatio > 0 && progressRatio < 1) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(scrubberX, currentScrubberY, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = colors[0] || '#00d2ff';
        ctx.shadowBlur = 14;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(scrubberX, currentScrubberY, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = colors[0] || '#00d2ff';
        ctx.fill();
        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      destroyed = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      ro.disconnect();
    };
  }, [colors, isPlaying, progressRatio]);

  const handlePointerDown = (e) => {
    isDraggingRef.current = true;
    handleSeekEvent(e);
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return;
    handleSeekEvent(e);
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  const handleSeekEvent = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || duration <= 0) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek?.(fraction * duration);
  };

  return (
    <div className="wavy-playbar" role="region" aria-label="Audio Playbar">
      <div className="wavy-playbar__header">
        <div className="wavy-playbar__meta">
          <h3 className="wavy-playbar__title">{track?.title || 'Unknown Title'}</h3>
          <p className="wavy-playbar__artist">{track?.artist || 'Unknown Artist'}</p>
        </div>
        <span className="wavy-playbar__badge">
          {track?.genre || 'Cosmos'}
        </span>
      </div>

      {/* Interactive Wavy Canvas */}
      <div
        className="wavy-playbar__wave-container"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        title="Click or drag to seek"
      >
        <canvas ref={canvasRef} className="wavy-playbar__canvas" />
      </div>

      {/* Timestamps */}
      <div className="wavy-playbar__times">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Playback Controls */}
      <div className="wavy-playbar__controls">
        <div className="wavy-playbar__buttons">
          <button
            className="wavy-btn"
            onClick={onPrev}
            title="Previous Track"
            aria-label="Previous Track"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>

          <button
            className="wavy-btn wavy-btn--play"
            onClick={onPlayPause}
            title={isPlaying ? 'Pause' : 'Play'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: '2px' }}>
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button
            className="wavy-btn"
            onClick={onNext}
            title="Next Track"
            aria-label="Next Track"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>
        </div>

        {/* Volume Scrubber */}
        <div className="wavy-playbar__volume" title={`Volume: ${Math.round(volume * 100)}%`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.7 }}>
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
          </svg>
          <input
            type="range"
            min="0"
            max="1"
            step="0.02"
            value={volume}
            onChange={(e) => onVolumeChange?.(parseFloat(e.target.value))}
            aria-label="Volume slider"
          />
        </div>
      </div>
    </div>
  );
}

