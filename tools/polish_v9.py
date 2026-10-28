# -*- coding: utf-8 -*-
"""卡片内容优化 v9：最后一批偏薄的卡补到 21 字以上，保证卡面观感一致。

用法： python tools/polish_v9.py
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARDS = os.path.join(ROOT, "src", "cards")

R = {
    "按住腰": "一只手按住对方的腰，不许往上躲，也不许扭开。",
    "每三秒靠近": "对视，每三秒靠近一点，直到贴住为止，中途不许笑。",
    "放首歌": "放一首慢歌，音量调到刚好盖住说话声，然后就别说话。",
    "换到床边": "换到床边坐着，脚踩在地上，膝盖碰着膝盖。",
    "跟着节拍": "放一首节拍慢的歌，跟着节奏动，不许抢拍，也不许停。",
    "温度刚好": "把温度调到刚好不出汗，动起来也不闷，皮肤不会黏。",
    "舌尖": "只用舌尖，很轻，轻到对方要开口求你，再重一点。",
    "能忍到哪一步": "你最多能忍到哪一步？说出来，我按你说的试。",
    "想被夸哪里": "你想被夸哪里？说出来，我认真夸一遍，夸到点上。",
    "耳边别出声": "贴在耳边呼吸，一个字都别说，手继续，别停。",
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
        print(f"L{t}: 补写 {hit} 张")
        total += hit
    print(f"合计 {total} 张")
    return 0


if __name__ == "__main__":
    sys.exit(main())
