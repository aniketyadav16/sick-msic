import React, { useEffect, useRef, useState } from 'react';
import { musicApi } from './music-api';

const labels = {
  searching: 'Looking for your song…', downloading: 'Downloading audio…', converting: 'Preparing MP3…',
  awaiting_password: 'Your song is ready. Enter the password to save it.', uploading: 'Uploading to your music library…',
  complete: 'Added to your library.', error: 'The download could not finish.',
};
export default function AddSongModal({ open, onClose, onAdded, onLocalFile }) {
  const [query, setQuery] = useState('');
  const [password, setPassword] = useState('');
  const [job, setJob] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef(null);
  const delivered = useRef(null);
  const submitting = useRef(false);
  const active = job && ['searching', 'downloading', 'converting', 'uploading'].includes(job.state);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    dialogRef.current?.querySelector('input')?.focus();
    return () => previous?.focus();
  }, [open]);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    let timer;
    const poll = async () => {
      try {
        const next = await musicApi(`/songs/${job.id}`, undefined, controller.signal);
        if (controller.signal.aborted) return;
        setJob(next); setError('');
        if (next.state === 'complete' && delivered.current !== next.id) {
          delivered.current = next.id; onAdded(next.track);
        }
        if (['searching', 'downloading', 'converting', 'uploading'].includes(next.state)) timer = setTimeout(poll, 1200);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err.message);
          if (err.status === 404) setJob((previous) => ({ ...previous, state: 'error' }));
          else timer = setTimeout(poll, 4000);
        }
      }
    };
    poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [job?.id, active, onAdded]);
  async function submit(event) {
    event.preventDefault();
    if (submitting.current || active) return;
    submitting.current = true; setPending(true); setError('');
    try {
      const next = job?.state === 'awaiting_password'
        ? await musicApi(`/songs/${job.id}/upload`, { password })
        : await musicApi('/songs', { query });
      setJob(next);
      if (next.state === 'complete' && delivered.current !== next.id) { delivered.current = next.id; onAdded(next.track); }
    } catch (err) { setError(err.message); }
    finally { setPassword(''); setPending(false); submitting.current = false; }
  }
  function keyDown(event) {
    event.stopPropagation();
    if (event.key === 'Escape') onClose();
    if (event.key !== 'Tab') return;
    const elements = [...dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled)')];
    const first = elements[0], last = elements.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  if (!open) return null;
  return <div className="add-modal-backdrop" onClick={onClose}>
    <div className="add-modal" role="dialog" aria-modal="true" aria-labelledby="add-song-title" ref={dialogRef} onKeyDown={keyDown} onClick={(e) => e.stopPropagation()}>
      <div className="add-modal__heading"><h2 className="add-modal__title" id="add-song-title">Add to your cosmos</h2><button type="button" className="add-modal__file-btn" aria-label="Close add song" onClick={onClose}>✕</button></div>
      <p className="add-modal__hint">Find a song, prepare the audio, then unlock the upload.</p>
      <form onSubmit={submit}>
        {(!job || job.state === 'error') && <><label htmlFor="song-query">Song name or YouTube link</label><input id="song-query" className="add-modal__input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Night Changes — One Direction" maxLength={500} required disabled={pending} /></>}
        {job?.track && <div className="add-modal__track"><strong>{job.track.title}</strong><span>{job.track.artist} · {Math.floor(job.track.duration / 60)}:{String(Math.floor(job.track.duration % 60)).padStart(2, '0')}</span></div>}
        {job && <div role="status" aria-live="polite" className="add-modal__status">{labels[job.state]}</div>}
        {active && <progress aria-label={labels[job.state]} max="100" value={job.state === 'downloading' ? job.progress : undefined} />}
        {job?.state === 'awaiting_password' && <><label htmlFor="upload-password">Upload password</label><input key={job.id} id="upload-password" className="add-modal__input" type="password" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus required disabled={pending} /></>}
        {(error || job?.error) && <p className="add-modal__error" role="alert">{error || job.error}</p>}
        <div className="add-modal__row">
          {!job && <button type="button" className="add-modal__file-btn" disabled={pending} onClick={onLocalFile}>Play local file</button>}
          {job && !active && <button type="button" className="add-modal__file-btn" disabled={pending} onClick={() => { setJob(null); setError(''); setPassword(''); }}>Another song</button>}
          {job?.state === 'complete' ? <button type="button" className="add-modal__submit-btn" onClick={onClose}>Done</button> : <button className="add-modal__submit-btn" type="submit" disabled={pending || active || (job?.state === 'awaiting_password' ? !password : !query.trim())}>{pending ? 'Please wait…' : active ? 'Working…' : job?.state === 'awaiting_password' ? 'Unlock & upload' : 'Find & download'}</button>}
        </div>
      </form>
      <p className="add-modal__hint">{active ? 'You can hide this window and keep listening.' : 'Prepared songs expire after 30 minutes. Local files play on this device only.'}</p>
    </div>
  </div>;
}
