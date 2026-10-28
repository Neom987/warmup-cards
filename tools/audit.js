const puppeteer = require("puppeteer-core");
const path = require("path");
const KEY = "csc" + ".v3";
(async () => {
  const b = await puppeteer.launch({
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    headless: "new",
    args: ["--allow-file-access-from-files", "--hide-scrollbars"],
  });
  const p = await b.newPage();
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("file:///" + path.resolve(__dirname, "..", "情侣升温卡.html").replace(/\\/g, "/"), { waitUntil: "load" });
  await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: "load" });
  await new Promise((r) => setTimeout(r, 300));

  const info = await p.evaluate(() => {
    const D = window.__DATA__;
    const lens = D.cards.map((c) => c.text.length).sort((a, b) => b - a);
    const longest = D.cards.slice().sort((a, b) => b.text.length - a.text.length)[0];
    return {
      total: D.cards.length,
      maxLen: lens[0],
      median: lens[Math.floor(lens.length / 2)],
      longestTitle: longest.title,
      longestText: longest.text,
      withProps: D.cards.filter((c) => c.props).length,
      withAlt: D.cards.filter((c) => c.alt).length,
      withDur: D.cards.filter((c) => c.dur).length,
      perTier: [1, 2, 3].map((t) => D.cards.filter((c) => c.tier === t).length),
    };
  });

  // 逐条点「不要」，记录可用数量
  const poolAfter = {};
  const rowCount = await p.evaluate(() => document.querySelectorAll(".brow").length);
  for (let i = 0; i < rowCount; i++) {
    await p.evaluate((idx) => {
      document.querySelectorAll(".brow")[idx].querySelectorAll(".tri button")[2].click();
    }, i);
    await new Promise((r) => setTimeout(r, 150));
    poolAfter["row" + i] = await p.evaluate(() => document.getElementById("poolInfo").textContent);
  }
  await p.screenshot({ path: path.join(__dirname, "..", "shots", "10-all-no.png") });

  // 全部恢复「看情况」
  await p.evaluate(() => {
    document.querySelectorAll(".brow").forEach((r) => r.querySelectorAll(".tri button")[1].click());
  });
  await new Promise((r) => setTimeout(r, 200));

  // 收藏一张，再看「只抽收藏」是否出现
  await p.evaluate(() => {
    document.getElementById("startBtn").click();
    document.getElementById("card").click();
    document.getElementById("favBtn").click();
  });
  await new Promise((r) => setTimeout(r, 300));
  const favs = await p.evaluate((k) => (JSON.parse(localStorage.getItem(k) || "{}").favs || []).length, KEY);

  // 渲染最长的一张，检查是否溢出
  await p.evaluate(() => {
    const D = window.__DATA__;
    const longest = D.cards.slice().sort((a, b) => b.text.length - a.text.length)[0];
    // 直接借用内部渲染：伪造一张
    const el = document.getElementById("cText");
    el.textContent = longest.text;
    document.getElementById("cTitle").textContent = longest.title;
  });
  await new Promise((r) => setTimeout(r, 200));
  const overflow = await p.evaluate(() => {
    const p2 = document.getElementById("cText");
    const card = document.querySelector(".face.front");
    return { textH: p2.scrollHeight, boxH: p2.clientHeight, cardH: card.clientHeight, clipped: p2.scrollHeight > p2.clientHeight + 2 };
  });
  await p.screenshot({ path: path.join(__dirname, "..", "shots", "11-longest.png") });

  console.log(JSON.stringify({ info, poolAfter, favs, overflow, errs }, null, 2));
  await b.close();
})();
