# -*- coding: utf-8 -*-
"""把霞鹜文楷按「本应用实际用到的字」做子集化，base64 内联成 src/font.css。

为什么要子集化：整套中文 TTF 19 MB，直接用会把单文件撑爆；
按用字裁剪后通常只剩两三百 KB，双击打开也有统一好看的字体。

用法：
  python tools/make_font.py                 # 重新生成 src/font.css
  python tools/make_font.py --report        # 只看字符数与预估体积
"""
import base64
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")
CARDS = os.path.join(SRC, "cards")
TTF = os.path.join(ROOT, "tmp", "wenkai-regular.ttf")
TTF_URL = "https://fastly.jsdelivr.net/gh/lxgw/LxgwWenKai@v1.510/fonts/TTF/LXGWWenKai-Regular.ttf"
OUT = os.path.join(SRC, "font.css")

# 兜底字符：ASCII + 中文标点 + 数字符号，保证界面文案不会掉字
EXTRA = (
    "".join(chr(c) for c in range(0x20, 0x7F))
    + "·—…、。，！？：；（）「」『』《》【】〈〉“”‘’～￥¥％‰°×÷±≤≥"
    + "①②③④⑤⑥⑦⑧⑨⑩♡♥☀◐☾●↺❙│┃"
)


def collect_chars():
    buf = []
    for name in ("tier1.json", "tier2.json", "tier3.json", "props.json"):
        with io.open(os.path.join(CARDS, name), encoding="utf-8") as f:
            buf.append(f.read())
    for name in ("app.html", "theme.css"):
        with io.open(os.path.join(SRC, name), encoding="utf-8") as f:
            buf.append(f.read())
    text = "\n".join(buf)
    # 去掉 base64 与注释里的噪声，只保留真正会显示的字
    text = re.sub(r"data:[^\"')]+", " ", text)
    text = re.sub(r"/\*.*?\*/", " ", text, flags=re.S)
    chars = {c for c in text if c.isprintable() and not c.isspace()}
    chars |= set(EXTRA)
    return "".join(sorted(chars))


def ensure_ttf():
    """字体源 TTF 不随仓库分发（19 MB），缺失时按需下载到 tmp/。"""
    if os.path.exists(TTF):
        return True
    os.makedirs(os.path.dirname(TTF), exist_ok=True)
    print(f"↓ 下载字体源（约 19 MB）：{TTF_URL}")
    try:
        import urllib.request
        with urllib.request.urlopen(TTF_URL, timeout=600) as r, open(TTF, "wb") as f:
            f.write(r.read())
    except Exception as e:
        print(f"!! 下载失败：{e}")
        print(f"   请手动下载后放到 {TTF}")
        return False
    print(f"✓ 已下载 {os.path.getsize(TTF) / 1048576:.1f} MB")
    return True


def main():
    if not ensure_ttf():
        return 1

    chars = collect_chars()
    print(f"用字 {len(chars)} 个")

    from fontTools import subset

    opts = subset.Options()
    opts.flavor = "woff2"
    opts.desubroutinize = True
    opts.hinting = False
    opts.layout_features = []
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    opts.recalc_bounds = True
    opts.drop_tables += ["DSIG"]

    font = subset.load_font(TTF, opts)
    sub = subset.Subsetter(options=opts)
    sub.populate(text=chars)
    sub.subset(font)

    buf = io.BytesIO()
    font.save(buf)
    data = buf.getvalue()
    font.close()

    b64 = base64.b64encode(data).decode("ascii")
    css = (
        "/* 霞鹜文楷 Regular · 按本应用用字子集化后内联（SIL OFL 1.1）\n"
        "   字库来源：https://github.com/lxgw/LxgwWenKai\n"
        f"   子集 {len(chars)} 字 / {len(data) / 1024:.0f} KB woff2 */\n"
        '@font-face{\n  font-family:"WenKai";\n'
        f'  src:url(data:font/woff2;base64,{b64}) format("woff2");\n'
        "  font-weight:400; font-style:normal; font-display:block;\n}\n"
    )
    with io.open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(css)

    print(f"woff2 {len(data) / 1024:.0f} KB → base64 {len(css) / 1024:.0f} KB")
    print(f"✓ 已写出 {os.path.relpath(OUT, ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
