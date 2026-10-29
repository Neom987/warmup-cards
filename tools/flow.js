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
  const st = () => page.evaluate(() => {
    const vis = (id) => { const e = document.getElementById(id); return !!e && !e.hidden; };
    return {
      screen: document.querySelector(".screen.on").id,
      act: document.getElementById("actName").textContent,
      sub: document.getElementById("actSub").textContent,
      choose: vis("choose"),
      pass: vis("passGo"),
      passTxt: document.getElementById("passGo").textContent,
      doneBtn: vis("doneBtn"),
      downDis: document.getElementById("downBtn").disabled,
      undoHidden: document.getElementById("undoBtn").hidden,
      hint: document.getElementById("hint").textContent,
      flipped: document.getElementById("card").classList.contains("flip"),
      rev: document.getElementById("reveal").classList.contains("on"),
      rvrow: !document.querySelector("#reveal .rvrow").hidden,
      rvres: document.getElementById("rvRes").textContent,
      actOv: document.getElementById("ovAct").classList.contains("on"),
      toast: document.getElementById("toast").textContent,
      title: document.getElementById("cTitle").textContent,
    };
  });
  const tapCard = async () => { await page.click("#card"); await sleep(750); };
  const pick = async (v) => { await page.evaluate((vv) => document.querySelector('#choose [data-v="' + vv + '"]').click(), v); await sleep(320); };
  const doneN = async () => {
    const t = await page.evaluate(() => document.getElementById("actSub").textContent);
    const m = t.match(/进度\s*(\d+)/);
    return m ? +m[1] : -1;
  };
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

  // 3. 翻牌 → 出现「各自选」，而不是一个「做完了」
  await tapCard();
  const s2 = await st();
  await shot("f03-choose-a.png");

  // 4. A 选「做」→ 选择消失，只剩「递过去」，且不显示选了什么
  await pick("do");
  const s3 = await st();
  await shot("f04-pass.png");
  const leak = await page.evaluate(() => document.querySelector("#reveal .rvrow").offsetParent !== null && document.getElementById("reveal").classList.contains("on"));

  // 5. 递过去 → 又出现选择
  await page.click("#passGo");
  await sleep(300);
  const s4 = await st();
  await shot("f05-choose-b.png");

  // 6. B 选「做」→ 揭晓
  const n0 = await doneN();
  await pick("do");
  const s5 = await st();
  await shot("f06-reveal.png");
  const rv = await page.evaluate(() => ({
    a: document.getElementById("rvA").textContent,
    b: document.getElementById("rvB").textContent,
    an: document.getElementById("rvAName").textContent,
    bn: document.getElementById("rvBName").textContent,
  }));

  // 7. 下一张 → 回到未翻牌，完成数 +1
  await page.click("#doneBtn");
  await sleep(600);
  const s6 = await st();
  const n1 = await doneN();

  // 8. 有人选「不做」→ 不点名、不计入完成
  await tapCard();
  const n2 = await doneN();
  await pick("no");
  await page.click("#passGo");
  await sleep(260);
  await pick("do");
  const s7 = await st();
  const n3 = await doneN();
  await shot("f07-veto.png");
  await page.click("#doneBtn");
  await sleep(500);

  // 9. 都选「不做」→ 合拍，也不计入完成
  await tapCard();
  await pick("no");
  await page.click("#passGo");
  await sleep(260);
  await pick("no");
  const s8 = await st();
  await page.click("#doneBtn");
  await sleep(500);

  // 10. 完成一张后撤回
  await tapCard();
  await pick("do");
  await page.click("#passGo");
  await sleep(240);
  await pick("do");
  await page.click("#doneBtn");
  await sleep(600);
  const s9 = await st();
  await page.click("#undoBtn");
  await sleep(500);
  const s10 = await st();
  await shot("f08-undo.png");

  // 11. 左右滑不再改变任何状态（划走一张牌不再是单方面决定）
  await tapCard();
  const beforeSwipe = await st();
  await swipe(140, 0);
  const afterSwipe = await st();
  await swipe(-140, 0);
  const afterSwipe2 = await st();
  await shot("f09-swipe-inert.png");

  // 12. 连做 10 张触发升档过渡
  for (let i = 0; i < 14; i++) {
    const s = await page.evaluate(() => ({
      scr: document.querySelector(".screen.on").id,
      ov: document.getElementById("ovAct").classList.contains("on"),
      flip: document.getElementById("card").classList.contains("flip"),
    }));
    if (s.scr !== "s-game" || s.ov) break;
    if (!s.flip) { await page.click("#card"); await sleep(300); }
    await page.evaluate(() => {
      const $ = (id) => document.getElementById(id);
      const pick = (x) => { const b = document.querySelector('#choose [data-v="' + x + '"]'); if (b && !$("choose").hidden) b.click(); };
      pick("do");
      if (!$("passGo").hidden) $("passGo").click();
      pick("do");
      if (!$("doneBtn").hidden && !$("doneBtn").disabled) $("doneBtn").click();
    });
    await sleep(280);
  }
  await sleep(700);
  const s11 = await st();
  await shot("f10-act-overlay.png");
  await page.click("#actOk");
  await sleep(600);
  const s12 = await st();
  await shot("f11-after-act.png");

  // 13. 刷新 → 继续上一局
  await page.reload({ waitUntil: "load" });
  await sleep(400);
  const resumeVisible = await page.evaluate(() => !document.getElementById("resumeBtn").hidden);
  await shot("f12-setup-resume.png");
  await page.click("#resumeBtn");
  await sleep(500);
  const s13 = await st();
  await shot("f13-resumed.png");

  // 14. 档位 1 点降档 → 提示而非死按钮
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
    return { screen: document.querySelector(".screen.on").id, box: { w: Math.round(r.width), h: Math.round(r.height), t: Math.round(r.top) }, ovAct: document.getElementById("ovAct").classList.contains("on"), ovPause: document.getElementById("ovPause").classList.contains("on") };
  });
  await page.click("#card");
  await sleep(700);
  await page.click("#downBtn");
  await sleep(300);
  const s14 = await st();

  // 15. 结束屏
  await page.click("#pauseBtn");
  await sleep(400);
  const paused = await page.evaluate(() => document.getElementById("ovPause").classList.contains("on"));
  await shot("f14-pause.png");
  if (paused) { await page.click("#quitBtn"); await sleep(400); }
  const s15 = await st();
  await shot("f15-end.png");

  const checks = {
    "开始按钮在首屏": btnBox.bottom <= btnBox.vh && btnBox.top > 0,
    "未勾选时按钮禁用": beforeAgree.muted === true,
    "翻牌后出现三个选项": s2.choose === true,
    "翻牌后没有「做完了」": s2.doneBtn === false,
    "A 选完只留「递过去」": s3.choose === false && s3.pass === true,
    "传递时显示对方名字": /把手机给/.test(s3.passTxt),
    "传递时不泄露 A 选了什么": leak === false,
    "B 选前又出现三个选项": s4.choose === true,
    "揭晓出现两栏": s5.rev === true && s5.rvrow === true,
    "揭晓显示真实名字": rv.an.length > 0 && rv.bn.length > 0 && rv.an !== rv.bn,
    "两个都选做 → 合拍": /合拍/.test(s5.rvres),
    "揭晓后出现「下一张」": s5.doneBtn === true,
    "选做 → 完成数 +1": n1 === n0 + 1,
    "下一张回到未翻牌": s6.flipped === false && s6.choose === false,
    "有人不做 → 不点名": s7.rvrow === false,
    "有人不做 → 判决是放下": /先放下/.test(s7.rvres),
    "有人不做 → 完成数不变": n3 === n2,
    "都不做 → 合拍": /合拍/.test(s8.rvres),
    "撤回后回到选择态": s10.choose === true || s10.rev === true,
    "左右滑不再改变状态": afterSwipe.title === beforeSwipe.title && afterSwipe2.title === beforeSwipe.title && afterSwipe2.flipped === beforeSwipe.flipped,
    "升档过渡出现": s11.actOv === true,
    "升档后进入第二幕": /第二幕/.test(s12.act),
    "刷新后可继续": resumeVisible === true,
    "降档有提示不崩": s14.toast.length > 0,
    "暂停浮层可开": paused === true,
    "结束时没有 JS 报错": errs.length === 0,
  };
  const bad = Object.keys(checks).filter((k) => !checks[k]);
  console.log(JSON.stringify({ checks, bad, errs, sample: { s2, s3, s5, s7, s8, rv, n0, n1, n2, n3 } }, null, 2));
  await browser.close();
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
