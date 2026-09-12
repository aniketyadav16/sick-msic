import React, { useState, useRef, useEffect, useCallback } from 'react';
import Aurora from './Aurora';
import OptionWheel from './OptionWheel';
import ScrollExpand from './ScrollExpand';
import WavyPlaybar from './WavyPlaybar';
import './MusicApp.css';

// Base Cloudflare R2 Bucket URL for static music and image assets
const BASE_R2_URL = 'https://pub-74b555bb7c5040d49fc3ff86bc7905d1.r2.dev';

const COSMOS_THEMES = [
  { image: `${BASE_R2_URL}/images/earth-orbit.jpg`, genre: 'Earth Orbit', colors: ['#00d2ff', '#1e40af', '#090d16'] },
  { image: `${BASE_R2_URL}/images/galaxy-spiral.jpg`, genre: 'Spiral Galaxy', colors: ['#c084fc', '#6366f1', '#0f0728'] },
  { image: `${BASE_R2_URL}/images/scenic-earth-aurora.jpg`, genre: 'Scenic Aurora', colors: ['#4ade80', '#06b6d4', '#061727'] },
  { image: `${BASE_R2_URL}/images/space-nebula.jpg`, genre: 'Cosmic Nebula', colors: ['#fb923c', '#e11d48', '#1a0d16'] },
  { image: `${BASE_R2_URL}/images/scenic-earth-lake.jpg`, genre: 'Scenic Earth Lake', colors: ['#38bdf8', '#0284c7', '#081c24'] },
  { image: `${BASE_R2_URL}/images/galaxy-milkyway.jpg`, genre: 'Milky Way Galaxy', colors: ['#a855f7', '#3b82f6', '#090d16'] },
  { image: `${BASE_R2_URL}/images/earth-horizon.jpg`, genre: 'Orbital Horizon', colors: ['#38bdf8', '#2563eb', '#030712'] },
  { image: `${BASE_R2_URL}/images/scenic-earth-peaks.jpg`, genre: 'Scenic Alpine Peaks', colors: ['#818cf8', '#6366f1', '#0c0a1f'] },
  { image: `${BASE_R2_URL}/images/galaxy-andromeda.jpg`, genre: 'Andromeda Galaxy', colors: ['#f472b6', '#8b5cf6', '#12072b'] },
  { image: `${BASE_R2_URL}/images/scenic-earth-sunrise.jpg`, genre: 'Earth Alpine Sunrise', colors: ['#f59e0b', '#d97706', '#1c0f00'] },
  { image: `${BASE_R2_URL}/images/space-deep-field.jpg`, genre: 'Deep Space Starfield', colors: ['#60a5fa', '#a78bfa', '#090514'] },
  { image: `${BASE_R2_URL}/images/scenic-desert-galaxy.jpg`, genre: 'Celestial Earth Vista', colors: ['#ec4899', '#f97316', '#140810'] },
];

const DEFAULT_TRACKS = [
  { 
    title: 'Ambient Drift', 
    artist: 'Cosmic Explorers', 
    genre: 'Ambient', 
    image: `${BASE_R2_URL}/images/earth-orbit.jpg`, 
    url: `${BASE_R2_URL}/audio/ambient-drift.mp3`,
    colors: ['#00d2ff', '#3a7bd5', '#101015'] 
  },
  { 
    title: 'Neon Pulse', 
    artist: 'Starlight Beats', 
    genre: 'House', 
    image: `${BASE_R2_URL}/images/galaxy-spiral.jpg`, 
    url: `${BASE_R2_URL}/audio/neon-pulse.mp3`,
    colors: ['#7cff67', '#b497cf', '#5227ff'] 
  },
  { 
    title: 'Cyber Warehouse', 
    artist: 'Orbital Resonance', 
    genre: 'Techno', 
    image: `${BASE_R2_URL}/images/space-nebula.jpg`, 
    url: `${BASE_R2_URL}/audio/cyber-warehouse.mp3`,
    colors: ['#ff0055', '#7a00ff', '#0d0d11'] 
  },
  { 
    title: 'Midnight Session', 
    artist: 'Lunar Quartet', 
    genre: 'Jazz', 
    image: `${BASE_R2_URL}/images/scenic-earth-sunrise.jpg`, 
    url: `${BASE_R2_URL}/audio/midnight-session.mp3`,
    colors: ['#ffb347', '#ffcc33', '#1e1000'] 
  },
  { 
    title: 'Lo-Fi Chill', 
    artist: 'Aurora Soundscapes', 
    genre: 'Lo-Fi', 
    image: `${BASE_R2_URL}/images/scenic-earth-aurora.jpg`, 
    url: `${BASE_R2_URL}/audio/lofi-chill.mp3`,
    colors: ['#ff9a9e', '#fecfef', '#2b1055'] 
  },
  { 
    title: 'Retro Highway', 
    artist: 'Galactic Horizon', 
    genre: 'Synthwave', 
    image: `${BASE_R2_URL}/images/scenic-desert-galaxy.jpg`, 
    url: `${BASE_R2_URL}/audio/retro-highway.mp3`,
    colors: ['#ff007f', '#00f0ff', '#240046'] 
  }
];

