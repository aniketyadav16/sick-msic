// Development-only comparison page: /playbar-preview.html. No audio or cloud requests.
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PlaybarSurface } from './WavyPlaybar';
import './playbar-preview.css';
const tracks = [
  { title: 'Spain', artist: 'Jassa Dhillon', genre: 'Added music', colors: ['#00d2ff', '#818cf8', '#c4b5fd'] },
  { title: 'Pal Pal', artist: 'Afusic ft. Talwiinder', genre: 'Punjabi Indie', colors: ['#00d2ff', '#818cf8', '#c4b5fd'] },
];
function Study({ variant, number, title, description }) {
  const [playing, setPlaying] = useState(true), [position, setPosition] = useState(57), [volume, setVolume] = useState(.8), [index, setIndex] = useState(0);
  useEffect(() => { if (!playing) return; const id = setInterval(() => setPosition((v) => (v + 1) % 137), 1000); return () => clearInterval(id); }, [playing]);
  return <section className="study"><div className="study__label"><span>{number}</span><h2>{title}</h2></div>
    <div className="study__player playbar-studio"><PlaybarSurface variant={variant} track={tracks[index]} isPlaying={playing} currentTime={position} duration={137} volume={volume}
      onPlayPause={() => setPlaying(!playing)} onNext={() => { setIndex((index + 1) % 2); setPosition(0); }} onPrev={() => { setIndex((index + 1) % 2); setPosition(0); }} onSeek={setPosition} onVolumeChange={setVolume} /></div>
    <p className="study__description">{description}</p>
  </section>;
}
function Preview() {
  return <main className="studies"><header><div className="studies__brand"><span>✦</span> ARIA <i>/</i> PLAYER STUDIES</div><p className="studies__edition">EXPERIMENT 01—03</p></header>
    <div className="studies__intro"><h1>One song.<br /><em>Three moods.</em></h1><p>A different little world for whatever’s playing.<br />Try the controls. See what feels like you.</p></div>
    <div className="studies__grid"><Study variant="wave" number="01" title="Wave" description="The familiar favorite. A liquid ribbon of light, floating over your music." /><Study variant="mixtape" number="02" title="Mixtape" description="A little analog soul. Paper labels, spinning reels, and a satisfying play button." /><Study variant="orbit" number="03" title="Orbit" description="For getting lost in a song. A slow-spinning record, soft violet light, and room to breathe." /></div>
    <footer><span>All three are available in the app’s player-style switcher.</span><span>VISUAL PREVIEW · SIMULATED PLAYBACK</span></footer>
  </main>;
}
createRoot(document.getElementById('root')).render(<Preview />);
