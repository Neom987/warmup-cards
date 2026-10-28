const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const SHOTS = path.join(__dirname, "..", "shots");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: "new",
    args: ["--allow-file-access-from-files", "--hide-scrollbars"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = [];
  page.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });

  const url = "file:///" + path.resolve(__dirname, "..", "情侣升温卡.html").replace(/\\/g, "/");
  const tap = async (sel) => {
    await page.evaluate((s) => { const el = document.querySelector(s); if (!el) throw new Error("missing " + s); el.click(); }, sel);
    await sleep(220);
  };
  const tapCard = async () => { await page.click("#card"); await sleep(800); };
  const shot = (n) => page.screenshot({ path: path.join(SHOTS, n) });

  await page.goto(url, { waitUntil: "load" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "load" });
  await sleep(400);

  // 设置页：首屏
  await shot("v01-setup-top.png");
  // 设置页：展开道具与边界
  await tap("#advHead");
  await sleep(200);
  await page.evaluate(() => { const el = document.getElementById("advBody"); if (el) el.scrollIntoView({ block: "center" }); });
  await sleep(250);
  await shot("v02-setup-adv.png");
  // 设置页：滚到底
  await page.evaluate(() => { const s = document.querySelector(".screen.on"); s.scrollTop = s.scrollHeight; });
  await sleep(250);
  await shot("v03-setup-bottom.png");
  await tap("#advHead");

  // 开局：牌背
  await page.evaluate(() => { const s = document.querySelector(".screen.on"); s.scrollTop = 0; });
  await tap("#agreeRow");
  await tap("#startBtn");
  await sleep(400);
  await shot("v04-game-back.png");

  // 牌面
  await tapCard();
  await shot("v05-game-front.png");

  // 收藏态 + 跳过用尽态（连点 3 次跳过）
  await tap("#favBtn");
  for (let i = 0; i < 3; i++) {
    const fl = await page.evaluate(() => document.getElementById("card").classList.contains("flip"));
    if (!fl) await tapCard();
    await page.evaluate(() => { const b = document.getElementById("skipBtn"); if (!b.disabled) b.click(); });
    await sleep(400);
  }
  const fl2 = await page.evaluate(() => document.getElementById("card").classList.contains("flip"));
  if (!fl2) await tapCard();
  await shot("v06-game-states.png");

  // 升档浮层
  for (let i = 0; i < 12; i++) {
    const s = await page.evaluate(() => ({
      ov: document.getElementById("ovAct").classList.contains("on"),
      scr: document.querySelector(".screen.on").id,
      flip: document.getElementById("card").classList.contains("flip"),
    }));
    if (s.scr !== "s-game" || s.ov) break;
    if (!s.flip) { await page.click("#card"); await sleep(300); }
    await page.evaluate(() => document.getElementById("doneBtn").click());
    await sleep(260);
  }
  await sleep(600);
  await shot("v07-act.png");
  await tap("#actOk");
  await sleep(400);

  // 暂停浮层
  await tap("#pauseBtn");
  await sleep(300);
  await shot("v08-pause.png");
  await tap("#resumeBtn2");

  // 结束页
  await tap("#pauseBtn");
  await sleep(300);
  await tap("#quitBtn");
  await sleep(600);
  await shot("v09-end.png");

  // 桌面宽屏
  await page.setViewport({ width: 1280, height: 860, deviceScaleFactor: 1 });
  await page.reload({ waitUntil: "load" });
  await sleep(400);
  await shot("v10-desktop-setup.png");
  const agreed = await page.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => x.indexOf("v3") > -1 && x.indexOf("game") < 0);
    try { return !!(JSON.parse(localStorage.getItem(k) || "{}").agree); } catch (e) { return false; }
  });
  if (!agreed) await tap("#agreeRow");
  await tap("#startBtn");
  await sleep(400);
  const started = await page.evaluate(() => document.querySelector(".screen.on").id);
  if (started === "s-game") {
    await page.click("#card");
    await sleep(800);
  }
  await shot("v11-desktop-game.png");

  // 小屏 360x640 极窄
  await page.setViewport({ width: 360, height: 640, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await sleep(300);
  const fit = await page.evaluate(() => {
    const b = document.getElementById("doneBtn").getBoundingClientRect();
    const c = document.getElementById("card").getBoundingClientRect();
    return {
      doneBottom: Math.round(b.bottom), cardTop: Math.round(c.top), cardBottom: Math.round(c.bottom),
      vh: window.innerHeight, docH: document.documentElement.scrollHeight,
    };
  });
  await shot("v12-small-screen.png");

  console.log(JSON.stringify({ fit, errs }, null, 2));
  await browser.close();
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
