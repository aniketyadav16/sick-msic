// const BASE_R2_URL = 'https://pub-74b555bb7c5040d49fc3ff86bc7905d1.r2.dev';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import Aurora from './Aurora';
import OptionWheel from './OptionWheel';
import ScrollExpand from './ScrollExpand';
import WavyPlaybar from './WavyPlaybar';
import './MusicApp.css';

// Public Cloudflare R2 URL
const BASE_R2_URL = 'https://pub-74b555bb7c5040d49fc3ff86bc7905d1.r2.dev';

const dynamicTracks = data.music.map((trackData, idx) => {
        const theme = dynamicThemes[idx % dynamicThemes.length] || dynamicThemes[0];
        
        // Split the alias into title and artist based on the hyphen
        const [title, artist] = trackData.alias.split(" - ");

        return {
          id: `track-${idx}`,
          title: title.trim(),
          artist: artist ? artist.trim() : "Aria Cosmos",
          genre: "Vibe",
          url: `${BASE_R2_URL}/music/${encodeURIComponent(trackData.file)}`, // Use the real filename for the URL
          image: theme.image,
          colors: theme.colors
        };
      });

// Custom hook to detect mobile viewport width dynamically
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
};

export default function MusicApp() {
  const [tracks, setTracks] = useState(TRACKS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageIndex, setImageIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [cleanMode, setCleanMode] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addInput, setAddInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const fileInputRef = useRef(null);

  // Sync image index when switching tracks
  useEffect(() => {
    setImageIndex(currentIndex % COSMOS_THEMES.length);
  }, [currentIndex]);

  // Global keydown handler: Shift+Enter for image cycle & Cmd/Ctrl+R for clean mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        setImageIndex((prev) => (prev + 1) % COSMOS_THEMES.length);
      } else if (e.key === 'r' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCleanMode((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Triple-tap listener for touch devices (works on mobile view & desktop site mode on mobile)
  useEffect(() => {
    let tapCount = 0;
    let lastTapTime = 0;
    let lastTapX = 0;
    let lastTapY = 0;

    const handleTouchStart = (e) => {
      // Don't intercept taps inside buttons, inputs, or interactive controls
      if (e.target.closest('button, input, form, .wavy-playbar, .option-wheel')) {
        return;
      }

      const touch = e.touches[0];
      const currentTime = Date.now();
      const timeDiff = currentTime - lastTapTime;
      const distX = Math.abs(touch.clientX - lastTapX);
      const distY = Math.abs(touch.clientY - lastTapY);

      // If tap is within 300ms and close to previous tap location (no heavy dragging)
      if (timeDiff < 300 && distX < 30 && distY < 30) {
        tapCount += 1;
      } else {
        tapCount = 1;
      }

      lastTapTime = currentTime;
      lastTapX = touch.clientX;
      lastTapY = touch.clientY;

      if (tapCount === 3) {
        e.preventDefault(); // Prevent double-tap zoom or text selection
        setImageIndex((prev) => (prev + 1) % COSMOS_THEMES.length);
        tapCount = 0; // Reset counter after successful triple-tap
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    return () => window.removeEventListener('touchstart', handleTouchStart);
  }, []);

  // Shuffle images across tracks
  const handleShuffleImages = useCallback(() => {
    setTracks((prevTracks) => {
      const shuffledThemes = [...COSMOS_THEMES].sort(() => Math.random() - 0.5);
      return prevTracks.map((track, i) => {
        const theme = shuffledThemes[i % shuffledThemes.length];
        return {
          ...track,
          image: theme.image,
          colors: theme.colors,
        };
      });
    });
  }, []);

  // Add music from local audio file
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const fileName = file.name.replace(/\.[^/.]+$/, "");
    const randomTheme = COSMOS_THEMES[Math.floor(Math.random() * COSMOS_THEMES.length)];
    const newTrack = {
      id: `track-custom-${Date.now()}`,
      title: fileName,
      artist: 'Local Music',
      genre: 'Custom',
      url,
      image: randomTheme.image,
      colors: randomTheme.colors,
    };
    setTracks((prev) => [newTrack, ...prev]);
    setCurrentIndex(0);
    setShowAddModal(false);
  };

  // Add music from link or query
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    const query = addInput.trim();
    if (!query) return;

    setIsAdding(true);
    try {
      if (window.musicApp?.download) {
        await window.musicApp.download(query);
      } else {
        const randomTheme = COSMOS_THEMES[Math.floor(Math.random() * COSMOS_THEMES.length)];
        const newTrack = {
          id: `track-custom-${Date.now()}`,
          title: query.split('/').pop()?.split('?')[0] || query,
          artist: 'Web Stream',
          genre: 'Custom',
          url: query,
          image: randomTheme.image,
          colors: randomTheme.colors,
        };
        setTracks((prev) => [newTrack, ...prev]);
        setCurrentIndex(0);
      }
      setAddInput('');
      setShowAddModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAdding(false);
    }
  };

  const isMobile = useIsMobile();
  const audioRef = useRef(null);
  const isPlayingRef = useRef(isPlaying);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const currentTrack = tracks[currentIndex] || tracks[0];
  const currentTheme = COSMOS_THEMES[imageIndex % COSMOS_THEMES.length];

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % tracks.length);
  }, [tracks.length]);

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + tracks.length) % tracks.length);
  }, [tracks.length]);

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

  // Mobile Lockscreen / Control Center Integration
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist || 'Aria Music',
        album: currentTrack.genre || 'Cosmos',
        artwork: [
          { src: currentTheme.image, sizes: '512x512', type: 'image/jpeg' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', togglePlay);
      navigator.mediaSession.setActionHandler('pause', togglePlay);
      navigator.mediaSession.setActionHandler('previoustrack', handlePrev);
      navigator.mediaSession.setActionHandler('nexttrack', handleNext);
    }
  }, [currentTrack, currentTheme, togglePlay, handlePrev, handleNext]);

  // Track switch & continuous playback listener
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
      {/* Hidden HTML5 Audio Player */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      {/* Background WebGL Aurora */}
      <div className="music-app__bg">
        <Aurora
          colorStops={currentTheme.colors}
          blend={0.65}
          amplitude={isMobile ? 0.8 : 1.2}
          speed={0.4}
        />
        <div className="music-app__vignette" />
      </div>

      {/* Main Grid Viewport */}
      <div className="music-app__content">
        {/* Wheel Panel */}
        <section className="music-app__wheel-panel">
          <div className="music-app__panel-brand">
            <span className="brand-dot" style={{ background: currentTheme.colors[0] }} />
            <span>ARIA COSMOS</span>
            <div className="brand-actions">
              <button
                className="brand-btn"
                title="Shuffle Images"
                onClick={handleShuffleImages}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 3 21 3 21 8"></polyline>
                  <line x1="4" y1="20" x2="21" y2="3"></line>
                  <polyline points="21 16 21 21 16 21"></polyline>
                  <line x1="15" y1="15" x2="21" y2="21"></line>
                  <line x1="4" y1="4" x2="9" y2="9"></line>
                </svg>
              </button>
              <button
                className="brand-btn"
                title="Add Music"
                onClick={() => setShowAddModal(true)}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
            </div>
          </div>
          <OptionWheel
            items={tracks.map((t) => t.title)}
            defaultSelected={0}
            side={isMobile ? "right" : "left"}
            textColor="#71717a"
            activeColor="#ffffff"
            fontSize={isMobile ? 1.5 : 2.2}
            spacing={isMobile ? 1.3 : 1.45}
            curve={1.2}
            tilt={isMobile ? 5 : 7}
            blur={isMobile ? 2 : 3}
            fade={0.3}
            inset={isMobile ? 20 : 40}
            loop={true}
            draggable={true}
            soundUrl="/sounds/click-soft.mp3"
            soundVolume={0.4}
            onChange={handleWheelChange}
          />
        </section>

        {/* Display Panel */}
        <section className="music-app__display-panel">
          <ScrollExpand
            key={`${currentTrack.id || currentTrack.title}-${imageIndex}`}
            src={currentTheme.image}
            alt={currentTrack.title}
            title={cleanMode ? '' : currentTrack.title}
            scrollHint={cleanMode ? '' : (isMobile ? 'Scroll down to expand' : 'Scroll to expand • Reveal playbar')}
            startWidth={isMobile ? 85 : 56}
            startHeight={isMobile ? 75 : 66}
            startRadius={isMobile ? 16 : 22}
            endRadius={0}
            mediaZoom={1.15}
            scrollDistance={1.0}
            useWindowScroll={false}
          >
            {!cleanMode && (
              <div className="track-details">
                <div className="track-details__meta">
                  <h2>{currentTrack.title}</h2>
                  <p>{currentTrack.artist} • {currentTrack.genre}</p>
                </div>

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

      {/* Hidden file input for local files */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Add Music Modal */}
      {showAddModal && (
        <div className="add-modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="add-modal" onClick={(e) => e.stopPropagation()}>
            <p className="add-modal__title">Add Music</p>
            <form onSubmit={handleAddSubmit}>
              <input
                className="add-modal__input"
                type="text"
                placeholder="YouTube URL or song name"
                value={addInput}
                onChange={(e) => setAddInput(e.target.value)}
                autoFocus
              />
              <div className="add-modal__row">
                <button
                  type="button"
                  className="add-modal__file-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Local File
                </button>
                <button
                  type="submit"
                  className="add-modal__submit-btn"
                  disabled={isAdding || !addInput.trim()}
                >
                  {isAdding ? '...' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
