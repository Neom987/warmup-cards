const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const SHOTS = path.join(__dirname, "..", "shots");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const URL = "file:///" + path.resolve(__dirname, "..", "index.html").replace(/\\/g, "/");

async function run(browser, w, h, tag) {
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
    /* 翻牌之后屏幕上的主操作是「各自选」那一行，#doneBtn 要到揭晓才出现，
       所以量 .acts 整体的下沿，才是「操作区有没有出屏」的答案。 */
    const a = document.querySelector(".acts").getBoundingClientRect();
    const chEl = document.getElementById("choose");
    const ch = chEl.getBoundingClientRect();
    const s = document.querySelector(".screen.on");
    const txt = document.getElementById("cText");
    return {
      screen: s.id,
      card: { top: Math.round(c.top), bottom: Math.round(c.bottom), h: Math.round(c.height) },
      act: { top: Math.round(a.top), bottom: Math.round(a.bottom) },
      choose: { w: Math.round(ch.width), h: Math.round(ch.height) },
      vh: window.innerHeight,
      cardVisible: c.top >= 0 && c.bottom <= window.innerHeight,
      actVisible: a.height > 0 && a.bottom <= window.innerHeight,
      chooseFits: ch.width > 0 && chEl.scrollWidth <= chEl.clientWidth + 1,
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
