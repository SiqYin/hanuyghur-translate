/*
 * ugconv.js — 维吾尔语双文字引擎
 * 老维文 UEY (ئۇيغۇر ئەرەب يېزىقى) <-> 拉丁维文 ULY (ئۇيغۇر لاتىن يېزىقى)
 *
 * 设计原则：
 *   1. 单一真源：词库只存 UEY，ULY 由本文件派生
 *   2. 最长匹配：ch/sh/gh/ng/zh 先于单字母
 *   3. hamza 规则：词首元音、元音后元音加 ئ；辅音后元音用撇号保留音节边界
 *   4. 归一化：NFKC、去 ZWNJ/ZWJ/tatweel、统一 ك/ي、数字与标点
 *   5. 同一份代码供 Node 构建与浏览器运行时使用
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.UGConv = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var ULY2UEY = {
    a: "ا", e: "ە", b: "ب", p: "پ", t: "ت", j: "ج", ch: "چ", x: "خ",
    d: "د", r: "ر", z: "ز", zh: "ژ", s: "س", sh: "ش", gh: "غ", f: "ف",
    q: "ق", k: "ك", g: "گ", ng: "ڭ", l: "ل", m: "م", n: "ن", h: "ھ",
    o: "و", u: "ۇ", "ö": "ۆ", "ü": "ۈ", w: "ۋ", "é": "ې", i: "ى", y: "ي"
  };

  var UEY2ULY = {};
  Object.keys(ULY2UEY).forEach(function (k) { UEY2ULY[ULY2UEY[k]] = k; });
  // 兼容写法
  UEY2ULY["ه"] = "h";
  UEY2ULY["ة"] = "e";
  UEY2ULY["ء"] = "'";

  var DIGRAPHS = ["ch", "sh", "gh", "ng", "zh"];
  var VOWELS = "aeiouöüé";
  var HAMZA = "\u0626";

  function isVowel(ch) { return ch && VOWELS.indexOf(ch) > -1; }

  function isLatinLetter(ch) {
    return !!ch && /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(ch);
  }

  function isArabicLetter(ch) {
    if (!ch) return false;
    var c = ch.charCodeAt(0);
    return (c >= 0x0620 && c <= 0x064A) ||
      (c >= 0x066E && c <= 0x06D3) ||
      (c >= 0x06D5 && c <= 0x06FF) ||
      (c >= 0x0750 && c <= 0x077F) ||
      (c >= 0xFB50 && c <= 0xFDFF) ||
      (c >= 0xFE70 && c <= 0xFEFF);
  }

  // ---------- 归一化 ----------
  var AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
  var FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

  function normalizeUey(input) {
    var s = String(input == null ? "" : input);
    if (s.normalize) s = s.normalize("NFKC");
    // 控制符 / 连接符
    s = s.replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\u0640]/g, "");
    // 波斯 / 乌尔都写法统一
    s = s.replace(/\u06A9/g, "\u0643"); // ک -> ك
    s = s.replace(/\u06CC/g, "\u064A"); // ی -> ي
    s = s.replace(/\u06C1/g, "\u06BE"); // ہ -> ھ
    s = s.replace(/\u0647/g, "\u06D5"); // ه -> ە（维吾尔语 /h/ 用 ھ，ه 多为表现形还原残留）
    s = s.replace(/\u0629/g, "\u06D5"); // ة -> ە
    // hamza 变体
    s = s.replace(/[\u0622\u0623\u0625]/g, "\u0627");
    s = s.replace(/\u0624/g, "\u0648");
    // 数字
    s = s.replace(/[\u0660-\u0669]/g, function (c) {
      return String(AR_DIGITS.indexOf(c));
    });
    s = s.replace(/[\u06F0-\u06F9]/g, function (c) {
      return String(FA_DIGITS.indexOf(c));
    });
    // 标点
    s = s.replace(/\u060C/g, ",").replace(/\u061B/g, ";").replace(/\u061F/g, "?");
    s = s.replace(/\u00A0|\u2007|\u202F/g, " ");
    s = s.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();
    return s;
  }

  function normalizeUly(input) {
    var s = String(input == null ? "" : input);
    if (s.normalize) s = s.normalize("NFC");
    s = s.toLowerCase();
    s = s.replace(/\u00EB/g, "\u00E9");   // ë -> é
    s = s.replace(/v/g, "\u00FC");          // 键盘 v 代 ü
    s = s.replace(/\u2019|\u02BC|`/g, "'");
    s = s.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();
    return s;
  }

  // ---------- ULY -> UEY ----------
  function convertWordUl2Uey(word) {
    var w = word.toLowerCase().replace(/\u00EB/g, "\u00E9").replace(/v/g, "\u00FC");
    var out = [];
    var prevLatin = "";       // 上一个拉丁字母（跳过撇号）
    var prevWasApos = false;
    var prevPrevLatin = "";

    for (var i = 0; i < w.length; i++) {
      var ch = w.charAt(i);

      if (ch === "'") {
        prevWasApos = true;
        prevPrevLatin = prevLatin;   // 撇号紧前的字母
        continue;
      }

      var matched = null;
      for (var d = 0; d < DIGRAPHS.length; d++) {
        if (w.substr(i, 2) === DIGRAPHS[d]) { matched = DIGRAPHS[d]; break; }
      }
      var token = matched || ch;

      if (isVowel(token)) {
        var needsHamza = false;
        if (!prevLatin) needsHamza = true;                       // 词首
        else if (isVowel(prevLatin)) needsHamza = true;           // 元音后
        else if (prevWasApos && prevPrevLatin && !isVowel(prevPrevLatin)) needsHamza = true;
        if (needsHamza) out.push(HAMZA);
        out.push(ULY2UEY[token] || token);
      } else {
        out.push(ULY2UEY[token] || token);
      }

      prevPrevLatin = prevLatin;
      prevLatin = token;
      prevWasApos = false;
      if (matched) i++;
    }
    return out.join("");
  }

  function ul2uey(text) {
    var s = String(text == null ? "" : text);
    var out = [];
    var buf = [];
    function flush() {
      if (buf.length) { out.push(convertWordUl2Uey(buf.join(""))); buf = []; }
    }
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (isLatinLetter(ch) || ch === "'") buf.push(ch);
      else { flush(); out.push(ch); }
    }
    flush();
    return out.join("");
  }

  // ---------- UEY -> ULY ----------
  // 阿拉伯字母用 ئ 同时承担「元音载体」和「声门塞音」两种功能，
  // 后者转拉丁时必须保留撇号。以下为已确认的常用词例外，后续用 ULY 语料扩充。
  var WORD_EXCEPTIONS = {
    "مۇئەللىم": "mu'ellim",
    "ھەئە": "he'e",
    "مەنا": "me'na",
    "جەمئىيەت": "jem'iyet",
    "ئەھمىيەت": "ehmiyet"
  };

  function convertWordUey2Ul(word) {
    if (WORD_EXCEPTIONS[word]) return WORD_EXCEPTIONS[word];
    var chars = Array.from(word);
    var out = [];
    for (var i = 0; i < chars.length; i++) {
      var ch = chars[i];
      var prev = i > 0 ? chars[i - 1] : "";
      var next = i + 1 < chars.length ? chars[i + 1] : "";

      if (ch === HAMZA) {
        if (!prev) continue;                       // 词首：载体，去掉
        if (isArabicLetter(prev) && UEY2ULY[prev] && isVowel(UEY2ULY[prev])) continue; // 元音之间
        if (isArabicLetter(prev) && isArabicLetter(next) && UEY2ULY[next] && isVowel(UEY2ULY[next])) {
          out.push("'");                           // 辅音后元音：保留音节边界
        }
        continue;
      }

      var lat = UEY2ULY[ch];
      out.push(lat != null ? lat : ch);
    }
    return out.join("");
  }

  function uey2ul(text) {
    var s = String(text == null ? "" : text);
    var out = [];
    var buf = [];
    function flush() {
      if (buf.length) { out.push(convertWordUey2Ul(buf.join(""))); buf = []; }
    }
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (isArabicLetter(ch)) buf.push(ch);
      else { flush(); out.push(ch); }
    }
    flush();
    return out.join("");
  }

  // ---------- 统一检索键 ----------
  function foldLatin(s) {
    return s
      .replace(/\u00E9/g, "e")
      .replace(/\u00F6/g, "o")
      .replace(/\u00FC/g, "u")
      .replace(/'/g, "");
  }

  function ugKey(text, opts) {
    var s = String(text == null ? "" : text);
    var latin;
    if (/[\u0600-\u06FF]/.test(s)) {
      latin = uey2ul(normalizeUey(s));
    } else {
      latin = normalizeUly(s);
    }
    latin = latin.toLowerCase();
    if (opts && opts.loose) {
      latin = latin
        .replace(/gh/g, "g")
        .replace(/ng/g, "n")
        .replace(/sh/g, "s")
        .replace(/ch/g, "c")
        .replace(/zh/g, "z")
        .replace(/x/g, "h");
    }
    return foldLatin(latin).replace(/[^a-z0-9]/g, "");
  }

  function detectScript(text) {
    var s = String(text == null ? "" : text);
    var zh = /[\u3400-\u4DBF\u4E00-\u9FFF]/.test(s);
    var ar = /[\u0600-\u06FF]/.test(s);
    var la = /[A-Za-z]/.test(s);
    if (zh && !ar && !la) return "zh";
    if (ar && !zh) return "uey";
    if (la && !zh && !ar) return "uly";
    if (zh && (ar || la)) return "mixed";
    return "other";
  }

  function convert(text, target) {
    var t = String(target || "").toLowerCase();
    if (t === "uey" || t === "ar" || t === "arab") return ul2uey(text);
    if (t === "uly" || t === "latin" || t === "lat") return uey2ul(text);
    return String(text || "");
  }

  return {
    ul2uey: ul2uey,
    uey2ul: uey2ul,
    normalizeUey: normalizeUey,
    normalizeUly: normalizeUly,
    ugKey: ugKey,
    detectScript: detectScript,
    convert: convert,
    ULY2UEY: ULY2UEY,
    UEY2ULY: UEY2ULY
  };
});
