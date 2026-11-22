const { randomBytes, createHash, timingSafeEqual } = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { normalizeQuery, downloadSong } = require('./downloader');
const fail = (message, status) => Object.assign(new Error(message), { status });
const hash = (text) => createHash('sha256').update(text).digest();
const busy = (job) => ['searching', 'downloading', 'converting', 'uploading'].includes(job.state);

function createJobs({ storage, password, downloader = downloadSong, ttl = 30 * 60_000 }) {
  const jobs = new Map();
  let closed = false;
  const snapshot = ({ id, state, progress, track, error, expiresAt }) => ({ id, state, progress, track, error, expiresAt });
  async function cleanup(job) { if (job.directory) await fs.rm(job.directory, { recursive: true, force: true }); }
  const timer = setInterval(() => {
    for (const [id, job] of jobs) if (!busy(job) && Date.now() > job.expiresAt) {
      jobs.delete(id); cleanup(job).catch(() => {});
    }
  }, 30_000);
  timer.unref();
  function get(id) {
    const job = jobs.get(id);
    if (!job || (!busy(job) && Date.now() > job.expiresAt)) throw fail('This download expired. Search for the song again.', 404);
    return job;
  }
  return {
    start(query) {
      storage.check();
      const normalized = normalizeQuery(query);
      if (closed || jobs.size >= 30 || [...jobs.values()].filter(busy).length >= 2) throw fail('The song queue is full. Please try again shortly.', 429);
      const job = { id: randomBytes(32).toString('hex'), state: 'searching', progress: 0, expiresAt: Date.now() + ttl,
        attempts: 0, controller: new AbortController() };
      jobs.set(job.id, job);
      job.task = (async () => {
        try {
          job.directory = await fs.mkdtemp(path.join(os.tmpdir(), 'aria-song-'));
          const result = await downloader(normalized, job.directory, (patch) => Object.assign(job, patch), job.controller.signal);
          Object.assign(job, result, { state: 'awaiting_password', progress: 100, expiresAt: Date.now() + ttl });
        } catch (error) {
          job.state = 'error'; job.error = error.message;
          await cleanup(job);
        }
      })();
      return snapshot(job);
    },
    status(id) { return snapshot(get(id)); },
    upload(id, candidate, options = {}) {
      const job = get(id);
      if (!password) throw fail('Upload password is not configured on the server.', 503);
      if (job.attempts >= 5) throw fail('Too many incorrect passwords. Start a new download.', 429);
      if (typeof candidate !== 'string' || !timingSafeEqual(hash(candidate), hash(password))) {
        job.attempts += 1;
        throw fail('Incorrect password. Please try again.', 401);
      }
      if (job.state === 'complete' || job.state === 'uploading') return snapshot(job);
      if (job.state !== 'awaiting_password') throw fail('Wait for the song to finish downloading.', 409);
      if ([...jobs.values()].filter(busy).length >= 2) throw fail('The song queue is full. Please try again shortly.', 429);

      const customTitle = options.alias || options.title;
      if (customTitle && typeof customTitle === 'string' && customTitle.trim() && job.track) {
        job.track.title = customTitle.trim();
      }
      if (options.artist && typeof options.artist === 'string' && options.artist.trim() && job.track) {
        job.track.artist = options.artist.trim();
      }

      job.state = 'uploading'; job.error = undefined;
      job.task = (async () => {
        try {
          job.track = await storage.add_song(job.file, job.track);
          job.state = 'complete'; job.expiresAt = Date.now() + ttl;
        } catch {
          job.state = 'awaiting_password'; job.error = 'R2 upload failed. Check the bucket configuration and try again.';
        } finally {
          if (job.state === 'complete') await cleanup(job);
        }
      })();
      return snapshot(job);
    },
    async close() {
      closed = true; clearInterval(timer);
      for (const job of jobs.values()) job.controller.abort();
      await Promise.allSettled([...jobs.values()].map((job) => job.task));
      await Promise.allSettled([...jobs.values()].map(cleanup));
    },
  };
}
module.exports = { createJobs };
