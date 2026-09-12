const audio = document.querySelector("#audio");
const trackList = document.querySelector("#trackList");
const focusTitle = document.querySelector("#focusTitle");
const focusArtist = document.querySelector("#focusArtist");
const focusAlbum = document.querySelector("#focusAlbum");
const vinyl = document.querySelector("#vinyl");
const vinylCore = document.querySelector("#vinylCore");
const playButton = document.querySelector("#playButton");
const previousButton = document.querySelector("#previousButton");
const nextButton = document.querySelector("#nextButton");
const shuffleButton = document.querySelector("#shuffleButton");
const refreshButton = document.querySelector("#refreshButton");
const seek = document.querySelector("#seek");
const currentTime = document.querySelector("#currentTime");
const duration = document.querySelector("#duration");
const searchInput = document.querySelector("#searchInput");
const viewTitle = document.querySelector("#viewTitle");
const libraryCount = document.querySelector("#libraryCount");
const recentCount = document.querySelector("#recentCount");
const longCount = document.querySelector("#longCount");
const downloadForm = document.querySelector("#downloadForm");
const downloadButton = document.querySelector("#downloadButton");
const downloadStatus = document.querySelector("#downloadStatus");
const urlInput = document.querySelector("#urlInput");
const appShell = document.querySelector(".app-shell");
const sidebarToggle = document.querySelector("#sidebarToggle");
const heroPlayer = document.querySelector("#heroPlayer");
const downloadBurst = document.querySelector("#downloadBurst");
const spectrumCanvas = document.querySelector("#spectrumCanvas");
const spectrumContext = spectrumCanvas.getContext("2d");

let tracks = [];
let filteredTracks = [];
let currentIndex = -1;
let currentView = "all";
let isSeeking = false;
let audioContext;
let analyser;
let frequencyData;
let timeData;
let sourceNode;
let visualizerFrame;

