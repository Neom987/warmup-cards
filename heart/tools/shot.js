/* 用 CDP 驱动 headless Edge 截图 / 取文本。
   比 --screenshot 可靠：可以真正等待、点击、读计算样式。

   用法：
     node tools/shot.js --out shots/a.png --w 390 --h 844 --js "await sleep(400); await click('#kTheme')"
   页面里可用：sleep(ms) click(sel) q(sel) text(sel) css(sel,prop) shotless 返回值直接打印
*/
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const args = {};
process.argv.slice(2).forEach((a, i, arr) => {
  if (a.startsWith('--')) args[a.slice(2)] = (arr[i + 1] && !arr[i + 1].startsWith('--')) ? arr[i + 1] : true;
});

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9333 + (parseInt(process.env.SHOT_PORT || '0', 10) || 0);
const W = +(args.w || 390), H = +(args.h || 844);
const OUT = path.resolve(args.out || 'shots/shot.png');
const URL_ = args.url || 'index.html';
const JS = args.js || '';
const DPR = +(args.dpr || 2);

const profile = path.join(os.tmpdir(), 'cdp_' + process.pid);
const fileUrl = 'file:///' + path.resolve(__dirname, '..', URL_).replace(/\\/g, '/');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJson(u) {
  const r = await fetch(u);
  return r.json();
}

(async () => {
  const proc = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
    '--disable-extensions', '--disable-background-networking',
    '--force-prefers-reduced-motion',
    '--hide-scrollbars',
    '--user-data-dir=' + profile,
    '--window-size=' + W + ',' + H,
    '--remote-debugging-port=' + PORT,
    '--remote-allow-origins=*',
    'about:blank'
  ], { stdio: 'ignore' });

  let targets = null;
  for (let i = 0; i < 100; i++) {
    try { targets = await getJson('http://127.0.0.1:' + PORT + '/json/list'); if (targets.length) break; } catch (e) {}
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
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
    }
  };
  await new Promise(r => ws.onopen = r);

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DPR, mobile: false });

  const errs = [];
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.exceptionThrown') {
      errs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      errs.push(m.params.args.map(a => a.value || a.description).join(' '));
    }
  });

  await send('Page.navigate', { url: fileUrl });
  await sleep(700);

  if (JS) {
    const wrapped = `(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const q = s => document.querySelector(s);
      const click = s => { const e = typeof s === 'string' ? q(s) : s; if (!e) throw new Error('no el ' + s); e.click(); return e; };
      const text = s => { const e = q(s); return e ? e.textContent.trim().replace(/\\s+/g, ' ') : null; };
      const css = (s, p) => { const e = q(s); return e ? getComputedStyle(e).getPropertyValue(p).trim() : null; };
      const rect = s => { const e = q(s); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; };
      const attr = s => document.documentElement.getAttribute(s);
      const hidden = s => { const e = q(s); return e ? e.hidden : null; };
      const ret = await (async () => { ${JS} })();
      return JSON.stringify(ret === undefined ? null : ret);
    })()`;
    const r = await send('Runtime.evaluate', { expression: wrapped, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) errs.push(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    else console.log('js =>', r.result.value);
  }

  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, Buffer.from(shot.data, 'base64'));
  console.log('saved =>', OUT);
  if (errs.length) console.log('errors =>', JSON.stringify(errs, null, 1));

  /* 干净收尾：先让浏览器自己关，再按进程树兜底。
     只 proc.kill() 是不够的——Windows 上它只杀 node spawn 出来的那一个进程，
     Chromium 的子进程可能活下来，于是 Alt+Tab 里留下一个标题为页面 <title>
     （本应用是「读书笔记」）的僵尸窗口：切不过去，也关不掉。 */
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
