#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
invert_zh_ug.py — 由已严格对齐的中→维词库反演维→中词库

为什么不用 UyCn 文件：UEY/ULY 两份文件存在行偏移，直接按行配对会错位
（例如「ئۆي」被配成「öy atlash…」）。中→维的 328,902 行是逐行严格对齐的，
从它反演可以保证每条维语词的中文释义与维文写法一致。
"""
import io
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLEAN = os.path.join(ROOT, "data", "clean")


def split_pairs(uey, uly):
    up = [x.strip() for x in re.split(r"[\u060C,]", uey) if x.strip()]
    lp = [x.strip() for x in re.split(r"[\u060C,]", uly) if x.strip()]
    if len(up) == len(lp) and len(up) > 1:
        return list(zip(up, lp))
    return [(uey, uly)]


def load_modern():
    s = {}
    p = os.path.join(ROOT, "data", "modern_chinese_words.tsv")
    with io.open(p, encoding="utf-8-sig") as f:
        f.readline()
        for line in f:
            c = line.rstrip("\n").split("\t")
            if len(c) < 3:
                continue
            try:
                rank = int(c[0])
            except ValueError:
                continue
            if c[1] and c[1] not in s:
                s[c[1]] = rank
    return s


def main():
    modern = load_modern()
    rev = {}
    total = 0
    with io.open(os.path.join(CLEAN, "zh_ug.jsonl"), encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            zh = r["zh"]
            rank = modern.get(zh, 999999)
            for uey, uly in r["senses"]:
                for u, l in split_pairs(uey, uly):
                    total += 1
                    rec = rev.get(u)
                    if not rec:
                        rec = {"uey": u, "uly": l, "zh": {}, "rank": rank}
                        rev[u] = rec
                    if zh not in rec["zh"]:
                        rec["zh"][zh] = rank
                    # 同一维语词取最短/最规范的 ULY 写法
                    if len(l) < len(rec["uly"]):
                        rec["uly"] = l

    out = []
    for rec in rev.values():
        zhs = sorted(rec["zh"].items(), key=lambda x: (x[1], len(x[0])))[:8]
        out.append({"uey": rec["uey"], "uly": rec["uly"], "zh": [z for z, _ in zhs]})
    print("senses", total, "unique ug", len(out))

    with io.open(os.path.join(CLEAN, "ug_zh_inv.jsonl"), "w", encoding="utf-8") as f:
        for r in out:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print("wrote", os.path.join(CLEAN, "ug_zh_inv.jsonl"))


if __name__ == "__main__":
    main()
