/* 回归脚本共用：把一张牌「走完」。
 *
 * v15 之后，一张牌要两个人各自选一次才算数：
 *   A 选 → 「把手机递过去」→ B 选 → 揭晓 → 下一张
 * 揭晓那一刻 #doneBtn 是同步可点的，所以整段可以塞进一个 evaluate 里，
 * 不用在 Node 和页面之间来回等。
 *
 * 用法：await advance(page);            // 两个人都选「做」
 *       await advance(page, "no");     // 两个人都选「不做」
 *       await advance(page, "soft");
 * 调用前卡片必须已经翻开。
 */
async function advance(page, v) {
  return page.evaluate((vv) => {
    const $ = (id) => document.getElementById(id);
    const on = (id) => $(id) && $(id).classList.contains("on");
    /* 挡路的浮层先关掉：升档过渡、三选一 */
    if (on("ovAct")) $("actOk").click();
    if (on("ovPick")) {
      const b = document.querySelector("#pickList button");
      if (b) b.click();
    }
    const pick = (x) => {
      const b = document.querySelector('#choose [data-v="' + x + '"]');
      if (b && !$("choose").hidden) b.click();
    };
    pick(vv);
    if (!$("passGo").hidden) $("passGo").click();
    pick(vv);
    if (!$("doneBtn").hidden && !$("doneBtn").disabled) $("doneBtn").click();
    return true;
  }, v || "do");
}

module.exports = { advance };
