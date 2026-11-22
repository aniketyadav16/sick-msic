const { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { createReadStream } = require('node:fs');
const path = require('node:path');
const PREFIX = 'music/';
const TYPES = { '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.wav': 'audio/wav', '.flac': 'audio/flac', '.ogg': 'audio/ogg', '.opus': 'audio/ogg' };
const isAudio = (key) => typeof key === 'string' && key.startsWith(PREFIX) && Boolean(TYPES[path.extname(key).toLowerCase()]);
const audioUrl = (key) => `/api/audio?key=${encodeURIComponent(key)}`;

function createStorage(env = process.env) {
  const missing = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'].filter((name) => !env[name]);
  const bucketName = (env.R2_BUCKET_NAME || 'music-stuff').split('/')[0];
  const publicUrl = (env.R2_PUBLIC_URL || 'https://pub-74b555bb7c5040d49fc3ff86bc7905d1.r2.dev').replace(/\/$/, '');
  let client;
  let cache;
  let cacheUntil = 0;
  const details = new Map();
  function check() {
    if (missing.length) throw Object.assign(new Error(`Server setup required: ${missing.join(', ')}.`), { status: 503 });
    client ||= new S3Client({ region: 'auto', endpoint: env.S3_END_POINT || `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
      requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' });
  }
  async function send(command) { return client.send(command, { abortSignal: AbortSignal.timeout(120_000) }); }
  function describe(key, info, metadata = {}) {
    let saved = {};
    try { saved = JSON.parse(Buffer.from(metadata['aria-track'] || '', 'base64url').toString()); } catch {}
    const name = path.basename(key, path.extname(key)).replace(/\[[^\]]*\]/g, '').trim();
    const parts = name.split(' - ');
    return {
      id: typeof saved.id === 'string' ? saved.id : `r2-${Buffer.from(key).toString('base64url')}`,
      key, title: saved.title || (parts.length > 1 ? parts.slice(1).join(' - ') : name),
      artist: saved.artist || (parts.length > 1 ? parts[0] : 'Aria Music'),
      duration: Number(saved.duration) || 0, genre: 'Added music', lyrics: [],
      size: info.Size ?? info.ContentLength ?? 0,
      addedAt: new Date(info.LastModified || 0).getTime(), url: audioUrl(key),
    };
  }
  return {
    check,
    getBucket() { return bucketName; },
    getPublicUrl() { return publicUrl; },
    async list() {
      check();
      if (cache && Date.now() < cacheUntil) return cache;
      let token;
      const tracks = [];
      const present = new Set();
      do {
        const page = await send(new ListObjectsV2Command({ Bucket: bucketName, Prefix: PREFIX, ContinuationToken: token }));
        const objects = (page.Contents || []).filter(({ Key }) => isAudio(Key));
        for (let i = 0; i < objects.length; i += 10) {
          tracks.push(...await Promise.all(objects.slice(i, i + 10).map(async (item) => {
            present.add(item.Key);
            const version = `${item.ETag}:${item.LastModified}`;
            const cached = details.get(item.Key);
            if (cached?.version === version) return cached.track;
            try {
              const head = await send(new HeadObjectCommand({ Bucket: bucketName, Key: item.Key }));
              const track = describe(item.Key, item, head.Metadata);
              details.set(item.Key, { version, track });
              return track;
            } catch (error) {
              // An object may have been removed between listing and reading metadata.
              if (error.$metadata?.httpStatusCode === 404) return null;
              throw error;
            }
          })));
        }
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (token);
      for (const key of details.keys()) if (!present.has(key)) details.delete(key);
      cache = tracks.filter(Boolean).sort((a, b) => a.addedAt - b.addedAt || a.key.localeCompare(b.key));
      cacheUntil = Date.now() + 15_000;
      return cache;
    },
    async list_images() {
      check();
      const page = await send(new ListObjectsV2Command({ Bucket: bucketName, Prefix: 'images/' }));
      return (page.Contents || [])
        .filter(({ Key }) => Key && /\.(jpe?g|png|webp|gif|svg)$/i.test(Key))
        .map(({ Key, LastModified }) => ({
          key: Key,
          name: path.basename(Key),
          url: `${publicUrl}/${Key}`,
          addedAt: new Date(LastModified || 0).getTime()
        }))
        .sort((a, b) => b.addedAt - a.addedAt);
    },
    async add_image(body, filename, contentType = 'image/jpeg') {
      check();
      const cleanName = path.basename(filename).replace(/[/\\?%*:|"<>]/g, '_');
      const key = `images/${cleanName}`;
      await send(new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000'
      }));
      return {
        key,
        name: cleanName,
        url: `${publicUrl}/${key}`
      };
    },
    async add_song(file, track) {
      check();
      const safeId = track.id || `track-${Date.now()}`;
      const cleanTitle = (track.title || 'Untitled').replace(/[/\\?%*:|"<>]/g, '_');
      const cleanArtist = (track.artist || 'Aria Music').replace(/[/\\?%*:|"<>]/g, '_');
      const key = `${PREFIX}${cleanArtist} - ${cleanTitle} [${safeId}].mp3`.slice(0, 220);
      const metadata = { 'aria-track': Buffer.from(JSON.stringify({ id: track.id || safeId,
        title: String(track.title).slice(0, 200), artist: String(track.artist).slice(0, 160),
        duration: track.duration })).toString('base64url') };
      const body = typeof file === 'string' ? createReadStream(file) : file;
      try {
        await send(new PutObjectCommand({ Bucket: bucketName, Key: key, Body: body,
          ContentLength: track.size, ContentType: 'audio/mpeg', Metadata: metadata, CacheControl: 'public, max-age=3600' }));
      } finally { if (body.destroy) body.destroy(); }
      cacheUntil = 0; details.delete(key);
      return describe(key, { Size: track.size, LastModified: new Date() }, metadata);
    },
    async audio(key, range, headOnly = false) {
      check();
      if (!isAudio(key)) throw Object.assign(new Error('Song not found.'), { status: 404 });
      if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) throw Object.assign(new Error('Invalid audio range.'), { status: 416 });
      const Command = headOnly ? HeadObjectCommand : GetObjectCommand;
      const result = await send(new Command({ Bucket: bucketName, Key: key, ...(range && !headOnly ? { Range: range } : {}) }));
      return { ...result, ContentType: TYPES[path.extname(key).toLowerCase()] };
    },
  };
}
module.exports = { createStorage };
