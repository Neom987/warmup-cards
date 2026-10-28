const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const SHOTS = path.join(__dirname, "..", "shots");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const URL = "file:///" + path.resolve(__dirname, "..", "情侣升温卡.html").replace(/\\/g, "/");

async function run(browser, w, h, tag) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(URL, { waitUntil: "load" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "load" });
  await sleep(400);

  // 设置页：开始按钮是否被遮挡 / 是否可见
  const setup = await page.evaluate(() => {
    const b = document.getElementById("startBtn").getBoundingClientRect();
    const foot = document.querySelector(".setupfoot") || document.querySelector(".footbar");
    return {
      btn: { top: Math.round(b.top), bottom: Math.round(b.bottom) },
      vh: window.innerHeight,
      footH: foot ? Math.round(foot.getBoundingClientRect().height) : null,
      inView: b.top >= 0 && b.bottom <= window.innerHeight,
    };
  });
  await page.screenshot({ path: path.join(SHOTS, "s-" + tag + "-setup.png") });

  await page.evaluate(() => document.getElementById("agreeRow").click());
  await sleep(200);
  await page.evaluate(() => document.getElementById("startBtn").click());
  await sleep(400);
  await page.click("#card");
  await sleep(800);

  const game = await page.evaluate(() => {
    const c = document.getElementById("card").getBoundingClientRect();
    const d = document.getElementById("doneBtn").getBoundingClientRect();
    const s = document.querySelector(".screen.on");
    const txt = document.getElementById("cText");
    return {
      screen: s.id,
      card: { top: Math.round(c.top), bottom: Math.round(c.bottom), h: Math.round(c.height) },
      done: { top: Math.round(d.top), bottom: Math.round(d.bottom) },
      vh: window.innerHeight,
      cardVisible: c.top >= 0 && c.bottom <= window.innerHeight,
      doneVisible: d.bottom <= window.innerHeight,
      textOverflow: txt.scrollHeight > txt.clientHeight + 2,
      scrollH: s.scrollHeight,
    };
  });
  await page.screenshot({ path: path.join(SHOTS, "s-" + tag + "-game.png") });
  await page.close();
  return { tag, setup, game, errs };
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: EDGE, headless: "new",
    args: ["--allow-file-access-from-files", "--hide-scrollbars"],
  });
  const out = [];
  out.push(await run(browser, 360, 640, "360x640"));
  out.push(await run(browser, 320, 568, "320x568"));
  out.push(await run(browser, 430, 932, "430x932"));
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
