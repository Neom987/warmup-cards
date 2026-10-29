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
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });

  const url = "file:///" + path.resolve(__dirname, "..", "index.html").replace(/\\/g, "/");
  const shot = (n) => page.screenshot({ path: path.join(SHOTS, n) });
  const st = () => page.evaluate(() => ({
    screen: document.querySelector(".screen.on").id,
    act: document.getElementById("actName").textContent,
    sub: document.getElementById("actSub").textContent,
    done: document.getElementById("doneBtn").disabled,
    skipTxt: document.getElementById("skipBtn").textContent,
    skipDis: document.getElementById("skipBtn").disabled,
    downDis: document.getElementById("downBtn").disabled,
    undoHidden: document.getElementById("undoBtn").hidden,
    hint: document.getElementById("hint").textContent,
    flipped: document.getElementById("card").classList.contains("flip"),
    actOv: document.getElementById("ovAct").classList.contains("on"),
    toast: document.getElementById("toast").textContent,
    title: document.getElementById("cTitle").textContent,
  }));
  const tapCard = async () => { await page.click("#card"); await sleep(750); };
  const swipe = async (dx, dy) => {
    const box = await (await page.$("#card")).boundingBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) { await page.mouse.move(cx + (dx * i) / 6, cy + (dy * i) / 6); await sleep(16); }
    await page.mouse.up();
    await sleep(500);
  };

  await page.goto(url, { waitUntil: "load" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "load" });
  await sleep(400);

  // 1. 开始按钮是否在首屏可见
  const btnBox = await page.evaluate(() => {
    const r = document.getElementById("startBtn").getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: window.innerHeight };
  });
  await shot("f01-setup.png");

  // 2. 未勾选 → 开始按钮禁用且文案提示
  const beforeAgree = await page.evaluate(() => { const b = document.getElementById("startBtn"); return { muted: b.classList.contains("muted"), txt: b.textContent }; });
  await page.click("#agreeRow");
  await sleep(200);
  await page.click("#startBtn");
  await sleep(400);
  const s1 = await st();
  await shot("f02-game-disabled.png");

  // 3. 点击翻牌 → 按钮启用
  await tapCard();
  const s2 = await st();
  await shot("f03-flipped.png");

  // 4. 右滑完成
  await swipe(140, 0);
  const s3 = await st();
  await shot("f04-after-right-swipe.png");

  // 5. 上滑翻牌 + 左滑跳过 + 撤销
  await swipe(0, -120);
  const s4 = await st();
  await swipe(-140, 0);
  const s5 = await st();
  const undoBtnInToast = await page.evaluate(() => {
    const b = document.querySelector("#toast button");
    if (!b) return false;
    b.click();
    return true;
  });
  await sleep(400);
  const s6 = await st();
  await shot("f05-skip-undo.png");

  // 6. 完成一张后撤回
  await tapCard();
  await page.click("#doneBtn");
  await sleep(600);
  const s7 = await st();
  await page.click("#undoBtn");
  await sleep(500);
  const s8 = await st();
  await shot("f06-undo.png");

  // 7. 连做 10 张触发升档过渡
  for (let i = 0; i < 12; i++) {
    const s = await page.evaluate(() => ({
      scr: document.querySelector(".screen.on").id,
      ov: document.getElementById("ovAct").classList.contains("on"),
      flip: document.getElementById("card").classList.contains("flip"),
    }));
    if (s.scr !== "s-game" || s.ov) break;
    if (!s.flip) { await page.click("#card"); await sleep(260); }
    await page.click("#doneBtn");
    await sleep(260);
  }
  await sleep(700);
  const s9 = await st();
  await shot("f07-act-overlay.png");
  await page.click("#actOk");
  await sleep(600);
  const s10 = await st();
  await shot("f08-after-act.png");

  // 8. 刷新 → 继续上一局
  await page.reload({ waitUntil: "load" });
  await sleep(400);
  const resumeVisible = await page.evaluate(() => !document.getElementById("resumeBtn").hidden);
  await shot("f09-setup-resume.png");
  await page.click("#resumeBtn");
  await sleep(500);
  const s11 = await st();
  await shot("f10-resumed.png");

  // 9. 档位 1 点降档 → 提示而非死按钮
  await page.evaluate(() => {
    const o = JSON.parse(localStorage.getItem("csc.v3.game"));
    o.tier = 1; localStorage.setItem("csc.v3.game", JSON.stringify(o));
  });
  await page.reload({ waitUntil: "load" });
  await sleep(300);
  await page.click("#resumeBtn");
  await sleep(400);
  const preDown = await page.evaluate(() => {
    const r = document.getElementById("card").getBoundingClientRect();
    return { screen: document.querySelector(".screen.on").id, box: {w: Math.round(r.width), h: Math.round(r.height), t: Math.round(r.top)}, ovAct: document.getElementById("ovAct").classList.contains("on"), ovPause: document.getElementById("ovPause").classList.contains("on") };
  });
  await page.click("#card");
  await sleep(700);
  await page.click("#downBtn");
  await sleep(300);
  const s12 = await st();

  // 10. 结束屏
  await page.click("#pauseBtn");
  await sleep(400);
  const paused = await page.evaluate(() => document.getElementById("ovPause").classList.contains("on"));
  await shot("f11a-pause.png");
  if (paused) { await page.click("#quitBtn"); await sleep(400); }
  const s13 = await st();
  await shot("f11-end.png");

  console.log(JSON.stringify({ preDown, btnBox, beforeAgree, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, resumeVisible, s11, s12, paused, s13, errs }, null, 2));
  await browser.close();
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
