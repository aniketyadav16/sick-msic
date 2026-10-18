#!/usr/bin/env node
require('dotenv').config({ quiet: true });
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const { createReadStream, existsSync } = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Project root directory: yt2
const YT2_DIR = path.resolve(__dirname, '..');

function getS3Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials missing. Please ensure R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY are set in .env');
  }
  return new S3Client({
    region: 'auto',
    endpoint: process.env.S3_END_POINT || `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey }
  });
}

function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: cwd || YT2_DIR,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      const s = d.toString();
      stdout += s;
      process.stdout.write(s);
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', (err) => reject(new Error(`Failed to start ${command}: ${err.message}`)));
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${command} exited with code ${code}\n${stderr}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

/**
 * Downloads a song using yt-dlp inside yt2 directory, then uploads it to R2 music/ folder.
 * @param {string} query - YouTube URL or song name search query
 * @returns {Promise<{id: string, title: string, artist: string, duration: number, key: string, url: string, size: number}>}
 */
async function uploadSongToR2(query, alias) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new Error('Please provide a song name or YouTube URL.');
  }

  const s3 = getS3Client();
  const rawBucket = process.env.R2_BUCKET_NAME || 'music-stuff';
  const bucketName = rawBucket.split('/')[0];
  const publicBase = (process.env.R2_PUBLIC_URL || 'https://pub-74b555bb7c5040d49fc3ff86bc7905d1.r2.dev').replace(/\/$/, '');

  const ytdlpPath = process.env.YT_DLP_PATH || 'yt-dlp';
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'yt2-music-'));

  try {
    console.log(`\n🎵 [1/3] Fetching song metadata for: "${query}" using yt-dlp in ${YT2_DIR}...`);
    
    // Normalize query
    let target = query.trim();
    if (!/^(https?:\/\/|www\.|youtu\.be\/)/i.test(target)) {
      target = `ytsearch1:${target}`;
    }

    // Dump single JSON to inspect track info
    const infoOutput = await runCommand(ytdlpPath, [
      '--dump-single-json',
      '--skip-download',
      '--no-playlist',
      '--no-warnings',
      '--',
      target
    ], YT2_DIR);

    const parsed = JSON.parse(infoOutput);
    const info = parsed.entries?.[0] || parsed;
    const rawTitle = (info.track || info.title || 'Untitled');
    const title = (alias && typeof alias === 'string' && alias.trim() ? alias.trim() : rawTitle).replace(/[/\\?%*:|"<>]/g, '_');
    const artist = (info.artist || info.uploader || 'Aria Music').replace(/[/\\?%*:|"<>]/g, '_');
    const duration = Number(info.duration) || 0;
    const id = info.id || `yt-${Date.now()}`;
    const safeFilename = `${artist} - ${title} [${id}].mp3`.slice(0, 220);
    const localMp3Path = path.join(tempDir, 'output.mp3');

    console.log(`\n⬇️  [2/3] Downloading & converting audio: "${title}" by ${artist}...`);
    await runCommand(ytdlpPath, [
      '-f', 'bestaudio/best',
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', '192K',
      '--no-playlist',
      '--no-warnings',
      '-o', path.join(tempDir, 'output.%(ext)s'),
      '--',
      info.webpage_url || target
    ], YT2_DIR);

    if (!existsSync(localMp3Path)) {
      throw new Error(`Audio conversion failed: expected output file not found at ${localMp3Path}`);
    }

    const stats = await fs.stat(localMp3Path);
    console.log(`\n☁️  [3/3] Uploading ${Math.round(stats.size / 1024 / 1024 * 10) / 10} MB to Cloudflare R2 bucket "${bucketName}" (music/${safeFilename})...`);

    const r2Key = `music/${safeFilename}`;
    const metadata = {
      'aria-track': Buffer.from(JSON.stringify({
        id: `youtube-${id}`,
        title,
        artist,
        duration
      })).toString('base64url')
    };

    const stream = createReadStream(localMp3Path);
    await s3.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: r2Key,
      Body: stream,
      ContentType: 'audio/mpeg',
      ContentLength: stats.size,
      Metadata: metadata,
      CacheControl: 'public, max-age=31536000'
    }));

    const publicUrl = `${publicBase}/music/${encodeURIComponent(safeFilename)}`;
    const result = {
      id: `youtube-${id}`,
      title,
      artist,
      duration,
      size: stats.size,
      key: r2Key,
      url: publicUrl
    };

    console.log(`\n✅ Song uploaded successfully to R2!`);
    console.log(`   Title: ${title}`);
    console.log(`   Artist: ${artist}`);
    console.log(`   URL: ${publicUrl}\n`);

    return result;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

// Allow direct CLI invocation: node scripts/upload-music.js "song query" [optional-alias]
if (require.main === module) {
  const query = process.argv[2]?.trim();
  const alias = process.argv[3]?.trim();
  if (!query) {
    console.log('Usage: node scripts/upload-music.js <"song name" or "https://youtube.com/watch?v=..."> [song_alias]');
    process.exit(1);
  }
  uploadSongToR2(query, alias)
    .then((track) => {
      console.log(JSON.stringify(track, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error(`\n❌ Error uploading song to R2:`, err.message);
      process.exit(1);
    });
}

module.exports = { uploadSongToR2 };
