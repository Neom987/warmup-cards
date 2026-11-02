/* 回归：主流程（jsdom，不需要浏览器）
 *
 *   node tools/flow.js
 *
 * 为什么用 jsdom 而不是 puppeteer：这套断言只关心「点了以后状态对不对」，
 * 不关心像素，跑在 jsdom 里意味着没有 Edge 的机器上也能跑。
 * 布局相关的回归（溢出、小屏、字号）仍在 tools/overflow.js / fit.js 里，
 * 那些必须真浏览器 + Edge。
 *
 * 覆盖：设置页 → 六种玩法各自能开局 → 翻牌 → 做完 / 跳过 / 升降档 / 撤销
 *       → 收藏 → 暂停继续 → 结束页 → 全程无未捕获异常。
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const HTML = fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let fails = 0;
function ok(name, cond, extra) {
  if (cond) console.log("  ✓ " + name);
  else { fails++; console.log("  ✗ " + name + (extra !== undefined ? "  → " + extra : "")); }
}

async function boot() {
  const dom = new JSDOM(HTML, {
    url: "http://localhost/", runScripts: "dangerously", pretendToBeVisual: true,
  });
  const { window } = dom;
  window.navigator.vibrate = () => true;
  const errs = [];
  window.addEventListener("error", (e) => errs.push(e.message));
  await sleep(120);

  const $ = (s) => window.document.querySelector(s);
  const $$ = (s) => [...window.document.querySelectorAll(s)];
  /* 翻牌走的是 pointerdown/pointerup，不是 click */
  const tap = (el) => {
    if (!el) throw new Error("tap: 元素不存在");
    for (const t of ["pointerdown", "pointerup"]) {
      el.dispatchEvent(new window.MouseEvent(t, { bubbles: true, clientX: 100, clientY: 400 }));
    }
  };
  const on = (s) => { const e = $(s); return !!e && e.classList.contains("on"); };
  const txt = (s) => ($(s) ? $(s).textContent.trim() : "");
  return { window, $, $$, tap, on, txt, errs, close: () => dom.window.close() };
}

async function startGame(h, modeIdx, tierIdx) {
  h.$("#agreeRow").click();
  await sleep(20);
  h.$$("#modeChips .chip")[modeIdx].click();
  await sleep(20);
  if (tierIdx !== undefined) { h.$$("#segTier button")[tierIdx].click(); await sleep(20); }
  h.$("#startBtn").click();
  await sleep(120);
}

