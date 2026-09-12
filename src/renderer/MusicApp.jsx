import React, { useState, useRef, useEffect, useCallback } from 'react';
import Aurora from './Aurora';
import OptionWheel from './OptionWheel';
import ScrollExpand from './ScrollExpand';
import WavyPlaybar from './WavyPlaybar';
import './MusicApp.css';

// Replace with your public R2 URL (r2.dev or custom subdomain)
const BASE_R2_URL = 'https://pub-74b555bb7c5040d49fc3ff86bc7905d1.r2.dev';

const COSMOS_THEMES = [
  { image: `${BASE_R2_URL}/images/earth-orbit.jpg`, colors: ['#00d2ff', '#1e40af', '#090d16'] },
  { image: `${BASE_R2_URL}/images/galaxy-spiral.jpg`, colors: ['#c084fc', '#6366f1', '#0f0728'] },
  { image: `${BASE_R2_URL}/images/scenic-earth-aurora.jpg`, colors: ['#4ade80', '#06b6d4', '#061727'] },
  { image: `${BASE_R2_URL}/images/space-nebula.jpg`, colors: ['#fb923c', '#e11d48', '#1a0d16'] },
  { image: `${BASE_R2_URL}/images/scenic-earth-lake.jpg`, colors: ['#38bdf8', '#0284c7', '#081c24'] },
  { image: `${BASE_R2_URL}/images/galaxy-milkyway.jpg`, colors: ['#a855f7', '#3b82f6', '#090d16'] },
  { image: `${BASE_R2_URL}/images/earth-horizon.jpg`, colors: ['#38bdf8', '#2563eb', '#030712'] },
  { image: `${BASE_R2_URL}/images/scenic-earth-peaks.jpg`, colors: ['#818cf8', '#6366f1', '#0c0a1f'] },
  { image: `${BASE_R2_URL}/images/galaxy-andromeda.jpg`, colors: ['#f472b6', '#8b5cf6', '#12072b'] },
  { image: `${BASE_R2_URL}/images/scenic-earth-sunrise.jpg`, colors: ['#f59e0b', '#d97706', '#1c0f00'] },
  { image: `${BASE_R2_URL}/images/space-deep-field.jpg`, colors: ['#60a5fa', '#a78bfa', '#090514'] },
  { image: `${BASE_R2_URL}/images/scenic-desert-galaxy.jpg`, colors: ['#ec4899', '#f97316', '#140810'] },
];

