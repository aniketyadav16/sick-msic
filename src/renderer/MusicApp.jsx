import React, { useState, useRef, useEffect, useCallback } from 'react';
import Aurora from './Aurora';
import OptionWheel from './OptionWheel';
import ScrollExpand from './ScrollExpand';
import WavyPlaybar from './WavyPlaybar';
import './MusicApp.css';

const COSMOS_THEMES = [
  { image: '/images/cosmos/earth-orbit.jpg', genre: 'Earth Orbit', colors: ['#00d2ff', '#1e40af', '#090d16'] },
  { image: '/images/cosmos/galaxy-spiral.jpg', genre: 'Spiral Galaxy', colors: ['#c084fc', '#6366f1', '#0f0728'] },
  { image: '/images/cosmos/scenic-earth-aurora.jpg', genre: 'Scenic Aurora', colors: ['#4ade80', '#06b6d4', '#061727'] },
  { image: '/images/cosmos/space-nebula.jpg', genre: 'Cosmic Nebula', colors: ['#fb923c', '#e11d48', '#1a0d16'] },
  { image: '/images/cosmos/scenic-earth-lake.jpg', genre: 'Scenic Earth Lake', colors: ['#38bdf8', '#0284c7', '#081c24'] },
  { image: '/images/cosmos/galaxy-milkyway.jpg', genre: 'Milky Way Galaxy', colors: ['#a855f7', '#3b82f6', '#090d16'] },
  { image: '/images/cosmos/earth-horizon.jpg', genre: 'Orbital Horizon', colors: ['#38bdf8', '#2563eb', '#030712'] },
  { image: '/images/cosmos/scenic-earth-peaks.jpg', genre: 'Scenic Alpine Peaks', colors: ['#818cf8', '#6366f1', '#0c0a1f'] },
  { image: '/images/cosmos/galaxy-andromeda.jpg', genre: 'Andromeda Galaxy', colors: ['#f472b6', '#8b5cf6', '#12072b'] },
  { image: '/images/cosmos/scenic-earth-sunrise.jpg', genre: 'Earth Alpine Sunrise', colors: ['#f59e0b', '#d97706', '#1c0f00'] },
  { image: '/images/cosmos/space-deep-field.jpg', genre: 'Deep Space Starfield', colors: ['#60a5fa', '#a78bfa', '#090514'] },
  { image: '/images/cosmos/scenic-desert-galaxy.jpg', genre: 'Celestial Earth Vista', colors: ['#ec4899', '#f97316', '#140810'] },
];

const DEFAULT_TRACKS = [
  { title: 'Ambient Drift', artist: 'Cosmic Explorers', genre: 'Ambient', image: '/images/cosmos/earth-orbit.jpg', colors: ['#00d2ff', '#3a7bd5', '#101015'] },
  { title: 'Neon Pulse', artist: 'Starlight Beats', genre: 'House', image: '/images/cosmos/galaxy-spiral.jpg', colors: ['#7cff67', '#b497cf', '#5227ff'] },
  { title: 'Cyber Warehouse', artist: 'Orbital Resonance', genre: 'Techno', image: '/images/cosmos/space-nebula.jpg', colors: ['#ff0055', '#7a00ff', '#0d0d11'] },
  { title: 'Midnight Session', artist: 'Lunar Quartet', genre: 'Jazz', image: '/images/cosmos/scenic-earth-sunrise.jpg', colors: ['#ffb347', '#ffcc33', '#1e1000'] },
  { title: 'Lo-Fi Chill', artist: 'Aurora Soundscapes', genre: 'Lo-Fi', image: '/images/cosmos/scenic-earth-aurora.jpg', colors: ['#ff9a9e', '#fecfef', '#2b1055'] },
  { title: 'Retro Highway', artist: 'Galactic Horizon', genre: 'Synthwave', image: '/images/cosmos/scenic-desert-galaxy.jpg', colors: ['#ff007f', '#00f0ff', '#240046'] }
];

// Fisher-Yates array shuffler
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Generate harmonic color palette for custom images / seeds
function generatePalette(seedStr) {
  const hash = [...String(seedStr)].reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 7);
  const hue1 = hash % 360;
  const hue2 = (hue1 + 45 + ((hash >> 4) % 60)) % 360;
  return [
    `hsl(${hue1}, 85%, 62%)`,
    `hsl(${hue2}, 75%, 52%)`,
    `hsl(${(hue1 + 180) % 360}, 60%, 8%)`
  ];
}

