/*
 * morph.js — 维吾尔语轻量词形还原
 * 目标：点击例句中的屈折形式（ئىچىمەن / ئۆيلەردىكىلەر / قەلىمى）能回到词典原形。
 * 方法：后缀槽位表 + 元音弱化候选 + 词表校验 + 打分；不做完整 FST。
 */
(function (root) {
  "use strict";

  var UG = root.UGConv;
  var lemmaSet = new Set();

  // 长后缀优先，避免「ىمىز」被拆成「ى」+「مىز」
  var SUFFIXES = [
    { s: "ىڭلار", g: "第二人称复数领属" },
    { s: "ىمىز", g: "第一人称复数领属" },
    { s: "سىلەر", g: "第二人称复数" },
    { s: "ماقتا", g: "持续体" },
    { s: "مەكتە", g: "持续体" },
    { s: "دىكى", g: "在…的" },
    { s: "تىكى", g: "在…的" },
    { s: "غان", g: "过去分词" },
    { s: "گەن", g: "过去分词" },
    { s: "قان", g: "过去分词" },
    { s: "كەن", g: "过去分词" },
    { s: "ماق", g: "不定式" },
    { s: "مەك", g: "不定式" },
    { s: "لىق", g: "名词化" },
    { s: "لىك", g: "名词化" },
    { s: "لار", g: "复数" },
    { s: "لەر", g: "复数" },
    { s: "نىڭ", g: "属格" },
    { s: "دىن", g: "从格" },
    { s: "تىن", g: "从格" },
    { s: "مەن", g: "第一人称单数" },
    { s: "سەن", g: "第二人称单数" },
    { s: "مىز", g: "第一人称复数" },
    { s: "دۇ", g: "第三人称" },
    { s: "دى", g: "过去时" },
    { s: "تى", g: "过去时" },
    { s: "ۋات", g: "进行体" },
    { s: "غا", g: "向格" },
    { s: "گە", g: "向格" },
    { s: "قا", g: "向格" },
    { s: "كە", g: "向格" },
    { s: "دا", g: "位格" },
    { s: "دە", g: "位格" },
    { s: "تا", g: "位格" },
    { s: "تە", g: "位格" },
    { s: "نى", g: "宾格" },
    { s: "ىم", g: "第一人称单数领属" },
    { s: "ىڭ", g: "第二人称单数领属" },
    { s: "سى", g: "第三人称领属" },
    { s: "چى", g: "职业/从事者" },
    { s: "سىز", g: "无…的" },
    { s: "مۇ", g: "疑问" },
    { s: "مۈ", g: "疑问" },
    { s: "چۇ", g: "语气" },
    { s: "چۈ", g: "语气" },
    { s: "ى", g: "第三人称领属/连接元音" }
  ].sort(function (a, b) { return b.s.length - a.s.length; });

  var VOWELS = "ائىۇۈۆېەو";

  function norm(s) { return UG ? UG.normalizeUey(s) : String(s || ""); }

  function buildFromCore(core) {
    lemmaSet = new Set();
    (core || []).forEach(function (e) {
      (e[2] || []).forEach(function (s) {
        var w = norm(s[0]);
        if (!w) return;
        // 义项里常有「ئىچمەك، ئىچىشمەك」这种同义词串，逐词入表
        var parts = w.split(/[\s،,;；/()（）]+/);
        parts.forEach(function (p) {
          p = p.replace(/^[.\-]+|[.\-]+$/g, "");
          if (p && p.length >= 2 && p.length <= 24) lemmaSet.add(p);
        });
      });
    });
    return lemmaSet.size;
  }

  function lastVowelIndex(s) {
    for (var i = s.length - 1; i >= 0; i--) {
      if (VOWELS.indexOf(s.charAt(i)) > -1) return i;
    }
    return -1;
  }

  // 元音弱化还原：末音节 ى -> ە / ا
  function weaken(stem) {
    var out = [];
    var i = lastVowelIndex(stem);
    if (i < 0) return out;
    var c = stem.charAt(i);
    if (c === "ى") {
      out.push(stem.slice(0, i) + "ە" + stem.slice(i + 1));
      out.push(stem.slice(0, i) + "ا" + stem.slice(i + 1));
    }
    return out;
  }

  // 判断一个「原形」本身是否还带派生/屈折后缀（不定式除外）
  function isDerived(lemma) {
    for (var i = 0; i < SUFFIXES.length; i++) {
      var sf = SUFFIXES[i];
      if (sf.s === "ماق" || sf.s === "مەك") continue;
      if (lemma.length <= sf.s.length + 1) continue;
      if (lemma.slice(-sf.s.length) !== sf.s) continue;
      var stem = lemma.slice(0, -sf.s.length);
      if (lemmaSet.has(stem)) return true;
      var ws = weaken(stem);
      for (var k = 0; k < ws.length; k++) {
        if (lemmaSet.has(ws[k])) return true;
      }
    }
    return false;
  }

  function analyze(surface) {
    var s = norm(surface);
    if (!s || s.indexOf(" ") > -1) return null;

    var results = [];
    var seen = new Set();

    function add(lemma, chain, verb) {
      var key = lemma + "|" + chain.length;
      if (seen.has(key)) return;
      seen.add(key);
      results.push({ lemma: lemma, chain: chain, verb: !!verb });
    }

    function walk(rest, chain, depth) {
      if (depth === 0 && lemmaSet.has(rest)) add(rest, [], false);
      if (depth > 0 && chain.length > 0) {
        if (lemmaSet.has(rest)) add(rest, chain, false);
        if (lemmaSet.has(rest + "مەك")) add(rest + "مەك", chain, true);
        if (lemmaSet.has(rest + "ماق")) add(rest + "ماق", chain, true);
      }
      if (depth >= 3) return;

      // 只在剥掉后缀之后才做元音弱化，避免对表面形式凭空造词
      if (chain.length > 0) {
        weaken(rest).forEach(function (w) { walk(w, chain, depth + 1); });
      }

      for (var i = 0; i < SUFFIXES.length; i++) {
        var sf = SUFFIXES[i];
        if (rest.length <= sf.s.length + 1) continue;
        if (rest.slice(-sf.s.length) !== sf.s) continue;
        var stem = rest.slice(0, -sf.s.length);
        walk(stem, [{ s: sf.s, g: sf.g }].concat(chain), depth + 1);
      }
    }

    walk(s, [], 0);

    if (!results.length) return null;
    // 打分：后缀层数少优先；有格/领属/人称后缀时动词优先；词干长优先
    function score(r) {
      var sc = r.chain.length * 10;
      var outer = r.chain.length ? r.chain[r.chain.length - 1].g : "";
      // 表面形式带人称/时态/体标记时，动词原形优先
      var predicative = /第一人称单数$|第二人称单数$|第三人称$|第一人称复数$|第二人称复数$/.test(outer) && !/领属/.test(outer);
      if (predicative) sc -= (r.verb ? 35 : 9);
      else if (/过去时|进行体|持续体/.test(outer)) sc -= (r.verb ? 12 : 4);
      // 「ئۆيلەر / قەلىمى」这类本身可再分解的形式，让位给更基本的原形
      if (isDerived(r.lemma)) sc += 12;
      if (r.lemma.length <= 2) sc += 6;
      return sc;
    }
    results.sort(function (a, b) { return score(a) - score(b); });
    return results[0];
  }

  root.UGMorph = {
    buildFromCore: buildFromCore,
    analyze: analyze,
    size: function () { return lemmaSet.size; }
  };
})(typeof self !== "undefined" ? self : this);