const palettes = [
  ["#00ff8a", "#00e5ff"],
  ["#35d07f", "#d7ff55"],
  ["#00d68f", "#8fffe0"],
  ["#6dff9f", "#00b894"],
  ["#d7ff55", "#00ff8a"],
  ["#00e5ff", "#35d07f"],
];

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remaining}`;
}

function formatSize(bytes) {
  if (!bytes) return "";
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatAge(timestamp) {
  const minutes = Math.max(1, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function getPalette(track) {
  return palettes[Math.abs(track?.colorSeed || 0) % palettes.length];
}

function initials(track) {
  return (track?.title || "N")
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function applyFocusTheme(track) {
  const [a, b] = getPalette(track);
  document.documentElement.style.setProperty("--accent", a);
  document.documentElement.style.setProperty("--accent-2", b);
  vinylCore.textContent = initials(track);
}

function updateCounts() {
  const day = 24 * 60 * 60 * 1000;
  libraryCount.textContent = tracks.length;
  recentCount.textContent = tracks.filter((track) => Date.now() - track.modifiedAt < 14 * day).length;
  longCount.textContent = tracks.filter((track) => track.duration >= 360).length;
}

function viewTracks() {
  const day = 24 * 60 * 60 * 1000;
  const query = searchInput.value.trim().toLowerCase();
  let next = tracks;
  document.body.dataset.view = currentView;

  if (currentView === "recent") {
    next = next.filter((track) => Date.now() - track.modifiedAt < 14 * day);
    viewTitle.textContent = "Fresh Signal";
  } else if (currentView === "long") {
    next = next.filter((track) => track.duration >= 360);
    viewTitle.textContent = "Long Plays";
  } else {
    viewTitle.textContent = "Library";
  }

  if (query) next = next.filter((track) => `${track.title} ${track.artist} ${track.album}`.toLowerCase().includes(query));
  filteredTracks = next;
  renderTracks();
}

function renderTracks() {
  trackList.innerHTML = "";

  if (!filteredTracks.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML =
      currentView === "recent"
        ? "<p>No fresh signal yet. Add something new and it will light up here.</p>"
        : "<p>No tracks match this view yet.</p>";
    trackList.append(empty);
    return;
  }

  filteredTracks.forEach((track) => {
    const row = document.createElement("div");
    const realIndex = tracks.findIndex((candidate) => candidate.id === track.id);
    const [a, b] = getPalette(track);
    row.className = `track-row${currentView === "recent" ? " fresh-row" : ""}${realIndex === currentIndex ? " active" : ""}`;
    row.role = "button";
    row.tabIndex = 0;
    row.innerHTML = `
      <div class="track-art" style="background: linear-gradient(135deg, ${a}, ${b})">${initials(track)}</div>
      <div class="track-text">
        <h4>${escapeHtml(track.title)}</h4>
        <p>${escapeHtml(track.artist)} · ${escapeHtml(track.album)}</p>
      </div>
      <div class="track-meta">
        ${currentView === "recent" ? `<span class="fresh-badge">NEW ${formatAge(track.modifiedAt)}</span>` : ""}
        <span>${formatTime(track.duration)}</span>
        <span>${formatSize(track.size)}</span>
      </div>
      <button class="reveal-button" type="button">Show</button>
    `;

    row.addEventListener("click", () => {
      triggerTrackImpact(row);
      playTrack(realIndex);
    });
    row.addEventListener("keydown", (event) => {
      if (event.code === "Enter" || event.code === "Space") {
        event.preventDefault();
        triggerTrackImpact(row);
        playTrack(realIndex);
      }
    });
    row.querySelector(".reveal-button").addEventListener("click", (event) => {
      event.stopPropagation();
      window.musicApp.reveal(track.path);
    });
    trackList.append(row);
  });
}

function triggerClickFlash(element) {
  element.classList.remove("click-flash");
  void element.offsetWidth;
  element.classList.add("click-flash");
  window.setTimeout(() => element.classList.remove("click-flash"), 430);
}

function triggerTrackImpact(element) {
  element.classList.remove("track-impact");
  void element.offsetWidth;
  element.classList.add("track-impact");
  window.setTimeout(() => element.classList.remove("track-impact"), 540);
}

function triggerDownloadAnimation() {
  heroPlayer.classList.remove("downloaded");
  downloadBurst.classList.remove("active");
  void heroPlayer.offsetWidth;
  heroPlayer.classList.add("downloaded");
  downloadBurst.classList.add("active");
  window.setTimeout(() => {
    heroPlayer.classList.remove("downloaded");
    downloadBurst.classList.remove("active");
  }, 1850);
}

function resizeSpectrumCanvas() {
  const scale = window.devicePixelRatio || 1;
  spectrumCanvas.width = Math.floor(window.innerWidth * scale);
  spectrumCanvas.height = Math.floor(window.innerHeight * scale);
  spectrumContext.setTransform(scale, 0, 0, scale, 0, 0);
}

function setupVisualizer() {
  if (audioContext) return;

  audioContext = new AudioContext();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.82;
  frequencyData = new Uint8Array(analyser.frequencyBinCount);
  timeData = new Uint8Array(analyser.fftSize);
  sourceNode = audioContext.createMediaElementSource(audio);
  sourceNode.connect(analyser);
  analyser.connect(audioContext.destination);
  resizeSpectrumCanvas();
}

function drawVisualizer() {
  if (!analyser) return;

  const width = window.innerWidth;
  const height = window.innerHeight;
  const centerY = height * 0.58;
  const baseY = height - 68;
  const barCount = 64;
  const barGap = 5;
  const barWidth = Math.max(4, (width * 0.78) / barCount - barGap);
  const startX = (width - barCount * (barWidth + barGap)) / 2;

  analyser.getByteFrequencyData(frequencyData);
  analyser.getByteTimeDomainData(timeData);
  spectrumContext.clearRect(0, 0, width, height);

  const glow = spectrumContext.createRadialGradient(width * 0.5, centerY, 0, width * 0.5, centerY, width * 0.62);
  glow.addColorStop(0, "rgba(0, 255, 138, 0.13)");
  glow.addColorStop(0.42, "rgba(0, 229, 255, 0.055)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  spectrumContext.fillStyle = glow;
  spectrumContext.fillRect(0, 0, width, height);

  for (let index = 0; index < barCount; index += 1) {
    const value = frequencyData[index] / 255;
    const shaped = Math.pow(value, 1.45);
    const barHeight = 18 + shaped * height * 0.28;
    const x = startX + index * (barWidth + barGap);
    const hueShift = index / barCount;
    const alpha = 0.16 + shaped * 0.5;
    const gradient = spectrumContext.createLinearGradient(0, baseY - barHeight, 0, baseY);
    gradient.addColorStop(0, `rgba(215, 255, 85, ${alpha})`);
    gradient.addColorStop(0.48, `rgba(0, 255, 138, ${alpha * 0.86})`);
    gradient.addColorStop(1, `rgba(0, 229, 255, ${alpha * (0.55 + hueShift * 0.25)})`);

    spectrumContext.fillStyle = gradient;
    spectrumContext.shadowColor = "rgba(0, 255, 138, 0.48)";
    spectrumContext.shadowBlur = 18;
    spectrumContext.fillRect(x, baseY - barHeight, barWidth, barHeight);
  }

  spectrumContext.shadowBlur = 0;
  spectrumContext.beginPath();
  for (let index = 0; index < timeData.length; index += 1) {
    const x = (index / (timeData.length - 1)) * width;
    const y = centerY + ((timeData[index] - 128) / 128) * 72;
    if (index === 0) spectrumContext.moveTo(x, y);
    else spectrumContext.lineTo(x, y);
  }
  spectrumContext.strokeStyle = "rgba(0, 229, 255, 0.42)";
  spectrumContext.lineWidth = 2;
  spectrumContext.shadowColor = "rgba(0, 229, 255, 0.5)";
  spectrumContext.shadowBlur = 16;
  spectrumContext.stroke();

  visualizerFrame = window.requestAnimationFrame(drawVisualizer);
}

async function startVisualizer() {
  setupVisualizer();
  if (audioContext.state === "suspended") await audioContext.resume();
  document.body.classList.add("visualizer-active");
  window.cancelAnimationFrame(visualizerFrame);
  drawVisualizer();
}

function stopVisualizer() {
  document.body.classList.remove("visualizer-active");
  window.cancelAnimationFrame(visualizerFrame);
  visualizerFrame = undefined;
}

function setFocus(track) {
  if (!track) return;
  focusTitle.textContent = track.title;
  focusArtist.textContent = track.artist;
  focusAlbum.textContent = track.album;
  duration.textContent = formatTime(track.duration);
  applyFocusTheme(track);
  renderTracks();
}

async function playTrack(index) {
  if (!tracks[index]) return;
  currentIndex = index;
  const track = tracks[currentIndex];
  audio.src = track.url;
  setFocus(track);
  await audio.play();
}

function togglePlay() {
  if (currentIndex === -1 && tracks.length) {
    playTrack(0);
    return;
  }

  if (audio.paused) audio.play();
  else audio.pause();
}

function stepTrack(direction) {
  if (!tracks.length) return;
  const next = currentIndex === -1 ? 0 : (currentIndex + direction + tracks.length) % tracks.length;
  playTrack(next);
}

function shuffle() {
  if (!tracks.length) return;
  const next = Math.floor(Math.random() * tracks.length);
  playTrack(next === currentIndex ? (next + 1) % tracks.length : next);
}

async function refreshLibrary({ keepCurrent = true } = {}) {
  const previousPath = tracks[currentIndex]?.path;
  tracks = await window.musicApp.listLibrary();
  updateCounts();
  viewTracks();

  if (tracks.length && currentIndex === -1) {
    currentIndex = 0;
    setFocus(tracks[0]);
  } else if (keepCurrent && previousPath) {
    currentIndex = tracks.findIndex((track) => track.path === previousPath);
    if (currentIndex >= 0) setFocus(tracks[currentIndex]);
  }
}

playButton.addEventListener("click", togglePlay);
previousButton.addEventListener("click", () => stepTrack(-1));
nextButton.addEventListener("click", () => stepTrack(1));
shuffleButton.addEventListener("click", shuffle);
refreshButton.addEventListener("click", () => refreshLibrary());
searchInput.addEventListener("input", viewTracks);
sidebarToggle.addEventListener("click", () => {
  const collapsed = appShell.classList.toggle("sidebar-collapsed");
  sidebarToggle.title = collapsed ? "Expand sidebar" : "Collapse sidebar";
});

document.addEventListener("click", (event) => {
  const target = event.target.closest("button, .track-row");
  if (target) triggerClickFlash(target);
});

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelector(".nav-item.active").classList.remove("active");
    button.classList.add("active");
    currentView = button.dataset.view;
    viewTracks();
  });
});

downloadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  downloadButton.disabled = true;
  downloadStatus.textContent = "Downloading and preparing your track...";

  try {
    const result = await window.musicApp.download(urlInput.value);
    urlInput.value = "";
    tracks = result.tracks;
    currentIndex = -1;
    updateCounts();
    viewTracks();
    downloadStatus.textContent = "Added. Your library has been refreshed.";
    triggerDownloadAnimation();
  } catch (error) {
    downloadStatus.textContent = error.message || "Download failed.";
  } finally {
    downloadButton.disabled = false;
  }
});

audio.addEventListener("play", () => {
  playButton.textContent = "Ⅱ";
  vinyl.classList.add("playing");
  startVisualizer();
});

audio.addEventListener("pause", () => {
  playButton.textContent = "▶";
  vinyl.classList.remove("playing");
  stopVisualizer();
});

audio.addEventListener("ended", () => {
  stopVisualizer();
  stepTrack(1);
});

audio.addEventListener("timeupdate", () => {
  if (isSeeking) return;
  const value = audio.duration ? (audio.currentTime / audio.duration) * 1000 : 0;
  seek.value = value;
  currentTime.textContent = formatTime(audio.currentTime);
  duration.textContent = formatTime(audio.duration || tracks[currentIndex]?.duration);
});

seek.addEventListener("input", () => {
  isSeeking = true;
  const next = (Number(seek.value) / 1000) * (audio.duration || 0);
  currentTime.textContent = formatTime(next);
});

seek.addEventListener("change", () => {
  if (audio.duration) audio.currentTime = (Number(seek.value) / 1000) * audio.duration;
  isSeeking = false;
});

window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement) return;
  if (event.code === "Space") {
    event.preventDefault();
    togglePlay();
  }
  if (event.code === "ArrowLeft") audio.currentTime = Math.max(0, audio.currentTime - 10);
  if (event.code === "ArrowRight") audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10);
});

window.addEventListener("resize", resizeSpectrumCanvas);

refreshLibrary({ keepCurrent: false }).catch((error) => {
  downloadStatus.textContent = error.message || "Could not load music library.";
});
