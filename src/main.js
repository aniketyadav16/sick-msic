const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const { spawn } = require("node:child_process");
const { pathToFileURL } = require("node:url");

const LOCAL_MUSIC_DIR = path.join(__dirname, "..", "Aria", "music");
const MUSIC_DIR = fsSync.existsSync(LOCAL_MUSIC_DIR) ? LOCAL_MUSIC_DIR : "/Users/aniketyadav/Downloads/aria/music";
const ARIA_IMAGES_DIR = path.join(__dirname, "..", "Aria", "images");
const DOWNLOAD_SCRIPT = path.join(MUSIC_DIR, "scripti.sh");
const GET_LINK_SCRIPT = path.join(__dirname, "..", "get_link.py");

const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg"]);
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);

let mainWindow = null;
let musicWatcher = null;
let imageWatcher = null;
let libraryChangeTimer = null;
let imageChangeTimer = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 940,
    minHeight: 640,
    title: "Aria",
    backgroundColor: "#08090d",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
    },
  });

  const distIndex = path.join(__dirname, "..", "dist", "index.html");
  if (fsSync.existsSync(distIndex)) {
    mainWindow.loadFile(distIndex);
  } else {
    mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  }

  setupWatchers();
}

async function walkFiles(directory, extensions) {
  if (!fsSync.existsSync(directory)) return [];
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const files = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) return walkFiles(fullPath, extensions);
        if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) return [fullPath];
        return [];
      })
    );
    return files.flat();
  } catch {
    return [];
  }
}

function parseArtistTitle(filePath, common = {}) {
  let title = common.title;
  let artist = common.artist || common.albumartist;

  if (!title || !artist) {
    let raw = path
      .basename(filePath, path.extname(filePath))
      .replace(/\[[^\]]*\]/gu, "")
      .replace(/【[^】]*】/gu, "")
      .replace(/＂/gu, "")
      .replace(/\s*(?:｜|\|)\s*.*$/u, "")
      .replace(/\s*\([^)]*(?:official|video|audio|visualiser|visualizer|lyrics|prod\.|feat\.|ft\.)[^)]*\)\s*/giu, " ")
      .replace(/\s+/gu, " ")
      .trim();

    if (!artist) {
      if (raw.includes(" - ")) {
        const parts = raw.split(" - ");
        artist = parts[0].trim();
        title = title || parts.slice(1).join(" - ").trim();
      } else if (raw.includes(" – ")) {
        const parts = raw.split(" – ");
        artist = parts[0].trim();
        title = title || parts.slice(1).join(" – ").trim();
      } else {
        artist = "Aria Music";
        title = title || raw;
      }
    } else if (!title) {
      title = raw;
    }
  }

  return {
    title: title || path.basename(filePath, path.extname(filePath)),
    artist: artist || "Unknown Artist",
  };
}

async function readTrack(filePath) {
  const stats = await fs.stat(filePath);
  let metadata = {};

  try {
    const { parseFile } = await import("music-metadata");
    metadata = await parseFile(filePath, { duration: true });
  } catch {
    metadata = {};
  }

  const common = metadata.common || {};
  const format = metadata.format || {};
  const { title, artist } = parseArtistTitle(filePath, common);
  const album = common.album || "Aria Space & Cosmos";
  const colorSeed = [...`${title}${artist}`].reduce((sum, char) => sum + char.charCodeAt(0), 0);

  return {
    id: Buffer.from(filePath).toString("base64url"),
    title,
    artist,
    album,
    duration: Number(format.duration || 0),
    size: stats.size,
    addedAt: stats.birthtimeMs || stats.mtimeMs,
    modifiedAt: stats.mtimeMs,
    path: filePath,
    url: pathToFileURL(filePath).toString(),
    colorSeed,
  };
}

async function getLibrary() {
  if (!fsSync.existsSync(MUSIC_DIR)) await fs.mkdir(MUSIC_DIR, { recursive: true });
  const files = await walkFiles(MUSIC_DIR, AUDIO_EXTENSIONS);
  const tracks = await Promise.all(files.map(readTrack));
  return tracks.sort((a, b) => b.modifiedAt - a.modifiedAt);
}

