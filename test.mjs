import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, parseRules, selectMode, StyleLease } from './bpm-style-director/rules.mjs';
import { estimateBpm } from './bpm-style-director/estimator.mjs';
import { Director } from './bpm-style-director/engine.mjs';
import { createHost, songKey, nativeBpm } from './bpm-style-director/host.mjs';
import { readBounded } from './bpm-style-director/analyze.mjs';
const modes = [{ id: 'fume', label: '浮名' }, { id: 'classic', label: '流光' }, { id: 'sonnet', label: '商籁' }, { id: 'tempera', label: '凝彩' }, { id: 'manual', label: '手动样式' }];
function setup({ result = { bpm: 128, confidence: 0.8, source: '测试估算' }, native = null } = {}) {
  let context = { key: 'local:a', title: 'A', song: { id: 'a' }, audioUrl: 'blob:local', source: 'local' };
  let visual = { mode: 'classic', random: false }, config = { ...DEFAULTS }, calls = [], saved = null;
  const listeners = new Set();
  const host = { context: () => context, modes: () => modes, visualState: () => ({ ...visual }),
    setMode: mode => { calls.push(mode); visual = { mode, random: false }; listeners.forEach(fn => fn(visual)); },
    setRandom: random => { visual.random = random; }, userMode: mode => { visual.mode = mode; listeners.forEach(fn => fn(visual)); },
    change: key => { context = { ...context, key, title: key }; } };
  let analyzed = 0;
  const engine = new Director({ host, settings: { get: () => config }, storage: { get: async () => null, set: async (_key, value) => { saved = value; } },
    nativeBpm: async () => native, analyze: async () => { analyzed++; return result; } });
  listeners.add(state => engine.onMode(state));
  return { engine, host, calls, config, setNative: value => { native = value; }, get analyzed() { return analyzed; }, get saved() { return saved; } };
}

