# -*- coding: utf-8 -*-
"""v12：重排两档的强度分布。

用户反馈：
  「升温的有的不够升温，可以更色情一点；言语类的大部分并入第一档，除非很色情。」

做法：
  1. 把第二档里「只是说话」的卡下沉到第一档（12 张）
  2. 把第一档里已经动手到位的卡上提到第二档（12 张），补回张数
  3. 把第二档里偏轻的触碰卡、指令卡就地改写，提高强度
  4. 两档都按类别重新排序，方便以后手工编辑

用法： python tools/rebalance_v12.py
"""
import io
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARDS = os.path.join(ROOT, "src", "cards")
ORDER = ["say", "gaze", "touch", "scene", "truth", "command"]

# 第二档 → 第一档：纯言语、没有身体动作的卡
DOWN = [
    "说三件事", "我要你", "评价我", "只剩一句话", "说清楚", "该你了",
    "我要看着你", "答应一半", "报分数", "说出底线", "一句话求我", "说个画面",
]

# 第一档 → 第二档：已经越过「抚摸」的卡，cat 可顺带修正
UP = {
    "跨坐": "command",
    "压住双手": "touch",
    "抬起一条腿": "touch",
    "拉进衣服里": "command",
    "从后腰进去": "touch",
    "隔着布料按": "touch",
    "手掌上滑": "touch",
    "含手指": "touch",
    "牙齿解扣": "touch",
    "揉腰侧": "touch",
    "只留一层": "scene",
    "用嘴解开一颗": "command",
}

# 第二档就地加深：title -> (text, alt 或 None)
REWRITE = {
    # ---- 偏轻的触碰 ----
    "关灯认手": ("关灯，用两根手指从对方胸口往下滑，停在哪儿，就让对方说出那儿叫什么。",
                 "不想被问就换成只用手背，慢慢走一遍。"),
    "跪下来": ("让对方坐着，你跪下来，把对方一条腿抬到自己肩上，脸贴上去，不动。",
               "觉得太近就把腿放下，只把头靠在膝盖上。"),
    "扶着头发": ("一只手抓着头发往后拉，让脖子完全露出来，另一只手不许停。",
                 "头发短就用下巴压住对方的肩，一样别让躲。"),
    "耳廓一圈": ("含着对方的耳垂说话，说到一半改用舌头，让那句话听不完整。", None),
    "掌心听心跳": ("手掌整个覆上去，用掌心压着揉，隔着布料也要揉到对方挺起来。",
                   "隔着两层衣服，力气减半。"),
    "膝盖后面": ("把对方一条腿架到自己腰上，手从膝弯内侧往上推，推到腿根就停。", None),
    "脚踝内侧": ("抬起对方的脚踝，用嘴唇从内侧一路吻到膝弯，吻到那条腿发抖。", None),
    "指缝": ("十指扣住，把对方的手按在头顶，另一只手从腰侧一路摸到腿根。",
             "不想被按就改成两只手都放在背后。"),
    "呼吸在耳后": ("从耳后一路舔到肩膀，中间不停，停下来的地方就用牙咬一下。", None),
    "牙齿轻磨": ("咬住对方肩上的肉，用力到留下牙印，再用舌头把那个印子舔一遍。",
                 "不想留印就只咬不出力，痕迹一会儿就散。"),
    "一节一节按": ("从后颈开始往下按，按到腰改用指节，一路压到尾椎骨。", None),
    "额头顶锁骨": ("用嘴唇从下巴一路往下，经过喉咙，停在胸口中间，用牙轻轻磨。", None),

    # ---- 偏轻的指令 ----
    "站好别动": ("让对方站直，你从背后把衣服一件件解开，手不许停，也不许转过来。", None),
    "三分钟不出声": ("让对方三分钟不出声，你的手不许停，出声一次就重新计时。",
                     "忍不住就改成出声一次加十秒，不用重来。"),
    "等我说停": ("让对方自己动，等你说停；你说停之后，还要再撑三秒才算数。", None),
    "手放在看得见的地方": ("让对方把手放在头顶，十指扣住，没你的话不许放下来。", None),
    "跪好抬头": ("让对方跪好，手放在自己腿上，抬头看你，全程不许低头看别处。", None),
    "笑就加规则": ("接下来让对方别笑，笑一次就脱一件，脱完还笑就加一条规则。", None),

    # ---- 剩下的言语卡：再露骨一档 ----
    "别忍着": ("贴着耳朵说「别忍着」，说完就继续，直到听见声音为止。", None),
    "边做边说": ("一边碰一边让对方说感受，声音不许断，断了就从头开始。", None),
    "数出来": ("每碰一下让对方数一下，数错一次就退回上一个数重来。", None),
    "说一句别动": ("说一句「别动」，然后做你想做的；对方动一下，就退回上一张。", None),
    "慢到出声": ("说「慢一点」，把节奏压到最慢，慢到对方先开口求你加快。", None),
    "说三遍想要": ("让对方说「我想要」，说三遍，每一遍都要说清想要哪里。", None),
    "我要停了": ("说「我要停了」，真的停手十秒，看对方会不会自己贴上来。", None),
    "叫我的名字": ("让对方在被碰的时候喊你的名字，喊错一次就停十秒。", None),
    "重复一遍": ("让对方把刚才那句话再说一遍，这次要看着你说，声音更低。", None),

    # ---- 场景：把「布置」改成「状态」 ----
    "一条薄毯": ("只盖一条薄毯，别的不盖；谁先掀开，谁就负责把灯关掉。", None),
    "开一扇窗": ("把窗开一条缝，让房间凉下来，冷了就贴紧，别去找被子。", None),
}


def load(name):
    with io.open(os.path.join(CARDS, name), encoding="utf-8") as f:
        return json.load(f)


def save(name, data):
    with io.open(os.path.join(CARDS, name), "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write("\n")


def sort_cards(cards):
    return sorted(cards, key=lambda c: (ORDER.index(c["cat"]), cards.index(c)))


def main():
    t1 = load("tier1.json")
    t2 = load("tier2.json")
    by1 = {c["title"]: c for c in t1}
    by2 = {c["title"]: c for c in t2}

    missing = [t for t in DOWN if t not in by2]
    missing += [t for t in UP if t not in by1]
    if missing:
        print("!! 找不到这些卡：", missing)
        return 1

    # 1. 下沉
    for title in DOWN:
        c = by2.pop(title)
        t2.remove(c)
        t1.append(c)

    # 2. 上提（可顺带改类别）
    for title, cat in UP.items():
        c = by1.pop(title)
        t1.remove(c)
        c["cat"] = cat
        t2.append(c)

    # 3. 改写
    hit = 0
    for title, (text, alt) in REWRITE.items():
        c = by2.get(title) or by1.get(title)
        if not c:
            print("!! 改写目标不存在：", title)
            continue
        c["text"] = text
        if alt:
            c["alt"] = alt
        elif "alt" in c:
            del c["alt"]
        hit += 1

    t1 = sort_cards(t1)
    t2 = sort_cards(t2)
    save("tier1.json", t1)
    save("tier2.json", t2)

    from collections import Counter
    for name, data in (("L1", t1), ("L2", t2)):
        cnt = Counter(c["cat"] for c in data)
        print(f"{name} {len(data)} 张  " + " ".join(f"{k}{cnt[k]}" for k in ORDER))
    print(f"改写 {hit} 张")


if __name__ == "__main__":
    main()
