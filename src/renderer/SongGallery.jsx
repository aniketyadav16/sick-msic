import React, { useMemo } from 'react';
import InfiniteMenu from './InfiniteMenu';
import ClassicPlaybar from './ClassicPlaybar';
import './SongGallery.css';

const LOCAL_ART = [
  'earth-orbit', 'galaxy-spiral', 'scenic-earth-aurora', 'space-nebula',
  'scenic-earth-lake', 'galaxy-milkyway', 'earth-horizon', 'scenic-earth-peaks',
  'galaxy-andromeda', 'scenic-earth-sunrise', 'space-deep-field', 'scenic-desert-galaxy'
];

export default function SongGallery({ tracks, currentIndex, cleanMode, libraryError, onSelect,
  onAddSong, onShuffleImages, ...playerProps }) {
  const items = useMemo(() => tracks.map((track, index) => ({
    image: track.image,
    fallbackImage: `./images/cosmos/${LOCAL_ART[index % LOCAL_ART.length]}.jpg`,
    title: track.title,
    description: track.artist,
  })), [tracks]);
  const currentTrack = tracks[currentIndex];
  const activate = (_, index) => {
    if (index === currentIndex) playerProps.onPlayPause();
    else onSelect(index);
  };

  return <section className={`song-gallery${cleanMode ? ' song-gallery--clean' : ''}`} aria-label="Gallery view">
    <header className="song-gallery__header">
      <div className="song-gallery__brand">ARIA <span>COSMOS</span></div>
      <div className="song-gallery__intro">
        <div><h1>Your music, in orbit.</h1><p>{tracks.length} songs. A different way to find your next.</p></div>
        <div className="song-gallery__actions">
          <button type="button" onClick={onShuffleImages} title="Shuffle song artwork">Shuffle images</button>
          <button type="button" onClick={onAddSong} aria-haspopup="dialog"><span aria-hidden="true">＋</span> Add song</button>
        </div>
      </div>
      {libraryError && <p className="song-gallery__notice" role="status" title={libraryError}>Cloud additions unavailable · your library is ready</p>}
    </header>
    <div className="song-gallery__scene">
      <InfiniteMenu items={items} selectedIndex={currentIndex} count={Math.max(160, tracks.length)}
        tileSize={0.63} roundness={0.2} zoom={1.25} pullBack={1} stretch={0.6}
        inertia={0.6} autoplay={3} grayscale dim={0.5} intro theme="dark" accentColor="#ffffff"
        onItemClick={activate} showInfo={!cleanMode}
        renderInfo={(item, index, moving) => {
          const playing = index === currentIndex && playerProps.isPlaying;
          return <div className="gallery-track" data-moving={moving}>
            <div className="gallery-track__title"><span>{index === currentIndex ? (playing ? 'NOW PLAYING' : 'ON THE PLAYER') : 'DISCOVER'}</span><h2>{item.title}</h2></div>
            <div className="gallery-track__artist"><p>{item.description}</p><span>{tracks[index]?.genre || 'Your library'}</span></div>
            <button className="gallery-track__play" type="button" disabled={moving} onClick={() => activate(item, index)} aria-label={`${playing ? 'Pause' : 'Play'} ${item.title}`}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={playing ? 'M6 5h4v14H6zm8 0h4v14h-4z' : 'M8 5v14l11-7z'} /></svg>
              {playing ? 'Pause song' : 'Play song'}
            </button>
          </div>;
        }} />
    </div>
    <div className="song-gallery__hint"><span>Drag to explore</span><i aria-hidden="true">·</i><span>Click the center image to play</span><span className="song-gallery__keyboard">Arrow keys to browse · Enter to play</span></div>
    {!cleanMode && currentTrack && <footer className="song-gallery__player">
      <img className="song-gallery__cover" src={currentTrack.image} alt="" onError={event => {
        if (event.currentTarget.dataset.fallback !== 'true') {
          event.currentTarget.dataset.fallback = 'true'; event.currentTarget.src = items[currentIndex].fallbackImage;
        }
      }} key={currentTrack.image} />
      <ClassicPlaybar track={currentTrack} {...playerProps} />
    </footer>}
  </section>;
}
