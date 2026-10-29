# -*- coding: utf-8 -*-
"""把 src/cards/*.json 内联进 src/app.html，产出一个可双击打开的单文件。

用法： python build.py
输出： index.html（双击即玩，同时是 GitHub Pages 的入口）
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
CARDS = os.path.join(ROOT, "src", "cards")
TEMPLATE = os.path.join(ROOT, "src", "app.html")
OUT = os.path.join(ROOT, "index.html")
VENDOR = os.path.join(ROOT, "src", "vendor")
VENDOR_FILES = ("chroma.min.js", "anime.min.js")

TIER_META = {
    1: {"name": "调情", "act": "第一幕 · 调情", "desc": "接吻、抚摸、开始脱"},
    2: {"name": "升温", "act": "第二幕 · 升温", "desc": "口、手、边缘"},
    3: {"name": "深处", "act": "第三幕 · 深处", "desc": "进入、节奏、掌控"},
}
CAT_META = {
    "say": {"name": "语言撩拨", "color": "#FF7E9D"},
    "gaze": {"name": "距离眼神", "color": "#8FB8FF"},
    "touch": {"name": "触碰引导", "color": "#FFA25C"},
    "scene": {"name": "场景氛围", "color": "#7FE0B0"},
    "truth": {"name": "真心话", "color": "#FFD37A"},
    "command": {"name": "指令掌控", "color": "#C08CFF"},
}
BOUNDS = [
    {"key": "body", "name": "触碰：胸口、大腿"},
    {"key": "kiss", "name": "亲吻：嘴唇、身体"},
    {"key": "hide", "name": "遮挡：蒙眼、绑手"},
    {"key": "mark", "name": "留痕：吻痕、口红印"},
    {"key": "rhythm", "name": "节奏：被控制、被停下"},
    {"key": "cmd", "name": "命令与称呼"},
]


def load(name):
    with open(os.path.join(CARDS, name), encoding="utf-8") as f:
        return json.load(f)


def main():
    props_doc = load("props.json")
    requires = props_doc.get("requires", {})

    cards = []
    for t in (1, 2, 3):
        for i, c in enumerate(load(f"tier{t}.json")):
            item = {
                "id": f"t{t}-{i + 1}",
                "tier": t,
                "cat": c["cat"],
                "title": c["title"],
                "text": c["text"],
                "who": c.get("who", "drawer"),
            }
            if c.get("dur"):
                item["dur"] = c["dur"]
            if c.get("alt"):
                item["alt"] = c["alt"]
            need = requires.get(c["title"])
            if need:
                item["props"] = need
            cards.append(item)

    for i, c in enumerate(props_doc["cards"]):
        item = {
            "id": f"p-{i + 1}",
            "tier": c["tier"],
            "cat": c["cat"],
            "title": c["title"],
            "text": c["text"],
            "who": c.get("who", "drawer"),
            "props": c["props"],
            "extra": 1,
        }
        if c.get("dur"):
            item["dur"] = c["dur"]
        if c.get("alt"):
            item["alt"] = c["alt"]
        cards.append(item)

    data = {
        "tiers": {str(k): v for k, v in TIER_META.items()},
        "cats": CAT_META,
        "props": props_doc["props"],
        "bounds": BOUNDS,
        "cards": cards,
    }

    with open(TEMPLATE, encoding="utf-8") as f:
        html = f.read()

    payload = "window.__DATA__=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";"
    if "/*__DATA__*/" not in html:
        print("✗ 模板里找不到 /*__DATA__*/ 占位")
        return 1
    html = html.replace("/*__DATA__*/", payload)

    # 第三方库直接内联，保持「双击即玩、零网络请求」
    if "/*__VENDOR__*/" not in html:
        print("✗ 模板里找不到 /*__VENDOR__*/ 占位")
        return 1
    parts = []
    for name in VENDOR_FILES:
        path = os.path.join(VENDOR, name)
        if not os.path.exists(path):
            print(f"✗ 缺少 {os.path.join('src', 'vendor', name)}")
            return 1
        with open(path, encoding="utf-8") as f:
            parts.append(f.read().strip())
    html = html.replace("/*__VENDOR__*/", "\n".join(parts))
    # 去掉行尾空白，避免 git diff --check 把生成文件判成脏改动。
    html = "\n".join(line.rstrip() for line in html.splitlines()) + "\n"

    # 保险：确认没有残留外链资源
    if re.search(r'<(script|link)[^>]+(src|href)="https?://', html):
        print("✗ 存在外部资源引用，单文件会失效")

    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(html)

    size = os.path.getsize(OUT) / 1024
    print(f"✓ 已生成 {os.path.basename(OUT)}  {size:.0f} KB")
    print(f"  卡片 {len(cards)} 张 / 道具 {len(props_doc['props'])} 种")
    return 0


if __name__ == "__main__":
    sys.exit(main())
