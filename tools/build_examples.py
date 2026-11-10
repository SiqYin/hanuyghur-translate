#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""build_examples.py — 例句去重、转拉丁维文、写前端数据"""
import io
import json
import os
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "cache", "examples.jsonl")
OUT = os.path.join(ROOT, "app", "data", "examples.js")
MAX_PER_WORD = 2


def main():
    if not os.path.exists(SRC):
        print("no examples")
        return
    rows = []
    seen = {}
    with io.open(SRC, encoding="utf-8") as f:
        for line in f:
            try:
                r = json.loads(line)
            except Exception:
                continue
            zh = r.get("zh")
            if not zh or not r.get("uey") or not r.get("zh_sent"):
                continue
            seen[zh] = seen.get(zh, 0) + 1
            if seen[zh] <= MAX_PER_WORD:
                rows.append(r)

    print("examples", len(rows), "words", len(seen))

    # 批量转拉丁维文（同一份 ugconv.js）
    payload = "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows)
    p = subprocess.run(
        ["node", os.path.join(ROOT, "tools", "conv_json.js")],
        input=payload.encode("utf-8"), stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    if p.returncode != 0:
        raise SystemExit("conv failed: " + p.stderr.decode("utf-8", "ignore"))

    data = {}
    for line in p.stdout.decode("utf-8").splitlines():
        if not line.strip():
            continue
        r = json.loads(line)
        data.setdefault(r["zh"], []).append([r["zh_sent"], r["uey"], r["uly"]])

    with io.open(OUT, "w", encoding="utf-8") as f:
        f.write("window.EXAMPLES=")
        f.write(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
        f.write(";\n")
    print("wrote", OUT, os.path.getsize(OUT), "bytes", "words", len(data))


if __name__ == "__main__":
    main()
