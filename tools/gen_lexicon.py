#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_lexicon.py — 汉维词库生成管线

输入：汉文词表 TSV（HSK 或现代汉语词频表）
输出：JSONL，一行一个汉文词条
特性：批量、并发、缓存、断点续跑、JSON 容错、正字法校验
"""
import argparse
import concurrent.futures as cf
import hashlib
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error

API_BASE = os.environ.get("UG_API_BASE", "https://index-translate.bilibili.com/v1")
API_MODEL = os.environ.get("UG_API_MODEL", "Index-Translate-35B-A3B")
API_KEY = os.environ.get("UG_API_KEY", "EMPTY")

AR_LETTER = re.compile(r"^[\u0621-\u064A\u067E\u0686\u0698\u06A9\u06AF\u06AD\u06BE\u06C6-\u06D0\u06CB\s\-'’]+$")
CJK = re.compile(r"[\u3400-\u4DBF\u4E00-\u9FFF]")

PROMPT_HEAD = """你是维吾尔语词典编辑。为下列汉文词给出维吾尔语最常用对应词。
要求：
1. 老维文（ئۇيغۇر ئەرەب يېزىقى），2009 标准正字法，字母必须正确（ڭ ۇ ۆ ۈ ۋ ې ھ ە ى ئ）。
2. 动词用 -ماق/-مەك 不定式；名词用主格单数；形容词用原级。
3. 每词只给 1 个最常用对应，不要生僻词；借词用通行写法。
4. 只输出 JSON 数组，不要解释、不要 Markdown 代码块。
格式：[{"chinese":"水","uyghur":"سۇ","pos":"n","gloss":"水"}]
pos 取值：n / v / adj / adv / num / pron / conj / postp / intj

