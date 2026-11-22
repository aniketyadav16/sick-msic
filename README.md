# Aria Cosmos

React 19 + Vite music player with an Electron desktop shell. The player has a curved song wheel, WebGL aurora backgrounds, expanding artwork, playback/seek/volume controls, media-session controls, voice/title/lyric matching, image switching, clean mode, and temporary local-file playback. The existing 25 curated songs stream from the public R2 bucket.

## Library views

Use **Wheel / Gallery** at the top to change how you browse songs. The view is remembered on this device; switching preserves the current song, playback position, and volume. Gallery uses the React Bits `InfiniteMenu` TypeScript + CSS component with each song's assigned artwork, including cloud additions and temporary local tracks.

Drag the sphere or focus it and use the arrow keys to browse. Click a surrounding image to bring it forward, then click the center image or **Play song** to listen. Enter or Space also plays the focused song. Browsing and the three-second automatic gallery rotation do not change playback; automatic rotation pauses on hover or focus and is disabled for reduced motion. Previous/next and voice search also bring the selected song into view. The bottom player provides playback, seeking, and volume controls. **Shuffle images** reassigns artwork across the library.

Cloud images fall back to bundled artwork if unavailable. If WebGL 2 is unavailable, Gallery presents clickable image cards. No new runtime dependencies are needed.

## Adding songs

Click **Add song** in the left panel, enter a song name or a single YouTube video link, and select **Find & download**. The backend uses the first YouTube search result, shows the matched title/artist and download progress, and converts the audio to MP3. Enter the upload password (**minion** by default; optionally overridden with `UPLOAD_PASSWORD`) to upload directly from the backend to R2. A completed song appears in the wheel without interrupting playback. Other clients refresh new additions every 30 seconds and when the window regains focus.

The password is checked on the server, never embedded in the frontend. A wrong password performs no R2 write. Failed uploads can be retried without downloading again. Prepared files expire after 30 minutes; incomplete jobs do not survive a backend restart. Hiding the modal keeps the current job running and preserves its state until the page is reloaded. Local-file playback remains device-only.

## Local setup