(async () => {
  /* ---------- 设置页 ---------- */
  console.log("\n[设置页]");
  let h = await boot();
  const modes = h.$$("#modeChips .chip").map((e) => e.textContent.trim());
  ok("六个玩法", modes.length === 6, modes.join(" / "));
  ok("温度三档", h.$$("#segTier button").length === 3);
  ok("抽卡数四个选项", h.$$("#segCount button").length === 4);
  ok("可用卡数 615", h.txt("#poolInfo").includes("615"), h.txt("#poolInfo"));
  ok("温度上限右侧有数字", /3 \/ 3 档/.test(h.txt("#tierCount")), h.txt("#tierCount"));
  ok("未勾协议时按钮是提示文案", h.txt("#startBtn").includes("先勾选"));
  h.close();

  /* ---------- 经典 ---------- */
  console.log("\n[经典：翻牌 / 做完 / 撤销]");
  h = await boot();
  await startGame(h, 0);
  ok("进入抽卡页", h.on("#s-game"));
  const t0 = h.txt("#actSub");
  ok("未翻牌时「做完」是禁用的", h.$("#doneBtn").disabled);
  h.tap(h.$("#card"));
  await sleep(80);
  ok("翻牌后「做完」可用", !h.$("#doneBtn").disabled);
  h.$("#doneBtn").click();
  await sleep(200);
  ok("做完后进度前进", h.txt("#actSub") !== t0, t0 + " → " + h.txt("#actSub"));
  ok("出现撤销按钮", !h.$("#undoBtn").hidden);
  h.$("#undoBtn").click();
  await sleep(150);
  ok("撤销回到起点", h.txt("#actSub") === t0, h.txt("#actSub"));

  /* ---------- 跳过 ---------- */
  console.log("\n[跳过]");
  h.tap(h.$("#card"));
  await sleep(80);
  const s0 = h.txt("#skipBtn");
  h.$("#skipBtn").click();
  await sleep(200);
  ok("跳过次数递减", h.txt("#skipBtn") !== s0, s0 + " → " + h.txt("#skipBtn"));
  h.close();

  /* ---------- 升降档 ---------- */
  console.log("\n[升档 / 降档]");
  h = await boot();
  await startGame(h, 0, 1);
  h.tap(h.$("#card"));
  await sleep(80);
  h.$("#upBtn").click();
  await sleep(300);
  ok("升档后到第二幕", h.txt("#actName").includes("第二幕"), h.txt("#actName"));
  h.tap(h.$("#card"));
  await sleep(80);
  h.$("#downBtn").click();
  await sleep(200);
  ok("降档只换卡不改档", h.txt("#actName").includes("第二幕"), h.txt("#actName"));
  h.close();

  /* ---------- 三选一 ---------- */
  console.log("\n[三选一]");
  h = await boot();
  await startGame(h, 2);
  await sleep(200);
  ok("弹出三选一", h.on("#ovPick"));
  const pk = h.$$("#pickRow .pk");
  ok("三个选项", pk.length === 3, pk.length + " 个");
  if (pk.length) pk[0].click();
  await sleep(200);
  ok("选完收起", !h.on("#ovPick"));
  ok("选完有牌面", h.txt("#cCat") !== "");
  h.close();

  /* ---------- 掷骰 ---------- */
  console.log("\n[掷骰]");
  h = await boot();
  await startGame(h, 3);
  await sleep(150);
  ok("弹出掷骰", h.on("#ovDice"));
  await sleep(2100);
  ok("掷骰结束收起", !h.on("#ovDice"));
  ok("骰面落在类别上", ["语", "眼", "触", "景", "真", "令"].includes(h.txt("#diceFace")), h.txt("#diceFace"));
  h.close();

  /* ---------- 限时 ---------- */
  console.log("\n[限时]");
  h = await boot();
  await startGame(h, 4);
  await sleep(200);
  ok("标签变成「限时多久」", h.txt("#countLabel").includes("限时"), h.txt("#countLabel"));
  ok("显示倒计时", /\d+:\d\d/.test(h.txt("#actSub")), h.txt("#actSub"));
  h.close();

  /* ---------- 言语局 ---------- */
  console.log("\n[言语局]");
  h = await boot();
  await startGame(h, 5, 2);
  const seen = [];
  for (let i = 0; i < 8; i++) {
    h.tap(h.$("#card"));
    await sleep(60);
    seen.push(h.txt("#cCat"));
    h.$("#doneBtn").click();
    await sleep(150);
  }
  const bad = seen.filter((c) => !["语言撩拨", "距离眼神", "真心话"].includes(c));
  ok("只出语言/眼神/真心话", bad.length === 0, seen.join("/"));

  /* ---------- 暂停 / 继续 ---------- */
  console.log("\n[暂停 / 继续]");
  h.$("#pauseBtn").click();
  await sleep(200);
  ok("暂停浮层出现", h.on("#ovPause"));
  h.$("#resumeBtn2").click();
  await sleep(200);
  ok("继续后收起", !h.on("#ovPause"));

  /* ---------- 收藏 ---------- */
  console.log("\n[收藏]");
  h.tap(h.$("#card"));
  await sleep(80);
  const fav0 = h.txt("#favBtn");
  h.$("#favBtn").click();
  await sleep(60);
  ok("收藏按钮变成实心", h.txt("#favBtn") !== fav0, fav0 + " → " + h.txt("#favBtn"));

  /* ---------- 视觉：房间跟着卡换色（v5 的签名） ---------- */
  console.log("\n[视觉：房间跟着卡换色]");
  h = await boot();
  ok("环境光与卡片背后的凝胶光都在", !!h.$("#aura") && !!h.$("#glow"));
  ok("牌背转盘 / 牌面色签 / 档位药丸都在", !!h.$(".disc") && !!h.$(".ctab") && !!h.$(".tierpill"));
  await startGame(h, 0);
  const body = h.window.document.body;
  const c1 = body.style.getPropertyValue("--cc");
  ok("类别色写进 --cc", /^#[0-9a-f]{6}$/i.test(c1), c1);
  ok("第二凝胶色与主色不同", body.style.getPropertyValue("--g2") !== c1, body.style.getPropertyValue("--g2"));
  ok("字色按对比度选（深/浅二选一）", /^#(2a0f1a|fff6ef)$/i.test(body.style.getPropertyValue("--cc-ink")), body.style.getPropertyValue("--cc-ink"));
  ok("凝胶光已着色", h.$("#glow").style.backgroundColor !== "", h.$("#glow").style.backgroundColor);
  ok("档位写进 data-tier", body.dataset.tier === "1", body.dataset.tier);
  const shades = new Set([c1]);
  for (let i = 0; i < 6; i++) {
    h.tap(h.$("#card"));
    await sleep(50);
    h.$("#doneBtn").click();
    await sleep(130);
    shades.add(body.style.getPropertyValue("--cc"));
  }
  ok("换卡时房间真的换色", shades.size > 1, [...shades].join(" "));
  h.close();

  /* ---------- 结束页 ---------- */
  console.log("\n[结束页]");
  if (h.$("#quitBtn")) h.$("#quitBtn").click();
  await sleep(300);
  ok("退出后离开抽卡页", h.on("#s-end") || h.on("#s-setup"), h.on("#s-end") ? "s-end" : "s-setup");

  console.log("\n[运行时报错]");
  ok("无未捕获异常", h.errs.length === 0, h.errs.slice(0, 3).join(" | "));
  h.close();

  console.log(fails === 0 ? "\n✓ 主流程回归通过" : `\n✗ ${fails} 项失败`);
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error("测试脚本异常:", e); process.exit(1); });
