# -*- coding: utf-8 -*-
"""卡片内容优化 v10：蒙眼类 7 张句式撞车，换成不同说法（机制保留）。

用法： python tools/polish_v10.py
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARDS = os.path.join(ROOT, "src", "cards")

R = {
    "绑手蒙眼": "把眼睛蒙上，双手绑在身前，用气息绕着走一圈，不出声。",
    "手还是丝巾": "蒙住眼睛，让对方凭触感分辨碰到的是手还是丝巾，猜五次。",
    "唇还是指尖": "眼睛蒙上之后，在对方身上任选一处停留，让对方猜是唇还是指尖。",
    "蒙眼听": "把对方的眼睛蒙住，让对方只听声音判断你在做什么，猜错加一条规则。",
    "蒙眼听指令": "眼前什么都看不见，只能听指令，做错一次加十秒。",
    "蒙眼猜位置": "眼睛蒙上，让对方猜你现在碰的是哪里，猜错加十秒。",
    "蒙眼猜停处": "把对方的眼睛蒙住，用手从肩膀走到膝盖，让对方猜你停在哪里。",
    "蒙眼喂水": "蒙住眼睛，喂对方喝一口水，不许用手扶，洒了也算完成。",
}


def main():
    total = 0
    for t in (1, 2, 3):
        p = os.path.join(CARDS, f"tier{t}.json")
        with open(p, encoding="utf-8") as f:
            arr = json.load(f)
        hit = 0
        for c in arr:
            if c["title"] in R:
                c["text"] = R[c["title"]]
                hit += 1
        with open(p, "w", encoding="utf-8") as f:
            json.dump(arr, f, ensure_ascii=False, indent=1)
            f.write("\n")
        print(f"L{t}: 改写 {hit} 张")
        total += hit
    print(f"合计 {total} 张")
    return 0


if __name__ == "__main__":
    sys.exit(main())
