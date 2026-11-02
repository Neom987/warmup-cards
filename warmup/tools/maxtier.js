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

  await page.goto(url, { waitUntil: "load" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "load" });
  await sleep(300);

  // 上限 1 档 + 无限抽
  await page.evaluate(() => {
    document.querySelectorAll("#segTier button")[0].click();
  });
  await sleep(200);
  await page.evaluate(() => {
    document.querySelectorAll("#segCount button")[3].click();
  });
  await sleep(200);
  await page.click("#agreeRow");
  await sleep(150);
  await page.click("#startBtn");
  await sleep(500);

  const subs = [];
  for (let i = 0; i < 13; i++) {
    const s = await page.evaluate(() => ({
      scr: document.querySelector(".screen.on").id,
      ov: document.getElementById("ovAct").classList.contains("on"),
      flip: document.getElementById("card").classList.contains("flip"),
      sub: document.getElementById("actSub").textContent,
      toast: document.getElementById("toast").textContent,
    }));
    if (s.scr !== "s-game") break;
    if (s.ov) { await page.click("#actOk"); await sleep(400); continue; }
    subs.push({ i, sub: s.sub, toast: s.toast });
    if (!s.flip) { await page.click("#card"); await sleep(320); }
    await advance(page);
    await sleep(300);
  }
  await shot("m01-maxtier.png");
  const hud = await page.evaluate(() => ({
    act: document.getElementById("actName").textContent,
    sub: document.getElementById("actSub").textContent,
    ladder: [...document.querySelectorAll("#ladder div")].map((d) => d.textContent + ":" + getComputedStyle(d).opacity),
    prog: document.getElementById("progBar").style.width,
  }));

  // 结束页
  await page.click("#pauseBtn");
  await sleep(350);
  await page.click("#quitBtn");
  await sleep(500);
  const end = await page.evaluate(() => ({
    done: document.getElementById("stDone").textContent,
    logNum: document.getElementById("logNum").textContent,
    rows: document.querySelectorAll("#logList .lrow").length,
    first: (document.querySelector("#logList .lrow") || {}).textContent,
  }));
  await shot("m02-end-log.png");

  console.log(JSON.stringify({ subs, hud, end, errs }, null, 2));
  await browser.close();
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
