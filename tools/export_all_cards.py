# -*- coding: utf-8 -*-
"""把三档卡片导出为一份可交给外部 AI 阅读/改写的 Markdown。"""
import io
import json
import os
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "tmp", f"cards-all-{datetime.now().strftime('%Y-%m-%d')}.md")

CAT = {
    "say": ("语言撩拨", "以说、问、答、叫、念为主"),
    "gaze": ("距离眼神", "以看、被看、对视、暴露为主"),
    "touch": ("触碰引导", "以具体身体动作、手法、落点为主"),
    "scene": ("场景氛围", "以地点、光线、道具改变玩法为主"),
    "truth": ("真心话", "以必须诚实回答的问题为主"),
    "command": ("指令掌控", "以规定姿势、节奏、权限为主"),
}
WHO = {
    "drawer": "抽卡者",
    "partner": "对方",
    "both": "一起",
    "random": "猜拳",
}
TIER = {1: "调情", 2: "升温", 3: "深处"}
ORDER = ["say", "gaze", "touch", "scene", "truth", "command"]


def cell(s):
    return str(s if s not in (None, "") else "—").replace("|", "\\|").replace("\n", " ")


def main():
    tiers = {}
    for t in (1, 2, 3):
        with io.open(os.path.join(ROOT, "src", "cards", f"tier{t}.json"), encoding="utf-8") as f:
            tiers[t] = json.load(f)

    lines = []
    lines.append("# 三档卡片文本合集（360 张）")
    lines.append("")
    lines.append(f"> 导出时间：{datetime.now().strftime('%Y-%m-%d %H:%M')}  ")
    lines.append("> 用途：交给外部 AI 逐条改写。当前是**未验收的 WIP**，不是线上最终版。")
    lines.append("")
    lines.append("## 给接手 AI 的任务")
    lines.append("")
    lines.append("用户反馈：**分类混乱、不够色、有点无聊**。请逐条精修，不要只换同义词。")
    lines.append("")
    lines.append("硬性要求：")
    lines.append("")
    lines.append("1. **不要改 ID**，不要增删行；三档各保持 120 张。")
    lines.append("2. 可以改「类别」「标题」「正文」；改标题后要保证全库不重名。")
    lines.append("3. 正文控制在 20–36 个汉字，必须有一个可执行动作，不要写家务或纯氛围。")
    lines.append("4. 分类按“玩家实际做的事”判断，不按话题判断：")
    for k in ORDER:
        lines.append(f"   - `{k}` {CAT[k][0]}：{CAT[k][1]}")
    lines.append("5. 强度必须递增：")
    lines.append("   - L1 调情：隔衣、亲吻、脱一件、试探；不出现明确性行为。")
    lines.append("   - L2 升温：明确的手动/口部/进入、边缘控制；开始出现节奏变化。")
    lines.append("   - L3 深处：组合刺激、体位与权限交换、连续边缘、更强掌控；不能只写“站好/跪下/数数/不许动”。")
    lines.append("6. 仅限成年人、双方自愿、可随时停止；不得出现未成年、强迫、窒息/勒颈；不要写“不能反悔”。")
    lines.append("7. 高风险动作要有一条可执行的轻量退路，写在「退路」列；没有就写 `—`。")
    lines.append("")
    lines.append("回传格式：保持同样的 Markdown 表格，列顺序不变，只改需要改的单元格；不要输出解释。")
    lines.append("")
    lines.append("## 字段说明")
    lines.append("")
    lines.append("- `执行人`：`抽卡者` / `对方` / `一起` / `猜拳`。当前 360 张全是 `抽卡者`，需要打散。")
    lines.append("- `退路`：当前三档的 `alt` 字段在上一轮整表重写中丢失，全部为空；请在新文本里补回。")
    lines.append("- `计时`：当前 `dur` 字段同样丢失；只有正文明确要求计时才填秒数，否则 `—`。")
    lines.append("")

    total = 0
    for t in (1, 2, 3):
        data = tiers[t]
        lines.append(f"## L{t} {TIER[t]}（{len(data)} 张）")
        lines.append("")
        lines.append("| ID | 类别 | 标题 | 正文 | 执行人 | 退路 | 计时 |")
        lines.append("|---|---|---|---|---|---|---|")
        for i, c in enumerate(data, 1):
            cid = f"L{t}-{i:03d}"
            cat = c.get("cat", "")
            cat_label = f"{CAT.get(cat, (cat, ''))[0]} `{cat}`"
            who = WHO.get(c.get("who"), c.get("who", "—"))
            dur = f"{c['dur']} 秒" if c.get("dur") else "—"
            lines.append(
                "| {id} | {cat} | {title} | {text} | {who} | {alt} | {dur} |".format(
                    id=cid,
                    cat=cell(cat_label),
                    title=cell(c.get("title")),
                    text=cell(c.get("text")),
                    who=cell(who),
                    alt=cell(c.get("alt")),
                    dur=cell(dur),
                )
            )
            total += 1
        lines.append("")

    lines.append("## 当前统计")
    lines.append("")
    for t in (1, 2, 3):
        counts = {k: sum(1 for c in tiers[t] if c.get("cat") == k) for k in ORDER}
        lines.append(f"- L{t}：{len(tiers[t])} 张；" + "、".join(f"{CAT[k][0]} {counts[k]}" for k in ORDER))
    lines.append(f"- 合计：{total} 张。")
    lines.append("")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with io.open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines))

    print("written", OUT)
    print("cards", total, "lines", len(lines), "bytes", os.path.getsize(OUT))


if __name__ == "__main__":
    main()
