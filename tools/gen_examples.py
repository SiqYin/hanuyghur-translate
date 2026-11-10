#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_examples.py — 汉维双语例句批量生成（两段式、缓存、续跑）

两段式：
  1) 一次给 8 个汉文词，生成 8 条汉文例句（一行一条）
  2) 把这 8 条汉文例句一次翻成老维文（一行一条）

比单词级快 6–10 倍；两段都做行数/字符集校验，失败批不落缓存，下次续跑。
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
TR_CHUNK = int(os.environ.get("UG_TR_CHUNK", "4"))
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

AR = re.compile(r"[\u0600-\u06FF]")
CJK = re.compile(r"[\u3400-\u4DBF\u4E00-\u9FFF]")

STOP = set("""
的 是 在 一 有 和 不 了 人 我 他 这 个 上 们 来 到 时 大 地 为 子 中 你 说 生 国 年 着 就 那 要 她 出 也 得 里 后 自 以 会 家 可 下 而 过 天 去 能 对 小 多 然 于 心 学 么 之 都 好 看 起 发 当 没 成 只 如 事 把 还 用 第 样 道 想 作 种 开 美 总 从 无 情 己 面 最 女 但 现 前 些 所 同 日 手 又 行 意 动 方 期 它 头 经 长 儿 回 位 分 爱 老 因 很 给 名 法 间 斯 知 世 什 两 次 使 身 者 被 高 已 亲 其 进 此 话 常 与 活 正 感 见 明 问 力 理 业 本 外 性 点 望 教 体 认 边 等 别 真 打 便 四 五 六 七 八 九 十 百 千 万 亿 号 月 分 秒 只 条 张 件 双 群 批 吗 呢 吧 啊 呀 哦 嗯 哈 着 了 过 的 地 得 和 与 及 或 而 但 却 若 如 虽 然 则 就 才 又 再 也 都 很 太 更 最 仅 还 已 曾 正 将 会 能 可 要 想 应 该 必 须 没 别 勿 莫 未 无 非 否 把 被 给 对 向 往 从 到 在 于 为 以 因 由 跟 同 己 其 之 所 者 矣 焉 哉 乎 兮 我们 他们 她们 咱们 自己 这样 这个 那个 这些 那些 这里 那里 什么 怎么 为什么 因为 所以 但是 而且 如果 虽然 可以 应该 需要 已经 还是 就是 只是 那样 一样 一些 有的 有些 大家 人家 别人 东西 时候 地方 方面 情况
""".split())


def clean(s):
    s = str(s or "").strip()
    s = re.sub(r"^\s*(?:\d+[\.、\)\-]|[-*•])\s*", "", s)
    s = s.strip("“”\"'` ")
    return re.sub(r"\s+", " ", s).strip()


