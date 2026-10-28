# -*- coding: utf-8 -*-
"""v12：新增「震动棒」道具，并给道具稀薄的几件补卡。
同时把道具从「随机点缀」升级成有节奏的玩法（节奏逻辑在 app.html 里）。

用法： python tools/add_vibe_prop.py
"""
import io
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, "src", "cards", "props.json")

NEW_PROP = {
    "key": "vibe",
    "name": "震动棒",
    "hint": "有就用，没有也不影响其他卡",
}

NEW_CARDS = [
    # ---------- 震动棒 · 第二幕 ----------
    {"tier": 2, "cat": "touch", "title": "最低档", "who": "drawer",
     "text": "开到最低档，隔着衣服贴在对方腰侧，慢慢往上移，等对方先出声再停。",
     "props": ["vibe"],
     "alt": "隔着两层衣服，或者只贴在手心里，麻感会淡很多。"},

    {"tier": 2, "cat": "command", "title": "开关在谁手里", "who": "drawer",
     "text": "让对方握着，你只说「开」和「关」。每说一次，间隔比上一次短一点。",
     "props": ["vibe"],
     "alt": "换你握着，对方只用表情告诉你什么时候该停。"},

    {"tier": 2, "cat": "gaze", "title": "猜档位", "who": "partner",
     "text": "闭着眼，让对方把档位调上或调下，你猜是升了还是降了，猜错就多十秒。",
     "props": ["vibe"]},

    {"tier": 2, "cat": "say", "title": "贴着说话", "who": "drawer",
     "text": "开着最低档贴在对方耳边说话，说到对方听不清你在说什么为止。",
     "props": ["vibe"]},

    {"tier": 2, "cat": "touch", "title": "一起握着", "who": "both",
     "text": "两个人的手叠在一起握着它，谁先松手，谁负责把它收进抽屉。",
     "props": ["vibe"]},

    {"tier": 2, "cat": "command", "title": "锁骨上", "who": "drawer",
     "text": "放在锁骨上不许躲，谁先动一下，谁就把档位往上加一格。",
     "props": ["vibe"]},

    # ---------- 震动棒 · 第三幕 ----------
    {"tier": 3, "cat": "command", "title": "交给你了", "who": "drawer",
     "text": "把开关交到对方手里，说一句「你决定」。接下来三分钟，你不许提要求。",
     "props": ["vibe"],
     "alt": "觉得失控就提前约一个手势，抬手就停，不用解释。"},

    {"tier": 3, "cat": "command", "title": "数到十", "who": "partner",
     "text": "开到中档，让对方从一数到十，数错一个就重来，数对才准停。",
     "props": ["vibe"],
     "alt": "十太长就数到五，规则一样。"},

    {"tier": 3, "cat": "scene", "title": "三次边缘", "who": "drawer",
     "text": "快到的时候停下来，等呼吸平了再继续，来回三次，最后一次由对方说可以。",
     "props": ["vibe"],
     "alt": "三次太多就一次，停多久你们自己定。"},

    {"tier": 3, "cat": "command", "title": "自己来", "who": "partner",
     "text": "让对方自己来，你只负责看着，中途不许帮忙，也不许催。",
     "props": ["vibe"],
     "alt": "不想被看着就关灯，只留声音。"},

    {"tier": 3, "cat": "command", "title": "手腕绑住", "who": "drawer",
     "text": "手腕用丝巾松松系在床头，开关在对方手里，你只能说出快一点或慢一点。",
     "props": ["vibe", "silk"],
     "alt": "不想被绑就背过手自己握着，其他一样。"},

    {"tier": 3, "cat": "scene", "title": "镜子里看着", "who": "drawer",
     "text": "对着镜子，让对方从背后抱着你，全程看着镜子里的自己，不许低头。",
     "props": ["vibe", "mirror"],
     "alt": "觉得难为情就把灯调暗，只留镜子前那一盏。"},

    # ---------- 震动棒 · 第一幕（只在手上，尺度更轻） ----------
    {"tier": 1, "cat": "touch", "title": "隔着布料", "who": "drawer",
     "text": "隔着衣服把最低档贴在对方手背上，让对方猜你现在开的是哪一档。",
     "props": ["vibe"],
     "alt": "觉得别扭就换成手心贴手心，什么都不做。"},

    # ---------- 丝巾 ----------
    {"tier": 2, "cat": "command", "title": "系个松松的结", "who": "drawer",
     "text": "用丝巾在对方手腕上系一个松松的结，系完把另一头交到对方手里。",
     "props": ["silk"],
     "alt": "换成系在自己手上，让对方来解。"},

    {"tier": 3, "cat": "scene", "title": "看不见的手", "who": "drawer",
     "text": "用丝巾蒙住眼睛，让对方用指尖在你身上写字，一个字一个字地猜。",
     "props": ["silk"],
     "alt": "猜不出来就换成划圈，猜三次就换手。"},

    # ---------- 镜子 ----------
    {"tier": 2, "cat": "gaze", "title": "镜子里的表情", "who": "partner",
     "text": "站在镜子前，让对方从背后抱住你，看着镜子说出你现在最明显的那个表情。",
     "props": ["mirror"],
     "alt": "说不出来就只用手指指出来。"},

    {"tier": 3, "cat": "scene", "title": "背后的镜子", "who": "drawer",
     "text": "让对方面对镜子跪坐好，你在身后，全程只用手，让对方看着你的手在做什么。",
     "props": ["mirror"],
     "alt": "觉得太直接就把镜子挪远一点，只留个轮廓。"},

    # ---------- 蜡烛 ----------
    {"tier": 1, "cat": "scene", "title": "一点光", "who": "drawer",
     "text": "只点一根蜡烛，两个人靠得比平时近一点，谁先说话谁就吹灭它。",
     "props": ["candle"],
     "alt": "没有蜡烛就用手机手电筒蒙一层纸巾。"},

    {"tier": 2, "cat": "scene", "title": "烛光里换", "who": "drawer",
     "text": "只点一根蜡烛，让对方在烛光里脱掉一件衣服，你在旁边看着，不许出声。",
     "props": ["candle"],
     "alt": "蜡烛换成小夜灯，光弱一点更自在。"},
]


def main():
    with io.open(PATH, encoding="utf-8") as f:
        doc = json.load(f)

    keys = {p["key"] for p in doc["props"]}
    if "vibe" not in keys:
        # 插在「发圈」之后，保持「越靠后越进阶」的阅读顺序
        idx = [p["key"] for p in doc["props"]].index("clip") + 1
        doc["props"].insert(idx, NEW_PROP)
        print("✓ 新增道具：震动棒")

    titles = {c["title"] for c in doc["cards"]}
    added = skipped = 0
    for c in NEW_CARDS:
        if c["title"] in titles:
            skipped += 1
            continue
        doc["cards"].append(c)
        titles.add(c["title"])
        added += 1
    print(f"✓ 新增道具卡 {added} 张（跳过重复 {skipped} 张）")

    with io.open(PATH, "w", encoding="utf-8", newline="\n") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
        f.write("\n")

    from collections import Counter
    print("  道具卡总数", len(doc["cards"]), "| 按档",
          dict(Counter(c["tier"] for c in doc["cards"])))
    print("  按道具", dict(Counter(p for c in doc["cards"] for p in c["props"])))


if __name__ == "__main__":
    main()
