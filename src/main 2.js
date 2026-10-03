const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { existsSync } = require("node:fs");
const { spawn } = require("node:child_process");
const { pathToFileURL } = require("node:url");

const LOCAL_MUSIC_DIR = path.join(__dirname, "..", "Aria", "music");
const MUSIC_DIR = existsSync(LOCAL_MUSIC_DIR) ? LOCAL_MUSIC_DIR : "/Users/aniketyadav/Downloads/aria/music";
const DOWNLOAD_SCRIPT = path.join(MUSIC_DIR, "scripti.sh");
const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg"]);

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1240,
    height: 780,
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
  if (existsSync(distIndex)) {
    mainWindow.loadFile(distIndex);
  } else {
    mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  }
}

async function walkAudioFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return walkAudioFiles(fullPath);
      if (entry.isFile() && AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) return [fullPath];
      return [];
    })
  );
  return files.flat();
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
  if (!existsSync(MUSIC_DIR)) await fs.mkdir(MUSIC_DIR, { recursive: true });
  const files = await walkAudioFiles(MUSIC_DIR);
  const tracks = await Promise.all(files.map(readTrack));
  return tracks.sort((a, b) => b.modifiedAt - a.modifiedAt);
}

function assertUrl(input) {
  const url = String(input || "").trim();
  if (!url) throw new Error("Paste a music URL first.");
  if (!/^https?:\/\//iu.test(url)) throw new Error("Only http and https URLs are supported.");
  return url;
}

ipcMain.handle("library:list", getLibrary);

ipcMain.handle("library:reveal", async (_event, filePath) => {
  if (typeof filePath === "string" && filePath.startsWith(MUSIC_DIR)) shell.showItemInFolder(filePath);
});

ipcMain.handle("download:start", async (_event, rawUrl) => {
  const url = assertUrl(rawUrl);
  if (!existsSync(DOWNLOAD_SCRIPT)) throw new Error(`Downloader script not found at ${DOWNLOAD_SCRIPT}`);

  return new Promise((resolve, reject) => {
    const child = spawn(DOWNLOAD_SCRIPT, [url], {
      cwd: MUSIC_DIR,
      shell: false,
      env: process.env,
    });

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
      resolve({ output, tracks: await getLibrary() });
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
  if (process.platform !== "darwin") app.quit();
});
