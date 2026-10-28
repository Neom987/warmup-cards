const puppeteer = require("puppeteer-core");
const path = require("path");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.launch({
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    headless: "new",
    args: ["--allow-file-access-from-files", "--hide-scrollbars"],
  });
  const p = await b.newPage();
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("file:///" + path.resolve(__dirname, "..", "情侣升温卡.html").replace(/\\/g, "/"), { waitUntil: "load" });
  await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: "load" });
  await sleep(300);
  await p.click("#agreeRow");
  await sleep(150);
  await p.click("#startBtn");
  await sleep(400);

  // 找到一张带计时的卡
  const first = await p.evaluate(() => ({
    screen: document.querySelector(".screen.on").id,
    done: document.getElementById("doneBtn").disabled,
    flip: document.getElementById("card").classList.contains("flip"),
    box: (() => { const r = document.getElementById("card").getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })(),
  }));
  let found = false;
  for (let i = 0; i < 30; i++) {
    await p.click("#card");
    await sleep(200);
    const has = await p.evaluate(() => !document.getElementById("cTimer").hidden);
    if (has) { found = true; break; }
    await p.click("#doneBtn");
    await sleep(200);
  }

  let timerTap = null;
  if (found) {
    await p.evaluate(() => document.getElementById("cTimer").click());
    await sleep(400);
    timerTap = await p.evaluate(() => ({
      flipped: document.getElementById("card").classList.contains("flip"),
      running: document.getElementById("cTimer").classList.contains("run"),
      txt: document.getElementById("cTimer").textContent,
    }));
  }

  // 拖拽中的视觉反馈
  const box = await (await p.$("#card")).boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await p.mouse.move(cx, cy);
  await p.mouse.down();
  for (let i = 1; i <= 5; i++) { await p.mouse.move(cx - (90 * i) / 5, cy); await sleep(20); }
  await sleep(120);
  const dragState = await p.evaluate(() => ({
    hint: document.getElementById("hint").textContent,
    color: document.getElementById("hint").style.color,
    transform: document.getElementById("swipe").style.transform,
  }));
  await p.screenshot({ path: path.join(__dirname, "..", "shots", "f12-drag.png") });
  await p.mouse.up();
  await sleep(500);

  const afterSwipe = await p.evaluate(() => ({
    skip: document.getElementById("skipBtn").textContent,
    screen: document.querySelector(".screen.on").id,
  }));

  console.log(JSON.stringify({ first, found, timerTap, dragState, afterSwipe, errs }, null, 2));
  await b.close();
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
