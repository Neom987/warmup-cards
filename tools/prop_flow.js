const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const SHOTS = path.join(__dirname, "..", "shots");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: EDGE, headless: "new",
    args: ["--allow-file-access-from-files", "--hide-scrollbars"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = [];
  page.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });

  const url = "file:///" + path.resolve(__dirname, "..", "index.html").replace(/\\/g, "/");
  const shot = (n) => page.screenshot({ path: path.join(SHOTS, n) });
  const tap = async (sel) => {
    await page.evaluate((s) => { const el = document.querySelector(s); if (el) el.click(); }, sel);
    await sleep(200);
  };
  const state = () => page.evaluate(() => ({
    tier: document.getElementById("actName").textContent,
    sub: document.getElementById("actSub").textContent,
    prop: document.getElementById("cProp").hidden ? "" : document.getElementById("cProp").textContent,
    propMain: document.getElementById("cProp").classList.contains("main"),
    title: document.getElementById("cTitle").textContent,
    toast: document.getElementById("toast").textContent,
    actOv: document.getElementById("ovAct").classList.contains("on"),
    upDis: document.getElementById("upBtn").disabled,
  }));

  await page.goto(url, { waitUntil: "load" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "load" });
  await sleep(500);

  // 展开道具，勾选 震动棒 / 丝巾 / 镜子
  await tap("#advHead");
  await sleep(300);
  const picked = await page.evaluate(() => {
    const want = ["震动棒", "丝巾", "镜子", "蜡烛"];
    const got = [];
    document.querySelectorAll("#propChips .chip").forEach((c) => {
      const t = c.textContent || "";
      if (want.some((w) => t.indexOf(w) === 0)) { c.click(); got.push(t.split("\n")[0]); }
    });
    return got;
  });
  await sleep(300);
  await shot("p01-props-on.png");
  await tap("#advHead");
  await tap("#agreeRow");
  await tap("#startBtn");
  await sleep(600);

  const first = await state();

  // 连抽 14 张，记录道具卡出现的位置
  const seq = [];
  for (let i = 0; i < 14; i++) {
    const scr = await page.evaluate(() => document.querySelector(".screen.on").id);
    if (scr !== "s-game") break;
    const ov = await page.evaluate(() => document.getElementById("ovAct").classList.contains("on"));
    if (ov) { await tap("#actOk"); await sleep(400); }
    await page.click("#card");
    await sleep(700);
    const s = await state();
    seq.push({ i: i + 1, tier: s.tier.slice(0, 3), prop: s.prop, title: s.title });
    if (s.prop && !fs.existsSync(path.join(SHOTS, "p02-prop-card.png"))) {
      await shot("p02-prop-card.png");
    }
    await page.evaluate(() => document.getElementById("doneBtn").click());
    await sleep(260);
  }
  await sleep(400);

  // 手动升档
  const beforeUp = await state();
  const upOv0 = await page.evaluate(() => document.getElementById("ovAct").classList.contains("on"));
  if (upOv0) { await tap("#actOk"); await sleep(400); }
  await page.click("#card");
  await sleep(650);
  await tap("#upBtn");
  await sleep(500);
  const afterUp = await state();
  await shot("p03-manual-up.png");
  await tap("#actOk");
  await sleep(500);
  const afterUpOk = await state();

  // 暂停面板：主道具行
  await tap("#pauseBtn");
  await sleep(300);
  const pause = await page.evaluate(() => ({
    info: document.getElementById("pauseInfo").textContent,
    propHidden: document.getElementById("pausePropBox").hidden,
    prop: document.getElementById("pauseProp").textContent,
  }));
  await shot("p04-pause-prop.png");
  await tap("#resumeBtn2");

  console.log(JSON.stringify({ picked, first, seq, beforeUp, afterUp, afterUpOk, pause, errs }, null, 2));
  await browser.close();
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
