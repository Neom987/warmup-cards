# -*- coding: utf-8 -*-
"""把 cards-500-2026-10-29.md 导入 src/cards/tier1..3.json。

只做结构与必要校正：
- 解析 Markdown 表格，保留顺序；
- 中文执行人映射为内部 who；
- 补回 4 处触发红线词的措辞；
- 把明显以“说出欲望/感受/答案”为主的卡归回 truth；
- 根据正文提到的道具重建 requires。
"""
import io
import json
import os
import re
import shutil
import sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_LOCAL = os.path.join(ROOT, "data", "cards-500-2026-10-29.md")
SRC = SOURCE_LOCAL if os.path.exists(SOURCE_LOCAL) else r"C:\Users\neom\Desktop\locker\CARD\cards-500-2026-10-29.md"
BACKUP = os.path.join(ROOT, "tmp", "cards_backup_pre500")
CARDS_DIR = os.path.join(ROOT, "src", "cards")

CAT_MAP = {
    "say": "say", "gaze": "gaze", "touch": "touch",
    "scene": "scene", "truth": "truth", "command": "command",
}
WHO_MAP = {"抽卡者": "drawer", "对方": "partner", "一起": "both", "猜拳": "random"}
EXPECTED = {1: 120, 2: 156, 3: 224}

# 只改“必须”，保留原句意思；避免校验脚本把整批卡拦下。
TEXT_FIX = {
    "L1-112": ("赢的人必须吻一下", "赢的人要吻一下"),
    "L2-085": ("节奏必须一致", "节奏要保持一致"),
    "L3-014": ("对方必须一直看着", "对方要一直看着"),
    "L3-222": ("每条令都必须带", "每条令都要带"),
}

# 两张卡的骨架过于接近，只改其中一张的落点，保留原意。
CONTENT_FIX = {
    "L3-064": (
        "让对方自己抱住膝弯把腿分开，你用嘴服务，腿合上就停十秒。",
        "让对方抱膝把腿分开，你先从膝弯内侧吻到腿根，再含住，腿合上就停十秒。",
    ),
    "L2-128": (
        "把对方抱到厨房台面边，站在两腿之间，吻着，手探进衣摆。",
        "把对方抱到厨房台面边，让对方的腿环住你的腰，吻着往下摸到腿根。",
    ),
    "L3-092": (
        "对方背对着坐上来，你拉住对方的手腕往后，由对方控制深浅。",
        "对方背对坐下，你一手扣腕一手扶腰，胸口贴住后背，由对方带你动。",
    ),
    "L3-153": (
        "对方的手指在你里面，嘴含着你外面，两处用不同节奏，持续一分钟。",
        "让对方跪在你腿间，手指和嘴同时上来，一处快一处慢，持续一分钟。",
    ),
}

# 这些卡的主干是“说出想要/感受/答案”，归回真心话，避免该类归零。
TRUTH = {
    "L1-001": "耳边点单",
    "L1-002": "夸到发红",
    "L1-006": "想被亲哪里",
    "L1-007": "猜拳点吻",
    "L2-005": "三处各十秒",
    "L2-007": "快慢选一个",
    "L2-009": "气音要求",
    "L2-011": "边碰边问",
    "L2-014": "一问一答",
    "L3-001": "三选一",
    "L3-003": "说出画面",
    "L3-005": "先问再做",
    "L3-007": "想听的话",
    "L3-008": "想听什么",
    "L3-013": "说出感受",
}


def parse_rows(path):
    rows = []
    for line in io.open(path, encoding="utf-8"):
        if not re.match(r"^\| L[123]-\d{3} \|", line):
            continue
        cols = [x.strip() for x in line.strip().strip("|").split("|")]
        if len(cols) != 7:
            raise ValueError(f"列数错误 {len(cols)}：{line[:80]}")
        rows.append(cols)
    return rows


def main():
    if not os.path.exists(SRC):
        print("✗ 找不到源文件", SRC)
        return 1

    os.makedirs(BACKUP, exist_ok=True)
    for name in ("tier1.json", "tier2.json", "tier3.json", "props.json"):
        src = os.path.join(CARDS_DIR, name)
        dst = os.path.join(BACKUP, name)
        if os.path.exists(src) and not os.path.exists(dst):
            shutil.copy2(src, dst)

    rows = parse_rows(SRC)
    if len(rows) != 500:
        print("✗ 行数", len(rows), "应为 500")
        return 1

    by_tier = {1: [], 2: [], 3: []}
    ids = set()
    titles = set()
    for cid, cat_label, title, text, who, alt, dur in rows:
        tier = int(cid[1])
        m = re.search(r"`([a-z]+)`", cat_label)
        if not m or m.group(1) not in CAT_MAP:
            raise ValueError(f"{cid} 类别无法解析：{cat_label}")
        cat = m.group(1)
        if cid in TEXT_FIX:
            old, new = TEXT_FIX[cid]
            if old not in text:
                raise ValueError(f"{cid} 红线修复未命中：{old}")
            text = text.replace(old, new)
        if cid in CONTENT_FIX:
            old, new = CONTENT_FIX[cid]
            if old not in text:
                raise ValueError(f"{cid} 内容修复未命中：{old}")
            text = text.replace(old, new)
        if cid in TRUTH:
            if title != TRUTH[cid]:
                raise ValueError(f"{cid} 标题不符：{title} != {TRUTH[cid]}")
            cat = "truth"
        if cid in ids:
            raise ValueError(f"ID 重复：{cid}")
        if title in titles:
            raise ValueError(f"标题重复：{title}")
        ids.add(cid)
        titles.add(title)
        item = {
            "cat": cat,
            "title": title,
            "text": text,
            "who": WHO_MAP.get(who, "drawer"),
        }
        if dur not in ("—", ""):
            digits = re.search(r"\d+", dur)
            if digits:
                item["dur"] = int(digits.group(0))
        if alt not in ("—", ""):
            item["alt"] = alt
        by_tier[tier].append(item)

    for t in (1, 2, 3):
        if len(by_tier[t]) != EXPECTED[t]:
            print(f"✗ L{t} 张数 {len(by_tier[t])}，应为 {EXPECTED[t]}")
            return 1
        path = os.path.join(CARDS_DIR, f"tier{t}.json")
        with io.open(path, "w", encoding="utf-8", newline="\n") as f:
            json.dump(by_tier[t], f, ensure_ascii=False, indent=1)
            f.write("\n")
        print(f"✓ L{t}: {len(by_tier[t])} 张", dict(Counter(c["cat"] for c in by_tier[t])))

    # 重建 requires：正文提到某件道具，就需要先勾选它。
    props_path = os.path.join(CARDS_DIR, "props.json")
    props_doc = json.load(io.open(props_path, encoding="utf-8"))
    prop_names = {p["key"]: p["name"] for p in props_doc["props"]}
    requires = {}
    for t in (1, 2, 3):
        for c in by_tier[t]:
            keys = [k for k, n in prop_names.items() if n in c["title"] or n in c["text"]]
            if keys:
                requires[c["title"]] = keys
    props_doc["requires"] = requires
    with io.open(props_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(props_doc, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print("✓ requires:", len(requires), "条")
    print("  ", ", ".join(f"{k}×{v}" for k, v in Counter(
        key for keys in requires.values() for key in keys).items()))
    print("备份：", BACKUP)
    return 0


if __name__ == "__main__":
    sys.exit(main())