test('interval boundaries are deterministic and do not overlap at 90/120/150', () => {
  const rules = parseRules(DEFAULTS.rulesJson, modes);
  for (const [bpm, mode] of [[30, 'fume'], [89.9, 'fume'], [90, 'classic'], [120, 'sonnet'], [150, 'tempera'], [360, 'tempera']]) assert.equal(selectMode(bpm, rules, modes).mode, mode);
  assert.throws(() => parseRules([{ min: 90, max: 150, mode: 'classic' }, { min: 120, max: 160, mode: 'fume' }]), /重叠/);
});
test('missing third-party styles and gaps retain the current choice', () => {
  assert.equal(selectMode(128, [{ min: 100, max: 150, mode: 'removed:style' }], modes).mode, null);
  assert.equal(selectMode(80, [{ min: 100, max: 150, mode: 'classic' }], modes).mode, null);
});
test('known BPM automatically chooses a real host style', async () => {
  const f = setup(); await f.engine.load(); await f.engine.refresh();
  assert.equal(f.host.visualState().mode, 'sonnet'); assert.equal(f.analyzed, 1);
  assert.equal(f.engine.state().result.bpm, 128);
});
test('manual correction wins over native and detected BPM', async () => {
  const f = setup({ native: { bpm: 170, confidence: null, source: '宿主缓存' } });
  await f.engine.setManual(80); assert.equal(f.host.visualState().mode, 'fume'); assert.equal(f.analyzed, 0);
  await f.engine.setManual(null); assert.equal(f.host.visualState().mode, 'tempera');
});
test('native analysis cache takes priority over a prior estimate', async () => {
  const f = setup(); await f.engine.refresh();
  f.setNative({ bpm: 170, confidence: null, source: '宿主缓存' });
  await f.engine.refresh(); assert.equal(f.engine.state().result.bpm, 170); assert.equal(f.analyzed, 1);
});
test('cached BPM reuses the original source label without repeated suffixes', async () => {
  const f = setup(); await f.engine.refresh(); await f.engine.refresh(); await f.engine.refresh();
  assert.equal(f.analyzed, 1); assert.equal(f.engine.state().result.source, '测试估算');
});
test('low confidence and silence do not force an automatic switch', async () => {
  const f = setup({ result: { bpm: 180, confidence: 0.1, source: '估算' } }); await f.engine.refresh();
  assert.equal(f.calls.length, 0); assert.match(f.engine.state().message, /置信度/);
  const g = setup({ result: { bpm: null, confidence: 0, reason: '静音' } }); await g.engine.refresh(); assert.equal(g.calls.length, 0);
});
test('a delayed result can never select a mode for a different song', async () => {
  const f = setup(); let resolve;
  f.engine.analyze = () => new Promise(r => { resolve = r; });
  const first = f.engine.refresh(); await new Promise(r => setImmediate(r));
  f.host.change('local:b'); resolve({ bpm: 170, confidence: 0.9, source: '旧曲结果' }); await first;
  assert.equal(f.calls.length, 0);
});
test('rapid next-song requests serialize detection and retain only the newest request', async () => {
  const f = setup(); let finish; let calls = 0;
  f.engine.analyze = async () => { calls++; if (calls === 1) return new Promise(r => { finish = r; }); return { bpm: 80, confidence: 0.8, source: '新曲' }; };
  const a = f.engine.refresh(); await new Promise(r => setImmediate(r));
  f.host.change('local:b'); const b = f.engine.refresh(); f.host.change('local:c'); const c = f.engine.refresh();
  finish({ bpm: 160, confidence: 0.8, source: '旧曲' }); await Promise.all([a, b, c]);
  assert.equal(calls, 2); assert.equal(f.engine.state().context.key, 'local:c'); assert.equal(f.host.visualState().mode, 'fume');
});
test('manual style selection pauses automation until the next song', async () => {
  const f = setup(); await f.engine.refresh(); f.host.userMode('manual');
  await f.engine.refresh(); assert.equal(f.host.visualState().mode, 'manual');
  f.host.change('local:b'); await f.engine.refresh(); assert.equal(f.host.visualState().mode, 'sonnet');
});
test('manual choice is preserved when disabling; owned choices restore on unload', async () => {
  const f = setup(); await f.engine.refresh(); f.host.userMode('manual'); f.engine.dispose(); assert.equal(f.host.visualState().mode, 'manual');
  const g = setup(); await g.engine.refresh(); g.engine.dispose(); assert.equal(g.host.visualState().mode, 'classic');
});
test('disposal prevents an in-flight detector from changing the host', async () => {
  const f = setup(); let resolve; f.engine.analyze = () => new Promise(r => { resolve = r; });
  const pending = f.engine.refresh(); await new Promise(r => setImmediate(r)); f.engine.dispose();
  resolve({ bpm: 160, confidence: 1, source: '迟到' }); await pending; assert.equal(f.calls.length, 0);
});
test('clearing estimate memory preserves per-song manual corrections', async () => {
  const f = setup(); await f.engine.setManual(90); f.host.change('local:b'); await f.engine.refresh(); await f.engine.clearMemory();
  assert.equal(f.saved['local:a'].manualBpm, 90); assert.equal(f.saved['local:b'], undefined);
});
test('native random mode is restored after an owned automatic choice', () => {
  let value = { mode: 'classic', random: true };
  const lease = new StyleLease({ visualState: () => value, setMode: mode => { value = { mode, random: false }; }, setRandom: random => { value.random = random; } });
  lease.apply('sonnet'); assert.equal(value.random, false); lease.restore(); assert.deepEqual(value, { mode: 'classic', random: true });
});
test('source identities separate local, online provider, Navidrome and Stage', () => {
  assert.equal(songKey({ id: 1, localRef: { songId: 'abc' } }), 'local:abc');
  assert.equal(songKey({ id: 1, sourceRef: { kind: 'online', providerId: 'qq', mediaId: 1 } }), 'online:qq:1');
  assert.equal(songKey({ id: 1, isNavidrome: true }), 'navidrome:1');
  assert.equal(songKey({ id: 1, isStage: true }), 'stage:1');
});
test('displayed outgoing song never borrows the incoming deck audio URL', () => {
  const host = createHost({ host: { folia: '0.7.22' }, internals: { stores: { playback: { getState: () => ({ currentSong: { id: 'new' }, audioSrc: 'blob:new', transitionDisplay: { song: { id: 'old' } } }) }, visualizerSettings: { getState: () => ({ handleSetVisualizerMode() {} }) } }, visualizerRegistry: [] } });
  assert.equal(host.context().song.id, 'old'); assert.equal(host.context().audioUrl, null);
});
test('metadata BPM can be read without touching a database', async () => {
  assert.equal((await nativeBpm({ song: { bpm: '128' } }, null)).bpm, 128);
});
test('audio reader enforces length and streaming limits', async () => {
  const stream = bytes => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(bytes)); controller.close(); } }));
  assert.equal((await readBounded('blob:fake', 32, null, async () => stream(16))).byteLength, 16);
  await assert.rejects(readBounded('blob:fake', 8, null, async () => stream(16)), /上限/);
  await assert.rejects(readBounded('blob:fake', 8, null, async () => new Response('x', { headers: { 'content-length': '100' } })), /上限/);
});
test('silence and steady tones do not produce a trusted tempo', () => {
  const silence = new Float32Array(11025 * 15); assert.equal(estimateBpm(silence, 11025).bpm, null);
  const tone = Float32Array.from(silence, (_, i) => Math.sin(i * 2 * Math.PI * 220 / 11025) * 0.5);
  const result = estimateBpm(tone, 11025); assert.ok(result.bpm === null || result.confidence < DEFAULTS.minConfidence);
});
for (const bpm of [60, 75, 90, 100, 120, 128, 140, 160, 180]) test(`known ${bpm} BPM pulses are detected within 2 BPM`, () => {
  const rate = 11025, samples = new Float32Array(rate * 25);
  for (let time = 0.4; time < 25; time += 60 / bpm) for (let k = 0; k < 800 && Math.round(time * rate) + k < samples.length; k++) samples[Math.round(time * rate) + k] = Math.sin(2 * Math.PI * 85 * k / rate) * Math.exp(-k / 120);
  const result = estimateBpm(samples, rate); assert.ok(Math.abs(result.bpm - bpm) < 2, JSON.stringify(result)); assert.ok(result.confidence >= 0.45);
});
