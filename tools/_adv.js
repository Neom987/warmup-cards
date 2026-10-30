/* 回归脚本共用：把一张牌「走完」。
 *
 * 现在的流程是单机单人操作：翻牌 → 做完（或跳过 / 升档 / 降档）→ 下一张。
 * 早期版本是「两个人在同一台手机上各自选一次再揭晓」，那套已经删掉了，
 * 所以这里不再有 choose / passGo / reveal 这些步骤。
 *
 * 用法：await advance(page);          // 翻牌并「做完」
 *       await advance(page, "skip");  // 翻牌并「跳过」
 * 调用前卡片翻没翻都可以。
 */
async function advance(page, v) {
  return page.evaluate((vv) => {
    const $ = (id) => document.getElementById(id);
    const on = (id) => $(id) && $(id).classList.contains("on");
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const flipped = () => $("card") && $("card").classList.contains("flip");

    /* 挡路的浮层先关掉：升档过渡、三选一 */
    if (on("ovAct")) $("actOk").click();
    if (on("ovPick")) {
      const b = document.querySelector("#pickRow .pk");
      if (b) b.click();
    }
    if (!flipped()) {
      const swipe = $("swipe");
      if (swipe) {
        const opt = { bubbles: true, clientX: 100, clientY: 400 };
        swipe.dispatchEvent(new MouseEvent("pointerdown", opt));
        swipe.dispatchEvent(new MouseEvent("pointerup", opt));
      }
    }
    /* 掷骰浮层会自己收起，等它一下再点按钮 */
    return sleep(on("ovDice") ? 2200 : 120).then(() => {
      if (vv === "skip") {
        if (!$("skipBtn").disabled) $("skipBtn").click();
      } else if (!$("doneBtn").disabled) {
        $("doneBtn").click();
      }
      return true;
    });
  }, v || "do");
}

module.exports = { advance };
