#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
import_anatilim.py — 导入 Anatilim 汉维/维汉词典
源文件：ChineseUyghurStarDict*.txt（制表符 + 全角分号）
输出：data/clean/zh_ug.jsonl、data/clean/ug_zh.jsonl、data/clean/stats.json
"""
import io
import json
import os
import re
import unicodedata
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw", "anatilim")
OUT = os.path.join(ROOT, "data", "clean")
os.makedirs(OUT, exist_ok=True)

AR = re.compile(r"[\u0600-\u06FF]")
LAT = re.compile(r"[A-Za-zÀ-ÖØ-öø-ÿ]")
CJK = re.compile(r"[\u3400-\u4DBF\u4E00-\u9FFF]")
CTRL = re.compile(r"[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]")


def clean(s):
    s = unicodedata.normalize("NFKC", str(s or ""))
    s = CTRL.sub("", s)
    s = re.sub(r"[\u200B-\u200F\u202A-\u202E\u2066-\u2069]", "", s)
    s = s.replace("\u00A0", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def split_senses(rest):
    parts = re.split(r"[；;]", rest)
    return [clean(x) for x in parts if clean(x)]


def read_lines(fn):
    with io.open(os.path.join(RAW, fn), encoding="utf-8-sig", errors="replace") as f:
        return f.read().splitlines()


def import_zh_ug():
    uey_lines = read_lines("ChineseUyghurStarDict.txt")
    uly_lines = read_lines("ChineseUyghurStarDict_CnUy_ULY.txt")
    assert len(uey_lines) == len(uly_lines), (len(uey_lines), len(uly_lines))

    out = []
    sense_total = 0
    skipped = 0
    no_valid = 0
    for a, b in zip(uey_lines, uly_lines):
        if "\t\t" not in a or "\t\t" not in b:
            skipped += 1
            continue
        ha, ra = a.split("\t\t", 1)
        hb, rb = b.split("\t\t", 1)
        zh = clean(ha)
        if not zh or zh != clean(hb):
            skipped += 1
            continue

        sa = split_senses(ra)
        sb = split_senses(rb)
        if not sa or not sb:
            skipped += 1
            continue

        py = sa[0]
        ug_uey = sa[1:]
        ug_uly = sb[1:]

        senses = []
        for i in range(min(len(ug_uey), len(ug_uly))):
            u = clean(ug_uey[i])
            l = clean(ug_uly[i])
            if not u or not l:
                continue
            if not AR.search(u) or not LAT.search(l):
                continue
            # 去掉汉文残留（个别条目混入）
            if CJK.search(u):
                continue
            senses.append([u, l])

        if not senses:
            no_valid += 1
            continue
        sense_total += len(senses)
        out.append({"zh": zh, "py": py, "senses": senses, "src": "anatilim"})

    with io.open(os.path.join(OUT, "zh_ug.jsonl"), "w", encoding="utf-8") as f:
        for r in out:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    print(f"zh_ug: entries={len(out)} senses={sense_total} skipped={skipped} no_valid={no_valid}")
    return {"entries": len(out), "senses": sense_total, "skipped": skipped, "no_valid": no_valid}


def import_ug_zh():
    uey_lines = read_lines("ChineseUyghurStarDict_UyCn.txt")
    uly_lines = read_lines("ChineseUyghurStarDict_UyCn_ULY.txt")
    print(f"ug_zh raw lines: uey={len(uey_lines)} uly={len(uly_lines)}")

    n = min(len(uey_lines), len(uly_lines))
    out = []
    gloss_total = 0
    mismatch = 0
    no_valid = 0
    for i in range(n):
        a = uey_lines[i]
        b = uly_lines[i]
        if "\t\t" not in a or "\t\t" not in b:
            continue
        ha, ra = a.split("\t\t", 1)
        hb, rb = b.split("\t\t", 1)
        uey = clean(ha)
        uly = clean(hb)
        if not uey or not AR.search(uey):
            continue
        if not uly or not LAT.search(uly):
            continue
        # 逐行配对；头部不一致时用汉文释义做弱校验，仍保留
        if clean(hb) != clean(ha):
            mismatch += 1

        zh_parts = split_senses(ra)
        zh_parts_b = split_senses(rb)
        glosses = []
        for z in zh_parts:
            if CJK.search(z):
                glosses.append(z)
        if not glosses:
            no_valid += 1
            continue
        gloss_total += len(glosses)
        out.append({"uey": uey, "uly": uly, "zh": glosses[:8], "src": "anatilim"})

    with io.open(os.path.join(OUT, "ug_zh.jsonl"), "w", encoding="utf-8") as f:
        for r in out:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    print(f"ug_zh: entries={len(out)} glosses={gloss_total} mismatch={mismatch} no_valid={no_valid}")
    return {"entries": len(out), "glosses": gloss_total, "mismatch": mismatch, "no_valid": no_valid}


def main():
    s1 = import_zh_ug()
    s2 = import_ug_zh()
    stats = {"zh_ug": s1, "ug_zh": s2}
    with io.open(os.path.join(OUT, "stats.json"), "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)
    print(json.dumps(stats, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
