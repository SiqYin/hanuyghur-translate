#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""check_gateway.py — 例句翻译网关健康检查；DOWN 时不要放量。"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__))))
import gen_examples as G


def main():
    prompt = ("把下面这句翻译成维吾尔语（老维文，2009 标准正字法），只输出维文：\n"
              "今天天气很好。")
    try:
        lines = G.lines_of(G.call(prompt, max_tokens=120))
        ok = bool(lines and G.AR.search(lines[0]) and not G.CJK.search(lines[0]))
    except Exception:
        ok = False
    print("OK" if ok else "DOWN")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
