import React, { useState, useRef, useEffect, useCallback } from 'react';
import Aurora from './Aurora';
import OptionWheel from './OptionWheel';
import ScrollExpand from './ScrollExpand';
import WavyPlaybar from './WavyPlaybar';
import './MusicApp.css';
import AddSongModal from './AddSongModal';
import { musicApi } from './music-api';

// Public Cloudflare R2 URL
const BASE_R2_URL = (import.meta.env.VITE_R2_PUBLIC_URL || 'https://pub-74b555bb7c5040d49fc3ff86bc7905d1.r2.dev').replace(/\/$/, '');

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
  { image: `${BASE_R2_URL}/images/bmw-m5.jpg`, colors: ['#ec4₹899', '#f97316', '#140810'] },
  { image: `${BASE_R2_URL}/images/Screenshot 2026-09-27 at 3.13.16 PM.png`, colors: ['#ec2899', '#f97376', '#140310'] },
  { image: `${BASE_R2_URL}/images/pexels-francesco-ungaro-12553116.jpg`, colors: ['#ec4899', '#f97316', '#140810'] },
  { image: `${BASE_R2_URL}/images/wp2605667-wallpaper-optimus-prime.jpg`, colors: ['#ec4899', '#f97316', '#140810'] }
];

const RAW_TRACK_LIST = [
  {
    title: "Pal Pal",
    artist: "Afusic ft. Talwiinder",
    genre: "Punjabi Indie",
    file: "Afusic - Pal Pal with @Talwiinder  (Official Visualiser) Prod. @AliSoomroMusic [AbkEmIgJMcU].mp3",
    lyrics: ["pal pal", "har pal", "tere bina", "yaad aave", "afusic", "talwiinder"]
  },
  {
    title: "We Don't Talk Anymore",
    artist: "Charlie Puth ft. Selena Gomez",
    genre: "Pop",
    file: "Charlie Puth - We Don't Talk Anymore (feat. Selena Gomez) [Official Video] [3AtDnEC4zak].mp3",
    lyrics: ["we don't talk anymore", "like we used to do", "don't talk anymore", "i just heard you found the one", "charlie puth", "selena gomez"]
  },
  {
    title: "Pehli Mohabbat",
    artist: "Darshan Raval",
    genre: "Romantic Pop",
    file: "Darshan Raval - Pehli Mohabbat - Asian Network in Mumbai [Gq2hcE4V7Jo].mp3",
    lyrics: ["pehli mohabbat", "pehli mohabbat ka ehsaas", "darshan raval", "tu hi meri shab hai"]
  },
  {
    title: "Perfect",
    artist: "Ed Sheeran",
    genre: "Acoustic Pop",
    file: "Ed Sheeran - Perfect (Official Music Video) [2Vv-BfVoq4g].mp3",
    lyrics: ["i found a love for me", "darling just dive right in", "dancing in the dark", "barefoot on the grass", "perfect", "ed sheeran"]
  },
  {
    title: "HIGH ON YOU",
    artist: "Jind Universe",
    genre: "Indie Pop",
    file: "HIGH ON YOU - Jind Universe (OFFICIAL VIDEO) [yuF7Pw-_YIE].mp3",
    lyrics: ["high on you", "jind universe", "i'm high on you", "falling for you"]
  },
  {
    title: "Take Me Home, Country Roads",
    artist: "John Denver",
    genre: "Folk Rock",
    file: "John Denver - Take Me Home, Country Roads (Official Audio) [1vrEljMfXYo].mp3",
    lyrics: ["almost heaven", "west virginia", "blue ridge mountains", "country roads take me home", "to the place i belong", "country roads", "john denver"]
  },
  {
    title: "Way Down We Go",
    artist: "KALEO",
    genre: "Alternative Rock",
    file: "KALEO - Way Down We Go (Official Music Video) [0-7IHOXkiV8].mp3",
    lyrics: ["way down we go", "you let your feet run wild", "time has come as we all oh", "kaleo"]
  },
  {
    title: "Kangana Tera Ni (Slowed)",
    artist: "Abeer Arora",
    genre: "Chill Vibe",
    file: "Kangana Tera Ni (Slowed + Reverb) - ABEER ARORA ｜ Laung Mare Lashkare ｜ Also Holic [6n9CKm2YpGM].mp3",
    lyrics: ["kangana tera ni", "sanhu maar sutteya", "laung mare lashkare", "abeer arora"]
  },
  {
    title: "Brooklyn Baby",
    artist: "Lana Del Rey",
    genre: "Dream Pop",
    file: "Lana Del Rey - Brooklyn Baby (Official Audio) [T5xcnjAG8pE].mp3",
    lyrics: ["they say i'm too young with an old soul", "my boyfriend's in a band", "brooklyn baby", "lana del rey"]
  },
  {
    title: "Margaret",
    artist: "Lana Del Rey ft. Bleachers",
    genre: "Alt-Pop",
    file: "Lana Del Rey - Margaret (Audio) ft. Bleachers [2xtKhqbNBoY].mp3",
    lyrics: ["when you know you know", "margaret", "december", "bleachers"]
  },
  {
    title: "Summertime Sadness",
    artist: "Lana Del Rey",
    genre: "Sad Pop",
    file: "Lana Del Rey - Summertime Sadness (Official Music Video) [TdrL3QxjyVw].mp3",
    lyrics: ["kiss me hard before you go", "summertime sadness", "i got that summertime sadness", "dancing in the dark"]
  },
  {
    title: "Main Tenu Yaad Awanga",
    artist: "Punjabi Folk",
    genre: "Soulful",
    file: "Main Tenu Yaad Awanga [loZU1BuN5Lo].mp3",
    lyrics: ["main tenu yaad awanga", "yaad awanga", "jad vi tu kalli hovegi", "akhiyan ch hanju"]
  },
  {
    title: "Mi Amor (Slowed)",
    artist: "Sharn",
    genre: "Slowed Ambient",
    file: "Mi Amor - Perfectly Slowed [XmA0huo5rqw].mp3",
    lyrics: ["mi amor", "sharn", "tere karke", "nakhre tere", "slowed"]
  },
  {
    title: "Mil Ke Baithange",
    artist: "Amrinder Gill",
    genre: "Punjabi Folk",
    file: "Mil Ke Baithange ｜ Angrej ｜ Amrinder Gill ｜ Full Music Video [Doo1T5WabEU].mp3",
    lyrics: ["mil ke baithange", "taan gallan bohot karniyan", "amrinder gill", "angrej"]
  },
  {
    title: "Nit Khair Mansan Sohnia",
    artist: "Sufi Traditional",
    genre: "Sufi",
    file: "Nit Khair Mansan Sohnia Main Teri [AfIBjGPsv2U].mp3",
    lyrics: ["nit khair mangdan", "nit khair mansan", "sohnya main teri", "duaa na koi hor mangdi", "sufi"]
  },
  {
    title: "Night Changes",
    artist: "One Direction",
    genre: "Pop",
    file: "One Direction - Night Changes [syFZfO_wfMQ].mp3",
    lyrics: ["does it ever drive you crazy", "night changes", "just how fast the night changes", "we're only getting older baby", "one direction"]
  },
  {
    title: "Par Chanaa De",
    artist: "Coke Studio",
    genre: "Sufi Folk",
    file: "Par Chanaa De [wgN8a8nN79g].mp3",
    lyrics: ["par chanaa de", "disse rooh yaar di", "ghar yaar da", "coke studio"]
  },
  {
    title: "Let Her Go",
    artist: "Passenger",
    genre: "Folk Pop",
    file: "Passenger ｜ Let Her Go (Official Video) [RBumgq5yVrA].mp3",
    lyrics: ["only need the light when it's burning low", "only miss the sun when it starts to snow", "only know you love her when you let her go", "let her go", "passenger"]
  },
  {
    title: "9_45",
    artist: "Prabh Singh ft. Jay Trak",
    genre: "Punjabi Hip-Hop",
    file: "Prabh Singh Ft Jay Trak - 9_45 (Official Music Video) [bzSn6AKLkMI].mp3",
    lyrics: ["9 45", "nine forty five", "kudi kehndi", "prabh singh", "jay trak"]
  },
  {
    title: "Sajjan Raazi",
    artist: "Satinder Sartaaj",
    genre: "Sufi Poetry",
    file: "Sajjan Raazi [t6vm8h5BDxo].mp3",
    lyrics: ["sajjan raazi ho jaave", "rab vi man jaanda", "satinder sartaaj", "sartaaj"]
  },
  {
    title: "Until I Found You",
    artist: "Stephen Sanchez",
    genre: "Retro Pop",
    file: "Stephen Sanchez - Until I Found You (Official Video) [GxldQ9eX2wo].mp3",
    lyrics: ["i would never fall in love until i found her", "until i found you", "georgia wrap me up in all your", "stephen sanchez"]
  },
  {
    title: "Aa Chal Ke Tujhe",
    artist: "Jagjit Singh",
    genre: "Classical",
    file: "Aa Chal Ke Tujhe .mp3",
    lyrics: ["aa chal ke tujhe main le ke chalun", "ik aise gagan ke tale", "door gagan ki chhaon mein", "jagjit singh"]
  },
  {
    title: "Hothon Se Chhu Lo",
    artist: "Jagjit Singh",
    genre: "Classical",
    file: "Hothon Se Chhu Lo Tum (From ＂Prem Geet＂) [31f0mVT2Mvc].mp3",
    lyrics: ["hothon se chhu lo tum", "mera geet amar kar do", "prem geet", "jagjit singh"]
  },
  {
    title: "Kal Chaudvi Ki Raat",
    artist: "Jagjit Singh",
    genre: "Classical",
    file: "Kal Chaudhvin Ki Raat .mp3",
    lyrics: ["kal chaudhvin ki raat thi", "shab bhar raha charcha tera", "kuchh ne kaha ye chaand hai", "jagjit singh"]
  },
  {
    title: "Love me not",
    artist: "Ravyn Lenae",
    genre: "Angrez",
    file: "Ravyn Lenae - Love Me Not (Lyrics) [w71znGyLAbQ].mp3",
    lyrics: ["love me not", "he loves me he loves me not", "ravyn lenae", "pluck petals off"]
  }
];

