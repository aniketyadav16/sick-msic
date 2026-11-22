const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
const { buildVoice } = require('../scripts/build-voice');
const LOCALES = new Set(['en-IN', 'en-US', 'hi-IN']);

function createVoiceService({ build = buildVoice, spawnProcess = spawn } = {}) {
  let active;
  function stop(owner) {
    if (!active || (owner !== undefined && active.owner !== owner)) return;
    const session = active;
    active = undefined;
    clearTimeout(session.timeout);
    if (session.child) {
      session.child.stdin.end('stop\n');
      const killTimer = setTimeout(() => session.child.kill('SIGKILL'), 1500);
      killTimer.unref();
      session.child.once('close', () => clearTimeout(killTimer));
    }
    session.send({ type: 'end', sessionId: session.id });
  }
  return {
    stop,
    async start(owner, id, locale, send) {
      if (typeof id !== 'string' || !/^[\w-]{1,80}$/.test(id) || !LOCALES.has(locale)) throw new Error('Invalid voice request.');
      stop();
      const session = { owner, id, send };
      active = session;
      try {
        const binary = await build();
        if (active !== session) return;
        const child = spawnProcess(binary, [locale], { stdio: ['pipe', 'pipe', 'pipe'], shell: false });
        session.child = child;
        let failed = false;
        const fail = () => {
          if (active !== session) return;
          send({ type: 'error', code: 'native-failed', sessionId: id });
          stop(owner);
        };
        child.stdin.on('error', () => {});
        child.stderr.resume();
        const lines = createInterface({ input: child.stdout });
        lines.on('line', (line) => {
          if (active !== session || line.length > 8000) return;
          let event;
          try { event = JSON.parse(line); } catch { return; }
          if (!['status', 'listening', 'result', 'error', 'end'].includes(event.type)) return;
          if (event.type === 'result' && (typeof event.text !== 'string' || event.text.length > 2000)) return;
          if (event.type === 'error') failed = true;
          send({ ...event, sessionId: id });
          if (event.type === 'end') { clearTimeout(session.timeout); active = undefined; }
        });
        child.on('error', fail);
        child.on('close', () => {
          if (active !== session) return;
          if (!failed) send({ type: 'error', code: 'native-failed', sessionId: id });
          clearTimeout(session.timeout); active = undefined;
          send({ type: 'end', sessionId: id });
        });
        session.timeout = setTimeout(() => { if (active === session) fail(); }, 120_000);
        session.timeout.unref();
      } catch (error) {
        if (active === session) {
          send({ type: 'error', message: error.message, sessionId: id });
          stop(owner);
        }
      }
    },
  };
}
module.exports = { createVoiceService };