Use Node 22.14+ and install `yt-dlp` and FFmpeg on PATH. yt-dlp also needs a supported JavaScript runtime; this service explicitly enables Node. See the [official yt-dlp installation instructions](https://github.com/yt-dlp/yt-dlp#installation).

```sh
npm ci
cp .env.example .env
```

Only four settings are required in `.env`: `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY`. The upload password defaults to `minion` on the backend; `UPLOAD_PASSWORD` is an optional override. No public bucket URL is required for new songs because the backend streams them with byte-range support for seeking. Use an R2 API token scoped to Object Read & Write for this bucket. The public bucket URL alone cannot authorize uploads. See [Cloudflare's S3 SDK configuration](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/).

```sh
# Terminal 1: downloader/API
npm run server
# Terminal 2: frontend with /api proxy
npm run dev
```

Open http://localhost:5173. `npm start` builds and launches Electron with its own local API. Alternatively, set `MUSIC_API_URL` to an existing backend; remote Electron usage requires explicitly including `null` in that backend's `ALLOWED_ORIGINS` because the renderer uses a file URL.

Both yt-dlp search and download commands run with the project root as their working directory (`yt2` locally). Each job writes its audio to a separate temporary folder using an absolute output path. Failed commands print their diagnostics in the backend terminal. Restart `npm run server` after changing backend code.

## Production: existing Vercel frontend + download backend

Keep this repository's frontend on Vercel. `vercel.json` sets the build command and `dist` output. The downloader is a separate, continuously running Node/Docker service: it starts background processes and retains a temporary file between the download and password requests. Do not deploy `server/index.js` as a Vercel Function. Vercel Functions have [bounded invocation durations](https://vercel.com/docs/functions/limitations); this implementation uses a persistent process for its job state.

1. Deploy the included `Dockerfile` to your Docker-capable host. Use **one instance** with at least 2 GB free temporary disk, outbound internet, and HTTPS in front of port 3001. The image includes Node, yt-dlp, and FFmpeg. Rebuild periodically for yt-dlp extractor updates.
2. Set the four required `R2_*` environment variables from `.env.example` on the backend, plus `ALLOWED_ORIGINS=https://your-app.vercel.app` (include your custom domain if applicable, comma separated). Set `HOST=0.0.0.0` for container deployment. Do not put credentials in the Docker image or Vercel frontend variables.
3. In Vercel, set **VITE_API_BASE_URL=https://your-backend.example.com** (origin only, no `/api`). Redeploy so Vite includes the backend URL. `VITE_R2_PUBLIC_URL` is only needed if changing the bucket used by the pre-existing curated songs and artwork. Add exact Vercel preview origins to `ALLOWED_ORIGINS` only when needed.
4. Verify backend `/api/health`, then add a short song in the site. The health endpoint checks required configuration; an actual upload verifies credentials and bucket permissions.

For a local Docker check:

```sh
docker build -t aria-music-api .
docker run --rm --env-file .env -e HOST=0.0.0.0 -p 3001:3001 aria-music-api
```

The storage function `add_song(file, track)` writes the MP3 and its title/artist/duration metadata together to `music/youtube-VIDEO_ID.mp3` in a single R2 operation. There is no separate song catalog, database, or manual frontend list to update. The existing password-gated job calls this function after download.

The app lists audio files directly from the bucket's `music/` folder (including nested folders), so MP3, M4A, AAC, WAV, FLAC, OGG and Opus files uploaded through the R2 dashboard are discovered too. Files without app metadata use their filename as a title; `Artist - Song.mp3` supplies both artist and title. Duration is learned during playback for those files. Existing curated entries are matched by object key to avoid duplicates. Older `aria/tracks/` JSON records are no longer read or written and need not be deleted.

Newly added songs appear immediately for the uploader. Other clients refresh every 30 seconds and on window focus; the backend caches bucket listings for 15 seconds. Allow up to about 45 seconds for a manual upload to appear in an already-open client. The backend streams new songs from R2, which also allows private buckets; their playback traffic passes through the backend. Existing curated songs/artwork retain their public URLs.

Requests are limited to five download starts and fifteen password attempts per connection IP per ten minutes, with five incorrect guesses per job. Forwarded-IP headers are deliberately ignored; behind a reverse proxy these limits may apply to all visitors together. Jobs are limited to two active tasks and thirty retained jobs; songs must be non-live, at most 15 minutes and 50 MB. A simple shared password is a casual upload gate. Downloads occur before that gate as requested, and are bounded by these resource limits. Use a single backend instance; multiple replicas need shared job storage/queues and rate limits. YouTube can block datacenter IPs or restrict videos; those failures are shown in the form.

## Verification

```sh
npm test
npm run build
```

Tests cover query validation, authorization, wrong-password lockout, upload retry/idempotency, temp cleanup, expired jobs, failed downloads, concurrency limits, automatic discovery of manually uploaded songs, single-object persistence, audio byte-range playback, and the HTTP workflow/CORS/rate limits using injected download and storage fixtures. They do not perform real YouTube downloads or R2 writes. Live end-to-end verification requires working bucket credentials and an accessible YouTube source.

## Project state

- Active frontend: `src/renderer/MusicApp.jsx`, with `OptionWheel`, `Aurora`, `ScrollExpand`, and `WavyPlaybar`.
- New cloud flow: `AddSongModal.jsx`, `music-api.js`, and `server/`.
- Electron uses the same HTTP service with context isolation, sandboxing and web security enabled.
- `src/renderer/renderer.js`, `styles.css`, `src/main 2.js`, `scripti.sh`, and `get_link.py` are legacy implementations, not used by the current app. They retain old machine-specific paths and are not production entry points.
- Browser voice search uses Web Speech when available. The macOS Electron app uses Apple Speech through a native helper. Custom songs support title/artist search but do not fetch new lyrics.

## Voice search on macOS desktop

Restart with `npm start`. Its prestart step builds a small Swift helper using Apple Command Line Tools, caches the signed app in `~/Library/Caches/Aria/Voice`, and skips recompiling unchanged source. `npm run build:voice` builds it separately. No cloud API key or extra npm package is needed. Distribution to other Macs requires bundling/signing the helper for the target platform; this is the local development setup.

Click **Voice Search**, allow **Speech Recognition** and **Microphone** when macOS asks, then say a library title or known lyric. If access was previously denied, enable Aria Voice (or the responsible Electron app shown by macOS) in **System Settings → Privacy & Security → Microphone / Speech Recognition**. The permission dialog is only requested after clicking Voice Search.

Music pauses while listening so the microphone doesn't match the song already playing. A completed phrase selects a matching song; if no match is found or listening is cancelled, previous playback resumes. Click the pill again to cancel. Capture stops on completion, after the listening timeout, on reload, or when the window closes. Audio is not saved or sent to this project's backend or R2. The helper prefers on-device recognition where supported; Apple may process audio for other language configurations.

The search dropdown offers English (India), English (US), and Hindi. Matching retains Unicode and understands commands like “play Night Changes.” Choose English for romanized titles; Hindi recognition yields Hindi-script text, so Hindi-script titles match directly (there is no automatic transliteration). Browsers without speech support and non-macOS desktop builds still provide typed search with an explicit explanation.

`test/voice.test.js` verifies the native bridge, cancellation, permission feedback, stale-event suppression, browser fallback and title/lyric matching with simulated recognition. Live microphone accuracy requires testing on your device after granting permissions.

## Playbar experiments

The expanded player has a **Wave / Mixtape / Orbit** switcher. Mixtape is the initial style; your selection is saved on this device and carries across songs and restarts. All variants control the same audio element, so switching styles preserves playback position and volume. Wave keeps the original design, now with keyboard-accessible seeking. Mixtape adds animated cassette reels; Orbit adds a rotating record and circular progress. The new animations follow play/pause and respect reduced-motion preferences; they are decorative, not audio-reactive visualizers.

For a side-by-side visual comparison, run `npm run dev` and open `/playbar-preview.html`. This development-only page simulates playback and makes no audio or cloud requests. The actual app uses the real player controls.
