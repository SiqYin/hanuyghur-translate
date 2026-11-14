/*
 * ugconv.js — 维吾尔语双文字引擎
 * 老维文 UEY (ئۇيغۇر ئەرەب يېزىقى) <-> 拉丁维文 ULY (ئۇيغۇر لاتىن يېزىقى)
 *
 * ULY 采用 2008 年 1 月新疆维吾尔自治区民族语言文字工作委员会鉴定验收的方案：
 *   1. ئې/ې → ë（2008 年修订：由旧案的 é 改为 ë）
 *   2. ژ → zh、ج → j（2008 年起固定，消除旧案 j/zh 二义）
 *   3. 词首的 hamza 载体不转写（ئۇيغۇر → Uyghur）
 *   4. 词中的 hamza 一律转写为隔音符号 '（مۇئەللىم → mu'ellim、سۈنئىي → sün'iy、قائىدە → qa'ide）
 *   5. 相邻字母会被误读成二合字母时（n+gh、n+g 等），插入 ' 保证与老维文一一对应
 *      （تاللانغان → tallan'ghan、ئىنگلىزچە → in'glizche；شىنجاڭ → shinjang 不加）
 *   6. 阿拉伯标点/数字转西式（؛ → ; ، → , ؟ → ?）
 *   7. 回环保证：uey2ul→ul2uey 与 ul2uey→uey2ul 均可复原（tools/test_ugconv.js 覆盖）
 *
 * 设计原则：
 *   1. 单一真源：词库只存 UEY，ULY 由本文件派生
 *   2. 最长匹配：ch/sh/gh/ng/zh 先于单字母
 *   3. 归一化：NFKC、去 ZWNJ/ZWJ/tatweel、统一 ك/ي、数字与标点
 *   4. 同一份代码供 Node 构建与浏览器运行时使用
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
    o: "و", u: "ۇ", "ö": "ۆ", "ü": "ۈ", w: "ۋ", "ë": "ې", i: "ى", y: "ي"
  };

  var UEY2ULY = {};
  Object.keys(ULY2UEY).forEach(function (k) { UEY2ULY[ULY2UEY[k]] = k; });
  // 兼容写法
  UEY2ULY["ه"] = "h";
  UEY2ULY["ة"] = "e";
  UEY2ULY["ء"] = "'";

  var DIGRAPHS = ["ch", "sh", "gh", "ng", "zh"];
  var VOWELS = "aeiouëöü";
  var HAMZA = "\u0626";
  // ULY 单字母表（c 只出现在 ch，v 不存在——键盘 v 由归一化转 ü）
  var ULY_SINGLES = "abdefghijklmnopqrstuwxyzëöü";

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
    s = s.replace(/\u0647/g, "\u06D5"); // ه -> ە（维吾尔语 /h/ 用 ھ、ه 多为表现形还原残留）
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
    s = s.replace(/\u00E9/g, "\u00EB");   // é -> ë（旧写法兼容）
    s = s.replace(/v/g, "\u00FC");          // 键盘 v 代 ü
    s = s.replace(/\u2019|\u02BC|`/g, "'");
    s = s.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();
    return s;
  }

  // 最长匹配分词：返回 free 串中每个 token 的起始下标
  function lmTokenStarts(free) {
    var starts = {};
    var i = 0;
    while (i < free.length) {
      starts[i] = true;
      var len = 1;
      for (var d = 0; d < DIGRAPHS.length; d++) {
        if (free.substr(i, 2) === DIGRAPHS[d]) { len = 2; break; }
      }
      i += len;
    }
    return starts;
  }

  // ---------- ULY -> UEY ----------
  function convertWordUl2Uey(word) {
    var w = word.toLowerCase().replace(/\u00E9/g, "\u00EB").replace(/v/g, "\u00FC");
    var lmStarts = lmTokenStarts(w.replace(/'/g, ""));
    var out = [];
    var prevLatin = "";       // 上一个拉丁 token
    var prevWasApos = false;
    var prevPrevLatin = "";
    var freeIdx = 0;          // 当前 token 在去撇号串中的下标

    for (var i = 0; i < w.length; i++) {
      var ch = w.charAt(i);

      if (ch === "'") {
        prevWasApos = true;
        prevPrevLatin = prevLatin;   // 撇号紧前的 token
        continue;
      }

      var matched = null;
      for (var d = 0; d < DIGRAPHS.length; d++) {
        if (w.substr(i, 2) === DIGRAPHS[d]) { matched = DIGRAPHS[d]; break; }
      }
      var token = matched || ch;

      if (isVowel(token)) {
        var needsHamza = false;
        if (!prevLatin) needsHamza = true;                                // 词首：UEY 必写 hamza 载体
        else if (prevWasApos) needsHamza = true;                  // 显式隔音符：还原 hamza（qa'ide、mu'ellim、sün'iy）
        // 元音后无撇号不加 hamza：借词正字法允许 و+ە/ې 直连（گۇەن、يۈەن、جۇڭخۇا）
        if (needsHamza) out.push(HAMZA);
        out.push(ULY2UEY[token] || token);
      } else {
        // ' 后接辅音：若去撇号串在此处本就有 token 边界，说明这不是防误读撇号，
        // 而是喉塞 hamza（مەئنا 类），还原为 ئ
        if (prevWasApos && prevLatin && lmStarts[freeIdx]) out.push(HAMZA);
        out.push(ULY2UEY[token] || token);
      }

      prevPrevLatin = prevLatin;
      prevLatin = token;
      prevWasApos = false;
      freeIdx += token.length;
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
  // 个别词的老维文写法不带 hamza 但官方拉丁拼写有隔音符（مەنا → me'na）
  var WORD_EXCEPTIONS = {
    "مەنا": "me'na"
  };

  function convertWordUey2Ul(word) {
    if (WORD_EXCEPTIONS[word]) return WORD_EXCEPTIONS[word];
    var chars = Array.from(word);
    var letters = [];        // 意图 token：{t: 1-2个拉丁字母, h: 前置 hamza}，或字符串 "'"/未知字符
    var pendingHamza = false;
    var i, ch, t;

    for (i = 0; i < chars.length; i++) {
      ch = chars[i];
      if (ch === HAMZA) {
        if (letters.length === 0) continue;   // 词首载体：不转写
        pendingHamza = true;                   // 词中 hamza：下一字母前加 '
        continue;
      }
      t = UEY2ULY[ch];
      if (t == null) { letters.push(ch); pendingHamza = false; continue; } // 未知字符原样带过
      if (t === "'") {                        // ء 独立 hamza：直接输出 '
        letters.push("'"); pendingHamza = false; continue;
      }
      letters.push({ t: t, h: pendingHamza });
      pendingHamza = false;
    }
    if (pendingHamza) letters.push({ t: "'", h: false }); // 词尾悬挂 hamza（罕见）
    if (!letters.length) return "";

    // 去撇号意图串与意图边界
    var free = "";
    var intent = {};
    var pos = 0;
    for (i = 0; i < letters.length; i++) {
      var tok = typeof letters[i] === "string" ? letters[i] : letters[i].t;
      if (tok === "'") continue;
      intent[pos] = true;
      free += tok;
      pos += tok.length;
    }
    var lmStarts = lmTokenStarts(free);

    // 输出：意图 token 边界处，hamza → '；LM 解析不认可该边界（会并入二合字母）→ '
    var out = "";
    pos = 0;
    for (i = 0; i < letters.length; i++) {
      var tok = typeof letters[i] === "string" ? letters[i] : letters[i].t;
      if (tok === "'") { out += "'"; continue; }
      if (pos > 0) {
        if (letters[i].h) out += "'";
        else if (intent[pos] && !lmStarts[pos]) out += "'";
      }
      out += tok;
      pos += tok.length;
    }
    return out;
  }

  function uey2ul(text) {
    var s = normalizeUey(text);
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

  // ---------- 句首大写（ULY 正字法）----------
  function capitalizeUly(text) {
    var s = String(text == null ? "" : text);
    var out = "";
    var capNext = true;
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      var lower = (ch >= "a" && ch <= "z") || ch === "\u00EB" || ch === "\u00F6" || ch === "\u00FC";
      var upper = (ch >= "A" && ch <= "Z") || ch === "\u00CB" || ch === "\u00D6" || ch === "\u00DC";
      if (capNext && lower) { out += ch.toUpperCase(); capNext = false; continue; }
      if (lower || upper) capNext = false;
      if (ch === "." || ch === "!" || ch === "?" || ch === "\u2026") capNext = true;
      out += ch;
    }
    return out;
  }

  // ---------- ULY 合法性（词内不能出现字母表外的拉丁字母）----------
  function isLegalUly(text) {
    var s = normalizeUly(text);
    var words = s.split(/[\s0-9.,;:!?"'()\[\]{}\u2014\u2026\u00AB\u00BB-]+/);
    for (var w = 0; w < words.length; w++) {
      var word = words[w];
      if (!word) continue;
      var i = 0;
      while (i < word.length) {
        if (ULY_SINGLES.indexOf(word.charAt(i)) > -1) { i++; continue; }
        if (DIGRAPHS.indexOf(word.substr(i, 2)) > -1) { i += 2; continue; }
        return false; // 字母表外的拉丁字母（ç/ş/ı/ə/独立 c 等）
      }
    }
    return true;
  }

  // ---------- 统一检索键 ----------
  function foldLatin(s) {
    return s
      .replace(/\u00EB/g, "e")
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
    capitalizeUly: capitalizeUly,
    isLegalUly: isLegalUly,
    ULY2UEY: ULY2UEY,
    UEY2ULY: UEY2ULY
  };
});
