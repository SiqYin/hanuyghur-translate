#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
translate_examples.py — 复用汉南的 11.4 万条汉文例句，只补维文翻译

来源：D:/项目上下文归档/2026-11-7 汉南辞典/02_数据管线/产出/examples.json
      结构：{ 词头: [汉文例句, 越南语译文] }
做法：取汉文句，过滤，按 4 句一批翻成老维文；缓存/续跑。
"""
import argparse
import concurrent.futures as cf
import io
import json
import os
import re
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import gen_examples as G

DEFAULT_SRC = r"D:/项目上下文归档/2026-11-7 汉南辞典/02_数据管线/产出/examples.json"


def load_pairs(path):
    d = json.load(io.open(path, encoding="utf-8"))
    out = []
    seen = set()
    for zh, v in d.items():
        if not isinstance(v, list) or not v:
            continue
        s = G.clean(v[0])
        if not s or s in seen:
            continue
        if zh not in s:
            continue
        if len(s) < 4 or len(s) > 40:
            continue
        if re.search(r"[A-Za-z\u0600-\u06FF]", s):
            continue
        if re.search(r"https?://|www\.", s):
            continue
        seen.add(s)
        out.append((zh, s))
    return out


def work(batch):
    sents = [s for _, s in batch]
    for attempt in range(2):
        ugs = G.translate(sents)
        if ugs and len(ugs) == len(sents):
            out = []
            for (zh, s), u in zip(batch, ugs):
                if G.valid_pair(zh, s, u):
                    out.append({"zh": zh, "zh_sent": s, "uey": u, "src": "AI+HanViet", "model": G.MODEL})
            if out:
                return batch, out, None
        time.sleep(1.2 * (attempt + 1))
    return batch, [], "batch failed"


MAX_FAIL_STREAK = 12


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default=DEFAULT_SRC)
    ap.add_argument("--out", default="data/cache/examples.jsonl")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--workers", type=int, default=8)
    args = ap.parse_args()

    pairs = load_pairs(args.source)
    print("source pairs", len(pairs), flush=True)

    done = set()
    if os.path.exists(args.out):
        with io.open(args.out, encoding="utf-8") as f:
            for line in f:
                try:
                    done.add(json.loads(line)["zh"])
                except Exception:
                    pass
    todo = [x for x in pairs if x[0] not in done]
    if args.limit:
        todo = todo[:args.limit]
    batches = [todo[i:i + args.batch] for i in range(0, len(todo), args.batch)]
    print(f"done={len(done)} todo={len(todo)} batches={len(batches)}", flush=True)

    os.makedirs(os.path.dirname(os.path.join(ROOT, args.out)), exist_ok=True)
    fout = io.open(os.path.join(ROOT, args.out), "a", encoding="utf-8")
    ok = bad = 0
    streak = 0
    lane = max(2, args.workers)
    t0 = time.time()
    it = iter(batches)
    pending = set()
    with cf.ThreadPoolExecutor(max_workers=args.workers) as ex:
        def fill():
            while len(pending) < lane * 2:
                try:
                    b = next(it)
                except StopIteration:
                    return
                pending.add(ex.submit(work, b))

        fill()
        i = 0
        while pending:
            finished, _ = cf.wait(pending, return_when=cf.FIRST_COMPLETED)
            for fu in finished:
                pending.discard(fu)
                try:
                    batch, out, err = fu.result()
                except Exception:
                    batch, out, err = [], [], "worker error"
                i += 1
                if err:
                    bad += len(batch)
                    streak += 1
                else:
                    streak = 0
                    for r in out:
                        fout.write(json.dumps(r, ensure_ascii=False) + "\n")
                        ok += 1
                fout.flush()
                if i % 20 == 0:
                    dt = max(1, time.time() - t0)
                    print(f"[{i}] ok={ok} bad={bad} {ok/dt:.2f} 句/s", flush=True)
                if streak >= MAX_FAIL_STREAK:
                    print(f"连续 {streak} 批失败（可能是额度或限流），提前停止", flush=True)
                    for x in pending:
                        x.cancel()
                    pending.clear()
                    break
            if streak >= MAX_FAIL_STREAK:
                break
            fill()
    fout.close()
    print(f"DONE ok={ok} bad={bad} elapsed={time.time()-t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
