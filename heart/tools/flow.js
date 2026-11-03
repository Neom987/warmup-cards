/* jsdom 流程回归：待机 → 校准 → 抽牌 → 作答 → 跳过 → 报告 → 暗夜 → 牌库记忆 → 一直抽 */
const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs");
const http = require("http");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let fails = 0;
function ok(name, cond, extra) {
  console.log((cond ? "  ok  " : "  FAIL") + "  " + name + (cond || !extra ? "" : "  → " + extra));
  if (!cond) fails++;
}

/* file:// 在 jsdom 里是 opaque origin，localStorage 会抛错；起个临时 http 服务来跑 */
const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json" };
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split("?")[0]);
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
      res.end(fs.readFileSync(file));
    });
    srv.listen(0, "127.0.0.1", () => resolve(srv));
  });
}

(async () => {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => {
    if (/Not implemented: HTMLCanvasElement/.test(e.message)) return;
    errors.push("jsdomError: " + e.message);
  });
  vc.on("error", (...a) => errors.push("console.error: " + a.join(" ")));

  const srv = await serve();
  const origin = "http://127.0.0.1:" + srv.address().port;

  const dom = await JSDOM.fromURL(origin + "/index.html", {
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    virtualConsole: vc,
  });

  const { window } = dom;
  const doc = window.document;
  const $ = (s) => doc.querySelector(s);
  const click = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  const seen = () => JSON.parse(window.localStorage.getItem("hb_seen") || "[]");

  await new Promise((r) => (doc.readyState === "complete" ? r() : window.addEventListener("load", r)));
  await sleep(400);

  ok("牌库载入 92 张", window.CARDS && window.CARDS.length === 92, window.CARDS && window.CARDS.length);
  ok("chroma 可用", typeof window.chroma === "function");
  ok("anime 可用", typeof window.anime === "function");
  ok("待机页可见", $("#startLayer").hidden === false);
  ok("牌库初始满仓", $("#poolInfo").textContent.trim() === "92 / 92 张未抽", $("#poolInfo").textContent);
  ok("牌库满时隐藏重置", $("#kReset").hidden === true);

  /* --- 暗夜模式 --- */
  ok("默认日间", doc.documentElement.getAttribute("data-theme") === "day");
  click($("#kTheme"));
  await sleep(150);
  ok("切到暗夜", doc.documentElement.getAttribute("data-theme") === "night");
  ok("暗夜时按钮显示「日」", $("#kTheme").textContent === "日", $("#kTheme").textContent);
  ok("暗夜已记住", window.localStorage.getItem("hb_theme") === "night");
  click($("#kTheme"));
  await sleep(150);
  ok("切回日间", doc.documentElement.getAttribute("data-theme") === "day");

  /* --- 第一局：24 张 --- */
  const seg = doc.querySelectorAll("#segTotal button");
  click(seg[1]);
  ok("张数切到 24", seg[1].classList.contains("on") && !seg[0].classList.contains("on"));

  $("#nameA").value = "阿哲";
  $("#nameB").value = "小林";
  click($("#kStart"));
  await sleep(2400);

  ok("校准后待机页收起", $("#startLayer").hidden === true);
  ok("第一张已出", !!$(".statement") && $(".statement").textContent.length > 10);
  ok("进度 01 / 24", $("#prog").textContent.trim() === "01 / 24", $("#prog").textContent);
  ok("日间没有结束键", $("#kEnd").hidden === true);
  ok("抽一张即计入牌库", seen().length === 1, seen().length);

  const round1 = [$(".statement").textContent];

  await sleep(200);
  click($("#kAnswer"));
  await sleep(950);
  ok("作答后进入第 2 张", $("#prog").textContent.trim() === "02 / 24", $("#prog").textContent);

  click($("#kSkip"));
  await sleep(200);
  ok("跳过进入第 3 张", $("#prog").textContent.trim() === "03 / 24", $("#prog").textContent);

  for (let i = 0; i < 40; i++) {
    if ($("#reportLayer").hidden === false) break;
    if ($(".statement")) round1.push($(".statement").textContent);
    click($("#kAnswer"));
    await sleep(820);
  }
  await sleep(900);

  ok("报告页出现", $("#reportLayer").hidden === false);
  ok("回答数 = 23", $("#rAns").textContent === "23", $("#rAns").textContent);
  ok("跳过数 = 1", $("#rSkip").textContent === "1", $("#rSkip").textContent);
  ok("张力有读数", /^\d\.\d\d$/.test($("#rTension").textContent), $("#rTension").textContent);
  ok("最长犹豫有读数", /\ds$/.test($("#rPeak").textContent), $("#rPeak").textContent);
  ok("编号已写入", /^CASE \d{4}$/.test($("#rCase").textContent), $("#rCase").textContent);
  ok("牌库已记下 24 张", seen().length === 24, seen().length);

  /* --- 再测一局：不应出现刚抽过的牌 --- */
  click($("#kAgain"));
  await sleep(900);
  ok("再测一局回到牌桌", $("#reportLayer").hidden === true && $("#prog").textContent.trim() === "01 / 24", $("#prog").textContent);

  const round2 = [];
  for (let i = 0; i < 24; i++) {
    if ($("#reportLayer").hidden === false) break;
    if ($(".statement")) round2.push($(".statement").textContent);
    click($("#kAnswer"));
    await sleep(820);
  }
  await sleep(900);

  const overlap = round2.filter((t) => round1.indexOf(t) >= 0);
  ok("第二局没有重复牌", overlap.length === 0, overlap.join(" / "));
  ok("牌库累计 48 张", seen().length === 48, seen().length);

  /* --- 一直抽 --- */
  click($("#kSetup"));
  await sleep(200);
  ok("改设置能回待机页", $("#startLayer").hidden === false);
  ok("牌库读数更新", $("#poolInfo").textContent.trim() === "44 / 92 张未抽", $("#poolInfo").textContent);
  ok("有抽过就显示重置", $("#kReset").hidden === false);

  const seg2 = doc.querySelectorAll("#segTotal button");
  click(seg2[3]);
  ok("选中一直抽", seg2[3].classList.contains("on"));
  click($("#kStart"));
  await sleep(2400);

  ok("一直抽显示不限", /^\d\d · 不限$/.test($("#prog").textContent.trim()), $("#prog").textContent);
  ok("一直抽出现结束键", $("#kEnd").hidden === false);

  for (let i = 0; i < 6; i++) { click($("#kAnswer")); await sleep(820); }
  ok("一直抽计数在涨", /^07 · 不限$/.test($("#prog").textContent.trim()), $("#prog").textContent);

  click($("#kEnd"));
  await sleep(900);
  ok("结束键能收局", $("#reportLayer").hidden === false);

  /* --- 重置牌库 --- */
  click($("#kSetup"));
  await sleep(200);
  click($("#kReset"));
  await sleep(150);
  ok("重置后牌库满仓", $("#poolInfo").textContent.trim() === "92 / 92 张未抽", $("#poolInfo").textContent);
  ok("重置后隐藏重置按钮", $("#kReset").hidden === true);

  ok("无未捕获异常", errors.length === 0, errors.join(" | "));

  console.log(fails ? `\n${fails} 条失败` : "\n全部通过");
  window.close();
  srv.close();
  process.exit(fails ? 1 : 0);
})();
