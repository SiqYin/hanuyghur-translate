#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_examples.py — 例句去重、转拉丁维文、写前端数据

输出：
  app/data/examples_core.js       核心词例句（首屏同步）
  app/data/examples_chunks/bXX.js 长尾例句分片（按词头哈希，按需加载）
"""
import io
import json
import os
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "cache", "examples.jsonl")
CORE_WORDS = os.path.join(ROOT, "app", "data", "core_words.txt")
OUT_CORE = os.path.join(ROOT, "app", "data", "examples_core.js")
OUT_DIR = os.path.join(ROOT, "app", "data", "examples_chunks")
MAX_PER_WORD = 2
NBUCKET = 64


def bucket(zh):
    h = 0
    for ch in zh:
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    return h % NBUCKET


def main():
    if not os.path.exists(SRC):
        print("no examples")
        return

    core_words = set()
    if os.path.exists(CORE_WORDS):
        with io.open(CORE_WORDS, encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    core_words.add(line.strip())

    rows = []
    count = {}
    with io.open(SRC, encoding="utf-8") as f:
        for line in f:
            try:
                r = json.loads(line)
            except Exception:
                continue
            zh = r.get("zh")
            if not zh or not r.get("uey") or not r.get("zh_sent"):
                continue
            count[zh] = count.get(zh, 0) + 1
            if count[zh] <= MAX_PER_WORD:
                rows.append(r)

    print("examples", len(rows), "words", len(count))

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

    core = {}
    shards = [dict() for _ in range(NBUCKET)]
    for zh, arr in data.items():
        if zh in core_words:
            core[zh] = arr
        else:
            shards[bucket(zh)][zh] = arr

    os.makedirs(OUT_DIR, exist_ok=True)
    with io.open(OUT_CORE, "w", encoding="utf-8") as f:
        f.write("window.EXAMPLES=")
        f.write(json.dumps(core, ensure_ascii=False, separators=(",", ":")))
        f.write(";\nwindow.EX_COUNT=%d;\n" % len(data))

    total = 0
    for b, part in enumerate(shards):
        total += len(part)
        with io.open(os.path.join(OUT_DIR, f"b{b:02d}.js"), "w", encoding="utf-8") as f:
            f.write(f'(window.EX_CHUNKS=window.EX_CHUNKS||{{}})["b{b:02d}"]=')
            f.write(json.dumps(part, ensure_ascii=False, separators=(",", ":")))
            f.write(";\n")

    print("core words", len(core), "shard words", total)
    print("core.js", round(os.path.getsize(OUT_CORE) / 1024, 1), "KB")
    print("shards", len([x for x in os.listdir(OUT_DIR) if x.endswith(".js")]))


if __name__ == "__main__":
    main()
