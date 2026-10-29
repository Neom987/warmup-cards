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

  const url = "file:///" + path.resolve(__dirname, "..", "index.html").replace(/\\/g, "/");
  await page.goto(url, { waitUntil: "load" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "load" });
  await sleep(300);

  // 最大字号 + 上限 3 档
  await page.evaluate(() => document.querySelectorAll("#segTier button")[2].click());
  await sleep(150);
  await page.evaluate(() => document.querySelectorAll("#segCount button")[3].click());
  await sleep(150);
  await page.click("#agreeRow");
  await sleep(150);
  await page.click("#startBtn");
  await sleep(400);
  await page.evaluate(() => { document.body.classList.remove("fs-s", "fs-m", "fs-l"); document.body.classList.add("fs-l"); });

  let worst = null, over = 0, seen = 0;
  for (let i = 0; i < 70; i++) {
    const s = await page.evaluate(() => ({
      scr: document.querySelector(".screen.on").id,
      ov: document.getElementById("ovAct").classList.contains("on"),
      flip: document.getElementById("card").classList.contains("flip"),
    }));
    if (s.scr !== "s-game") break;
    if (s.ov) { await page.click("#actOk"); await sleep(400); continue; }
    if (!s.flip) { await page.click("#card"); await sleep(300); }
    const m = await page.evaluate(() => {
      const p = document.getElementById("cText");
      const card = document.getElementById("card").getBoundingClientRect();
      return {
        title: document.getElementById("cTitle").textContent,
        len: p.textContent.length,
        sh: p.scrollHeight, ch: p.clientHeight,
        cardH: Math.round(card.height),
      };
    });
    seen++;
    if (m.sh > m.ch + 1) {
      over++;
      if (!worst || m.sh - m.ch > worst.sh - worst.ch) {
        worst = m;
        await page.screenshot({ path: path.join(SHOTS, "t01-overflow.png") });
      }
    }
    await page.click("#doneBtn");
    await sleep(260);
  }
  console.log(JSON.stringify({ seen, over, worst, errs }, null, 2));
  await browser.close();
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
