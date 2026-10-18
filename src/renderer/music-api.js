let basePromise;
async function apiBase() {
  basePromise ||= Promise.resolve(window.musicApp?.getApiBase?.() ?? import.meta.env.VITE_API_BASE_URL ?? '')
    .then((base) => base.replace(/\/$/, ''));
  return basePromise;
}
export async function musicApi(route, body, signal) {
  let response;
  try {
    response = await fetch(`${await apiBase()}/api${route}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Cannot reach the music service. Check your connection or backend URL.');
  }
  const result = await response.json().catch(() => ({ error: 'Music backend is unavailable. Configure the backend URL for this deployment.' }));
  if (!response.ok || result.error && !result.state) throw Object.assign(new Error(result.error || 'The request failed. Please try again.'), { status: response.status });
  const base = await apiBase();
  const resolveTrack = (track) => ({ ...track, url: track.url?.startsWith('/api/') ? `${base}${track.url}` : track.url });
  if (Array.isArray(result.tracks)) result.tracks = result.tracks.map(resolveTrack);
  if (result.track?.url) result.track = resolveTrack(result.track);
  return result;
}
