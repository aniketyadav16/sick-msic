#!/usr/bin/env node
require('dotenv').config({ quiet: true });
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('node:fs/promises');
const { createReadStream, existsSync } = require('node:fs');
const path = require('node:path');

const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif'
};

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

/**
 * Uploads an image from this machine to Cloudflare R2 images/ folder.
 * @param {string|Buffer} fileInput - Absolute or relative local path to image file, or Buffer
 * @param {string} [customFileName] - Optional custom filename if buffer provided
 * @returns {Promise<{key: string, name: string, url: string, size: number}>}
 */
async function uploadImageToR2(fileInput, customFileName) {
  const s3 = getS3Client();
  const rawBucket = process.env.R2_BUCKET_NAME || 'music-stuff';
  const bucketName = rawBucket.split('/')[0];
  const publicBase = (process.env.R2_PUBLIC_URL || 'https://pub-74b555bb7c5040d49fc3ff86bc7905d1.r2.dev').replace(/\/$/, '');

  let body;
  let filename;
  let size;

  if (Buffer.isBuffer(fileInput)) {
    if (!customFileName) throw new Error('Filename required when uploading from Buffer.');
    filename = path.basename(customFileName);
    body = fileInput;
    size = fileInput.length;
  } else {
    const filePath = path.resolve(fileInput);
    if (!existsSync(filePath)) {
      throw new Error(`Image file not found at path: ${filePath}`);
    }
    const stats = await fs.stat(filePath);
    filename = customFileName ? path.basename(customFileName) : path.basename(filePath);
    body = createReadStream(filePath);
    size = stats.size;
  }

  const cleanName = filename.replace(/[/\\?%*:|"<>]/g, '_');
  const ext = path.extname(cleanName).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'image/jpeg';
  const r2Key = `images/${cleanName}`;

  console.log(`\n🖼️  Uploading image "${cleanName}" (${Math.round(size / 1024)} KB) to Cloudflare R2 bucket "${bucketName}" (${r2Key})...`);

  await s3.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: r2Key,
    Body: body,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000'
  }));

  const publicUrl = `${publicBase}/${r2Key}`;
  const result = {
    key: r2Key,
    name: cleanName,
    url: publicUrl,
    size
  };

  console.log(`\n✅ Image uploaded successfully to R2!`);
  console.log(`   Key: ${r2Key}`);
  console.log(`   URL: ${publicUrl}\n`);

  return result;
}

// Allow CLI invocation: node scripts/upload-image.js /path/to/image.jpg
if (require.main === module) {
  const targetPath = process.argv[2];
  if (!targetPath) {
    console.log('Usage: node scripts/upload-image.js <path-to-image>');
    process.exit(1);
  }
  uploadImageToR2(targetPath)
    .then((img) => {
      console.log(JSON.stringify(img, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error(`\n❌ Error uploading image to R2:`, err.message);
      process.exit(1);
    });
}

module.exports = { uploadImageToR2 };
