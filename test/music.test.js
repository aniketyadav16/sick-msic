const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { normalizeQuery } = require('../server/downloader');
const { createJobs } = require('../server/jobs');
const { createStorage } = require('../server/storage');
const { startServer } = require('../server');
const track = { id: 'youtube-abcdefghijk', title: 'A song', artist: 'An artist', duration: 120, size: 5 };
async function downloader(query, directory, update) {
  update({ state: 'downloading', progress: 42, track });
  const file = path.join(directory, 'audio.mp3');
  await fs.writeFile(file, 'audio');
  return { file, track };
}
function fixture(overrides = {}) {
  const saved = [];
  const storage = { check() {}, list: async () => saved, add_song: async (_file, item) => {
    const result = { ...item, url: `https://music.example/music/${item.id}.mp3` }; saved.push(result); return result;
  }, ...overrides };
  return { storage, saved };
}
async function waitFor(read, state) {
  for (let i = 0; i < 100; i++) {
    const value = await read();
    if (value.state === state) return value;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Did not reach ${state}`);
}

test('normalizes searches and strips URL playlist/redirect parameters; rejects unsafe inputs', () => {
  assert.equal(normalizeQuery('  Night Changes  '), 'ytsearch1:Night Changes');
  assert.equal(normalizeQuery('https://youtu.be/abcdefghijk?list=other'), 'https://www.youtube.com/watch?v=abcdefghijk');
  assert.equal(normalizeQuery('https://music.youtube.com/watch?v=abcdefghijk&list=other'), 'https://www.youtube.com/watch?v=abcdefghijk');
  for (const query of ['', null, {}, 'a'.repeat(501), 'file:///etc/passwd', 'http://127.0.0.1', 'https://youtube.com.evil.test/watch?v=abcdefghijk', 'https://youtube.com:123/watch?v=abcdefghijk', 'https://youtube.com/playlist?list=abc', '//localhost/admin']) {
    assert.throws(() => normalizeQuery(query), { status: 400 });
  }
  assert.equal(normalizeQuery('--exec touch /tmp/test'), 'ytsearch1:--exec touch /tmp/test');
});

test('password gates uploads; success is idempotent and removes temporary audio', async (t) => {
  let uploadedFile;
  let uploads = 0;
  const { storage } = fixture({ add_song: async (file, item) => { uploads++; uploadedFile = file; return { ...item, url: 'https://music.example/a.mp3' }; } });
  const jobs = createJobs({ storage, password: 'minion', downloader }); t.after(() => jobs.close());
  const started = jobs.start('test song');
  assert.equal(started.state, 'searching');
  assert.equal(started.id.length, 64);
  assert.throws(() => jobs.upload(started.id, 'minion'), { status: 409 });
  await waitFor(() => jobs.status(started.id), 'awaiting_password');
  assert.throws(() => jobs.upload(started.id, 'wrong'), { status: 401 });
  assert.equal(uploads, 0);
  assert.equal(jobs.upload(started.id, 'minion').state, 'uploading');
  jobs.upload(started.id, 'minion');
  await waitFor(() => jobs.status(started.id), 'complete');
  assert.equal(uploads, 1);
  jobs.upload(started.id, 'minion');
  assert.equal(uploads, 1);
  await new Promise((resolve) => setTimeout(resolve, 20));
  await assert.rejects(fs.stat(uploadedFile), { code: 'ENOENT' });
});

test('failed R2 upload retains the prepared song for password-protected retry', async (t) => {
  let calls = 0;
  const { storage } = fixture({ add_song: async (_file, item) => { if (++calls === 1) throw new Error('secret details'); return item; } });
  const jobs = createJobs({ storage, password: 'minion', downloader }); t.after(() => jobs.close());
  const { id } = jobs.start('song'); await waitFor(() => jobs.status(id), 'awaiting_password');
  jobs.upload(id, 'minion');
  const failed = await waitFor(() => jobs.status(id), 'awaiting_password');
  assert.match(failed.error, /R2 upload failed/); assert.ok(!failed.error.includes('secret'));
  jobs.upload(id, 'minion'); await waitFor(() => jobs.status(id), 'complete');
  assert.equal(calls, 2);
});

test('five wrong guesses lock a job; unknown jobs and expired jobs are rejected', async (t) => {
  const { storage } = fixture();
  const jobs = createJobs({ storage, password: 'minion', downloader, ttl: 120 }); t.after(() => jobs.close());
  const { id } = jobs.start('song'); await waitFor(() => jobs.status(id), 'awaiting_password');
  for (let i = 0; i < 5; i++) assert.throws(() => jobs.upload(id, 'bad'), { status: 401 });
  assert.throws(() => jobs.upload(id, 'minion'), { status: 429 });
  assert.throws(() => jobs.status('unknown'), { status: 404 });
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.throws(() => jobs.status(id), { status: 404 });
});

test('download failure exposes a recoverable state and concurrency is bounded', async (t) => {
  const { storage } = fixture();
  const jobs = createJobs({ storage, password: 'minion', downloader: async () => { throw new Error('Song unavailable'); } });
  t.after(() => jobs.close());
  const first = jobs.start('one'); const second = jobs.start('two');
  assert.throws(() => jobs.start('three'), { status: 429 });
  assert.equal((await waitFor(() => jobs.status(first.id), 'error')).error, 'Song unavailable');
  await waitFor(() => jobs.status(second.id), 'error');
});

test('missing R2 settings fail closed before starting a download', () => {
  const storage = createStorage({});
  assert.throws(() => storage.check(), { status: 503 });
});

test('HTTP workflow, CORS, invalid requests, no secret exposure, library persistence, rate limits', async (t) => {
  const { storage, saved } = fixture();
  const app = await startServer({ storage, password: 'minion', downloader, port: 0, origins: ['https://aria.vercel.app'] });
  t.after(() => app.close());
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const post = (route, body, origin = 'https://aria.vercel.app') => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body) });
  assert.equal((await post('/api/songs', { query: 'song' }, 'https://evil.example')).status, 403);
  assert.equal((await post('/api/songs', null)).status, 400);
  assert.equal((await post('/api/songs', { query: 'x'.repeat(5000) })).status, 413);
  const response = await post('/api/songs', { query: 'song' });
  assert.equal(response.status, 202); assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://aria.vercel.app');
  const { id } = await response.json();
  const read = async () => (await fetch(`${base}/api/songs/${id}`)).json();
  const ready = await waitFor(read, 'awaiting_password');
  assert.ok(!JSON.stringify(ready).includes('minion')); assert.equal(ready.file, undefined);
  assert.equal((await post(`/api/songs/${id}/upload`, { password: 'incorrect' })).status, 401);
  assert.equal(saved.length, 0);
  assert.equal((await post(`/api/songs/${id}/upload`, { password: 'minion' })).status, 202);
  await waitFor(read, 'complete');
  const library = await (await fetch(base + '/api/tracks')).json();
  assert.equal(library.tracks[0].title, 'A song');
  assert.equal((await fetch(base + '/api/missing')).status, 404);
  await post('/api/songs', { query: 'x' }); await post('/api/songs', { query: 'y' });
  assert.equal((await post('/api/songs', { query: 'z' })).status, 429);
});

test('yt-dlp runs from the project root for search and download with isolated absolute output paths', async (t) => {
  const { downloadSong } = require('../server/downloader');
  const os = require('node:os');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aria-downloader-test-'));
  const binary = path.join(dir, 'fake-yt-dlp');
  const previous = process.env.YT_DLP_PATH;
  t.after(async () => { if (previous === undefined) delete process.env.YT_DLP_PATH; else process.env.YT_DLP_PATH = previous; await fs.rm(dir, { recursive: true, force: true }); });
  await fs.writeFile(binary, `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
if (process.cwd() !== ${JSON.stringify(path.resolve(__dirname, '..'))}) process.exit(4);
if (!args.includes('--ignore-config') || args.at(-2) !== '--') process.exit(2);
if (args.includes('--dump-single-json')) {
  console.log(JSON.stringify({ entries: [{ id: 'abcdefghijk', title: 'Test', uploader: 'Artist', duration: 123 }] }));
} else {
  if (args.at(-1) !== 'https://www.youtube.com/watch?v=abcdefghijk') process.exit(3);
  if (!require('node:path').isAbsolute(args[args.indexOf('-o') + 1])) process.exit(5);
  fs.writeFileSync(args[args.indexOf('-o') + 1].replace('%(ext)s', 'mp3'), 'test audio');
  console.log('ARIA:  42.5%');
  console.log('ARIA: 100.0%');
}
`, { mode: 0o700 });
  process.env.YT_DLP_PATH = binary;
  const updates = [];
  const result = await downloadSong(normalizeQuery('song; touch SHOULD_NOT_EXIST'), dir, (value) => updates.push(value), new AbortController().signal);
  assert.equal(result.track.id, 'youtube-abcdefghijk');
  assert.equal(result.track.size, 10);
  assert.ok(updates.some((update) => update.progress === 42.5));
  assert.equal(updates.at(-1).state, 'converting');
  assert.equal(await fs.readFile(result.file, 'utf8'), 'test audio');
  await assert.rejects(fs.stat(path.join(dir, 'SHOULD_NOT_EXIST')), { code: 'ENOENT' });
});

test('R2 discovers manual uploads and saves each added song in one object, with range playback', async (t) => {
  const { S3Client } = require('@aws-sdk/client-s3');
  const { Readable } = require('node:stream');
  const os = require('node:os');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aria-r2-test-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'audio.mp3'); await fs.writeFile(file, 'audio');
  const objects = new Map();
  let writes = 0, clock = Date.now();
  t.mock.method(Date, 'now', () => clock);
  t.mock.method(S3Client.prototype, 'send', async (command) => {
    const { Key, Body, Bucket, ContentType, ContentLength, Prefix, Metadata, Range, ContinuationToken } = command.input;
    assert.equal(Bucket, 'test-bucket');
    if (command.constructor.name === 'PutObjectCommand') {
      writes++;
      assert.ok(Key.endsWith('.mp3')); assert.equal(ContentType, 'audio/mpeg'); assert.equal(ContentLength, 5);
      const chunks = []; for await (const chunk of Body) chunks.push(chunk);
      objects.set(Key, { data: Buffer.concat(chunks).toString(), Metadata });
      return {};
    }
    if (command.constructor.name === 'ListObjectsV2Command') {
      assert.equal(Prefix, 'music/');
      const keys = [...objects.keys()].filter((key) => key.startsWith(Prefix));
      const offset = Number(ContinuationToken || 0);
      return { Contents: keys.slice(offset, offset + 1).map((key) => ({ Key: key, ETag: key, Size: objects.get(key).data.length })),
        IsTruncated: offset + 1 < keys.length, NextContinuationToken: String(offset + 1) };
    }
    if (command.constructor.name === 'HeadObjectCommand') return objects.get(Key);
    if (command.constructor.name === 'GetObjectCommand') {
      assert.equal(Range, 'bytes=1-3');
      return { Body: Readable.from(['udi']), ContentRange: 'bytes 1-3/5', ContentLength: 3 };
    }
    throw new Error('Unexpected command');
  });
  // No public URL or password is needed by the storage adapter.
  const env = { R2_ACCOUNT_ID: 'test', R2_ACCESS_KEY_ID: 'test', R2_SECRET_ACCESS_KEY: 'test', R2_BUCKET_NAME: 'test-bucket' };
  const storage = createStorage(env);
  assert.deepEqual(await storage.list(), []);
  const added = await storage.add_song(file, track);
  assert.equal(added.url, `/api/audio?key=${encodeURIComponent(added.key)}`);
  assert.equal((await storage.list())[0].title, track.title);
  assert.equal(writes, 1);
  await storage.add_song(file, { ...track, id: 'youtube-lmnopqrstuv', title: 'हिंदी गीत' });
  await storage.add_song(file, track);
  assert.equal(objects.size, 2);
  const reloaded = await createStorage(env).list();
  assert.equal(reloaded.length, 2);
  assert.ok(reloaded.some((item) => item.title === 'हिंदी गीत'));
  // Simulate a file uploaded directly through the R2 dashboard. No catalog entry exists.
  objects.set('music/Artist - Manual song.mp3', { data: 'audio' });
  objects.set('music/notes.txt', { data: 'ignore me' });
  clock += 16_000;
  const discovered = await storage.list();
  assert.equal(discovered.length, 3);
  assert.ok(discovered.some((item) => item.title === 'Manual song' && item.artist === 'Artist'));
  const audio = await storage.audio('music/Artist - Manual song.mp3', 'bytes=1-3');
  let data = ''; for await (const chunk of audio.Body) data += chunk;
  assert.equal(data, 'udi'); assert.equal(audio.ContentType, 'audio/mpeg');
  await assert.rejects(storage.audio('private/secret.mp3'), { status: 404 });
  await assert.rejects(storage.audio('music/notes.txt'), { status: 404 });
  await assert.rejects(storage.audio('music/song.mp3', 'bytes=1-2,3-4'), { status: 416 });
});

test('HTTP audio streams byte ranges and permits metadata-only requests', async (t) => {
  const { Readable } = require('node:stream');
  const { storage } = fixture({ audio: async (key, range, headOnly) => {
    assert.equal(key, 'music/Artist - Song.mp3');
    if (headOnly) return { ContentType: 'audio/mpeg', ContentLength: 5 };
    assert.equal(range, 'bytes=1-3');
    return { Body: Readable.from(['udi']), ContentType: 'audio/mpeg', ContentLength: 3, ContentRange: 'bytes 1-3/5' };
  } });
  const app = await startServer({ storage, port: 0 }); t.after(() => app.close());
  const url = `http://127.0.0.1:${app.server.address().port}/api/audio?key=music%2FArtist%20-%20Song.mp3`;
  const response = await fetch(url, { headers: { Range: 'bytes=1-3' } });
  assert.equal(response.status, 206); assert.equal(response.headers.get('content-range'), 'bytes 1-3/5');
  assert.equal(await response.text(), 'udi');
  const head = await fetch(url, { method: 'HEAD' });
  assert.equal(head.status, 200); assert.equal(head.headers.get('content-length'), '5'); assert.equal(await head.text(), '');
});
