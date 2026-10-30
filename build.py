# -*- coding: utf-8 -*-
"""把 src/cards/*.json 内联进 src/app.html，产出一个可双击打开的单文件。

用法： python build.py
输出： index.html（双击即玩，同时是 GitHub Pages 的入口）

源与产物：src/ 是唯一的源，index.html 只由本脚本生成。
不要手改 index.html——下一次构建会把它覆盖掉。
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
CARDS = os.path.join(ROOT, "src", "cards")
TEMPLATE = os.path.join(ROOT, "src", "app.html")
OUT = os.path.join(ROOT, "index.html")

TIER_META = {
    1: {"name": "调情", "act": "第一幕 · 调情", "desc": "接吻、抚摸、开始脱"},
    2: {"name": "升温", "act": "第二幕 · 升温", "desc": "口、手、边缘"},
    3: {"name": "深处", "act": "第三幕 · 深处", "desc": "进入、节奏、掌控"},
}
# 低饱和的哑光色，配红金暗场。改这里会同时改卡片左侧的色线、类别标签、
# 三选一的顶边色，以及掷骰时骰面的字色。
CAT_META = {
    "say": {"name": "语言撩拨", "color": "#c9738a"},
    "gaze": {"name": "距离眼神", "color": "#7f8fc9"},
    "touch": {"name": "触碰引导", "color": "#cf8f5c"},
    "scene": {"name": "场景氛围", "color": "#6fa98d"},
    "truth": {"name": "真心话", "color": "#c9b45c"},
    "command": {"name": "指令掌控", "color": "#c05a44"},
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
        }
        if c.get("dur"):
            item["dur"] = c["dur"]
        if c.get("alt"):
            item["alt"] = c["alt"]
        item["props"] = c["props"]
        item["extra"] = 1
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

    # 去掉行尾空白，避免 git diff --check 把生成文件判成脏改动。
    html = "\n".join(line.rstrip() for line in html.splitlines()) + "\n"

    # 保险：单文件不能有任何外链资源，否则离线双击就废了
    if re.search(r'<(script|link)[^>]+(src|href)="https?://', html):
        print("✗ 存在外部资源引用，单文件会失效")
        return 1

    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(html)

    size = os.path.getsize(OUT) / 1024
    print(f"✓ 已生成 {os.path.basename(OUT)}  {size:.0f} KB")
    print(f"  卡片 {len(cards)} 张 / 道具 {len(props_doc['props'])} 种")
    return 0


if __name__ == "__main__":
    sys.exit(main())
