/* 诊断：在页面里按 Tab，看焦点落到哪些元素上、它们是否可见。
   用法：node tools/tabprobe.js [--url index.html] [--n 8]
*/
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const args = {};
process.argv.slice(2).forEach((a, i, arr) => {
  if (a.startsWith('--')) args[a.slice(2)] = (arr[i + 1] && !arr[i + 1].startsWith('--')) ? arr[i + 1] : true;
});

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9401;
const N = +(args.n || 8);
const URL_ = args.url || 'index.html';
const profile = path.join(os.tmpdir(), 'cdp_tab_' + process.pid);
const fileUrl = 'file:///' + path.resolve(__dirname, '..', URL_).replace(/\\/g, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const proc = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
    '--disable-extensions', '--disable-background-networking',
    '--force-prefers-reduced-motion', '--hide-scrollbars',
    '--user-data-dir=' + profile,
    '--window-size=390,844',
    '--remote-debugging-port=' + PORT,
    '--remote-allow-origins=*',
    'about:blank'
  ], { stdio: 'ignore' });

  let targets = null;
  for (let i = 0; i < 100; i++) {
    try { targets = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json(); if (targets.length) break; } catch (e) {}
    await sleep(150);
  }
  if (!targets || !targets.length) { console.error('CDP 未就绪'); proc.kill(); process.exit(1); }
  const page = targets.find(t => t.type === 'page') || targets[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params) => new Promise((res, rej) => {
    const mid = ++id;
    pending.set(mid, { res, rej });
    ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
  });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
    }
  };
  await new Promise(r => ws.onopen = r);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: fileUrl });
  await sleep(800);

  const probe = `(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return 'BODY';
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const layer = el.closest('.layer');
    return JSON.stringify({
      tag: el.tagName, id: el.id, cls: el.className,
      txt: (el.textContent || '').trim().slice(0, 12),
      rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      vis: cs.visibility, disp: cs.display, op: cs.opacity,
      inLayer: layer ? (layer.id + (layer.hidden ? '(hidden)' : '')) : '-'
    });
  })()`;

  const read = async () => {
    const r = await send('Runtime.evaluate', { expression: probe, returnByValue: true });
    return r.result.value;
  };

  console.log('初始焦点 =>', await read());
  for (let i = 1; i <= N; i++) {
    await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: 9, key: 'Tab', code: 'Tab' });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: 9, key: 'Tab', code: 'Tab' });
    await sleep(120);
    console.log('Tab#' + i + ' =>', await read());
  }

  /* 收尾同 shot.js：Browser.close + 进程树兜底，别在 Alt+Tab 里留僵尸窗口 */
  try { await send('Browser.close'); } catch (e) {}
  try { ws.close(); } catch (e) {}
  await sleep(300);
  try {
    if (process.platform === 'win32') {
      require('child_process').execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      proc.kill('SIGKILL');
    }
  } catch (e) {}
  await sleep(300);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  process.exit(0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
