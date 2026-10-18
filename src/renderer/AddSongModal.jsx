import React, { useEffect, useRef, useState } from 'react';
import { musicApi } from './music-api';

const labels = {
  searching: 'Looking for your song…',
  downloading: 'Downloading audio…',
  converting: 'Preparing MP3…',
  awaiting_password: 'Your song is ready to save.',
  uploading: 'Uploading to your music library…',
  complete: 'Added to your library.',
  error: 'The download could not finish.',
};

export function suggestAlias(title, artist = '') {
  if (!title) return '';
  let cleaned = title;
  if (artist && cleaned.toLowerCase().startsWith(artist.toLowerCase())) {
    cleaned = cleaned.slice(artist.length).replace(/^[\s\-–—:|]+/, '');
  }
  cleaned = cleaned.replace(/\s*[([][^)]*(?:official|video|audio|lyrics?|lyrical|visuali[sz]er|remastered|4k|hd|prod\.?|feat\.?|ft\.?)[^\])]*[)\]]/gi, '');
  cleaned = cleaned.replace(/\s*\[[a-zA-Z0-9_-]{8,}\]/g, '');
  cleaned = cleaned.replace(/\s*(?:prod\.?|produced by)\s*@?[a-zA-Z0-9_.-]+/gi, '');
  cleaned = cleaned.replace(/\s*(?:with|feat\.?|ft\.?)\s*@?[a-zA-Z0-9_.-]+/gi, '');
  const parts = cleaned.split(/\s+[|｜/]\s+/);
  if (parts.length > 1 && parts[0].trim().length > 2) {
    cleaned = parts[0];
  }
  return cleaned.trim().replace(/^[\s\-–—:|]+|[\s\-–—:|]+$/g, '').trim() || title;
}

function formatDuration(seconds) {
  const m = Math.floor((seconds || 0) / 60);
  const s = String(Math.floor((seconds || 0) % 60)).padStart(2, '0');
  return `${m}:${s}`;
}

