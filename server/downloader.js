const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
const fs = require('node:fs/promises');
const path = require('node:path');

const MAX_BYTES = 50 * 1024 * 1024;
// Resolve from this module so launches from Electron or another terminal folder
// still execute yt-dlp from the project root (yt2 locally, /app in Docker).
const PROJECT_DIR = path.resolve(__dirname, '..');
function normalizeQuery(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 500) {
    throw Object.assign(new Error('Enter a song name or YouTube link (up to 500 characters).'), { status: 400 });
  }
  const query = value.trim();
  if (/^(https?:\/\/|www\.|youtu\.be\/)/i.test(query)) {
    let url;
    try { url = new URL(/^https?:/i.test(query) ? query : `https://${query}`); } catch {}
    if (!url || !['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port ||
        !['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(url.hostname)) {
      throw Object.assign(new Error('Use a YouTube link or search by song name.'), { status: 400 });
    }
    const id = url.hostname === 'youtu.be' ? url.pathname.slice(1) :
      url.searchParams.get('v') || url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)$/)?.[1];
    if (!/^[\w-]{11}$/.test(id || '')) throw Object.assign(new Error('Use a single YouTube video link.'), { status: 400 });
    return `https://www.youtube.com/watch?v=${id}`;
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(query) || query.startsWith('//')) {
    throw Object.assign(new Error('Use a YouTube link or search by song name.'), { status: 400 });
  }
  return `ytsearch1:${query}`;
}

function run(args, { signal, onLine }) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Download was interrupted. Please try again.'));
    const grouped = process.platform !== 'win32';
    const child = spawn(process.env.YT_DLP_PATH || 'yt-dlp', args, {
      cwd: PROJECT_DIR, shell: false, detached: grouped, stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stop = () => {
      try { if (grouped && child.pid) process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); } catch {}
    };
    signal?.addEventListener('abort', stop, { once: true });
    let output = '';
    let errorOutput = '';
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; stop(); }, 8 * 60_000);
    const lines = createInterface({ input: child.stdout });
    lines.on('line', (line) => { output = (output + line + '\n').slice(-2_000_000); onLine?.(line); });
    // Keep bounded diagnostics in the backend terminal, not the public response.
    child.stderr.on('data', (chunk) => { errorOutput = (errorOutput + chunk.toString()).slice(-8000); });
    child.on('error', (error) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', stop);
      reject(new Error(error.code === 'ENOENT' ? 'yt-dlp is not installed on the server.' : 'Download was interrupted. Please try again.'));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', stop);
      if (code !== 0) {
        console.error(`[yt-dlp] Failed with exit code ${code} (working directory: ${PROJECT_DIR})\n${errorOutput}`);
        const message = /ffmpeg.*(?:not found|not installed)|ffprobe.*(?:not found|not installed)/i.test(errorOutput)
          ? 'FFmpeg is missing from the backend PATH. Install it and restart the backend.'
          : 'Could not download this song. Check the backend terminal for the yt-dlp error.';
        reject(new Error(timedOut ? 'Download timed out. Try a shorter song.' : message));
      }
      else resolve(output);
    });
  });
}

async function downloadSong(query, directory, update, signal) {
  // Output remains isolated per job, independently of the command's cwd.
  directory = path.resolve(directory);
  const base = ['--js-runtimes', 'node', '--ignore-config', '--no-playlist', '--no-warnings', '--socket-timeout', '20', '--retries', '2'];
  const raw = await run([...base, '--dump-single-json', '--skip-download', '--', query], { signal });
  const found = JSON.parse(raw);
  const info = found.entries?.[0] || found;
  if (!/^[\w-]{11}$/.test(info.id || '') || !Number.isFinite(info.duration) || info.duration <= 0 || info.duration > 900 || info.is_live) {
    throw new Error('Choose a non-live song shorter than 15 minutes.');
  }
  const track = {
    id: `youtube-${info.id}`, title: info.track || info.title || 'Untitled',
    artist: info.artist || info.uploader || 'Unknown artist', duration: info.duration,
    genre: 'Added music', lyrics: [], sourceUrl: `https://www.youtube.com/watch?v=${info.id}`,
  };
  update({ state: 'downloading', progress: 0, track });
  await run([...base, '-f', 'bestaudio/best', '-x', '--audio-format', 'mp3', '--audio-quality', '192K',
    '--max-filesize', String(MAX_BYTES), '--match-filter', 'duration <= 900 & !is_live',
    '--newline', '--progress', '--progress-template', 'download:ARIA:%(progress._percent_str)s',
    '-o', path.join(directory, 'audio.%(ext)s'), '--', track.sourceUrl], {
    signal, onLine(line) {
      const match = line.match(/ARIA:\s*([\d.]+)%/);
      if (match) update({ state: Number(match[1]) >= 100 ? 'converting' : 'downloading', progress: Math.min(100, Number(match[1])) });
    },
  });
  const file = path.join(directory, 'audio.mp3');
  const stats = await fs.stat(file);
  if (stats.size <= 0 || stats.size > MAX_BYTES) throw new Error('The downloaded song exceeds the 50 MB limit or is empty.');
  return { file, track: { ...track, size: stats.size } };
}
module.exports = { normalizeQuery, downloadSong };
