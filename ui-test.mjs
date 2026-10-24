import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const base = path.dirname(fileURLToPath(import.meta.url));
await fs.mkdir(path.join(base, 'validation'), { recursive: true });
const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'folia-bpm-browser-'));
const server = http.createServer(async (request, response) => {
  try {
    const relative = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'preview.html';
    const target = path.resolve(base, relative);
    if (!target.startsWith(base + path.sep)) { response.writeHead(403).end(); return; }
    const content = await fs.readFile(target);
    response.writeHead(200, { 'content-type': relative.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8',
      'content-security-policy': "default-src 'self' blob: data:; script-src 'self' 'unsafe-inline' blob:; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self' blob:" }); response.end(content);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const chrome = spawn(process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-sync', '--remote-debugging-port=0', '--user-data-dir=' + folder, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let socket;
const pending = new Map(); let nextId = 0;
try {
  let port, socketPath;
  for (let i = 0; i < 100; i++) {
    try { [port, socketPath] = (await fs.readFile(path.join(folder, 'DevToolsActivePort'), 'utf8')).trim().split(/\r?\n/); break; } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  if (!port) throw new Error('无法启动隔离浏览器');
  socket = new WebSocket(`ws://127.0.0.1:${port}${socketPath}`);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const entry = pending.get(message.id); if (!entry) return; pending.delete(message.id);
      message.error ? entry.reject(new Error(message.error.message)) : entry.resolve(message.result);
    }
  });
  const call = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const id = ++nextId; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); });
  const target = await call('Target.createTarget', { url: `http://127.0.0.1:${server.address().port}/preview.html` });
  const { sessionId } = await call('Target.attachToTarget', { targetId: target.targetId, flatten: true });
  const evaluate = async expression => {
    const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  await call('Emulation.setDeviceMetricsOverride', { width: 1120, height: 1340, deviceScaleFactor: 1, mobile: false }, sessionId);
  await evaluate('new Promise((resolve,reject)=>{let n=0;let id=setInterval(()=>{if(window.__previewReady){clearInterval(id);resolve(true)}else if(++n>100){clearInterval(id);reject(new Error("页面未就绪"))}},50)})');
  await evaluate('__preview.until(()=>__preview.mode()==="sonnet")');
  assert.equal(await evaluate('document.querySelectorAll(".rule-row").length'), 4);
  await evaluate('document.querySelector("[data-id=test]").click()');
  assert.match(await evaluate('document.querySelector("[data-id=test-result]").textContent'), /商籁/);
  await evaluate('(()=>{const last=document.querySelectorAll(".rule-row")[0].querySelectorAll("input")[1];last.value="100";last.dispatchEvent(new Event("input"));document.querySelector("[data-id=save]").click()})()');
  assert.match(await evaluate('document.querySelector("[data-id=feedback]").textContent'), /重叠|区间/);
  await evaluate('document.querySelector("[data-id=defaults]").click();document.querySelector("[data-id=save]").click()');
  assert.match(await evaluate('document.querySelector("[data-id=feedback]").textContent'), /已保存/);
  await evaluate('document.querySelector("[data-id=manual]").value="80";document.querySelector("[data-id=manual-save]").click();__preview.until(()=>__preview.mode()==="fume")');
  await evaluate('document.querySelector("[data-id=manual-clear]").click();__preview.until(()=>__preview.mode()==="sonnet")');
  await evaluate('__preview.userMode("cadenza")');
  assert.match(await evaluate('document.querySelector("[data-id=phase]").textContent'), /手动控制/);
  await evaluate('__preview.next(170);__preview.until(()=>__preview.mode()==="tempera")');
  const audio = await evaluate('__preview.testAudio()'); assert.ok(Math.abs(audio.bpm - 120) < 2); assert.ok(audio.confidence >= 0.45);
  const native = await evaluate('__preview.testNativeCache()'); assert.equal(native.bpm, 143.6);
  await evaluate('__preview.settings.set({enabled:false});__preview.until(()=>__preview.mode()==="cadenza")');
  await evaluate('__preview.settings.set({enabled:true});__preview.next(128);__preview.until(()=>__preview.mode()==="sonnet")');
  const screenshot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, sessionId);
  await fs.writeFile(path.join(base, 'validation/设置界面预览.png'), Buffer.from(screenshot.data, 'base64'));
  await call('Emulation.setDeviceMetricsOverride', { width: 460, height: 1600, deviceScaleFactor: 1, mobile: false }, sessionId);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= 460'), true);
  await evaluate('__preview.stop()');
  assert.equal(await evaluate('document.querySelectorAll(".bpm-panel").length'), 0);
  const result = { browser: 'isolated Chrome', tests: ['settings panel mounts', 'rule preview', 'overlap rejection', 'settings save', 'manual BPM', 'manual style hold', 'next-song switching', 'WebAudio decode + worker', 'native IndexedDB BPM cache', 'disable restore', 'narrow layout', 'unmount cleanup'], estimatedTestBpm: audio.bpm, nativeCacheTestBpm: native.bpm, actualFoliaUiEnabled: false };
  await fs.writeFile(path.join(base, 'validation/ui-results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  await call('Browser.close');
} finally {
  socket?.close(); chrome.kill(); server.close();
  await new Promise(resolve => setTimeout(resolve, 400));
  if (path.resolve(folder).startsWith(path.resolve(os.tmpdir()) + path.sep)) await fs.rm(folder, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
