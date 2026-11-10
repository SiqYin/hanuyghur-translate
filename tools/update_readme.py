#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 app/data/meta.js 与例句缓存里的真实数字同步到三份 README 的 <!--st:key--> 标记中。"""
import io
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def meta():
    s = io.open(os.path.join(ROOT, "app", "data", "meta.js"), encoding="utf-8").read()
    m = re.search(r"window\.LEX_META=(\{.*?\});", s)
    return json.loads(m.group(1)) if m else {}


def examples():
    p = os.path.join(ROOT, "data", "cache", "examples.jsonl")
    seen = set()
    if os.path.exists(p):
        with io.open(p, encoding="utf-8") as f:
            for line in f:
                try:
                    seen.add(json.loads(line)["zh"])
                except Exception:
                    pass
    return len(seen)


def main():
    m = meta()
    vals = {
        "entries": m.get("entries", 0),
        "senses": m.get("senses", 0),
        "ug": m.get("ugEntries", 0),
        "pairs": m.get("senses", 0),
        "core": m.get("core", 0),
        "examples": examples() or 0,
    }
    for name in ("README.md", "README.en.md", "README.ug.md"):
        p = os.path.join(ROOT, name)
        s = io.open(p, encoding="utf-8").read()
        for k, v in vals.items():
            s = re.sub(r"(<!--st:%s-->)[^<]*(<!--/st:%s-->)" % (k, k),
                       lambda mm: mm.group(1) + format(v, ",") + mm.group(2), s)
        io.open(p, "w", encoding="utf-8").write(s)
    print("readme stats:", vals)


if __name__ == "__main__":
    main()
