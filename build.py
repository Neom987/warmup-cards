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
    # 规则卡不是牌库里的卡，用近白的中性色，房间的光会跟着变淡——
    # 让「这一张不是牌，是规则」在视觉上立刻成立
    "rule": {"name": "规则", "color": "#E9DCE6"},
}

# 规则卡：每 7 张普通卡插一张，改的是这一局的规则而不是内容。
# 五种全部是「降级或增权」，没有一种是加码——这类游戏真正缺的是
# 控制感和呼吸，不是强度。
RULES = [
    {"id": "breath", "effect": "breath", "title": "停一下", "dur": 60, "who": "both",
     "text": "抱住，什么都不做。六十秒。谁都不用说话。",
     "alt": "不想抱就牵着手，一样六十秒。"},
    {"id": "silent", "effect": "silence", "title": "不说话", "who": "both",
     "text": "接下来两张，只用动作和眼神。说「停」不算破例。",
     "alt": "想说话就说，没人会记着。"},
    {"id": "tell", "effect": "tell", "title": "说一件", "who": "both",
     "text": "各说一件今天没来得及说的小事。对方只听着，不接话。",
     "alt": "想不出来，就说今天最想吃什么。"},
    {"id": "pick", "effect": "pick", "title": "挑一张", "who": "both",
     "text": "下一张，从三张里挑。另外两张放回牌堆，跳过次数不变。",
     "alt": "不想挑就直接抽，一样算。"},
    {"id": "eyes", "effect": "eyes", "title": "闭上眼", "who": "both",
     "text": "下一张，闭着眼做。做完再睁开。",
     "alt": "不想闭眼，就让对方的手盖住你的眼睛。"},
]
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
        "rules": RULES,
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
