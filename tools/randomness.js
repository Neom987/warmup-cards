const puppeteer = require("puppeteer-core");
const path = require("path");

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const KEY = "csc.v3";
const GKEY = "csc.v3.game";

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new", args: ["--allow-file-access-from-files"] });
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
  const url = "file:///" + path.resolve(__dirname, "..", "index.html").replace(/\\/g, "/");

  await page.goto(url, { waitUntil: "load" });
  await page.evaluate((k, g) => { localStorage.clear(); }, KEY, GKEY);
  await page.reload({ waitUntil: "load" });
  await sleep(300);

  // 预先勾好同意，避免每局都要点
  await page.evaluate((k) => {
    localStorage.setItem(k, JSON.stringify({ agree: true, maxTier: 3, props: [], bounds: {}, names: ["", ""], history: [], favs: [] }));
  }, KEY);
  await page.reload({ waitUntil: "load" });
  await sleep(300);

  const runs = [];
  for (let g = 0; g < 4; g++) {
    await page.evaluate(() => document.getElementById("startBtn").click());
    await sleep(350);
    const seq = [];
    for (let i = 0; i < 6; i++) {
      const s = await page.evaluate(() => ({
        scr: document.querySelector(".screen.on").id,
        ov: document.getElementById("ovAct").classList.contains("on"),
        flip: document.getElementById("card").classList.contains("flip"),
        title: document.getElementById("cTitle").textContent,
        cat: document.getElementById("cCat").textContent,
      }));
      if (s.scr !== "s-game") break;
      if (s.ov) { await page.evaluate(() => document.getElementById("actOk").click()); await sleep(300); continue; }
      if (!s.flip) { await page.click("#card"); await sleep(400); }
      seq.push(s.cat + ":" + s.title);
      await page.evaluate(() => document.getElementById("doneBtn").click());
      await sleep(280);
    }
    runs.push(seq);
    // 结束本局
    await page.evaluate(() => document.getElementById("pauseBtn").click());
    await sleep(250);
    await page.evaluate(() => document.getElementById("quitBtn").click());
    await sleep(350);
    await page.evaluate(() => document.getElementById("backBtn").click());
    await sleep(300);
  }

  // 跨局重合度
  const sets = runs.map((r) => new Set(r));
  const overlap = [];
  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      overlap.push([...sets[j]].filter((x) => sets[i].has(x)).length);
    }
  }
  // 同局内连续同类别的次数
  const streak = runs.map((r) => {
    let n = 0;
    for (let i = 1; i < r.length; i++) if (r[i].split(":")[0] === r[i - 1].split(":")[0]) n++;
    return n;
  });

  console.log(JSON.stringify({ runs, overlap, streak }, null, 2));
  await browser.close();
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