export default function AddSongModal({ open, onClose, onAdded, onLocalFile }) {
  const [query, setQuery] = useState('');
  const [password, setPassword] = useState('');
  const [alias, setAlias] = useState('');
  const [confirmedAlias, setConfirmedAlias] = useState(false);
  const [job, setJob] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef(null);
  const delivered = useRef(null);
  const submitting = useRef(false);

  const active = job && ['searching', 'downloading', 'converting', 'uploading'].includes(job.state);

  // Automatically suggest alias once track metadata is downloaded
  useEffect(() => {
    if (job?.track && !alias) {
      setAlias(suggestAlias(job.track.title, job.track.artist));
    }
  }, [job?.track, alias]);

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
        setJob(next);
        setError('');
        if (next.state === 'complete' && delivered.current !== next.id) {
          delivered.current = next.id;
          onAdded(next.track);
        }
        if (['searching', 'downloading', 'converting', 'uploading'].includes(next.state)) {
          timer = setTimeout(poll, 1200);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err.message);
          if (err.status === 404) {
            setJob((previous) => ({ ...previous, state: 'error' }));
          } else {
            timer = setTimeout(poll, 4000);
          }
        }
      }
    };
    poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [job?.id, active, onAdded]);

  const handleReset = () => {
    setJob(null);
    setError('');
    setPassword('');
    setAlias('');
    setConfirmedAlias(false);
  };

  async function submit(event) {
    event.preventDefault();
    if (submitting.current || active) return;

    // Step: Confirm song alias before password screen
    if (job?.state === 'awaiting_password' && !confirmedAlias) {
      if (!alias.trim() && job?.track) {
        setAlias(job.track.title);
      }
      setConfirmedAlias(true);
      return;
    }

    submitting.current = true;
    setPending(true);
    setError('');
    try {
      const next = job?.state === 'awaiting_password'
        ? await musicApi(`/songs/${job.id}/upload`, {
            password,
            alias: alias.trim() || job.track?.title
          })
        : await musicApi('/songs', { query });
      setJob(next);
      if (next.state === 'complete' && delivered.current !== next.id) {
        delivered.current = next.id;
        onAdded(next.track);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setPassword('');
      setPending(false);
      submitting.current = false;
    }
  }

  function keyDown(event) {
    event.stopPropagation();
    if (event.key === 'Escape') onClose();
    if (event.key !== 'Tab') return;
    const elements = [...dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled)')];
    const first = elements[0], last = elements.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  if (!open) return null;

  const isAliasScreen = job?.state === 'awaiting_password' && !confirmedAlias;
  const isPasswordScreen = job?.state === 'awaiting_password' && confirmedAlias;

  return (
    <div className="add-modal-backdrop" onClick={onClose}>
      <div
        className="add-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-song-title"
        ref={dialogRef}
        onKeyDown={keyDown}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="add-modal__heading">
          <div>
            {isAliasScreen && <span className="add-modal__badge">Step 1 of 2: Set Song Alias</span>}
            {isPasswordScreen && <span className="add-modal__badge">Step 2 of 2: Unlock Upload</span>}
            <h2 className="add-modal__title" id="add-song-title">
              {isAliasScreen ? 'Set Song Alias' : isPasswordScreen ? 'Unlock & Upload' : 'Add to your cosmos'}
            </h2>
          </div>
          <button type="button" className="add-modal__file-btn" aria-label="Close add song" onClick={onClose}>
            ✕
          </button>
        </div>

        <p className="add-modal__hint">
          {isAliasScreen
            ? 'The downloaded name is long. Customize a clean alias to display on the wheel and player:'
            : isPasswordScreen
            ? 'Your song is prepared. Enter the upload password to save it to Cloudflare R2:'
            : 'Find a song, set a clean display alias, then unlock the cloud upload.'}
        </p>

        <form onSubmit={submit}>
          {/* Query input: initial or error state */}
          {(!job || job.state === 'error') && (
            <>
              <label htmlFor="song-query">Song name or YouTube link</label>
              <input
                id="song-query"
                className="add-modal__input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. Night Changes — One Direction"
                maxLength={500}
                required
                disabled={pending}
              />
            </>
          )}

          {/* Active download progress */}
          {active && (
            <>
              {job?.track && (
                <div className="add-modal__track">
                  <strong>{job.track.title}</strong>
                  <span>
                    {job.track.artist} · {formatDuration(job.track.duration)}
                  </span>
                </div>
              )}
              <div role="status" aria-live="polite" className="add-modal__status">
                {labels[job.state]}
              </div>
              <progress
                aria-label={labels[job.state]}
                max="100"
                value={job.state === 'downloading' ? job.progress : undefined}
              />
            </>
          )}

          {/* SCREEN 1: Song Alias screen before password asking */}
          {isAliasScreen && job?.track && (
            <>
              <div className="add-modal__track">
                <span className="add-modal__orig-label">Detected from YouTube:</span>
                <strong style={{ opacity: 0.85, fontSize: '0.88rem' }}>{job.track.title}</strong>
                <span>
                  {job.track.artist} · {formatDuration(job.track.duration)}
                </span>
              </div>

              <label htmlFor="song-alias">Frontend Display Name (Alias)</label>
              <input
                id="song-alias"
                className="add-modal__input"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="e.g. Night Changes"
                maxLength={120}
                autoFocus
                required
                disabled={pending}
              />
              <p className="add-modal__hint" style={{ marginTop: '0.35rem', marginBottom: '1rem' }}>
                This short alias will appear on the rotary wheel and audio player.
              </p>
            </>
          )}

          {/* SCREEN 2: Upload password screen */}
          {isPasswordScreen && job?.track && (
            <>
              <div className="add-modal__track">
                <div className="add-modal__alias-header">
                  <span className="add-modal__alias-tag">Frontend Display Alias</span>
                  <button
                    type="button"
                    className="add-modal__alias-edit-btn"
                    onClick={() => setConfirmedAlias(false)}
                  >
                    Edit alias
                  </button>
                </div>
                <strong>{alias.trim() || job.track.title}</strong>
                <span>
                  {job.track.artist} · {formatDuration(job.track.duration)}
                </span>
              </div>

              <label htmlFor="upload-password">Upload password</label>
              <input
                key={job.id}
                id="upload-password"
                className="add-modal__input"
                type="password"
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                required
                disabled={pending}
              />
            </>
          )}

          {/* Complete screen */}
          {job?.state === 'complete' && (
            <div className="add-modal__track">
              <span className="add-modal__alias-tag" style={{ color: '#4ade80' }}>✓ Saved to Library</span>
              <strong>{alias.trim() || job.track?.title}</strong>
              <span>{job.track?.artist}</span>
            </div>
          )}

          {(error || job?.error) && (
            <p className="add-modal__error" role="alert">
              {error || job.error}
            </p>
          )}

          <div className="add-modal__row">
            {!job && (
              <button
                type="button"
                className="add-modal__file-btn"
                disabled={pending}
                onClick={onLocalFile}
              >
                Play local file
              </button>
            )}

            {isAliasScreen && (
              <button
                type="button"
                className="add-modal__file-btn"
                onClick={() => {
                  setAlias(job.track.title);
                  setConfirmedAlias(true);
                }}
              >
                Keep original name
              </button>
            )}

            {isPasswordScreen && (
              <button
                type="button"
                className="add-modal__file-btn"
                onClick={() => setConfirmedAlias(false)}
              >
                ← Change alias
              </button>
            )}

            {job && !active && (
              <button
                type="button"
                className="add-modal__file-btn"
                disabled={pending}
                onClick={handleReset}
              >
                Another song
              </button>
            )}

            {job?.state === 'complete' ? (
              <button type="button" className="add-modal__submit-btn" onClick={onClose}>
                Done
              </button>
            ) : isAliasScreen ? (
              <button
                className="add-modal__submit-btn"
                type="submit"
                disabled={pending || !alias.trim()}
              >
                Continue to Password →
              </button>
            ) : (
              <button
                className="add-modal__submit-btn"
                type="submit"
                disabled={
                  pending ||
                  active ||
                  (job?.state === 'awaiting_password' ? !password : !query.trim())
                }
              >
                {pending ? 'Please wait…' : active ? 'Working…' : isPasswordScreen ? 'Unlock & upload' : 'Find & download'}
              </button>
            )}
          </div>
        </form>

        <p className="add-modal__hint">
          {active
            ? 'You can hide this window and keep listening.'
            : 'Prepared songs expire after 30 minutes. Saved songs stay in your cloud R2 library permanently.'}
        </p>
      </div>
    </div>
  );
}