export default function MusicApp() {
  const [tracks, setTracks] = useState(DEFAULT_TRACKS);
  const [rawTracks, setRawTracks] = useState([]);
  const [availableImages, setAvailableImages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [cleanMode, setCleanMode] = useState(false);

  // Add Music Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [downloadQuery, setDownloadQuery] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState('');

  const audioRef = useRef(null);
  const isPlayingRef = useRef(isPlaying);
  
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const currentTrack = tracks[currentIndex] || DEFAULT_TRACKS[0];

  // Helper to map songs to randomly shuffled images and theme palettes
  const buildRandomizedTracks = useCallback((sourceTracks, imagePool) => {
    if (!Array.isArray(sourceTracks) || sourceTracks.length === 0) return DEFAULT_TRACKS;

    const themePool = shuffleArray(COSMOS_THEMES);
    const extraImages = Array.isArray(imagePool) ? imagePool : [];
    const shuffledExtraImages = shuffleArray(extraImages);

    return sourceTracks.map((item, idx) => {
      let image, genre, colors;

      if (shuffledExtraImages.length > 0 && Math.random() > 0.35) {
        const img = shuffledExtraImages[idx % shuffledExtraImages.length];
        const matchingTheme = COSMOS_THEMES.find(t => t.image === img);
        if (matchingTheme) {
          image = matchingTheme.image;
          genre = matchingTheme.genre;
          colors = matchingTheme.colors;
        } else {
          image = img;
          genre = item.artist || 'Aria Cosmos';
          colors = generatePalette(item.title + (item.artist || '') + idx);
        }
      } else {
        const theme = themePool[idx % themePool.length];
        image = theme.image;
        genre = theme.genre;
        colors = theme.colors;
      }

      return {
        id: item.id || `track-${idx}`,
        title: item.title || 'Untitled Track',
        artist: item.artist || 'Aria Music',
        duration: Number(item.duration) || 0,
        url: item.url || '',
        path: item.path || '',
        genre,
        image,
        colors,
      };
    });
  }, []);

  // Refresh and randomize mapping on demand
  const randomizeMapping = useCallback(() => {
    if (rawTracks.length > 0) {
      setTracks(buildRandomizedTracks(rawTracks, availableImages));
    }
  }, [rawTracks, availableImages, buildRandomizedTracks]);

  // Load initial library & images and subscribe to real-time additions
  useEffect(() => {
    if (window.musicApp?.listImages) {
      window.musicApp.listImages().then((imgs) => {
        if (Array.isArray(imgs) && imgs.length > 0) {
          setAvailableImages(imgs);
        }
      }).catch(() => {});
    }

    if (window.musicApp?.listLibrary) {
      window.musicApp
        .listLibrary()
        .then((localTracks) => {
          if (Array.isArray(localTracks) && localTracks.length > 0) {
            setRawTracks(localTracks);
            setTracks(buildRandomizedTracks(localTracks, []));
          }
        })
        .catch((err) => {
          console.warn('Could not load local library, using defaults:', err);
        });
    }

    // Subscribe to live file updates from main process
    let unsubLib = () => {};
    let unsubImg = () => {};

    if (window.musicApp?.onLibraryUpdated) {
      unsubLib = window.musicApp.onLibraryUpdated((updatedTracks) => {
        if (Array.isArray(updatedTracks) && updatedTracks.length > 0) {
          setRawTracks(updatedTracks);
          setTracks(buildRandomizedTracks(updatedTracks, availableImages));
        }
      });
    }

    if (window.musicApp?.onImagesUpdated) {
      unsubImg = window.musicApp.onImagesUpdated((updatedImages) => {
        if (Array.isArray(updatedImages) && updatedImages.length > 0) {
          setAvailableImages(updatedImages);
          if (rawTracks.length > 0) {
            setTracks(buildRandomizedTracks(rawTracks, updatedImages));
          }
        }
      });
    }

    return () => {
      unsubLib();
      unsubImg();
    };
  }, [buildRandomizedTracks]);

  // Keyboard Shortcuts:
  // Cmd+R / Ctrl+R → toggle Clean Mode
  // Cmd+N / Ctrl+N → open Add Song modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        setCleanMode((prev) => !prev);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setShowAddModal((prev) => !prev);
      } else if (e.key === 'Escape' && showAddModal) {
        setShowAddModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAddModal]);

  // Next and Prev handlers
  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % tracks.length);
  }, [tracks.length]);

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + tracks.length) % tracks.length);
  }, [tracks.length]);

  // Update audio source on track change
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

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      isPlayingRef.current = false;
      setIsPlaying(false);
    } else {
      if (!audio.src && currentTrack.url) {
        audio.src = currentTrack.url;
      }
      audio
        .play()
        .then(() => {
          isPlayingRef.current = true;
          setIsPlaying(true);
        })
        .catch((err) => {
          console.warn('Playback error:', err);
          isPlayingRef.current = false;
          setIsPlaying(false);
        });
    }
  }, [isPlaying, currentTrack.url]);

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

  // Handle adding/downloading new song
  const handleAddSongSubmit = async (e) => {
    e?.preventDefault();
    const query = downloadQuery.trim();
    if (!query || isDownloading) return;

    setIsDownloading(true);
    setDownloadStatus('Searching and downloading track...');

    try {
      if (window.musicApp?.download) {
        await window.musicApp.download(query);
        setDownloadStatus('Track added to library!');
        setDownloadQuery('');
        setTimeout(() => {
          setShowAddModal(false);
          setDownloadStatus('');
          setIsDownloading(false);
        }, 1200);
      } else {
        throw new Error('Downloader service not available');
      }
    } catch (err) {
      setDownloadStatus(`Error: ${err.message || 'Download failed'}`);
      setIsDownloading(false);
    }
  };

  return (
    <main className={`music-app${cleanMode ? ' music-app--clean' : ''}`}>
      {/* HTML5 Audio Element */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      {/* Background WebGL Layer */}
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

            {/* Action buttons: Shuffle Photos & Add Song */}
            <div className="music-app__panel-actions">
              <button
                className="panel-action-btn"
                title="Shuffle Photos & Color Themes"
                onClick={randomizeMapping}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 3 21 3 21 8"></polyline>
                  <line x1="4" y1="20" x2="21" y2="3"></line>
                  <polyline points="21 16 21 21 16 21"></polyline>
                  <line x1="15" y1="15" x2="21" y2="21"></line>
                  <line x1="4" y1="4" x2="9" y2="9"></line>
                </svg>
              </button>
              <button
                className="panel-action-btn"
                title="Add New Music (Cmd+N)"
                onClick={() => setShowAddModal(true)}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
            </div>
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
            blur={cleanMode ? 0 : 2}
            fade={0.3}
            inset={40}
            loop={true}
            draggable={true}
            soundUrl="/sounds/click-soft.mp3"
            soundVolume={0.4}
            onChange={handleWheelChange}
          />
        </section>

        {/* Right Side: Scroll Expand Showcase */}
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

      {/* Add Song Modal */}
      {showAddModal && (
        <div className="add-music-backdrop" onClick={() => !isDownloading && setShowAddModal(false)}>
          <div className="add-music-modal" onClick={(e) => e.stopPropagation()}>
            <div className="add-music-modal__header">
              <h3>Add New Track</h3>
              <button
                className="add-music-modal__close"
                onClick={() => setShowAddModal(false)}
                disabled={isDownloading}
              >
                ✕
              </button>
            </div>
            <p className="add-music-modal__desc">
              Enter any song title, artist name, or YouTube URL to automatically download and add it to Aria.
            </p>
            <form onSubmit={handleAddSongSubmit} className="add-music-form">
              <input
                type="text"
                className="add-music-input"
                placeholder="e.g. Interstellar Theme or YouTube link"
                value={downloadQuery}
                onChange={(e) => setDownloadQuery(e.target.value)}
                autoFocus
                disabled={isDownloading}
              />
              <div className="add-music-actions">
                <button
                  type="button"
                  className="add-music-cancel"
                  onClick={() => setShowAddModal(false)}
                  disabled={isDownloading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="add-music-submit"
                  disabled={isDownloading || !downloadQuery.trim()}
                >
                  {isDownloading ? 'Downloading...' : 'Download & Add'}
                </button>
              </div>
            </form>
            {downloadStatus && (
              <div className={`download-status ${downloadStatus.startsWith('Error') ? 'is-error' : ''}`}>
                {isDownloading && <span className="status-spinner" />}
                <span>{downloadStatus}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}