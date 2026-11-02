# -*- coding: utf-8 -*-
"""卡片内容体检：跨档重复 / 类别错配 / 词频 / 长度 / 道具引用 / 句式套路。

用法： python tools/audit_content.py [--json]
只读，不改任何文件。
"""
import json
import os
import re
import sys
from collections import Counter, defaultdict
from difflib import SequenceMatcher

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARDS = os.path.join(ROOT, "src", "cards")
CAT_NAME = {"say": "语言", "gaze": "眼神", "touch": "触碰", "scene": "场景", "truth": "真心话", "command": "指令"}

# 每类“应该出现”的语义线索，用于发现类别错配
CAT_HINT = {
    "say": r"说|问|叫|答|喊|念|字|话|词|句",
    "gaze": r"看|眼|视|对视|眨眼|目光|凝视|距离|靠近|抬眼|低头|闭眼|光",
    "touch": r"碰|摸|抚|吻|亲|咬|含|掌|指|唇|皮|抱|搂|贴|蹭|揉|掐|按|压|滑|腿|腰|颈|肩|胸|背|手腕",
    "scene": r"灯|床|房|门|窗|烛|镜|音乐|歌|温度|手机|毯|床单|椅子|浴室|蒸汽|光|水",
    "truth": r"你|最|喜欢|想|怕|介意|几分|为什么|哪",
    "command": r"命令|不许|不准|保持|等|站|跪|坐|数|手|别动|抬头|转身|趴",
}


def load(name):
    p = os.path.join(CARDS, name)
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def main():
    tiers = {t: load(f"tier{t}.json") for t in (1, 2, 3)}
    props = load("props.json")
    pcards = props.get("cards", [])
    rows = []
    for t, arr in tiers.items():
        for i, c in enumerate(arr):
            rows.append(dict(c, _tier=t, _idx=i + 1, _src=f"L{t}#{i+1}"))
    for i, c in enumerate(pcards):
        rows.append(dict(c, _src=f"道具#{i+1}"))

    out = {}
    out["counts"] = {f"L{t}": len(v) for t, v in tiers.items()}
    out["counts"]["道具卡"] = len(pcards)
    out["counts"]["合计"] = len(rows)

    # 1. 跨档/全局近似（文本）
    dup_text = []
    for i in range(len(rows)):
        for j in range(i + 1, len(rows)):
            a, b = rows[i].get("text", ""), rows[j].get("text", "")
            if len(a) < 6 or len(b) < 6:
                continue
            r = SequenceMatcher(None, a, b).ratio()
            if r >= 0.72:
                dup_text.append((round(r, 3), rows[i]["_src"], rows[i]["title"], rows[j]["_src"], rows[j]["title"]))
    dup_text.sort(reverse=True)
    out["文本重复_top"] = dup_text[:40]
    out["文本重复_数量"] = len(dup_text)

    # 2. 标题近似（含同义改写）
    dup_title = []
    for i in range(len(rows)):
        for j in range(i + 1, len(rows)):
            a, b = rows[i]["title"], rows[j]["title"]
            r = SequenceMatcher(None, a, b).ratio()
            if r >= 0.6:
                dup_title.append((round(r, 3), rows[i]["_src"], a, rows[j]["_src"], b))
    dup_title.sort(reverse=True)
    out["标题近似_top"] = dup_title[:30]

    # 3. 类别错配
    mis = defaultdict(list)
    for c in rows:
        txt = c["title"] + c["text"]
        hint = CAT_HINT.get(c["cat"], "")
        if hint and not re.search(hint, txt):
            mis[c["cat"]].append((c["_src"], c["title"], c["text"][:26]))
    out["类别疑似错配"] = {CAT_NAME[k]: v for k, v in mis.items()}

    # 4. 词频
    allt = "".join(c["title"] + c["text"] for c in rows)
    words = ["不许", "不准", "停", "看", "数到", "绑", "蒙", "亲", "碰", "看着", "对方", "自己", "然后", "慢慢", "一下", "一次"]
    out["词频"] = {w: allt.count(w) for w in words}

    # 5. 长度
    for t in (1, 2, 3):
        lens = [len(c["text"]) for c in tiers[t]]
        out[f"L{t}长度"] = {"min": min(lens), "max": max(lens), "avg": round(sum(lens) / len(lens), 1),
                            "过短": [c["title"] for c in tiers[t] if len(c["text"]) < 18],
                            "过长": [c["title"] for c in tiers[t] if len(c["text"]) > 46]}

    # 6. alt / dur 覆盖
    for t in (1, 2, 3):
        arr = tiers[t]
        out[f"L{t}覆盖"] = {
            "alt": sum(1 for c in arr if c.get("alt")),
            "dur": sum(1 for c in arr if c.get("dur")),
            "who": dict(Counter(c.get("who", "-") for c in arr)),
        }

    # 7. 道具：文本提到道具却没 require
    keys = {p["key"]: p["name"] for p in props["props"]}
    name2key = {v: k for k, v in keys.items()}
    miss_req = []
    req_titles = props.get("requires", {})
    for c in rows:
        if c.get("props"):
            continue
        hit = [k for n, k in name2key.items() if n in c["text"]]
        if hit and c["title"] not in req_titles:
            miss_req.append((c["_src"], c["title"], hit, c["text"][:30]))
    out["提到道具但无requires"] = miss_req

    # 8. 时间词与 dur 不一致
    dur_bad = []
    for c in rows:
        if c.get("dur") and not re.search(r"秒|分钟|十|三十|六十", c["text"] + c["title"]):
            dur_bad.append((c["_src"], c["title"], c["dur"], c["text"]))
    out["dur无时间描述"] = dur_bad

    # 9. 句式开头套路
    starts = Counter()
    for c in rows:
        s = c["text"][:3]
        starts[s] += 1
    out["开头重复_top"] = starts.most_common(12)

    print(json.dumps(out, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