async function getAvailableImages() {
  const imageSources = [
    path.join(__dirname, "renderer", "public", "images", "cosmos"),
    path.join(__dirname, "..", "dist", "images", "cosmos"),
    ARIA_IMAGES_DIR,
    MUSIC_DIR,
  ];

  const foundFiles = new Set();
  for (const dir of imageSources) {
    const files = await walkFiles(dir, IMAGE_EXTENSIONS);
    for (const f of files) {
      foundFiles.add(f);
    }
  }

  const result = [];
  for (const fullPath of foundFiles) {
    const baseName = path.basename(fullPath);
    // If it's in the cosmos folder, format as relative path /images/cosmos/name
    if (fullPath.includes("cosmos")) {
      result.push(`/images/cosmos/${baseName}`);
    } else {
      result.push(pathToFileURL(fullPath).toString());
    }
  }

  return Array.from(new Set(result));
}

function setupWatchers() {
  // Watch music directory for real-time additions/removals
  if (fsSync.existsSync(MUSIC_DIR) && !musicWatcher) {
    try {
      musicWatcher = fsSync.watch(MUSIC_DIR, { recursive: true }, () => {
        clearTimeout(libraryChangeTimer);
        libraryChangeTimer = setTimeout(async () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            const tracks = await getLibrary();
            mainWindow.webContents.send("library:updated", tracks);
          }
        }, 600);
      });
    } catch (e) {
      console.warn("Could not setup music directory watcher:", e);
    }
  }

  // Watch images directory if exists
  if (fsSync.existsSync(ARIA_IMAGES_DIR) && !imageWatcher) {
    try {
      imageWatcher = fsSync.watch(ARIA_IMAGES_DIR, { recursive: true }, () => {
        clearTimeout(imageChangeTimer);
        imageChangeTimer = setTimeout(async () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            const images = await getAvailableImages();
            mainWindow.webContents.send("images:updated", images);
          }
        }, 600);
      });
    } catch (e) {
      console.warn("Could not setup image directory watcher:", e);
    }
  }
}

async function resolveToUrl(input) {
  const query = String(input || "").trim();
  if (!query) throw new Error("Please enter a song name or YouTube URL.");
  if (/^https?:\/\//iu.test(query)) {
    return query;
  }

  // If search query, run get_link.py to fetch YouTube URL
  if (fsSync.existsSync(GET_LINK_SCRIPT)) {
    const url = await new Promise((resolve) => {
      const py = spawn("python3", [GET_LINK_SCRIPT, query], { timeout: 15000 });
      let out = "";
      py.stdout.on("data", (d) => (out += d.toString()));
      py.on("close", () => {
        const found = out.trim();
        resolve(found && found.startsWith("http") ? found : null);
      });
      py.on("error", () => resolve(null));
    });

    if (url) return url;
  }

  // Fallback to direct ytsearch prefix for yt-dlp
  return `ytsearch1:${query}`;
}

ipcMain.handle("library:list", getLibrary);
ipcMain.handle("images:list", getAvailableImages);

ipcMain.handle("library:reveal", async (_event, filePath) => {
  if (typeof filePath === "string" && fsSync.existsSync(filePath)) shell.showItemInFolder(filePath);
});

ipcMain.handle("download:start", async (_event, queryOrUrl) => {
  const target = await resolveToUrl(queryOrUrl);
  if (!fsSync.existsSync(MUSIC_DIR)) await fs.mkdir(MUSIC_DIR, { recursive: true });

  return new Promise((resolve, reject) => {
    let child;
    if (fsSync.existsSync(DOWNLOAD_SCRIPT)) {
      child = spawn(DOWNLOAD_SCRIPT, [target, MUSIC_DIR], {
        cwd: MUSIC_DIR,
        shell: false,
        env: process.env,
      });
    } else {
      child = spawn("yt-dlp", ["-x", "--audio-format", "mp3", target], {
        cwd: MUSIC_DIR,
        shell: false,
        env: process.env,
      });
    }

    let output = "";
    let errorOutput = "";

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      errorOutput += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", async (code) => {
      if (code !== 0) {
        reject(new Error(errorOutput || output || `Download failed with exit code ${code}`));
        return;
      }
      const tracks = await getLibrary();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("library:updated", tracks);
      }
      resolve({ output, tracks });
    });
  });
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (musicWatcher) musicWatcher.close();
  if (imageWatcher) imageWatcher.close();
  if (process.platform !== "darwin") app.quit();
});

