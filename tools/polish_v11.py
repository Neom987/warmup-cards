# -*- coding: utf-8 -*-
"""卡片内容优化 v11：L3 剩余缺主语 / 指代不清的 8 张。

用法： python tools/polish_v11.py
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARDS = os.path.join(ROOT, "src", "cards")

R = {
    "绑手蒙眼": "把对方的眼睛蒙上，双手绑在身前，用气息绕着走一圈，不出声。",
    "椅中对视": "把对方的双手绑在身前，让人坐在椅子上，对视六十秒。",
    "绑手送到边缘": "把对方的双手绑住，用嘴送到边缘，然后停下来数到十。",
    "跪着抬头": "指一下地面，让对方跪好抬头，然后低下头用嘴唇，眼睛别闭。",
    "腿别合上": "把对方的腿分开，用身体卡住，动一下就重新开始。",
    "蒙眼之后再继续": "先把对方的眼睛蒙上再继续，让对方只能靠感觉猜下一步。",
    "房间中间的椅子": "把椅子搬到房间正中间，让对方坐下，四周空着，别挪。",
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
        print(f"L{t}: 修正 {hit} 张")
        total += hit
    print(f"合计 {total} 张")
    return 0


if __name__ == "__main__":
    sys.exit(main())
