import React, { useState, useRef, useEffect, useCallback } from 'react';
import Aurora from './Aurora';
import OptionWheel from './OptionWheel';
import ScrollExpand from './ScrollExpand';
import WavyPlaybar from './WavyPlaybar';
import './MusicApp.css';

const BASE_R2_URL = 'https://pub-74b555bb7c5040d49fc3ff86bc7905d1.r2.dev';
const MANIFEST_URL = `${BASE_R2_URL}/manifest.json`;

const DYNAMIC_PALETTES = [
  ['#00d2ff', '#1e40af', '#090d16'],
  ['#c084fc', '#6366f1', '#0f0728'],
  ['#4ade80', '#06b6d4', '#061727'],
  ['#fb923c', '#e11d48', '#1a0d16'],
  ['#f59e0b', '#d97706', '#1c0f00'],
  ['#ec4899', '#f97316', '#140810']
];

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
  const [tracks, setTracks] = useState([]);
  const [themes, setThemes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageIndex, setImageIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [cleanMode, setCleanMode] = useState(false);

  const isMobile = useIsMobile();
  const audioRef = useRef(null);
  const isPlayingRef = useRef(isPlaying);

  // FETCH MANIFEST
  useEffect(() => {
    async function loadManifest() {
      try {
        const response = await fetch(MANIFEST_URL);
        if (!response.ok) throw new Error("Could not fetch manifest");
        
        const data = await response.json();

        const dynamicThemes = data.images.map((imgName, idx) => ({
          image: `${BASE_R2_URL}/images/${encodeURIComponent(imgName)}`,
          colors: DYNAMIC_PALETTES[idx % DYNAMIC_PALETTES.length]
        }));

        const dynamicTracks = data.music.map((trackData, idx) => {
          const theme = dynamicThemes[idx % dynamicThemes.length] || dynamicThemes[0];
          
          // Safely split the alias (e.g. "Song - Artist" -> ["Song", "Artist"])
          const splitData = trackData.alias ? trackData.alias.split(" - ") : ["Unknown Track"];
          const title = splitData[0].trim();
          const artist = splitData[1] ? splitData[1].trim() : "Aria Cosmos";

          return {
            id: `track-${idx}`,
            title: title,
            artist: artist,
            genre: "Vibe",
            url: `${BASE_R2_URL}/music/${encodeURIComponent(trackData.file)}`,
            image: theme.image,
            colors: theme.colors
          };
        });

        setThemes(dynamicThemes);
        setTracks(dynamicTracks);
      } catch (err) {
        console.error("Manifest load error:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }

    loadManifest();
  }, []);

  // Sync image index when switching tracks
  useEffect(() => {
    if (themes.length > 0) {
      setImageIndex(currentIndex % themes.length);
    }
  }, [currentIndex, themes.length]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const handleNext = useCallback(() => {
    if (tracks.length) setCurrentIndex((prev) => (prev + 1) % tracks.length);
  }, [tracks.length]);

  const handlePrev = useCallback(() => {
    if (tracks.length) setCurrentIndex((prev) => (prev - 1 + tracks.length) % tracks.length);
  }, [tracks.length]);

  // Track switch & continuous playback listener
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || tracks.length === 0) return;

    const currentTrack = tracks[currentIndex];
    if (currentTrack?.url) {
      audio.src = currentTrack.url;
      audio.load();
      
      if (isPlayingRef.current) {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => setIsPlaying(true))
            .catch((err) => {
              console.warn('Autoplay prevented:', err);
              setIsPlaying(false);
            });
        }
      }
    }
    setCurrentTime(0);
    setDuration(0);
  }, [currentIndex, tracks]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  }, [isPlaying]);

  const handleSeek = useCallback((newTime) => {
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  }, []);

  const handleVolumeChange = useCallback((newVol) => {
    setVolume(newVol);
    if (audioRef.current) audioRef.current.volume = newVol;
  }, []);

  // SAFETY CHECKS (Prevents the black screen crash)
  if (isLoading) {
    return <div className="music-app" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'white' }}>Connecting to Cosmos...</div>;
  }

  if (error || tracks.length === 0) {
    return <div className="music-app" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'white' }}>No music found or CORS error. Press F12 to check console.</div>;
  }

  const currentTrack = tracks[currentIndex];
  const currentTheme = themes[imageIndex % themes.length];

  return (
    <main className={`music-app${cleanMode ? ' music-app--clean' : ''}`}>
      <audio
        ref={audioRef}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => { isPlayingRef.current = true; setIsPlaying(true); handleNext(); }}
      />

      <div className="music-app__bg">
        <Aurora colorStops={currentTheme.colors} blend={0.65} amplitude={isMobile ? 0.8 : 1.2} speed={0.4} />
        <div className="music-app__vignette" />
      </div>

      <div className="music-app__content">
        <section className="music-app__wheel-panel">
          <div className="music-app__panel-brand">
            <span className="brand-dot" style={{ background: currentTheme.colors[0] }} />
            <span>ARIA COSMOS</span>
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
            onChange={(index) => {
              setCurrentIndex(index);
              isPlayingRef.current = true;
              setIsPlaying(true);
            }}
          />
        </section>

        <section className="music-app__display-panel">
          <ScrollExpand
            key={`${currentTrack.id}-${imageIndex}`}
            src={currentTheme.image}
            alt={currentTrack.title}
            title={cleanMode ? '' : currentTrack.title}
            scrollHint={cleanMode ? '' : (isMobile ? 'Scroll down to expand' : 'Scroll to expand')}
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
                  duration={duration || 0}
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
