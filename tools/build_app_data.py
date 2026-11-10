#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_app_data.py — 把清洗后的词库编译为前端可分片加载的数据

输出：
  app/data/meta.js      统计信息
  app/data/core.js      核心词条（HSK + 高频 + 单字），首屏即用
  app/data/index.js     全量词头索引（zh + bucket + idx），用于搜索
  app/data/chunks/*.js  全量词条，按 64 个桶分片，按需加载
"""
import hashlib
import io
import json
import os
import re
import time
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLEAN = os.path.join(ROOT, "data", "clean")
APP_DATA = os.path.join(ROOT, "app", "data")
CHUNKS = os.path.join(APP_DATA, "chunks")
os.makedirs(CHUNKS, exist_ok=True)

NBUCKET = 64
CORE_TOP = 12000


def load_hsk():
    p = os.path.join(ROOT, "data", "hsk_all.tsv")
    s = {}
    with io.open(p, encoding="utf-8-sig") as f:
        for i, line in enumerate(f):
            c = line.split("\t")
            if c and c[0].strip():
                s[c[0].strip()] = i + 1
    return s


def load_modern():
    p = os.path.join(ROOT, "data", "modern_chinese_words.tsv")
    s = {}
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
            w = c[1].strip()
            if w and w not in s:
                s[w] = rank
    return s


def bucket_of(zh):
    h = hashlib.md5(zh.encode("utf-8")).hexdigest()
    return int(h[:8], 16) % NBUCKET


def norm_uey(s):
    s = unicodedata.normalize("NFKC", s or "")
    s = re.sub(r"[\u200B-\u200F\u202A-\u202E\u2066-\u2069\u0640]", "", s)
    s = s.replace("\u06A9", "\u0643").replace("\u06CC", "\u064A")
    s = s.replace("\u0647", "\u06D5").replace("\u0629", "\u06D5")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def load_reverse():
    """维->中 反查表：维语词 -> 中文释义串，用于义项排序。"""
    rev = {}
    p = os.path.join(CLEAN, "ug_zh.jsonl")
    with io.open(p, encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            k = norm_uey(r.get("uey", ""))
            if not k:
                continue
            g = " ".join(r.get("zh", []))[:240]
            rev[k] = (rev.get(k, "") + " " + g)[:480]
    print("reverse map", len(rev))
    return rev


def sense_score(zh, uey, rev):
    g = rev.get(norm_uey(uey), "")
    if not g:
        return 0
    if zh in g:
        return 3
    if any(ch in g for ch in zh if "\u4e00" <= ch <= "\u9fff"):
        return 1
    return 0


def split_pairs(senses):
    """把「ئىچمەك، ئىچىشمەك」拆成两个义项；两边数量不一致时保留原样。"""
    out = []
    for pair in senses:
        uey, uly = pair[0], pair[1]
        up = [x.strip() for x in re.split(r"[\u060C,]", uey) if x.strip()]
        lp = [x.strip() for x in re.split(r"[\u060C,]", uly) if x.strip()]
        if len(up) == len(lp) and len(up) > 1:
            out.extend(zip(up, lp))
        else:
            out.append((uey, uly))
    seen = set()
    res = []
    for u, l in out:
        k = (u, l)
        if k in seen:
            continue
        seen.add(k)
        res.append([u, l])
    return res


def clean_py(py):
    py = (py or "").strip()
    # 有些条目把注释写在拼音位，剔除无拉丁字母的
    if not re.search(r"[A-Za-zÀ-ÖØ-öø-ÿ]", py):
        return ""
    # 去掉【...】注释
    py = re.sub(r"【[^】]*】", "", py).strip()
    return py


def main():
    rows = []
    with io.open(os.path.join(CLEAN, "zh_ug.jsonl"), encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            r["py"] = clean_py(r.get("py"))
            if not r["senses"]:
                continue
            rows.append(r)

    # 合并同词头（仅 1 例）
    merged = {}
    order = []
    for r in rows:
        zh = r["zh"]
        if zh in merged:
            merged[zh]["senses"].extend(r["senses"])
        else:
            merged[zh] = r
            order.append(zh)
    rows = [merged[z] for z in order]
    print("unique entries", len(rows))

    hsk = load_hsk()
    modern = load_modern()
    rev = load_reverse()

    # 义项排序：先拆同义词串，再按反查释义命中排序
    for r in rows:
        r["senses"] = split_pairs(r["senses"])
        scored = []
        for i, s in enumerate(r["senses"]):
            scored.append((-(sense_score(r["zh"], s[0], rev)), i, s))
        scored.sort(key=lambda x: (x[0], x[1]))
        r["senses"] = [x[2] for x in scored]

    def rank_of(zh):
        if zh in modern:
            return modern[zh]
        if zh in hsk:
            return 100000 + hsk[zh]
        return 999999

    for r in rows:
        r["rank"] = rank_of(r["zh"])

    rows.sort(key=lambda r: (r["rank"], len(r["zh"]), r["zh"]))

    # 核心：高频 + 全部单字
    core = []
    seen = set()
    for r in rows:
        if len(core) < CORE_TOP and r["rank"] < 900000:
            core.append(r)
            seen.add(r["zh"])
    for r in rows:
        if len(r["zh"]) == 1 and r["zh"] not in seen:
            core.append(r)
            seen.add(r["zh"])
    core.sort(key=lambda r: (r["rank"], len(r["zh"]), r["zh"]))
    print("core entries", len(core))

    # 桶
    buckets = [[] for _ in range(NBUCKET)]
    for r in rows:
        r["bucket"] = bucket_of(r["zh"])
        r["idx"] = len(buckets[r["bucket"]])
        buckets[r["bucket"]].append(r)

    def compact(r):
        return [r["zh"], r["py"] or "", [[s[0], s[1]] for s in r["senses"]]]

    # meta
    total_senses = sum(len(r["senses"]) for r in rows)
    ug_entries = 0
    inv_path = os.path.join(CLEAN, "ug_zh_inv.jsonl")
    if os.path.exists(inv_path):
        with io.open(inv_path, encoding="utf-8") as sf:
            ug_entries = sum(1 for _ in sf)
    else:
        stats_path = os.path.join(CLEAN, "stats.json")
        if os.path.exists(stats_path):
            try:
                with io.open(stats_path, encoding="utf-8") as sf:
                    ug_entries = json.load(sf).get("ug_zh", {}).get("entries", 0)
            except Exception:
                pass
    with io.open(os.path.join(APP_DATA, "meta.js"), "w", encoding="utf-8") as f:
        f.write("window.LEX_META=" + json.dumps({
            "entries": len(rows),
            "senses": total_senses,
            "core": len(core),
            "ugEntries": ug_entries,
            "version": "0.1.0",
            "built": time.strftime("%Y-%m-%d %H:%M:%S"),
            "src": "Anatilim"
        }, ensure_ascii=False) + ";\n")

    # core
    with io.open(os.path.join(APP_DATA, "core.js"), "w", encoding="utf-8") as f:
        f.write("window.CORE=[")
        for i, r in enumerate(core):
            if i:
                f.write(",")
            f.write(json.dumps(compact(r), ensure_ascii=False, separators=(",", ":")))
        f.write("];\n")
    print("core.js MB", round(os.path.getsize(os.path.join(APP_DATA, "core.js")) / 1048576, 2))

    # index
    with io.open(os.path.join(APP_DATA, "index.js"), "w", encoding="utf-8") as f:
        f.write("window.LEX_INDEX=")
        lines = []
        for r in rows:
            lines.append(f"{r['zh']}\t{r['bucket']}\t{r['idx']}")
        f.write(json.dumps("\n".join(lines), ensure_ascii=False))
        f.write(";\n")
    print("index.js MB", round(os.path.getsize(os.path.join(APP_DATA, "index.js")) / 1048576, 2))

    # chunks
    for b in range(NBUCKET):
        arr = buckets[b]
        if not arr:
            continue
        with io.open(os.path.join(CHUNKS, f"b{b:02d}.js"), "w", encoding="utf-8") as f:
            f.write(f'(window.CHUNKS=window.CHUNKS||{{}})["b{b:02d}"]=[')
            for i, r in enumerate(arr):
                if i:
                    f.write(",")
                f.write(json.dumps(compact(r), ensure_ascii=False, separators=(",", ":")))
            f.write("];\n")

    print("chunks", len([x for x in os.listdir(CHUNKS) if x.endswith(".js")]))
    print("total senses", total_senses)


if __name__ == "__main__":
    main()
