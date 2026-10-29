const puppeteer = require("puppeteer-core");
const path = require("path");
const { advance } = require("./_adv");
const fs = require("fs");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const SHOTS = path.join(__dirname, "..", "shots");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new", args: ["--allow-file-access-from-files", "--hide-scrollbars"] });
  const page = await browser.newPage();

  /* 规则卡「挑一张」会弹一个必须选的浮层。回归脚本不关心选哪张，
     所以每次点击前先把它选掉，否则会随机卡住后续步骤。 */
  const _click = page.click.bind(page);
  page.click = async (sel, ...rest) => {
    if (await page.evaluate(() => {
      const el = document.getElementById("ovPick");
      return !!el && el.classList.contains("on");
    })) {
      await page.evaluate(() => {
        const b = document.querySelector("#pickList button");
        if (b) b.click();
      });
      await new Promise((r) => setTimeout(r, 350));
    }
    return _click(sel, ...rest);
  };
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });

  const url = "file:///" + path.resolve(__dirname, "..", "index.html").replace(/\\/g, "/");
  const shot = (n) => page.screenshot({ path: path.join(SHOTS, n) });
  const out = {};

  await page.goto(url, { waitUntil: "load" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "load" });
  await sleep(400);

  // A. 折叠区默认收起 + 摘要
  out.collapsed = await page.evaluate(() => ({
    open: document.getElementById("advBody").classList.contains("on"),
    sum: document.getElementById("advSum").textContent,
    arrow: document.getElementById("advArrow").textContent,
    footTop: Math.round(document.getElementById("startBtn").getBoundingClientRect().top),
  }));
  await shot("u01-setup-collapsed.png");

  // B. 展开 → 勾一个道具 → 收起后摘要更新
  await page.click("#advHead");
  await sleep(250);
  out.expanded = await page.evaluate(() => ({
    open: document.getElementById("advBody").classList.contains("on"),
    arrow: document.getElementById("advArrow").textContent,
    chips: document.querySelectorAll("#propChips .chip").length,
    bounds: document.querySelectorAll("#bounds .brow").length,
  }));
  await shot("u02-setup-expanded.png");
  await page.evaluate(() => {
    const c = document.querySelectorAll("#propChips .chip")[0];
    if (c) c.click();
    const b = document.querySelectorAll("#bounds .brow")[1];
    if (b) b.querySelectorAll("button")[2].click();
  });
  await sleep(200);
  await page.click("#advHead");
  await sleep(200);
  out.sumAfter = await page.evaluate(() => document.getElementById("advSum").textContent);

  // C. 开局
  await page.click("#agreeRow");
  await sleep(120);
  await page.click("#startBtn");
  await sleep(500);

  // D. 亮度四档
  const brights = [];
  for (let i = 0; i < 4; i++) {
    brights.push(await page.evaluate(() => ({
      icon: document.getElementById("brightBtn").textContent,
      op: document.getElementById("veil").style.opacity,
      toast: document.getElementById("toast").textContent,
    })));
    await page.click("#brightBtn");
    await sleep(200);
  }
  out.brights = brights;
  await shot("u03-bright-dark.png");
  // 复位到亮
  await page.evaluate(() => { for (let i = 0; i < 4; i++) { if (document.getElementById("veil").style.opacity === "0") break; document.getElementById("brightBtn").click(); } });
  await sleep(200);

  // E. 字号三档
  await page.click("#pauseBtn");
  await sleep(450);
  out.pauseOpen = await page.evaluate(() => document.getElementById("ovPause").classList.contains("on"));
  await page.evaluate(() => document.querySelectorAll("#segFs button")[2].click());
  await sleep(200);
  out.fsLarge = await page.evaluate(() => ({
    body: document.body.className,
    segOn: document.querySelector("#segFs button.on").textContent,
    fs: getComputedStyle(document.getElementById("cText")).fontSize,
  }));
  await shot("u04-pause-fs.png");
  await page.evaluate(() => document.querySelectorAll("#segFs button")[0].click());
  await sleep(150);
  out.fsSmall = await page.evaluate(() => getComputedStyle(document.getElementById("cText")).fontSize);
  await page.evaluate(() => document.querySelectorAll("#segFs button")[1].click());
  await sleep(150);
  await page.click("#resumeBtn2");
  await sleep(400);

  // F. 计时卡：翻牌后自动开始
  let timerCard = null;
  for (let i = 0; i < 40; i++) {
    const s = await page.evaluate(() => ({
      scr: document.querySelector(".screen.on").id,
      ov: document.getElementById("ovAct").classList.contains("on"),
      flip: document.getElementById("card").classList.contains("flip"),
      timerHidden: document.getElementById("cTimer").hidden,
      title: document.getElementById("cTitle").textContent,
    }));
    if (s.scr !== "s-game") break;
    if (s.ov) { await page.click("#actOk"); await sleep(500); continue; }
    if (!s.flip) {
      await page.click("#card");
      await sleep(800);
      const t = await page.evaluate(() => ({
        hidden: document.getElementById("cTimer").hidden,
        txt: document.getElementById("cTimer").textContent,
        run: document.getElementById("cTimer").classList.contains("run"),
        title: document.getElementById("cTitle").textContent,
      }));
      if (!t.hidden) {
        const t2 = await page.evaluate(() => document.getElementById("cTimer").textContent);
        await sleep(1200);
        const t3 = await page.evaluate(() => document.getElementById("cTimer").textContent);
        timerCard = { title: t.title, afterFlip: t.txt, run: t.run, later: t2, after1s: t3 };
        await shot("u05-timer-autorun.png");
        break;
      }
    }
    await advance(page);
    await sleep(320);
  }
  out.timerCard = timerCard;

  // G. 刷新后亮度/字号/折叠态是否记住
  await page.reload({ waitUntil: "load" });
  await sleep(400);
  out.persist = await page.evaluate(() => ({
    bright: document.getElementById("brightBtn").textContent,
    op: document.getElementById("veil").style.opacity,
    body: document.body.className,
    advOpen: document.getElementById("advBody").classList.contains("on"),
    sum: document.getElementById("advSum").textContent,
  }));

  out.errs = errs;
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