待处理词："""



# 只允许免费网关；付费接口必须显式授权，避免误用个人额度
PAID_HOSTS = ("deepseek.com", "openai.com", "anthropic.com", "moonshot.cn", "bigmodel.cn", "dashscope.aliyuncs.com")
if any(h in API for h in PAID_HOSTS) and os.environ.get("ALLOW_PAID_API") != "1":
    raise SystemExit(
        "拒绝启动：检测到付费 API 端点 %s\n"
        "本项目默认只使用免费的 Index-Translate 公共网关。\n"
        "如确需使用付费接口，请显式设置 ALLOW_PAID_API=1。" % API
    )

def norm_space(s):
    return re.sub(r"\s+", " ", str(s or "")).strip()


def read_hsk(path):
    rows = []
    with open(path, encoding="utf-8-sig") as f:
        for line in f:
            p = line.rstrip("\n").split("\t")
            if len(p) < 5:
                continue
            rows.append({
                "zh": p[0].strip(),
                "trad": p[1].strip() or p[0].strip(),
                "py_num": p[2].strip(),
                "py": p[3].strip(),
                "freq": None,
                "rank": len(rows) + 1,
                "en": p[4].strip()
            })
    return rows


def read_modern(path):
    rows = []
    with open(path, encoding="utf-8-sig") as f:
        header = f.readline()
        for line in f:
            p = line.rstrip("\n").split("\t")
            if len(p) < 10:
                continue
            try:
                rank = int(p[0])
            except ValueError:
                continue
            rows.append({
                "zh": p[1].strip(),
                "trad": p[1].strip(),
                "py_num": p[9].strip(),
                "py": p[7].strip(),
                "freq": rank,
                "rank": rank,
                "en": ""
            })
    return rows


def load_rows(path, limit):
    if path.endswith("hsk_all.tsv") or path.endswith("hsk6.tsv"):
        rows = read_hsk(path)
    else:
        rows = read_modern(path)
    # 去重（同词同音）
    seen = set()
    out = []
    for r in rows:
        k = r["zh"] + "|" + r["py_num"]
        if k in seen:
            continue
        seen.add(k)
        out.append(r)
        if limit and len(out) >= limit:
            break
    return out


def call_api(words, timeout=90):
    payload = {
        "model": API_MODEL,
        "messages": [{"role": "user", "content": PROMPT_HEAD + "、".join(words)}],
        "max_tokens": 1600,
        "temperature": 0
    }
    req = urllib.request.Request(
        API_BASE.rstrip("/") + "/chat/completions",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer " + API_KEY,
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                          "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
        },
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["choices"][0]["message"]["content"]


def extract_json(text):
    s = str(text or "").strip()
    s = re.sub(r"^```(?:json)?\s*", "", s)
    s = re.sub(r"\s*```$", "", s)
    i, j = s.find("["), s.rfind("]")
    if i < 0 or j <= i:
        raise ValueError("no json array")
    return json.loads(s[i:j + 1])


def valid_ug(s):
    s = norm_space(s)
    if not s or CJK.search(s):
        return False
    if not AR_LETTER.match(s):
        return False
    if len(s) > 80:
        return False
    return True


def normalize_batch(items, words):
    """把模型返回对齐到输入词；丢弃不合法项。"""
    by_zh = {}
    for it in items:
        if not isinstance(it, dict):
            continue
        zh = norm_space(it.get("chinese") or it.get("zh") or "")
        ug = norm_space(it.get("uyghur") or it.get("ug") or it.get("uey") or "")
        pos = norm_space(it.get("pos") or "")
        gloss = norm_space(it.get("gloss") or "")
        if not zh or not ug:
            continue
        by_zh[zh] = {"uey": ug, "pos": pos, "gloss": gloss}

    out = []
    for w in words:
        # 输入可能带拼音括号，按主词匹配
        base = re.split(r"[（(]", w)[0].strip()
        it = by_zh.get(w) or by_zh.get(base)
        if not it:
            continue
        ug = it["uey"]
        if not valid_ug(ug):
            continue
        # 动词必须不定式
        if it["pos"] == "v" and not (ug.endswith("ماق") or ug.endswith("مەك")):
            continue
        out.append(it)
    return out


def process_batch(args):
    rows, retries = args
    words = []
    for r in rows:
        w = r["zh"]
        if r.get("py"):
            w = f"{w}（{r['py']}）"
        words.append(w)
    last_err = None
    for attempt in range(retries):
        try:
            content = call_api(words)
            items = extract_json(content)
            good = normalize_batch(items, words)
            if not good:
                raise ValueError("empty after validation")
            return rows, good, content, None
        except Exception as e:
            last_err = str(e)
            time.sleep(1.5 * (attempt + 1))
    return rows, [], "", last_err


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--batch", type=int, default=10)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--retries", type=int, default=3)
    ap.add_argument("--out", default="data/cache/lex_seed.jsonl")
    ap.add_argument("--resume", action="store_true", default=True)
    ap.add_argument("--fresh", action="store_true")
    args = ap.parse_args()

    rows = load_rows(args.input, args.limit)
    print(f"input={args.input} rows={len(rows)}", flush=True)

    done = set()
    if args.resume and not args.fresh and os.path.exists(args.out):
        with open(args.out, encoding="utf-8") as f:
            for line in f:
                try:
                    d = json.loads(line)
                    done.add(d["zh"] + "|" + d.get("py_num", ""))
                except Exception:
                    pass
        print(f"resume: {len(done)} done", flush=True)

    todo = [r for r in rows if r["zh"] + "|" + r["py_num"] not in done]
    print(f"todo={len(todo)}", flush=True)

    batches = [todo[i:i + args.batch] for i in range(0, len(todo), args.batch)]
    batches = [(b, args.retries) for b in batches]

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    fout = open(args.out, "a", encoding="utf-8")
    ok = bad = 0
    t0 = time.time()

    with cf.ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures = [ex.submit(process_batch, b) for b in batches]
        for idx, fut in enumerate(cf.as_completed(futures), 1):
            rows_b, goods, raw, err = fut.result()
            if err:
                bad += len(rows_b)
                print(f"[{idx}/{len(batches)}] FAIL {err}", flush=True)
                continue
            # 对齐：goods 与 rows_b 顺序可能不同，按 chinese 匹配
            gmap = {}
            for g in goods:
                gmap[re.split(r"[（(]", g.get("chinese", ""))[0]] = g
            for r in rows_b:
                g = gmap.get(r["zh"])
                if not g:
                    bad += 1
                    continue
                rec = {
                    "zh": r["zh"], "trad": r["trad"],
                    "py_num": r["py_num"], "py": r["py"],
                    "freq": r["freq"], "rank": r["rank"],
                    "pos": g["pos"], "uey": g["uey"], "gloss": g["gloss"],
                    "src": "AI", "model": API_MODEL,
                    "ts": time.strftime("%Y-%m-%dT%H:%M:%S")
                }
                fout.write(json.dumps(rec, ensure_ascii=False) + "\n")
                ok += 1
            fout.flush()
            if idx % 5 == 0 or idx == len(batches):
                sp = ok / max(1, time.time() - t0)
                print(f"[{idx}/{len(batches)}] ok={ok} bad={bad} {sp:.1f} words/s", flush=True)

    fout.close()
    print(f"DONE ok={ok} bad={bad} out={args.out} elapsed={time.time()-t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
