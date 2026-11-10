#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成汉维辞典 logo：左上 #000000 -> 右下 #3A6DA2 渐变底 + 中央白色五瓣梅花。"""
import io
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "app", "assets")

PETAL = (
    "M256 244 C216 222 200 160 213 121 C219 102 237 91 246 104 L256 126 L266 104 C275 91 293 102 299 121 C312 160 296 222 256 244 Z"
)


def svg(rounded=True, bg=True):
    rect = (
        '<rect width="512" height="512" rx="104" fill="url(#g)"/>'
        if rounded
        else '<rect width="512" height="512" fill="url(#g)"/>'
    )
    if not bg:
        rect = ""
    petals = "".join(
        '<g transform="rotate(%d 256 256)"><path d="%s"/></g>' % (72 * i, PETAL)
        for i in range(5)
    )
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="汉维辞典">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#000000"/>
<stop offset="1" stop-color="#3A6DA2"/>
</linearGradient>
</defs>
{rect}
<g fill="#FFFFFF" transform="translate(256 256) scale(1.05) translate(-256 -256)">{petals}</g>
</svg>
"""


def main():
    os.makedirs(OUT, exist_ok=True)
    with io.open(os.path.join(OUT, "logo.svg"), "w", encoding="utf-8") as f:
        f.write(svg())
    # 无圆角版：Android 自适应图标前景 / 需要方形时使用
    with io.open(os.path.join(OUT, "logo-square.svg"), "w", encoding="utf-8") as f:
        f.write(svg(rounded=False))
    print("wrote", os.path.join(OUT, "logo.svg"))


if __name__ == "__main__":
    main()
