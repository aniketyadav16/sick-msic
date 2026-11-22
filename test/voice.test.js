const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { createVoiceService } = require('../src/voice-service');
const load = () => import('../src/renderer/voice-session.mjs');

function bridge() {
  let listener;
  const starts = [], stops = [];
  return {
    starts, stops,
    onVoiceEvent(callback) { listener = callback; return () => { listener = null; }; },
    async startVoice(...args) { starts.push(args); },
    async stopVoice() { stops.push(true); },
    emit(event) { listener?.(event); },
  };
}

test('Electron uses native voice, shows interim text, and releases the microphone on a final result', async () => {
  const { createVoiceSession } = await load();
  const native = bridge(), events = [];
  const session = createVoiceSession({ native, Recognition: class { constructor() { throw new Error('Browser speech must not be used'); } }, onEvent: (event) => events.push(event) });
  session.start('en-IN'); session.start('en-IN');
  assert.equal(native.starts.length, 1);
  const [sessionId, locale] = native.starts[0];
  assert.equal(locale, 'en-IN');
  native.emit({ type: 'listening', sessionId });
  native.emit({ type: 'result', sessionId, text: 'Night', final: false });
  assert.equal(native.stops.length, 0);
  native.emit({ type: 'result', sessionId, text: 'Night Changes', final: true });
  assert.equal(events.at(-2).text, 'Night Changes');
  assert.equal(events.at(-1).type, 'end');
  assert.equal(native.stops.length, 1);
  session.dispose();
});

test('stale native transcripts cannot select a track after cancel or restart', async () => {
  const { createVoiceSession } = await load();
  const native = bridge(), events = [];
  const session = createVoiceSession({ native, onEvent: (event) => events.push(event) });
  session.start(); const oldId = native.starts[0][0]; session.stop(); session.start();
  const count = events.length;
  native.emit({ type: 'result', sessionId: oldId, text: 'wrong song', final: true });
  assert.equal(events.length, count);
  session.dispose();
  native.emit({ type: 'result', sessionId: native.starts[1][0], text: 'wrong song', final: true });
  assert.equal(events.filter((event) => event.type === 'result').length, 0);
});

test('permission errors are actionable, stop listening and allow another attempt', async () => {
  const { createVoiceSession } = await load();
  const native = bridge(), events = [];
  const session = createVoiceSession({ native, onEvent: (event) => events.push(event) });
  session.start(); native.emit({ type: 'error', code: 'speech-permission', sessionId: native.starts[0][0] });
  assert.match(events.find((event) => event.type === 'error').message, /Privacy & Security.*Speech Recognition/);
  assert.equal(events.at(-1).type, 'end');
  session.start(); assert.equal(native.starts.length, 2); session.dispose();
});

test('browser voice handles final results without an automatic restart loop', async () => {
  const { createVoiceSession } = await load();
  let recognition, starts = 0, aborted = 0;
  class Recognition {
    constructor() { recognition = this; }
    start() { starts++; this.onstart(); }
    abort() { aborted++; }
  }
  const events = [];
  const session = createVoiceSession({ Recognition, onEvent: (event) => events.push(event) });
  session.start('hi-IN'); assert.equal(recognition.lang, 'hi-IN');
  const result = [{ transcript: 'पल पल' }]; result.isFinal = true;
  recognition.onresult({ resultIndex: 0, results: [result] });
  assert.equal(starts, 1); assert.equal(aborted, 1); assert.equal(recognition.onend, null);
  assert.equal(events.at(-2).text, 'पल पल'); session.dispose();
});

test('browser silence ends with feedback instead of leaving listening active', async () => {
  const { createVoiceSession } = await load();
  const events = [];
  const session = createVoiceSession({ Recognition: class { start() {} abort() {} }, timeoutMs: 5, onEvent: (event) => events.push(event) });
  session.start(); await new Promise((resolve) => setTimeout(resolve, 15));
  assert.match(events.find((event) => event.type === 'error').message, /No speech/);
  assert.equal(events.at(-1).type, 'end'); session.dispose();
});

test('song matching prioritizes exact titles, handles commands/Unicode, and avoids substring false positives', async () => {
  const { findMatchingTrack } = await load();
  const tracks = [
    { title: 'Another song', artist: 'Night Changes', lyrics: ['i found a love for me'] },
    { title: 'Night Changes', artist: 'One Direction' },
    { title: "We Don't Talk Anymore", artist: 'Charlie Puth' },
    { title: 'पल पल', artist: 'गायक' },
    { title: 'High', artist: 'Artist' },
  ];
  assert.equal(findMatchingTrack(tracks, 'Please play Night Changes please').index, 1);
  assert.equal(findMatchingTrack(tracks, 'we don’t talk anymore').index, 2);
  assert.equal(findMatchingTrack(tracks, 'पल पल').index, 3);
  assert.equal(findMatchingTrack(tracks, 'i found a love for me').matchType, 'lyric');
  assert.equal(findMatchingTrack(tracks, 'highway'), null);
  assert.equal(findMatchingTrack(tracks, ''), null);
});

function childFixture() {
  const child = new EventEmitter();
  child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.kill = () => child.emit('close', null);
  child.stdin.on('finish', () => child.emit('close', 0));
  return child;
}

test('native process service validates input, forwards events and enforces window ownership', async () => {
  const child = childFixture(), events = [];
  const voice = createVoiceService({ build: async () => '/test/AriaVoice', spawnProcess: (_path, args) => { assert.deepEqual(args, ['en-IN']); return child; } });
  await assert.rejects(voice.start(1, 'id', '--invalid', () => {}), /Invalid voice/);
  await voice.start(1, 'id', 'en-IN', (event) => events.push(event));
  child.stdout.write('not json\n' + JSON.stringify({ type: 'listening' }) + '\n');
  assert.deepEqual(events[0], { type: 'listening', sessionId: 'id' });
  voice.stop(2); assert.equal(child.stdin.writableEnded, false);
  voice.stop(1); assert.equal(child.stdin.writableEnded, true);
  assert.equal(events.at(-1).type, 'end');
});

test('cancel while native helper builds never starts microphone capture', async () => {
  let finishBuild, spawned = false;
  const voice = createVoiceService({ build: () => new Promise((resolve) => { finishBuild = resolve; }), spawnProcess: () => { spawned = true; return childFixture(); } });
  const pending = voice.start(1, 'id', 'en-IN', () => {});
  voice.stop(1); finishBuild('/test/AriaVoice'); await pending;
  assert.equal(spawned, false);
});

test('native build failure reaches the renderer before ending the session', async () => {
  const events = [];
  const voice = createVoiceService({ build: async () => { throw new Error('Install Apple Command Line Tools'); } });
  await voice.start(1, 'id', 'en-IN', (event) => events.push(event));
  assert.equal(events[0].type, 'error'); assert.match(events[0].message, /Command Line Tools/);
  assert.equal(events[1].type, 'end');
});
