# -*- coding: utf-8 -*-
"""把 src/theme.css 内联进 src/app.html 的 <style> 块。

可反复执行：每次都整体替换 <style>…</style> 之间的内容。
用法： python tools/apply_theme.py
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(ROOT, "src", "app.html")
CSS = os.path.join(ROOT, "src", "theme.css")
FONT = os.path.join(ROOT, "src", "font.css")


def main():
    with open(APP, encoding="utf-8") as f:
        html = f.read()
    with open(CSS, encoding="utf-8") as f:
        css = f.read().strip()
    # 字体子集放在最前面，@font-face 与使用顺序无关，但读起来更清楚
    if os.path.exists(FONT):
        with open(FONT, encoding="utf-8") as f:
            css = f.read().strip() + "\n\n" + css
        print(f"已合并 font.css（{os.path.getsize(FONT) // 1024} KB）")
    else:
        print("!! 没有 src/font.css，将使用系统字体回退")

    new, n = re.subn(r"<style>.*?</style>", "<style>\n" + css + "\n</style>", html, flags=re.S)
    if n != 1:
        print(f"!! 匹配到 {n} 个 <style>，预期 1 个")
        return 1
    # 必须显式 newline="\n"：Windows 下文本模式会把整个模板写成 CRLF，
    # 之后每次构建都会变成全文件 diff。
    with open(APP, "w", encoding="utf-8", newline="\n") as f:
        f.write(new)
    print(f"已内联 theme.css（{len(css)} 字节）到 app.html")
    return 0


if __name__ == "__main__":
    sys.exit(main())