// Target /music/ folder in Cloudflare R2 and encode filenames
const TRACKS = RAW_TRACK_LIST.map((item, idx) => {
  const theme = COSMOS_THEMES[idx % COSMOS_THEMES.length];
  return {
    id: `track-${idx}`,
    key: `music/${item.file}`,
    title: item.title,
    artist: item.artist,
    genre: item.genre,
    url: `${BASE_R2_URL}/music/${encodeURIComponent(item.file)}`,
    image: theme.image,
    colors: theme.colors,
    lyrics: item.lyrics || []
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
  const [themes, setThemes] = useState(COSMOS_THEMES);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageIndex, setImageIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [cleanMode, setCleanMode] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [libraryError, setLibraryError] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadNotice, setUploadNotice] = useState('');
  const fileInputRef = useRef(null);
  const imageFileInputRef = useRef(null);

  // Web Speech API continuous listening state
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [speechError, setSpeechError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const lastMatchTimeRef = useRef(0);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // Clean string helper for match comparison
  const normalize = (str) =>
    str ? str.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim() : '';

  // Match text against track titles, artists, or lyrics
  const findMatchingTrack = useCallback((spokenText) => {
    const text = normalize(spokenText);
    if (!text || text.length < 2) return null;

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      const titleNorm = normalize(track.title);
      const artistNorm = normalize(track.artist);

      // 1. Title match
      if (titleNorm && (text.includes(titleNorm) || (titleNorm.length > 3 && titleNorm.includes(text)))) {
        return { index: i, matchType: 'title', matchText: track.title };
      }

      // 2. Lyrics match
      if (Array.isArray(track.lyrics)) {
        for (const lyric of track.lyrics) {
          const lyricNorm = normalize(lyric);
          if (lyricNorm && (text.includes(lyricNorm) || (lyricNorm.length > 4 && lyricNorm.includes(text)))) {
            return { index: i, matchType: 'lyric', matchText: lyric };
          }
        }
      }

      // 3. Artist match
      if (artistNorm && text.includes(artistNorm)) {
        return { index: i, matchType: 'artist', matchText: track.artist };
      }
    }
    return null;
  }, [tracks]);

  const playMatchedTrack = useCallback((idx) => {
    if (idx >= 0 && idx < tracks.length) {
      setCurrentIndex(idx);
      setIsPlaying(true);
      isPlayingRef.current = true;
      if (audioRef.current) {
        audioRef.current.play().catch(() => {});
      }
    }
  }, [tracks.length]);

  // Handle Speech Recognition lifecycle
  useEffect(() => {
    const SpeechRecognition = typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const spoken = (interimTranscript || finalTranscript).trim();
      if (spoken) {
        setTranscript(spoken);

        const match = findMatchingTrack(spoken);
        const now = Date.now();
        if (match && (now - lastMatchTimeRef.current > 1500 || match.index !== currentIndex)) {
          lastMatchTimeRef.current = now;
          playMatchedTrack(match.index);
        }
      }
    };

    recognition.onerror = (event) => {
      // In Electron desktop, Chromium lacks Google's proprietary Speech API key
      // and returns 'network' / 'not-allowed'. Stop the loop and open lyric search.
      if (event.error === 'network' || event.error === 'service-not-allowed' || event.error === 'not-allowed') {
        isListeningRef.current = false;
        setIsListening(false);
        setSpeechError('network');
        setIsSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 150);
      } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('Speech recognition notice:', event.error);
      }
    };

    recognition.onend = () => {
      // Only keep continuous listening if user hasn't toggled off and no network error occurred
      if (isListeningRef.current && !speechError) {
        try {
          recognition.start();
        } catch {
          // ignore if already running
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {}
    };
  }, [findMatchingTrack, currentIndex, playMatchedTrack, speechError]);

  const toggleListening = useCallback(() => {
    const SpeechRecognition = typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (!SpeechRecognition) {
      setIsSearchOpen(true);
      setTimeout(() => searchInputRef.current?.focus(), 150);
      return;
    }

    if (isListening) {
      isListeningRef.current = false;
      setIsListening(false);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setTranscript('');
    } else {
      isListeningRef.current = true;
      setIsListening(true);
      setTranscript('');
      setSpeechError(null);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (err) {
          console.warn('Recognition start error:', err);
          setIsListening(false);
          isListeningRef.current = false;
          setIsSearchOpen(true);
        }
      }
    }
  }, [isListening]);

  // Load cloud images from R2 on mount
  useEffect(() => {
    let active = true;
    musicApi('/images')
      .then((res) => {
        if (!active || !Array.isArray(res?.images) || !res.images.length) return;
        const cloudThemes = res.images.map((img) => ({
          image: img.url,
          colors: ['#00d2ff', '#3b82f6', '#090d16']
        }));
        setThemes((prev) => {
          const existingUrls = new Set(prev.map((t) => t.image));
          const toAdd = cloudThemes.filter((t) => !existingUrls.has(t.image));
          return toAdd.length ? [...toAdd, ...prev] : prev;
        });
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  // Upload an image selected from this machine to R2 images/ folder
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingImage(true);
    setUploadNotice('Uploading image to R2 cloud storage…');
    try {
      const reader = new FileReader();
      const base64Promise = new Promise((resolve, reject) => {
        reader.onload = () => {
          const res = reader.result;
          resolve(typeof res === 'string' ? res.split(',')[1] : '');
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64 = await base64Promise;

      const result = await musicApi('/images', {
        filename: file.name,
        base64,
        contentType: file.type || 'image/jpeg'
      });

      if (result?.image?.url) {
        const newTheme = {
          image: result.image.url,
          colors: ['#38bdf8', '#818cf8', '#090d16']
        };
        setThemes((prev) => [newTheme, ...prev]);
        setImageIndex(0);
        setUploadNotice(`Uploaded "${result.image.name}" to R2 images!`);
      } else {
        throw new Error('Image upload failed.');
      }
    } catch (err) {
      console.error('Image upload error:', err);
      setUploadNotice(`Upload failed: ${err.message}`);
    } finally {
      setIsUploadingImage(false);
      setTimeout(() => setUploadNotice(''), 4500);
      if (e.target) e.target.value = '';
    }
  };

  // Sync image index when switching tracks
  useEffect(() => {
    setImageIndex(currentIndex % themes.length);
  }, [currentIndex, themes.length]);

  // Global keydown handler: Shift+Enter for image cycle & Cmd/Ctrl+R for clean mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        setImageIndex((prev) => (prev + 1) % themes.length);
      } else if (e.key === 'r' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCleanMode((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [themes.length]);

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
        setImageIndex((prev) => (prev + 1) % themes.length);
        tapCount = 0; // Reset counter after successful triple-tap
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    return () => window.removeEventListener('touchstart', handleTouchStart);
  }, [themes.length]);

  // Shuffle images across tracks
  const handleShuffleImages = useCallback(() => {
    setTracks((prevTracks) => {
      const shuffledThemes = [...themes].sort(() => Math.random() - 0.5);
      return prevTracks.map((track, i) => {
        const theme = shuffledThemes[i % shuffledThemes.length];
        return {
          ...track,
          image: theme.image,
          colors: theme.colors,
        };
      });
    });
  }, [themes]);

  // Add music from local audio file
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const fileName = file.name.replace(/\.[^/.]+$/, "");
    const randomTheme = themes[Math.floor(Math.random() * themes.length)];
    const newTrack = {
      id: `track-custom-${Date.now()}`,
      title: fileName,
      artist: 'Local Music',
      genre: 'Custom',
      url,
      image: randomTheme.image,
      colors: randomTheme.colors,
      lyrics: []
    };
    setTracks((prev) => [newTrack, ...prev]);
    setCurrentIndex(0);
    setShowAddModal(false);
  };

  const mergeCloudTracks = useCallback((incoming) => {
    setTracks((previous) => {
      const urls = new Set(previous.map((track) => track.url));
      const ids = new Set(previous.map((track) => track.id));
      const keys = new Set(previous.map((track) => track.key).filter(Boolean));
      const additions = incoming.filter((track) => !ids.has(track.id) && !urls.has(track.url) && !keys.has(track.key));
      return [...previous, ...additions.map((track, index) => ({
        ...track,
        image: themes[(previous.length + index) % themes.length].image,
        colors: themes[(previous.length + index) % themes.length].colors,
        lyrics: track.lyrics || [],
      }))];
    });
  }, [themes]);

  // Append records so library refreshes don't interrupt the currently playing song.
  useEffect(() => {
    let disposed = false;
    const refresh = async () => {
      try {
        const result = await musicApi('/tracks');
        if (!disposed) { mergeCloudTracks(result.tracks); setLibraryError(''); }
      } catch (error) { if (!disposed) setLibraryError(error.message); }
    };
    refresh();
    const timer = setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    return () => { disposed = true; clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [mergeCloudTracks]);

  const handleSongAdded = useCallback((track) => {
    mergeCloudTracks([track]);
    setLibraryError('');
  }, [mergeCloudTracks]);

  const isMobile = useIsMobile();
  const audioRef = useRef(null);
  const isPlayingRef = useRef(isPlaying);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const currentTrack = tracks[currentIndex] || tracks[0];
  const currentTheme = themes[imageIndex % themes.length] || themes[0];

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

      {/* Floating Voice Listener Pill (top-right, hidden in cleanMode) */}
      {!cleanMode && (
        <div className={`voice-listener-container ${isSearchOpen ? 'is-expanded' : ''}`}>
          <button
            className={`voice-listener-pill ${isListening ? 'is-listening' : ''}`}
            onClick={toggleListening}
            title={isListening ? "Listening for lyrics or song names... click to stop" : "Start Voice & Lyric Search"}
            type="button"
          >
            <span className="voice-listener-pulse" />
            <svg className="voice-mic-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
            <span className="voice-listener-text">
              {isListening
                ? (transcript ? `"${transcript}"` : "Listening lyrics...")
                : (transcript ? `"${transcript}"` : "Voice Search")}
            </span>
            <span
              className="voice-search-toggle"
              onClick={(e) => {
                e.stopPropagation();
                setIsSearchOpen((prev) => !prev);
                if (!isSearchOpen) {
                  setTimeout(() => searchInputRef.current?.focus(), 150);
                }
              }}
              title="Search by lyrics or title"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </span>
          </button>

          {isSearchOpen && (
            <div className="voice-search-dropdown">
              <div className="voice-search-input-wrap">
                <input
                  ref={searchInputRef}
                  type="text"
                  className="voice-search-input"
                  placeholder="Type or dictate lyric (e.g. night changes)..."
                  value={searchQuery}
                  onChange={(e) => {
                    const q = e.target.value;
                    setSearchQuery(q);
                    const match = findMatchingTrack(q);
                    if (match && q.length >= 3) {
                      playMatchedTrack(match.index);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const match = findMatchingTrack(searchQuery);
                      if (match) {
                        playMatchedTrack(match.index);
                        setIsSearchOpen(false);
                      }
                    } else if (e.key === 'Escape') {
                      setIsSearchOpen(false);
                    }
                  }}
                />
                <button
                  className="voice-search-close"
                  onClick={() => setIsSearchOpen(false)}
                  type="button"
                >
                  ✕
                </button>
              </div>
              {speechError === 'network' && (
                <div className="voice-search-hint">
                  <span>Electron speech service offline. Type lyrics or use macOS dictation (Fn Fn).</span>
                </div>
              )}
              {searchQuery && (
                <div className="voice-search-results">
                  {tracks
                    .map((t, idx) => {
                      const match = findMatchingTrack(searchQuery);
                      if (match && match.index === idx) return { track: t, idx, match };
                      return null;
                    })
                    .filter(Boolean)
                    .map(({ track, idx, match }) => (
                      <div
                        key={track.id || idx}
                        className="voice-search-result-item"
                        onClick={() => {
                          playMatchedTrack(idx);
                          setIsSearchOpen(false);
                        }}
                      >
                        <div className="voice-result-title">{track.title}</div>
                        <div className="voice-result-subtitle">
                          {match.matchType === 'lyric' ? `Matched Lyric: "${match.matchText}"` : track.artist}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
                className="brand-btn brand-btn--add-image"
                title="Select image from this machine and upload to R2"
                type="button"
                onClick={() => imageFileInputRef.current?.click()}
                disabled={isUploadingImage}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                <span>{isUploadingImage ? 'Uploading…' : 'Add image'}</span>
              </button>
              <button
                className="brand-btn brand-btn--add"
                title="Add song"
                type="button"
                aria-haspopup="dialog"
                onClick={() => setShowAddModal(true)}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span>Add song</span>
              </button>
            </div>
          </div>
          {libraryError && <p className="library-notice" role="status" title={libraryError}>Cloud additions unavailable · existing songs are ready</p>}
          <OptionWheel
            key={tracks.length}
            items={tracks.map((t) => t.title)}
            defaultSelected={currentIndex}
            value={currentIndex}
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

      <AddSongModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdded={handleSongAdded}
        onLocalFile={() => fileInputRef.current?.click()}
      />

      {/* Hidden file input for uploading images to R2 */}
      <input
        ref={imageFileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageUpload}
      />

      {/* Toast notification */}
      {uploadNotice && (
        <div className="upload-toast" role="status">
          {uploadNotice}
        </div>
      )}
    </main>
  );
}
