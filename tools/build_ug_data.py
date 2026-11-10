#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""build_ug_data.py — 编译维→中反向词库（索引 + 64 分片）"""
import hashlib
import io
import json
import os
import re
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLEAN = os.path.join(ROOT, "data", "clean")
APP_DATA = os.path.join(ROOT, "app", "data")
CHUNKS = os.path.join(APP_DATA, "ug_chunks")
os.makedirs(CHUNKS, exist_ok=True)
NBUCKET = 64


def norm_uey(s):
    s = unicodedata.normalize("NFKC", s or "")
    s = re.sub(r"[\u200B-\u200F\u202A-\u202E\u2066-\u2069\u0640]", "", s)
    s = s.replace("\u06A9", "\u0643").replace("\u06CC", "\u064A")
    s = s.replace("\u0647", "\u06D5").replace("\u0629", "\u06D5")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def ug_key(uly):
    s = (uly or "").lower()
    s = s.replace("ë", "é").replace("v", "ü")
    s = s.replace("é", "e").replace("ö", "o").replace("ü", "u")
    s = s.replace("'", "").replace("’", "")
    return re.sub(r"[^a-z]", "", s)


def bucket_of(s):
    h = hashlib.md5(s.encode("utf-8")).hexdigest()
    return int(h[:8], 16) % NBUCKET


def main():
    rows = []
    with io.open(os.path.join(CLEAN, "ug_zh_inv.jsonl"), encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            uey = norm_uey(r.get("uey", ""))
            uly = (r.get("uly") or "").strip()
            zh = r.get("zh") or []
            if not uey or not uly or not zh:
                continue
            k = ug_key(uly)
            if not k:
                continue
            rows.append([uey, uly, [z for z in zh if z][:8], k])
    print("rows", len(rows))

    buckets = [[] for _ in range(NBUCKET)]
    index = []
    for uey, uly, zh, k in rows:
        b = bucket_of(uey)
        idx = len(buckets[b])
        buckets[b].append([uey, uly, zh])
        index.append(f"{k}\t{uly}\t{b}\t{idx}")

    with io.open(os.path.join(APP_DATA, "ug_index.js"), "w", encoding="utf-8") as f:
        f.write("window.UG_INDEX=")
        f.write(json.dumps("\n".join(index), ensure_ascii=False))
        f.write(";\n")
    print("ug_index MB", round(os.path.getsize(os.path.join(APP_DATA, "ug_index.js")) / 1048576, 2))

    for b in range(NBUCKET):
        arr = buckets[b]
        if not arr:
            continue
        with io.open(os.path.join(CHUNKS, f"b{b:02d}.js"), "w", encoding="utf-8") as f:
            f.write(f'(window.UG_CHUNKS=window.UG_CHUNKS||{{}})["b{b:02d}"]=[')
            for i, r in enumerate(arr):
                if i:
                    f.write(",")
                f.write(json.dumps(r, ensure_ascii=False, separators=(",", ":")))
            f.write("];\n")
    print("chunks", len([x for x in os.listdir(CHUNKS) if x.endswith(".js")]))


if __name__ == "__main__":
    main()
