const messages = {
  unsupported: 'Voice search is unavailable here. Use a supported browser or macOS desktop app; typed search is still available.',
  'speech-permission': 'Allow Aria Voice under System Settings → Privacy & Security → Speech Recognition, then try again.',
  'microphone-permission': 'Allow microphone access under System Settings → Privacy & Security → Microphone, then try again.',
  'not-allowed': 'Microphone access was denied. Allow it in your browser or system settings, then try again.',
  'service-not-allowed': 'This browser does not provide speech recognition. Try a supported browser or the macOS app.',
  'audio-capture': 'No microphone is available. Check your sound input device and microphone permission.',
  network: 'The speech service could not connect. Check your connection and try again.',
  'service-unavailable': 'macOS speech recognition is unavailable. Check your connection and chosen language.',
  'recognition-failed': 'macOS could not recognize speech. Check your microphone, connection and chosen language, then retry.',
  'language-not-supported': 'This speech language is unavailable. Choose another language.',
  'no-speech': 'No speech was heard. Click Voice Search and say a song title or lyric.',
  'native-failed': 'The macOS voice helper stopped. Check Microphone and Speech Recognition permissions, then restart Aria.',
};
export function voiceError(code) { return messages[code] || 'Voice search could not start. Please try again.'; }

// One explicit listening session per click. Never recreate it when tracks change.
export function createVoiceSession({ native, Recognition, onEvent, timeoutMs = 30_000 }) {
  let id = null, recognition = null, timer, sequence = 0;
  let lastText = '';
  const detach = () => {
    clearTimeout(timer);
    if (recognition) {
      recognition.onstart = recognition.onresult = recognition.onerror = recognition.onend = null;
      try { recognition.abort(); } catch {}
      recognition = null;
    }
  };
  function stop() {
    if (!id) return;
    id = null;
    detach();
    native?.stopVoice().catch(() => {});
    onEvent({ type: 'end' });
  }
  function accept(event) {
    if (!id) return;
    if (event.type === 'error') {
      onEvent({ type: 'error', message: event.message || voiceError(event.code) });
      stop();
    } else if (event.type === 'end') stop();
    else {
      onEvent(event);
      if (event.type === 'result' && event.final) stop();
    }
  }
  const unsubscribe = native?.onVoiceEvent((event) => { if (id && event.sessionId === id) accept(event); });
  return {
    start(locale = 'en-IN') {
      if (id) return;
      id = `voice-${Date.now()}-${++sequence}`;
      const startedId = id;
      lastText = '';
      onEvent({ type: 'starting' });
      if (native) {
        native.startVoice(id, locale).catch((error) => {
          if (id === startedId) accept({ type: 'error', message: error.message });
        });
        return;
      }
      if (!Recognition) { accept({ type: 'error', code: 'unsupported' }); return; }
      try {
        recognition = new Recognition();
        recognition.lang = locale;
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.onstart = () => accept({ type: 'listening' });
        recognition.onresult = (event) => {
          for (let i = event.resultIndex; i < event.results.length; i++) {
            lastText = event.results[i][0].transcript.trim();
            accept({ type: 'result', text: lastText, final: event.results[i].isFinal });
            if (!id) break;
          }
        };
        recognition.onerror = (event) => accept({ type: 'error', code: event.error });
        recognition.onend = () => accept(lastText ? { type: 'result', text: lastText, final: true } : { type: 'error', code: 'no-speech' });
        timer = setTimeout(() => accept(lastText ? { type: 'result', text: lastText, final: true } : { type: 'error', code: 'no-speech' }), timeoutMs);
        recognition.start();
      } catch { accept({ type: 'error', code: 'unsupported' }); }
    },
    stop,
    dispose() { stop(); unsubscribe?.(); },
  };
}

export function findMatchingTrack(tracks, spokenText) {
  const normalize = (text) => String(text || '').normalize('NFKC').toLowerCase()
    .replace(/[’']/gu, '').replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').replace(/\s+/gu, ' ').trim();
  const text = normalize(spokenText).replace(/^(?:please\s+)?(?:play|search for|find)\s+/u, '').replace(/\s+please$/u, '');
  if (text.length < 2) return null;
  let best = null;
  const consider = (index, type, value, priority) => {
    const candidate = normalize(value);
    if (!candidate) return;
    const contains = (a, b) => ` ${a} `.includes(` ${b} `);
    const exact = candidate === text;
    const full = contains(text, candidate);
    const partial = text.length >= 4 && contains(candidate, text);
    if (!exact && !full && !partial) return;
    const score = (exact ? 1000 : full ? 500 : 100) + priority + Math.min(candidate.length, 80);
    if (!best || score > best.score) best = { index, matchType: type, matchText: value, score };
  };
  tracks.forEach((track, index) => {
    consider(index, 'title', track.title, 30);
    for (const lyric of track.lyrics || []) consider(index, 'lyric', lyric, 20);
    consider(index, 'artist', track.artist, 10);
  });
  if (!best) return null;
  const { score, ...match } = best;
  return match;
}
