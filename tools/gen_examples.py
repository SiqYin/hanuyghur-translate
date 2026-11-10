#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_examples.py — 中维双语例句生成（单词级、带标签、缓存、续跑）

经验：多词 JSON 批量会让模型把维文写进中文字段；
单词级「中文：/维文：」两行格式最稳，接近 100% 可用。
"""
import argparse
import concurrent.futures as cf
import io
import json
import os
import re
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = os.environ.get("UG_API_BASE", "https://index-translate.bilibili.com/v1").rstrip("/") + "/chat/completions"
MODEL = os.environ.get("UG_API_MODEL", "Index-Translate-35B-A3B")
KEY = os.environ.get("UG_API_KEY", "EMPTY")
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

AR = re.compile(r"[\u0600-\u06FF]")
CJK = re.compile(r"[\u3400-\u4DBF\u4E00-\u9FFF]")

STOP = set("""
的 是 在 一 有 和 不 了 人 我 他 这 个 上 们 来 到 时 大 地 为 子 中 你 说 生 国 年 着 就 那 要 她 出 也 得 里 后 自 以 会 家 可 下 而 过 天 去 能 对 小 多 然 于 心 学 么 之 都 好 看 起 发 当 没 成 只 如 事 把 还 用 第 样 道 想 作 种 开 美 总 从 无 情 己 面 最 女 但 现 前 些 所 同 日 手 又 行 意 动 方 期 它 头 经 长 儿 回 位 分 爱 老 因 很 给 名 法 间 斯 知 世 什 两 次 使 身 者 被 高 已 亲 其 进 此 话 常 与 活 正 感 见 明 问 力 理 业 本 外 性 点 望 教 体 认 边 等 别 真 打 便 四 五 六 七 八 九 十 百 千 万 亿 号 月 分 秒 只 条 张 件 双 群 批 吗 呢 吧 啊 呀 哦 嗯 哈 着 了 过 的 地 得 和 与 及 或 而 但 却 若 如 虽 然 则 就 才 又 再 也 都 很 太 更 最 仅 还 已 曾 正 将 会 能 可 要 想 应 该 必 须 没 别 勿 莫 未 无 非 否 把 被 给 对 向 往 从 到 在 于 为 以 因 由 跟 同 己 其 之 所 者 矣 焉 哉 乎 兮
""".split())


def clean(s):
    return re.sub(r"\s+", " ", str(s or "")).strip()


def prompt_for(w):
    return (
        f"词：{w}\n"
        "请完成两步：\n"
        f"1. 用“{w}”写一个简单、自然的中文例句（8-14个字），只写句子。\n"
        "2. 把这个中文句子翻译成维吾尔语（老维文，2009 标准正字法，SOV 语序），只写维文句子。\n"
        "严格按两行输出：\n"
        "中文：<句子>\n"
        "维文：<句子>"
    )


def call(prompt):
    body = json.dumps({
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 400, "temperature": 0
    }, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(API, data=body, headers={
        "Content-Type": "application/json", "Authorization": "Bearer " + KEY,
        "Accept": "application/json", "User-Agent": UA
    }, method="POST")
    with urllib.request.urlopen(req, timeout=90) as r:
        d = json.loads(r.read().decode("utf-8"))
    return d["choices"][0]["message"]["content"]


def parse(content, word):
    zh = ug = ""
    for line in str(content or "").splitlines():
        s = line.strip()
        m = re.match(r"^中文\s*[:：]\s*(.+)$", s)
        if m:
            zh = clean(m.group(1))
            continue
        m = re.match(r"^维文\s*[:：]\s*(.+)$", s)
        if m:
            ug = clean(m.group(1))
    if not zh or not ug:
        return None, "no fields"
    if not CJK.search(zh) or AR.search(zh):
        return None, "zh not chinese"
    if not AR.search(ug) or CJK.search(ug):
        return None, "ug not uyghur"
    if word not in zh:
        return None, "word missing"
    if len(zh) < 4 or len(zh) > 80 or len(ug) > 220:
        return None, "length"
    return {"zh": word, "zh_sent": zh, "uey": ug, "src": "AI", "model": MODEL}, None


def work(batch):
    out = []
    errs = []
    for w, _rank in batch:
        ok = False
        for attempt in range(3):
            try:
                c = call(prompt_for(w))
                rec, err = parse(c, w)
                if rec:
                    out.append(rec)
                    ok = True
                    break
                errs.append(f"{w}:{err}")
            except Exception as e:
                errs.append(f"{w}:{str(e)[:40]}")
            time.sleep(1.2 * (attempt + 1))
        if not ok:
            continue
    return batch, out, ("; ".join(errs[:4]) if errs else None)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=300)
    ap.add_argument("--batch", type=int, default=3)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--out", default="data/cache/examples.jsonl")
    args = ap.parse_args()

    hsk = set()
    with io.open(os.path.join(ROOT, "data", "hsk_all.tsv"), encoding="utf-8-sig") as f:
        for line in f:
            c = line.split("\t")
            if c and c[0].strip():
                hsk.add(c[0].strip())

    words = []
    with io.open(os.path.join(ROOT, "data", "modern_chinese_words.tsv"), encoding="utf-8-sig") as f:
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
            if not w or not CJK.search(w) or len(w) > 8:
                continue
            if w in STOP:
                continue
            if len(w) == 1 and w not in hsk:
                continue
            words.append((w, rank))
            if args.limit and len(words) >= args.limit:
                break

    have = set()
    with io.open(os.path.join(ROOT, "data", "clean", "zh_ug.jsonl"), encoding="utf-8") as f:
        for line in f:
            have.add(json.loads(line)["zh"])
    words = [x for x in words if x[0] in have]

    done = set()
    if os.path.exists(args.out):
        with io.open(args.out, encoding="utf-8") as f:
            for line in f:
                try:
                    done.add(json.loads(line)["zh"])
                except Exception:
                    pass
    todo = [x for x in words if x[0] not in done]
    batches = [todo[i:i + args.batch] for i in range(0, len(todo), args.batch)]
    print(f"words={len(words)} done={len(done)} todo={len(todo)} batches={len(batches)}", flush=True)

    os.makedirs(os.path.dirname(os.path.join(ROOT, args.out)), exist_ok=True)
    fout = io.open(os.path.join(ROOT, args.out), "a", encoding="utf-8")
    ok = bad = 0
    t0 = time.time()
    with cf.ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = [ex.submit(work, b) for b in batches]
        for i, fu in enumerate(cf.as_completed(futs), 1):
            batch, out, err = fu.result()
            if err:
                bad += max(1, len(batch) - len(out))
            for r in out:
                fout.write(json.dumps(r, ensure_ascii=False) + "\n")
                ok += 1
            fout.flush()
            if i % 5 == 0 or i == len(batches):
                print(f"[{i}/{len(batches)}] ok={ok} bad={bad} {ok/max(1,time.time()-t0):.2f}/s", flush=True)
    fout.close()
    print(f"DONE ok={ok} bad={bad} elapsed={time.time()-t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
