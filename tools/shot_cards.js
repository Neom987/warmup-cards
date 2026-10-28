const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const SHOTS = path.join(__dirname, "..", "shots");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new", args: ["--allow-file-access-from-files", "--hide-scrollbars"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  const url = "file:///" + path.resolve(__dirname, "..", "情侣升温卡.html").replace(/\\/g, "/");

  await page.goto(url, { waitUntil: "load" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "load" });
  await sleep(300);

  // 选丝巾（道具卡会进池），上限 3 档，30 张
  await page.click("#advHead");
  await sleep(200);
  await page.evaluate(() => {
    const chips = [...document.querySelectorAll("#propChips .chip")];
    const c = chips.find((x) => x.textContent.includes("丝巾"));
    if (c) c.click();
  });
  await sleep(150);
  await page.click("#advHead");
  await sleep(150);
  await page.evaluate(() => document.querySelectorAll("#segTier button")[2].click());
  await sleep(120);
  await page.evaluate(() => document.querySelectorAll("#segCount button")[2].click());
  await sleep(120);
  await page.click("#agreeRow");
  await sleep(120);
  await page.click("#startBtn");
  await sleep(500);

  const found = { alt: false, prop: false, timer: false };
  const log = [];
  for (let i = 0; i < 40 && (!found.alt || !found.prop || !found.timer); i++) {
    const s = await page.evaluate(() => ({
      scr: document.querySelector(".screen.on").id,
      ov: document.getElementById("ovAct").classList.contains("on"),
      flip: document.getElementById("card").classList.contains("flip"),
    }));
    if (s.scr !== "s-game") break;
    if (s.ov) { await page.click("#actOk"); await sleep(400); continue; }
    if (!s.flip) { await page.click("#card"); await sleep(700); }
    const m = await page.evaluate(() => ({
      title: document.getElementById("cTitle").textContent,
      alt: !document.getElementById("cAlt").hidden,
      prop: !document.getElementById("cProp").hidden,
      timer: !document.getElementById("cTimer").hidden,
      tier: document.getElementById("cTierName").textContent,
      cat: document.getElementById("cCat").textContent,
    }));
    log.push(m);
    for (const k of ["alt", "prop", "timer"]) {
      if (m[k] && !found[k]) {
        found[k] = true;
        await page.screenshot({ path: path.join(SHOTS, `c-${k}.png`) });
      }
    }
    if (log.length <= 3) await page.screenshot({ path: path.join(SHOTS, `c-0${log.length}.png`) });
    await page.click("#doneBtn");
    await sleep(320);
  }
  console.log(JSON.stringify({ found, sample: log.slice(0, 6), errs }, null, 2));
  await browser.close();
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
