# -*- coding: utf-8 -*-
"""卡片库校验：唯一性 / 字段完整性 / 档位数量 / 类别覆盖 / 近似重复 / 道具与角色引用。

用法： python check_cards.py
退出码 0 = 通过（允许 warnings），1 = 有 error。
"""
import json
import os
import sys
from difflib import SequenceMatcher

ROOT = os.path.dirname(os.path.abspath(__file__))
CARDS_DIR = os.path.join(ROOT, "src", "cards")

TIERS = [1, 2, 3]
TIER_NAMES = {1: "调情", 2: "升温", 3: "深处"}
CATS = ["say", "gaze", "touch", "scene", "truth", "command"]
CAT_NAMES = {
    "say": "语言撩拨", "gaze": "距离眼神", "touch": "触碰引导", "scene": "场景氛围",
    "truth": "真心话", "command": "指令掌控",
}
WHO = {"drawer", "partner", "both", "random"}
EXPECTED = {1: 145, 2: 179, 3: 234}
MIN_PER_CAT = 4
SIM_THRESHOLD = 0.86
TEXT_MIN, TEXT_MAX = 8, 90
# 红线：不做无条件强制、不涉及未成年
RED_LINES = ["必须", "强迫", "强行", "不许拒绝", "不准拒绝", "未成年", "硬来", "强奸"]

errors, warns = [], []


def load_json(name, default=None):
    path = os.path.join(CARDS_DIR, name)
    if not os.path.exists(path):
        errors.append(f"缺少文件 {path}")
        return default
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        errors.append(f"{name} JSON 解析失败：{e}")
        return default


def check_card(c, loc, titles):
    cat = c.get("cat")
    title = (c.get("title") or "").strip()
    text = (c.get("text") or "").strip()
    if cat not in CATS:
        errors.append(f"{loc} cat 非法：{cat!r}")
    if not title:
        errors.append(f"{loc} 缺 title")
    if not text:
        errors.append(f"{loc} 缺 text")
    if text and not (TEXT_MIN <= len(text) <= TEXT_MAX):
        warns.append(f"{loc}「{title}」正文 {len(text)} 字，建议 {TEXT_MIN}-{TEXT_MAX}")
    if c.get("who") and c["who"] not in WHO:
        errors.append(f"{loc} who 非法：{c['who']!r}")
    if "dur" in c and c["dur"] is not None and not isinstance(c["dur"], int):
        errors.append(f"{loc} dur 必须是整数或 null")
    for w in RED_LINES:
        if w in text or w in title:
            errors.append(f"{loc}「{title}」出现红线表述：{w}")
    if title:
        if title in titles:
            errors.append(f"标题重复：「{title}」({titles[title]} 与 {loc})")
        else:
            titles[title] = loc


def main():
    all_cards, titles = [], {}
    for t in TIERS:
        data = load_json(f"tier{t}.json", [])
        if len(data) != EXPECTED[t]:
            errors.append(f"[L{t}] 张数 {len(data)}，应为 {EXPECTED[t]}")
        cat_count = {c: 0 for c in CATS}
        for i, c in enumerate(data):
            loc = f"L{t}#{i + 1}"
            check_card(c, loc, titles)
            if c.get("cat") in cat_count:
                cat_count[c["cat"]] += 1
            item = dict(c)
            item["_tier"], item["_loc"] = t, loc
            all_cards.append(item)
        missing = {CAT_NAMES[c]: n for c, n in cat_count.items() if n < MIN_PER_CAT}
        if missing:
            errors.append(f"[L{t}] 类别覆盖不足（每类至少 {MIN_PER_CAT}）：{missing}")
        print(f"L{t} {TIER_NAMES[t]}: {len(data)} 张  " +
              " ".join(f"{CAT_NAMES[c]}{n}" for c, n in cat_count.items()))

    # 近似重复：同档内比较
    for t in TIERS:
        pool = [c for c in all_cards if c["_tier"] == t]
        for i in range(len(pool)):
            for j in range(i + 1, len(pool)):
                a, b = pool[i].get("text", ""), pool[j].get("text", "")
                if not a or not b:
                    continue
                r = SequenceMatcher(None, a, b).ratio()
                if r >= SIM_THRESHOLD:
                    errors.append(
                        f"近似重复 {r:.2f}：{pool[i]['_loc']}「{pool[i].get('title')}」"
                        f" ≈ {pool[j]['_loc']}「{pool[j].get('title')}」"
                    )

    # 道具库
    props = load_json("props.json", {}) or {}
    prop_keys = {p["key"] for p in props.get("props", [])}
    if len(prop_keys) < 6:
        errors.append("道具库过少")
    extra = props.get("cards", [])
    for i, c in enumerate(extra):
        loc = f"道具#{i + 1}"
        check_card(c, loc, titles)
        if c.get("tier") not in TIERS:
            errors.append(f"{loc} tier 非法：{c.get('tier')!r}")
        miss = [k for k in c.get("props", []) if k not in prop_keys]
        if miss:
            errors.append(f"{loc} 引用了未定义的道具：{miss}")
    base_titles = {c.get("title") for c in all_cards}
    for title, keys in (props.get("requires") or {}).items():
        if title not in base_titles:
            errors.append(f"requires 里的「{title}」在基础卡里找不到")
        miss = [k for k in keys if k not in prop_keys]
        if miss:
            errors.append(f"requires「{title}」引用了未定义的道具：{miss}")

    print(f"\n基础卡 {len(all_cards)} 张 + 道具卡 {len(extra)} 张 = {len(all_cards) + len(extra)} 张")
    print(f"道具 {len(prop_keys)} 种")
    for w in warns:
        print(f"WARN  {w}")
    for e in errors:
        print(f"ERROR {e}")
    if errors:
        print(f"\n✗ 校验未通过：{len(errors)} 个错误 / {len(warns)} 个警告")
        return 1
    print(f"\n✓ 校验通过：0 错误 / {len(warns)} 个警告")
    return 0


if __name__ == "__main__":
    sys.exit(main())
