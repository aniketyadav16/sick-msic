import React, { useRef, useState } from 'react';
import ClassicPlaybar from './ClassicPlaybar';
import './PlaybarStudio.css';

const STYLES = ['wave', 'mixtape', 'orbit'];
const LABELS = { wave: 'Wave', mixtape: 'Mixtape', orbit: 'Orbit' };
const STORAGE_KEY = 'aria.playbar.style.v1';
const time = (value) => {
  const seconds = Number.isFinite(value) ? Math.max(0, value) : 0;
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
};

function Icon({ name, size = 20 }) {
  const paths = {
    play: 'M8 5v14l11-7z', pause: 'M6 5h4v14H6zm8 0h4v14h-4z',
    previous: 'M6 6h2v12H6zm3.5 6l8.5 6V6z', next: 'M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z',
    volume: 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z',
    muted: 'M3 9v6h4l5 5V4L7 9H3zm12.4-.4L14 10l2 2-2 2 1.4 1.4 2-2 2 2L20.8 14l-2-2 2-2-1.4-1.4-2 2z',
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={paths[name]} /></svg>;
}

function Transport({ isPlaying, onPlayPause, onPrev, onNext, volume, onVolumeChange }) {
  const previousVolume = useRef(0.8);
  const value = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0.8;
  return <div className="studio-transport">
    <div className="studio-transport__main">
      <button type="button" aria-label="Previous Track" title="Previous track" onClick={onPrev}><Icon name="previous" /></button>
      <button type="button" className="studio-play" aria-label={isPlaying ? 'Pause' : 'Play'} onClick={onPlayPause}><Icon name={isPlaying ? 'pause' : 'play'} size={24} /></button>
      <button type="button" aria-label="Next Track" title="Next track" onClick={onNext}><Icon name="next" /></button>
    </div>
    <div className="studio-volume">
      <button type="button" aria-label={value > 0 ? 'Mute' : 'Unmute'} title={value > 0 ? 'Mute' : 'Unmute'} onClick={() => {
        if (value > 0) { previousVolume.current = value; onVolumeChange?.(0); }
        else onVolumeChange?.(previousVolume.current);
      }}><Icon name={value > 0 ? 'volume' : 'muted'} size={17} /></button>
      <input type="range" min="0" max="1" step="0.02" value={value} aria-label="Volume slider" onChange={(e) => onVolumeChange?.(Number(e.target.value))} />
    </div>
  </div>;
}

function Seek({ currentTime, duration, onSeek }) {
  const length = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const current = Number.isFinite(currentTime) ? Math.min(length, Math.max(0, currentTime)) : 0;
  return <div className="studio-seek">
    <div className="studio-seek__track" style={{ '--progress': `${length ? current / length * 100 : 0}%` }}>
      <input type="range" min="0" max={length || 1} step="0.1" value={current} disabled={!length}
        aria-label="Seek through song" aria-valuetext={`${time(current)} of ${time(length)}`} onChange={(e) => onSeek?.(Number(e.target.value))} />
    </div>
    <div className="studio-times"><span>{time(current)}</span><span>{time(length)}</span></div>
  </div>;
}

function Reel({ side }) {
  return <div className={`tape-reel tape-reel--${side}`} aria-hidden="true"><div className="tape-reel__hub"><i /><i /><i /></div></div>;
}

function Mixtape(props) {
  return <div className={`studio-surface mixtape ${props.isPlaying ? 'is-playing' : ''}`} role="region" aria-label="Audio Playbar — Mixtape">
    <div className="mixtape__topline"><span><i /> ARIA / ANALOG SERIES</span><span>VOL. 01</span></div>
    <div className="cassette">
      <div className="cassette__label">
        <div className="cassette__side">A<span>STEREO</span></div>
        <div className="cassette__meta"><h3 title={props.track?.title}>{props.track?.title || 'Your next favorite'}</h3><p>{props.track?.artist || 'Aria Music'}</p></div>
        <span className="cassette__length">{time(props.duration)}<small>PLAY TIME</small></span>
      </div>
      <div className="cassette__mechanism">
        <Reel side="left" /><div className="cassette__window"><div /><span>MAGNETIC / 01</span></div><Reel side="right" />
      </div>
      <div className="cassette__stripes" aria-hidden="true" /><div className="cassette__bottom" aria-hidden="true"><i /><span /><i /></div>
      <b className="cassette__screw cassette__screw--left" aria-hidden="true">+</b><b className="cassette__screw cassette__screw--right" aria-hidden="true">+</b>
    </div>
    <div className="mixtape__status"><span>{props.isPlaying ? '● TAPE ROLLING' : '○ ON STANDBY'}</span><span>A LITTLE NOSTALGIA. A LOT OF FEELING.</span></div>
    <Seek {...props} /><Transport {...props} />
  </div>;
}

function Orbit(props) {
  const progress = props.duration > 0 ? Math.max(0, Math.min(1, props.currentTime / props.duration)) : 0;
  const title = props.track?.title || 'Your next favorite';
  return <div className={`studio-surface orbit ${props.isPlaying ? 'is-playing' : ''}`} role="region" aria-label="Audio Playbar — Orbit">
    <div className="orbit__topline"><span><i /> DEEP LISTENING</span><span>33⅓ RPM</span></div>
    <div className="orbit__body">
      <div className="orbit__disc" aria-hidden="true">
        <svg className="orbit__ring" viewBox="0 0 180 180"><circle cx="90" cy="90" r="84" /><circle className="orbit__progress" cx="90" cy="90" r="84" pathLength="100" strokeDasharray={`${progress * 100} 100`} /></svg>
        <div className="orbit__vinyl"><div className="orbit__label">ARIA<span>✦</span><small>SIDE A</small></div></div>
        <div className="orbit__needle" />
      </div>
      <div className="orbit__meta"><span className="orbit__eyebrow">{props.isPlaying ? 'IN ROTATION' : 'READY WHEN YOU ARE'}</span><h3 title={title}>{title}</h3><p>{props.track?.artist || 'Aria Music'}</p><div className="orbit__signal" aria-hidden="true">{[0, 1, 2, 3, 4, 5, 6].map((i) => <i key={i} style={{ '--i': i }} />)}</div></div>
    </div>
    <Seek {...props} /><Transport {...props} />
  </div>;
}

export function PlaybarSurface({ variant, ...props }) {
  if (variant === 'mixtape') return <Mixtape {...props} />;
  if (variant === 'orbit') return <Orbit {...props} />;
  return <ClassicPlaybar {...props} />;
}

export default function WavyPlaybar(props) {
  const [variant, setVariant] = useState(() => {
    try { const stored = localStorage.getItem(STORAGE_KEY); if (STYLES.includes(stored)) return stored; } catch {}
    return 'mixtape';
  });
  function choose(style) {
    setVariant(style);
    try { localStorage.setItem(STORAGE_KEY, style); } catch {}
  }
  return <div className="playbar-studio">
    <div className="playbar-studio__switcher" role="group" aria-label="Player style">
      <span>CHANGE THE FEEL</span>
      <div>{STYLES.map((style, index) => <button type="button" key={style} aria-pressed={variant === style} onClick={() => choose(style)}><span aria-hidden="true">0{index + 1}</span>{LABELS[style]}</button>)}</div>
    </div>
    <PlaybarSurface variant={variant} {...props} />
  </div>;
}