export default function MusicApp() {
  const [tracks, setTracks] = useState(DEFAULT_TRACKS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [cleanMode, setCleanMode] = useState(false);

  const audioRef = useRef(null);
  const isPlayingRef = useRef(isPlaying);
  
  // Synchronize ref state to prevent stale closure scope in async handlers
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const currentTrack = tracks[currentIndex] || DEFAULT_TRACKS[0];

  // Cmd+R / Ctrl+R → Toggle Clean View Mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'r' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCleanMode((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load songs from optional local IPC backend if running inside Electron wrapper
  useEffect(() => {
    if (window.musicApp?.listLibrary) {
      window.musicApp
        .listLibrary()
        .then((localTracks) => {
          if (Array.isArray(localTracks) && localTracks.length > 0) {
            const mapped = localTracks.map((item, idx) => {
              const theme = COSMOS_THEMES[idx % COSMOS_THEMES.length];
              return {
                id: item.id || `track-${idx}`,
                title: item.title || 'Untitled Track',
                artist: item.artist || 'Aria Music',
                duration: Number(item.duration) || 0,
                url: item.url || theme.image,
                path: item.path || '',
                genre: theme.genre,
                image: theme.image,
                colors: theme.colors,
              };
            });
            setTracks(mapped);
          }
        })
        .catch((err) => {
          console.warn('Could not load local library, using cloud defaults:', err);
        });
    }
  }, []);

  // Next and Previous Track Handlers
  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % tracks.length);
  }, [tracks.length]);

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + tracks.length) % tracks.length);
  }, [tracks.length]);

  // Handle Play / Pause Toggle
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      if (!audio.src && currentTrack.url) {
        audio.src = currentTrack.url;
      }
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn('Playback error:', err);
          setIsPlaying(false);
        });
    }
  }, [isPlaying, currentTrack.url]);

  // Native Mobile & System Lockscreen Controls (Media Session API)
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist || 'Cosmic Music',
        album: currentTrack.genre || 'Aria Cosmos',
        artwork: [
          { src: currentTrack.image, sizes: '512x512', type: 'image/jpeg' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', togglePlay);
      navigator.mediaSession.setActionHandler('pause', togglePlay);
      navigator.mediaSession.setActionHandler('previoustrack', handlePrev);
      navigator.mediaSession.setActionHandler('nexttrack', handleNext);
    }
  }, [currentTrack, togglePlay, handlePrev, handleNext]);

  // Track change side-effects and continuous stream handler
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (currentTrack.url) {
      audio.src = currentTrack.url;
      audio.load();
      
      if (isPlayingRef.current) {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => setIsPlaying(true))
            .catch((err) => {
              console.warn('Autoplay prevented on track switch:', err);
              setIsPlaying(false);
            });
        }
      }
    }
    setCurrentTime(0);
    setDuration(currentTrack.duration || 0);
  }, [currentIndex, currentTrack.url]);

  const handleSeek = useCallback((newTime) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, []);

  const handleVolumeChange = useCallback((newVol) => {
    setVolume(newVol);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
    }
  }, []);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current && audioRef.current.duration) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    isPlayingRef.current = true;
    setIsPlaying(true);
    handleNext();
  };

  const handleWheelChange = (index) => {
    setCurrentIndex(index);
    isPlayingRef.current = true;
    setIsPlaying(true);
  };

  return (
    <main className={`music-app${cleanMode ? ' music-app--clean' : ''}`}>
      {/* HTML5 Audio Element for Cloud R2 Streaming */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      {/* Background Layer: Animated WebGL Aurora */}
      <div className="music-app__bg">
        <Aurora
          colorStops={currentTrack.colors}
          blend={0.65}
          amplitude={1.2}
          speed={0.4}
        />
        <div className="music-app__vignette" />
      </div>

      {/* Main Grid Viewport */}
      <div className="music-app__content">
        {/* Left Side: Option Wheel */}
        <section className="music-app__wheel-panel">
          <div className="music-app__panel-brand">
            <span className="brand-dot" style={{ background: currentTrack.colors[0] }} />
            <span>ARIA COSMOS</span>
          </div>
          <OptionWheel
            items={tracks.map((t) => t.title)}
            defaultSelected={0}
            side="left"
            textColor="#71717a"
            activeColor="#ffffff"
            fontSize={2.2}
            spacing={1.45}
            curve={1.2}
            tilt={7}
            blur={3}
            fade={0.3}
            inset={40}
            loop={true}
            draggable={true}
            soundUrl="/sounds/click-soft.mp3"
            soundVolume={0.4}
            onChange={handleWheelChange}
          />
        </section>

        {/* Right Side: Scroll Expand Image Showcase */}
        <section className="music-app__display-panel">
          <ScrollExpand
            key={currentTrack.id || currentTrack.title}
            src={currentTrack.image}
            alt={currentTrack.title}
            title={cleanMode ? '' : currentTrack.title}
            scrollHint={cleanMode ? '' : 'Scroll to expand • Reveal wavy playbar'}
            startWidth={56}
            startHeight={66}
            startRadius={22}
            endRadius={0}
            mediaZoom={1.2}
            scrollDistance={1.0}
            useWindowScroll={false}
          >
            {!cleanMode && (
              <div className="track-details">
                <div className="track-details__meta">
                  <h2>{currentTrack.title}</h2>
                  <p>{currentTrack.artist} • {currentTrack.genre}</p>
                </div>

                {/* Wavy Playbar */}
                <WavyPlaybar
                  track={currentTrack}
                  isPlaying={isPlaying}
                  currentTime={currentTime}
                  duration={duration || currentTrack.duration}
                  volume={volume}
                  onPlayPause={togglePlay}
                  onNext={handleNext}
                  onPrev={handlePrev}
                  onSeek={handleSeek}
                  onVolumeChange={handleVolumeChange}
                />
              </div>
            )}
          </ScrollExpand>
        </section>
      </div>
    </main>
  );
}