def call(prompt, max_tokens=1000):
    body = json.dumps({
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens, "temperature": 0
    }, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(API, data=body, headers={
        "Content-Type": "application/json", "Authorization": "Bearer " + KEY,
        "Accept": "application/json", "User-Agent": UA
    }, method="POST")
    with urllib.request.urlopen(req, timeout=120) as r:
        d = json.loads(r.read().decode("utf-8"))
    return d["choices"][0]["message"]["content"]


def lines_of(content):
    out = []
    for line in str(content or "").splitlines():
        s = clean(line)
        if s:
            out.append(s)
    return out


def gen_sentences(words):
    p = ("请为下列每个汉文词写一个简单、自然的汉文例句（8-14个字）。每词一行，只输出句子，不要编号、不要解释。\n"
         "汉文例句只能出现汉字，绝对不能出现维吾尔字母。\n"
         "待处理词：" + "、".join(words))
    lines = lines_of(call(p, max_tokens=900))
    if len(lines) != len(words):
        # 试图按词找回，允许模型漏掉个别
        used = set()
        pairs = []
        for w in words:
            for i, l in enumerate(lines):
                if i not in used and w in l:
                    used.add(i)
                    pairs.append((w, l))
                    break
        if len(pairs) < max(2, len(words) // 2):
            return None
        return pairs
    return list(zip(words, lines))


def translate(sentences):
    # 网关对长请求会 504；每 4 句一批，失败重试
    out = []
    for i in range(0, len(sentences), TR_CHUNK):
        chunk = sentences[i:i + TR_CHUNK]
        p = ("把下列汉文句子逐句翻译成维吾尔语（老维文，2009 标准正字法，SOV 语序）。每句一行，只输出维文，不要编号、不要解释。\n"
             "维文只能出现维吾尔字母，绝对不能出现汉字。\n"
             "待翻译句子：\n" + "\n".join(chunk))
        got = None
        for attempt in range(3):
            try:
                lines = lines_of(call(p, max_tokens=4000 if TR_CHUNK >= 24 else (2200 if TR_CHUNK >= 12 else 800)))
                if len(lines) == len(chunk):
                    got = lines
                    break
            except Exception:
                pass
            time.sleep(1.2 * (attempt + 1))
        if got is None:
            return None
        out.extend(got)
    return out


def valid_pair(w, zh, ug):
    if not zh or not ug:
        return False
    if w not in zh:
        return False
    if AR.search(zh) or not CJK.search(zh):
        return False
    if not AR.search(ug) or CJK.search(ug):
        return False
    if len(zh) < 4 or len(zh) > 80 or len(ug) > 240:
        return False
    if len(ug.split()) < 3 or len(ug.split()) > 30:
        return False
    return True


def work(batch):
    words = [w for w, _ in batch]
    for attempt in range(2):
        try:
            pairs = gen_sentences(words)
            if not pairs:
                continue
            sents = [s for _, s in pairs]
            ugs = translate(sents)
            if len(ugs) != len(sents):
                continue
            out = []
            for (w, s), u in zip(pairs, ugs):
                if valid_pair(w, s, u):
                    out.append({"zh": w, "zh_sent": s, "uey": u, "src": "AI", "model": MODEL})
            if out:
                return batch, out, None
        except Exception as e:
            err = str(e)[:80]
            time.sleep(1.5 * (attempt + 1))
    return batch, [], "batch failed"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", choices=["modern","dict"], default="modern")
    ap.add_argument("--limit", type=int, default=1000)
    ap.add_argument("--batch", type=int, default=8)
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--out", default="data/cache/examples.jsonl")
    args = ap.parse_args()

    hsk = set()
    with io.open(os.path.join(ROOT, "data", "hsk_all.tsv"), encoding="utf-8-sig") as f:
        for line in f:
            c = line.split("\t")
            if c and c[0].strip():
                hsk.add(c[0].strip())

    modern = []
    modern_rank = {}
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
            if not w:
                continue
            modern.append((w, rank))
            modern_rank.setdefault(w, rank)

    if args.input == "dict":
        seen = set()
        rows = []
        with io.open(os.path.join(ROOT, "data", "clean", "zh_ug.jsonl"), encoding="utf-8") as f:
            for line in f:
                w = json.loads(line)["zh"]
                if w in seen:
                    continue
                seen.add(w)
                if not w or not CJK.search(w) or len(w) > 8 or w in STOP:
                    continue
                if len(w) == 1 and w not in hsk:
                    continue
                rows.append((w, modern_rank.get(w, 999999)))
        rows.sort(key=lambda x: (x[1], len(x[0])))
        words = rows[:args.limit] if args.limit else rows
    else:
        words = []
        for w, rank in modern:
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
                bad += len(batch)
            for r in out:
                fout.write(json.dumps(r, ensure_ascii=False) + "\n")
                ok += 1
            fout.flush()
            if i % 10 == 0 or i == len(batches):
                dt = max(1, time.time() - t0)
                print(f"[{i}/{len(batches)}] ok={ok} bad={bad} {ok/dt:.2f} 词/s", flush=True)
    fout.close()
    print(f"DONE ok={ok} bad={bad} elapsed={time.time()-t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
