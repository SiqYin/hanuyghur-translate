"use strict";

/*
 * rebuild_uly.js — 用当前 ugconv.js（单一真源）重建全部烘焙数据中的 ULY
 *
 * 背景：v1.0.0 数据里的拉丁维文来自三个不同来源（Anatilim 源数据自带列、
 * 例句管线缓存、运行时引擎），拼写年代不一（é、ژ→j、hamza 漏转、؛ 标点），
 * 与老维文原文对不上。本脚本一次性重算：
 *   chunks/*.js          [汉词, 拼音, [[uey,uly],...]]      → uly = uey2ul(uey)
 *   core.js              同上
 *   ug_chunks/*.js       [uey,uly,[汉...]]                  → uly 重算
 *   ug_index.js          key 列改用运行时 ugKey（与 app 一致），位置不动
 *   examples_chunks/*.js {词: [[汉句,uey句,uly句],...]}     → uly = 句首大写(uey2ul(uey))，坏句过滤
 *   examples_core.js     同上
 *
 * 例句过滤（AI 产生的坏数据，删除而非回填）：
 *   - uey 无阿拉伯字母 / 混入拉丁字母（混合文字垃圾）
 *   - uey 含 ه（U+0647，写法歧义）、西里尔字母、土耳其字母 ç ş ğ ı ə
 *   - 转写结果为空或含 ULY 字母表外的拉丁字母
 */

const fs = require("fs");
const path = require("path");
const U = require("../app/ugconv.js");

const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "app", "data");

const AR = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;

function badSentence(uey, uly) {
  if (!AR.test(uey)) return "no-arabic";
  if (/[A-Za-z]/.test(uey)) return "mixed-latin";
  if (/[\u0647]/.test(uey)) return "heh-ambiguous";
  if (/[\u0400-\u04FFçşğıə]/.test(uey)) return "foreign-letters";
  if (!uly || !uly.trim()) return "empty-uly";
  if (!U.isLegalUly(uly)) return "illegal-uly";
  return null;
}

function walk(dir, fn) {
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith(".js")).sort()) {
    fn(f);
  }
}

const stats = { lexSenses: 0, ugRows: 0, exSentences: 0, exDropped: 0, exWords: 0, exWordsLost: 0 };
const dropSamples = {};
function noteDrop(reason, sample) {
  dropSamples[reason] = (dropSamples[reason] || 0) + 1;
  if (dropSamples[reason] <= 3) {
    dropSamples[reason + "::sample"] = (dropSamples[reason + "::sample"] || []);
    if (dropSamples[reason + "::sample"].length < 3) dropSamples[reason + "::sample"].push(sample);
  }
}

// ---- chunks/*.js 与 core.js ----
function rebuildSenses(arr) {
  for (const entry of arr) {
    const senses = entry[2];
    if (!Array.isArray(senses)) continue;
    for (const s of senses) {
      if (Array.isArray(s) && s.length >= 2) { s[1] = U.uey2ul(s[0]); stats.lexSenses++; }
    }
  }
}

walk(path.join(DATA, "chunks"), f => {
  const key = f.replace(".js", "");
  const p = path.join(DATA, "chunks", f);
  const win = {};
  new Function("window", fs.readFileSync(p, "utf8"))(win);
  const val = win.CHUNKS[key];
  rebuildSenses(val);
  fs.writeFileSync(p, `(window.CHUNKS=window.CHUNKS||{})["${key}"]=` +
    JSON.stringify(val) + ";", "utf8");
});
{
  const p = path.join(DATA, "core.js");
  const win = {};
  new Function("window", fs.readFileSync(p, "utf8"))(win);
  rebuildSenses(win.CORE);
  fs.writeFileSync(p, "window.CORE=" + JSON.stringify(win.CORE) + ";", "utf8");
}

// ---- ug_chunks/*.js 与 ug_index.js ----
const ugIndexLines = [];
walk(path.join(DATA, "ug_chunks"), f => {
  const key = f.replace(".js", "");
  const b = parseInt(key.replace(/[^0-9]/g, ""), 10);
  const p = path.join(DATA, "ug_chunks", f);
  const win = {};
  new Function("window", fs.readFileSync(p, "utf8"))(win);
  const arr = win.UG_CHUNKS[key];
  for (let idx = 0; idx < arr.length; idx++) {
    const row = arr[idx];
    row[1] = U.uey2ul(row[0]);
    stats.ugRows++;
    ugIndexLines.push(U.ugKey(row[1]) + "\t" + row[1] + "\t" + b + "\t" + idx);
  }
  fs.writeFileSync(p, `(window.UG_CHUNKS=window.UG_CHUNKS||{})["${key}"]=` +
    JSON.stringify(arr) + ";", "utf8");
});
fs.writeFileSync(path.join(DATA, "ug_index.js"), "window.UG_INDEX=" +
  JSON.stringify(ugIndexLines.join("\n")) + ";", "utf8");

// ---- examples ----
function rebuildExamples(obj, fileLabel) {
  let words = 0, wordsLost = 0;
  for (const key of Object.keys(obj)) {
    const arr = obj[key];
    if (!Array.isArray(arr)) continue;
    words++;
    const kept = [];
    for (const sent of arr) {
      if (!Array.isArray(sent) || sent.length < 3) { stats.exDropped++; noteDrop("format", JSON.stringify(sent).slice(0, 60)); continue; }
      stats.exSentences++;
      const uey = sent[1] || "";
      const uly = U.capitalizeUly(U.uey2ul(uey));
      const bad = badSentence(U.normalizeUey(uey), uly);
      if (bad) { stats.exDropped++; noteDrop(bad, uey.slice(0, 50)); continue; }
      sent[2] = uly;
      kept.push(sent);
    }
    if (kept.length) obj[key] = kept;
    else { delete obj[key]; wordsLost++; }
  }
  stats.exWords += words;
  stats.exWordsLost += wordsLost;
}

walk(path.join(DATA, "examples_chunks"), f => {
  const key = f.replace(".js", "");
  const p = path.join(DATA, "examples_chunks", f);
  const win = {};
  new Function("window", fs.readFileSync(p, "utf8"))(win);
  const val = win.EX_CHUNKS[key];
  rebuildExamples(val, f);
  fs.writeFileSync(p, `(window.EX_CHUNKS=window.EX_CHUNKS||{})["${key}"]=` +
    JSON.stringify(val) + ";", "utf8");
});
{
  const p = path.join(DATA, "examples_core.js");
  const win = {};
  new Function("window", fs.readFileSync(p, "utf8"))(win);
  rebuildExamples(win.EXAMPLES, "examples_core");
  // EX_COUNT = 全库例句词数（核心 + 分片），rebuild 过滤后重算
  let totalWords = Object.keys(win.EXAMPLES).length;
  const exDir = path.join(DATA, "examples_chunks");
  for (const f of fs.readdirSync(exDir).filter(x => x.endsWith(".js"))) {
    const w = {};
    new Function("window", fs.readFileSync(path.join(exDir, f), "utf8"))(w);
    for (const ck of Object.keys(w.EX_CHUNKS || {})) {
      totalWords += Object.keys(w.EX_CHUNKS[ck] || {}).length;
    }
  }
  fs.writeFileSync(p, "window.EXAMPLES=" + JSON.stringify(win.EXAMPLES) + ";\n" +
    "window.EX_COUNT=" + totalWords + ";\n", "utf8");
}

console.log("rebuilt:", JSON.stringify(stats));
for (const k of Object.keys(dropSamples)) console.log("  ", k, dropSamples[k]);
