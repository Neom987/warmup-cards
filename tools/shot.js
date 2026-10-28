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
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", (e) => errs.push("PAGEERROR " + e.message + "\n" + (e.stack || "")));

  const url = "file:///" + path.resolve(__dirname, "..", "情侣升温卡.html").replace(/\\/g, "/");
  const tap = async (sel) => {
    await page.evaluate((s) => { const el = document.querySelector(s); if (!el) throw new Error("missing " + s); el.click(); }, sel);
    await sleep(180);
  };
  const shot = (n) => page.screenshot({ path: path.join(SHOTS, n) });

  await page.goto(url, { waitUntil: "load" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "load" });
  await sleep(400);
  await shot("01-setup.png");

  await tap("#agreeRow");
  await tap("#startBtn");
  await sleep(300);
  await shot("02-game-back.png");

  await tap("#card");
  await sleep(900);
  await shot("03-card-front.png");

  const s1 = await page.evaluate(() => ({
    screen: document.querySelector(".screen.on").id,
    act: document.getElementById("actName").textContent,
    sub: document.getElementById("actSub").textContent,
    cat: document.getElementById("cCat").textContent,
    text: document.getElementById("cText").textContent,
    flipped: document.getElementById("card").classList.contains("flip"),
  }));

  // 收藏 + 完成
  await tap("#favBtn");
  const favOn = await page.evaluate(() => document.getElementById("favBtn").classList.contains("on"));
  await tap("#doneBtn");
  await sleep(500);

  // 跳过
  await tap("#card");
  await sleep(700);
  await tap("#skipBtn");
  await sleep(400);
  const s2 = await page.evaluate(() => ({
    sub: document.getElementById("actSub").textContent,
    skip: document.getElementById("skipBtn").textContent,
    downDisabled: document.getElementById("downBtn").disabled,
  }));
  await shot("04-after-actions.png");

  // 长按暂停
  const box = await (await page.$("#pauseBtn")).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await sleep(1400);
  await page.mouse.up();
  await sleep(250);
  const pauseOpen = await page.evaluate(() => document.getElementById("ovPause").classList.contains("on"));
  await shot("05-pause.png");
  await tap("#resumeBtn");

  // 角色规则
  await tap("#roleBar");
  await sleep(200);
  await shot("06-role.png");
  await tap("#roleClose");

  // 强制升档测试：连续完成 10 张
  await page.evaluate(() => {
    for (let i = 0; i < 12; i++) {
      if (document.querySelector(".screen.on").id !== "s-game") break;
      const card = document.getElementById("card");
      if (!card.classList.contains("flip")) card.click();
      document.getElementById("doneBtn").click();
    }
  });
  await sleep(900);
  const s3 = await page.evaluate(() => ({
    act: document.getElementById("actName").textContent,
    sub: document.getElementById("actSub").textContent,
    screen: document.querySelector(".screen.on").id,
  }));
  await shot("07-tier-up.png");

  // 降一档（此时应在第二幕）
  const beforeDown = await page.evaluate(() => document.getElementById("cTitle").textContent);
  await tap("#downBtn");
  await sleep(400);
  const afterDown = await page.evaluate(() => ({
    title: document.getElementById("cTitle").textContent,
    toast: document.getElementById("toast").textContent,
  }));
  await shot("07b-downgrade.png");

  // 刷新持久化
  await page.reload({ waitUntil: "load" });
  await sleep(400);
  const persisted = await page.evaluate(() => {
    const o = JSON.parse(localStorage.getItem("csc.v3") || "{}");
    return { history: (o.history || []).length, favs: (o.favs || []).length, agree: !!o.agree };
  });
  await shot("08-reload.png");

  // 桌面
  await page.setViewport({ width: 1180, height: 820, deviceScaleFactor: 1 });
  await page.evaluate(() => { document.getElementById("startBtn").click(); });
  await sleep(400);
  await page.evaluate(() => { document.getElementById("card").click(); });
  await sleep(800);
  await shot("09-desktop.png");

  console.log(JSON.stringify({ s1, favOn, s2, pauseOpen, s3, beforeDown, afterDown, persisted, errs }, null, 2));
  await browser.close();
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
