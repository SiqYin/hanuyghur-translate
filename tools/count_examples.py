#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""count_examples.py — 输出例句的唯一词头数（去重后）"""
import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
p = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "data", "cache", "examples.jsonl")
seen = set()
if os.path.exists(p):
    with io.open(p, encoding="utf-8") as f:
        for line in f:
            try:
                seen.add(json.loads(line)["zh"])
            except Exception:
                pass
print(len(seen))
