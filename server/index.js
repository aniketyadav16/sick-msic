require('dotenv').config({ quiet: true });
const http = require('node:http');
const { pipeline } = require('node:stream/promises');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createStorage } = require('./storage');
const { createJobs } = require('./jobs');

function createApp({ storage = createStorage(), password = process.env.UPLOAD_PASSWORD || 'minion', downloader,
  origins = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
  allowFileOrigin = false, dist = path.resolve(__dirname, '../dist') } = {}) {
  const jobs = createJobs({ storage, password, downloader });
  const limits = new Map();
  function limit(req, group, max) {
    const now = Date.now();
    for (const [key, entry] of limits) if (entry.until <= now) limits.delete(key);
    const key = `${req.socket.remoteAddress}:${group}`;
    const entry = limits.get(key) || { count: 0, until: now + 10 * 60_000 };
    entry.count += 1; limits.set(key, entry);
    if (entry.count > max) throw Object.assign(new Error('Too many attempts. Please wait 10 minutes.'), { status: 429 });
  }
  async function json(req, maxBytes = 4096) {
    if (!req.headers['content-type']?.startsWith('application/json')) throw Object.assign(new Error('JSON is required.'), { status: 415 });
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (Buffer.byteLength(body) > maxBytes) throw Object.assign(new Error('Request is too large.'), { status: 413 });
    }
    try {
      const value = JSON.parse(body);
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
      return value;
    } catch { throw Object.assign(new Error('Invalid JSON.'), { status: 400 }); }
  }
  function reply(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    try {
      const url = new URL(req.url, 'http://localhost');
      const pathname = url.pathname;
      if (pathname.startsWith('/api/')) {
        const origin = req.headers.origin;
        const sameOrigin = origin === `http://${req.headers.host}` || origin === `https://${req.headers.host}`;
        if (origin && !sameOrigin && !origins.includes(origin) && !(allowFileOrigin && origin === 'null')) {
          return reply(res, 403, { error: 'This frontend origin is not allowed by the backend.' });
        }
        if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.writeHead(204); return res.end();
        }
        if (req.method === 'GET' && pathname === '/api/health') {
          storage.check(); return reply(res, 200, { ready: true });
        }
        if (req.method === 'GET' && pathname === '/api/tracks') {
          return reply(res, 200, { tracks: await storage.list() });
        }
        if (req.method === 'GET' && pathname === '/api/images') {
          return reply(res, 200, { images: await storage.list_images() });
        }
        if (req.method === 'POST' && pathname === '/api/images') {
          limit(req, 'image', 30);
          const data = await json(req, 20 * 1024 * 1024);
          if (!data.base64 || !data.filename) throw Object.assign(new Error('Image filename and base64 data required.'), { status: 400 });
          const buffer = Buffer.from(data.base64, 'base64');
          const ext = path.extname(data.filename).toLowerCase();
          const mimeTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
          const contentType = data.contentType || mimeTypes[ext] || 'image/jpeg';
          const uploaded = await storage.add_image(buffer, data.filename, contentType);
          return reply(res, 201, { success: true, image: uploaded });
        }
        if (['GET', 'HEAD'].includes(req.method) && pathname === '/api/audio') {
          const audio = await storage.audio(url.searchParams.get('key'), req.headers.range, req.method === 'HEAD');
          const headers = { 'Content-Type': audio.ContentType, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=300' };
          if (audio.ContentLength !== undefined) headers['Content-Length'] = audio.ContentLength;
          if (audio.ContentRange) headers['Content-Range'] = audio.ContentRange;
          res.writeHead(audio.ContentRange ? 206 : 200, headers);
          if (req.method === 'HEAD') return res.end();
          await pipeline(audio.Body, res);
          return;
        }
        if (req.method === 'POST' && pathname === '/api/songs') {
          limit(req, 'download', 10);
          return reply(res, 202, jobs.start((await json(req)).query));
        }
        const match = pathname.match(/^\/api\/songs\/([a-f0-9]{64})(\/upload)?$/);
        if (match && req.method === 'GET' && !match[2]) return reply(res, 200, jobs.status(match[1]));
        if (match && req.method === 'POST' && match[2]) {
          limit(req, 'password', 25);
          const payload = await json(req);
          return reply(res, 202, jobs.upload(match[1], payload.password || process.env.UPLOAD_PASSWORD || 'minion'));
        }
        return reply(res, 404, { error: 'API route not found.' });
      }
      if (!['GET', 'HEAD'].includes(req.method)) return reply(res, 405, { error: 'Method not allowed.' });
      const file = path.resolve(dist, `.${decodeURIComponent(pathname === '/' ? '/index.html' : pathname)}`);
      if (!file.startsWith(`${dist}${path.sep}`)) return reply(res, 404, { error: 'Not found.' });
      const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };
      let data;
      try { data = await fs.readFile(file); } catch { return reply(res, 404, { error: 'Not found. Run npm run build to build the frontend.' }); }
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (error) {
      const status = error.status || ([404, 416].includes(error.$metadata?.httpStatusCode) ? error.$metadata.httpStatusCode : 500);
      if (!res.headersSent) reply(res, status, { error: error.status ? error.message : status === 404 ? 'Song not found.' : status === 416 ? 'Invalid audio range.' : 'The music service could not complete this request. Check the backend configuration and try again.' });
    }
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 15_000;
  return { server, jobs, async close() { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); await jobs.close(); } };
}
async function startServer(options = {}) {
  const app = createApp(options);
  await new Promise((resolve, reject) => {
    app.server.once('error', reject);
    app.server.listen(options.port ?? Number(process.env.PORT || 3001), options.host || process.env.HOST || '127.0.0.1', resolve);
  });
  return app;
}
if (require.main === module) {
  startServer().then((app) => {
    console.log(`Aria music service listening on port ${app.server.address().port}`);
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => app.close().then(() => process.exit(0)));
  }).catch((error) => { console.error(error.message); process.exit(1); });
}
module.exports = { createApp, startServer };