const RAW_TRACK_LIST = [
  { title: "Pal Pal", artist: "Afusic ft. Talwiinder", genre: "Punjabi Indie", file: "Afusic - Pal Pal with @Talwiinder  (Official Visualiser) Prod. @AliSoomroMusic [AbkEmIgJMcU].mp3" },
  { title: "We Don't Talk Anymore", artist: "Charlie Puth ft. Selena Gomez", genre: "Pop", file: "Charlie Puth - We Don't Talk Anymore (feat. Selena Gomez) [Official Video] [3AtDnEC4zak].mp3" },
  { title: "Pehli Mohabbat", artist: "Darshan Raval", genre: "Romantic Pop", file: "Darshan Raval - Pehli Mohabbat - Asian Network in Mumbai [Gq2hcE4V7Jo].mp3" },
  { title: "Perfect", artist: "Ed Sheeran", genre: "Acoustic Pop", file: "Ed Sheeran - Perfect (Official Music Video) [2Vv-BfVoq4g].mp3" },
  { title: "HIGH ON YOU", artist: "Jind Universe", genre: "Indie Pop", file: "HIGH ON YOU - Jind Universe (OFFICIAL VIDEO) [yuF7Pw-_YIE].mp3" },
  { title: "Take Me Home, Country Roads", artist: "John Denver", genre: "Folk Rock", file: "John Denver - Take Me Home, Country Roads (Official Audio) [1vrEljMfXYo].mp3" },
  { title: "Way Down We Go", artist: "KALEO", genre: "Alternative Rock", file: "KALEO - Way Down We Go (Official Music Video) [0-7IHOXkiV8].mp3" },
  { title: "Kangana Tera Ni (Slowed)", artist: "Abeer Arora", genre: "Chill Vibe", file: "Kangana Tera Ni (Slowed + Reverb) - ABEER ARORA ｜ Laung Mare Lashkare ｜ Also Holic [6n9CKm2YpGM].mp3" },
  { title: "Brooklyn Baby", artist: "Lana Del Rey", genre: "Dream Pop", file: "Lana Del Rey - Brooklyn Baby (Official Audio) [T5xcnjAG8pE].mp3" },
  { title: "Margaret", artist: "Lana Del Rey ft. Bleachers", genre: "Alt-Pop", file: "Lana Del Rey - Margaret (Audio) ft. Bleachers [2xtKhqbNBoY].mp3" },
  { title: "Summertime Sadness", artist: "Lana Del Rey", genre: "Sad Pop", file: "Lana Del Rey - Summertime Sadness (Official Music Video) [TdrL3QxjyVw].mp3" },
  { title: "Main Tenu Yaad Awanga", artist: "Punjabi Folk", genre: "Soulful", file: "Main Tenu Yaad Awanga [loZU1BuN5Lo].mp3" },
  { title: "Mi Amor (Slowed)", artist: "Sharn", genre: "Slowed Ambient", file: "Mi Amor - Perfectly Slowed [XmA0huo5rqw].mp3" },
  { title: "Mil Ke Baithange", artist: "Amrinder Gill", genre: "Punjabi Folk", file: "Mil Ke Baithange ｜ Angrej ｜ Amrinder Gill ｜ Full Music Video [Doo1T5WabEU].mp3" },
  { title: "Nit Khair Mansan Sohnia", artist: "Sufi Traditional", genre: "Sufi", file: "Nit Khair Mansan Sohnia Main Teri [AfIBjGPsv2U].mp3" },
  { title: "Night Changes", artist: "One Direction", genre: "Pop", file: "One Direction - Night Changes [syFZfO_wfMQ].mp3" },
  { title: "Par Chanaa De", artist: "Coke Studio", genre: "Sufi Folk", file: "Par Chanaa De [wgN8a8nN79g].mp3" },
  { title: "Let Her Go", artist: "Passenger", genre: "Folk Pop", file: "Passenger ｜ Let Her Go (Official Video) [RBumgq5yVrA].mp3" },
  { title: "9_45", artist: "Prabh Singh ft. Jay Trak", genre: "Punjabi Hip-Hop", file: "Prabh Singh Ft Jay Trak - 9_45 (Official Music Video) [bzSn6AKLkMI].mp3" },
  { title: "Sajjan Raazi", artist: "Satinder Sartaaj", genre: "Sufi Poetry", file: "Sajjan Raazi [t6vm8h5BDxo].mp3" },
  { title: "Until I Found You", artist: "Stephen Sanchez", genre: "Retro Pop", file: "Stephen Sanchez - Until I Found You (Official Video) [GxldQ9eX2wo].mp3" }
];

// Map track files to public R2 audio URLs and pair them with dynamic themes
const TRACKS = RAW_TRACK_LIST.map((item, idx) => {
  const theme = COSMOS_THEMES[idx % COSMOS_THEMES.length];
  return {
    id: `track-${idx}`,
    title: item.title,
    artist: item.artist,
    genre: item.genre,
    url: `${BASE_R2_URL}/audio/${encodeURIComponent(item.file)}`,
    image: theme.image,
    colors: theme.colors
  };
});

export default function MusicApp() {
  const [tracks] = useState(TRACKS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [cleanMode, setCleanMode] = useState(false);

  const audioRef = useRef(null);
  const isPlayingRef = useRef(isPlaying);
  
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const currentTrack = tracks[currentIndex] || tracks[0];

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

  // Mobile Lockscreen / Control Center Media Controls
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist || 'Aria Music',
        album: currentTrack.genre || 'Cosmos',
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

  // Continuous playback stream handler on song change
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
      {/* HTML5 Audio Element */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      {/* WebGL Animated Background */}
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

        {/* Right Side: Scroll Expand Showcase */}
        <section className="music-app__display-panel">
          <ScrollExpand
            key={currentTrack.id || currentTrack.title}
            src={currentTrack.image}
            alt={currentTrack.title}
            title={cleanMode ? '' : currentTrack.title}
            scrollHint={cleanMode ? '' : 'Scroll to expand • Reveal playbar'}
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

                {/* Playbar */}
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
