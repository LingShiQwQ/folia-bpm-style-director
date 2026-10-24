import activate from './bpm-style-director/client.mjs';
import { analyzeContext } from './bpm-style-director/analyze.mjs';
import { nativeBpm } from './bpm-style-director/host.mjs';

const modeLabels = { still: '静止', classic: '流光', cadenza: '心象', partita: '云阶', fume: '浮名', monet: '莫奈', cappella: '群唱', tilt: '倾诉', claddagh: '回环', diorama: '镜台', pendolo: '时计', sonnet: '商籁', tempera: '凝彩', hanabi: '花火', 'example:custom': '第三方样式（演示）' };
function store(initial) {
  let state = initial; const listeners = new Set();
  return { getState: () => state, subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    patch: patch => { state = { ...state, ...patch }; listeners.forEach(fn => fn(state)); } };
}
const song = (id = 'preview', bpm = 128) => ({ id, name: '设置界面演示', artists: [{ name: '演示歌曲 · 可在界面中校正 BPM' }], isLocal: true, localRef: { songId: id }, bpm });
const playback = store({ currentSong: song(), audioSrc: null, transitionDisplay: null });
const visual = store({ visualizerMode: 'classic', randomVisualizerModePerSong: false });
visual.patch({ handleSetVisualizerMode: mode => visual.patch({ visualizerMode: mode, randomVisualizerModePerSong: false }),
  handleToggleRandomVisualizerModePerSong: random => visual.patch({ randomVisualizerModePerSong: random }) });
const definitions = {}, memory = new Map(), disposers = [], eventListeners = new Map();
const sectionHandles = [];
const commands = [];
const api = {
  host: { folia: '0.7.22', folium: { major: 1, minor: 7 } }, env: { context: 'main' },
  internals: { stores: { playback, visualizerSettings: visual }, visualizerRegistry: Object.entries(modeLabels).map(([mode, labelFallback]) => ({ mode, labelFallback })) },
  storage: { get: async key => memory.get(key), set: async (key, value) => memory.set(key, value) },
  onDispose: fn => disposers.push(fn), log: { warn: console.warn, info: console.log },
  ui: { openHomeTab: () => undefined },
  events: { on(type, fn) { const listeners = eventListeners.get(type) || new Set(); listeners.add(fn); eventListeners.set(type, listeners); return () => listeners.delete(fn); } },
  registries: {
    settingsSections: { register(def) {
      let values = Object.fromEntries(def.settings.map(s => [s.key, s.defaultValue])); const listeners = new Set();
      const settings = { get: () => values, set: patch => { values = { ...values, ...patch }; listeners.forEach(fn => fn()); }, reset: () => {}, onChange: fn => { listeners.add(fn); return () => listeners.delete(fn); } };
      const result = { id: 'bpm-style-director:' + def.id, settings }; sectionHandles.push(result); definitions.settings = def; return result;
    } },
    homeTabs: { register: def => { definitions.home = def; } },
    playerPanelTabs: { register: def => { definitions.panel = def; } },
    commands: { register: def => commands.push(def) },
  },
};
const stop = await activate(api);
const unmount = definitions.home.mount(document.querySelector('#app'));
window.__preview = {
  mode: () => visual.getState().visualizerMode, settings: sectionHandles[0].settings, memory,
  userMode: mode => visual.patch({ visualizerMode: mode }),
  next: bpm => { playback.patch({ currentSong: song('song-' + bpm, bpm) }); eventListeners.get('playback.songChanged')?.forEach(fn => fn({ song: null })); },
  stop: () => { unmount(); stop(); disposers.forEach(fn => fn()); },
  async until(fn, timeout = 5000) { const end = Date.now() + timeout; while (!fn()) { if (Date.now() > end) throw new Error('界面状态等待超时'); await new Promise(resolve => setTimeout(resolve, 20)); } },
  async testNativeCache() {
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('KineticPlayerDB', 1); request.onupgradeneeded = () => request.result.createObjectStore('metadata_cache', { keyPath: 'key' }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    await new Promise((resolve, reject) => { const tx = db.transaction('metadata_cache', 'readwrite'); tx.objectStore('metadata_cache').put({ key: 'automix_profile_local:native-test', data: { version: 9, bpm: 143.6, gridless: false }, timestamp: Date.now() }); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
    db.close(); return nativeBpm({ song: {}, key: 'local:native-test' });
  },
  async testAudio() {
    const rate = 11025, seconds = 25, samples = rate * seconds, bytes = new ArrayBuffer(44 + samples * 2), view = new DataView(bytes);
    const write = (offset, value) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
    write(0, 'RIFF'); view.setUint32(4, bytes.byteLength - 8, true); write(8, 'WAVE'); write(12, 'fmt '); view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, samples * 2, true);
    for (let time = 0.4; time < seconds; time += 0.5) for (let k = 0; k < 800 && Math.round(time * rate) + k < samples; k++) view.setInt16(44 + (Math.round(time * rate) + k) * 2, Math.round(Math.sin(2 * Math.PI * 85 * k / rate) * Math.exp(-k / 120) * 30000), true);
    const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
    try { return await analyzeContext({ audioUrl: url, source: 'local' }, { sampleSeconds: 25, maxFileMiB: 16 }, new AbortController().signal); }
    finally { URL.revokeObjectURL(url); }
  },
};
window.__previewReady = true;
