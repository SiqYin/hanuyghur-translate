(function () {
  "use strict";

  var CORE = window.CORE || [];
  var META = window.LEX_META || {};
  var EXAMPLES = window.EXAMPLES || {};
  var LINES = (window.LEX_INDEX || "").split("\n").filter(Boolean);
  var UG = window.UGConv;

  var MORPH = window.UGMorph;
  var coreMap = new Map();
  var senseMap = new Map();
  var lemmaGloss = new Map();
  var pyMap = new Map();
  var ulMap = new Map();
  var byFirst = new Map();
  var chunkCache = {};
  var EX_CHUNKS = {};
  var ugMap = new Map();
  var ugChunkCache = {};
  var ugIndexLoaded = false, ugIndexLoading = false, ugWaiters = [];

  var mode = "both";
  try { mode = localStorage.getItem("hanug.mode") || "both"; } catch (e) {}
  if (["uey", "uly", "both"].indexOf(mode) < 0) mode = "both";

  // ---------- 基础工具 ----------
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function isCJK(s) { return /[\u3400-\u4DBF\u4E00-\u9FFF]/.test(s); }
  function isArabic(s) { return /[\u0600-\u06FF]/.test(s); }
  function isLatin(s) { return /[A-Za-z]/.test(s); }

  var TONE = {
    "ā":"a","á":"a","ǎ":"a","à":"a","ē":"e","é":"e","ě":"e","è":"e",
    "ī":"i","í":"i","ǐ":"i","ì":"i","ō":"o","ó":"o","ǒ":"o","ò":"o",
    "ū":"u","ú":"u","ǔ":"u","ù":"u","ǖ":"v","ǘ":"v","ǚ":"v","ǜ":"v","ü":"v"
  };
  function foldPy(s) {
    var out = "";
    s = String(s || "").toLowerCase();
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      out += TONE[c] || c;
    }
    return out.replace(/[^a-z]/g, "");
  }

  // ---------- 建索引 ----------
  CORE.forEach(function (e) {
    coreMap.set(e[0], e);
    if (e[1]) {
      var pk = foldPy(e[1]);
      if (pk) {
        if (!pyMap.has(pk)) pyMap.set(pk, []);
        pyMap.get(pk).push(e);
      }
    }
    (e[2] || []).forEach(function (s, si) {
      var k = UG.ugKey(s[1]);
      if (!k) return;
      if (!senseMap.has(k)) senseMap.set(k, { zh: e[0], py: e[1], uey: s[0], uly: s[1] });
      var w = UG.normalizeUey(s[0]);
      if (w) {
        // 同一维语词可能出现在多个汉文词条下；优先「首义项 + 短汉文词」
        var sc = (si === 0 ? 10 : 0) + (e[0].length <= 2 ? 5 : 0) + (e[0].length === 1 ? 2 : 0);
        var prev = lemmaGloss.get(w);
        if (!prev || sc > prev.sc) {
          lemmaGloss.set(w, { zh: e[0], py: e[1], uey: s[0], uly: s[1], sc: sc });
        }
      }
      if (!ulMap.has(k)) ulMap.set(k, []);
      var arr = ulMap.get(k);
      if (arr.indexOf(e) < 0) arr.push(e);
    });
  });
  if (MORPH) MORPH.buildFromCore(CORE);

  LINES.forEach(function (line) {
    var i = line.indexOf("\t");
    if (i < 1) return;
    var zh = line.slice(0, i);
    var c = zh.charAt(0);
    if (!byFirst.has(c)) byFirst.set(c, []);
    byFirst.get(c).push(line);
  });

  // ---------- 分片加载 ----------
  function bucketName(b) { return "b" + String(b).padStart(2, "0"); }
  function loadChunk(b, cb) {
    var name = bucketName(b);
    if (chunkCache[name]) return cb(null, chunkCache[name]);
    var s = document.createElement("script");
    s.src = "data/chunks/" + name + ".js";
    s.onload = function () {
      var arr = (window.CHUNKS || {})[name] || [];
      chunkCache[name] = arr;
      cb(null, arr);
    };
    s.onerror = function () { cb(new Error("chunk load failed")); };
    document.head.appendChild(s);
  }

  function exBucket(zh) {
    var h = 0;
    for (var i = 0; i < zh.length; i++) h = (h * 31 + zh.charCodeAt(i)) >>> 0;
    return h % 64;
  }

  function loadExChunk(b, cb) {
    var name = "b" + String(b).padStart(2, "0");
    if (EX_CHUNKS[name]) return cb();
    var s = document.createElement("script");
    s.src = "data/examples_chunks/" + name + ".js";
    s.onload = function () {
      EX_CHUNKS[name] = (window.EX_CHUNKS || {})[name] || {};
      cb();
    };
    s.onerror = function () { EX_CHUNKS[name] = {}; cb(); };
    document.head.appendChild(s);
  }

  // ---------- 行解析 ----------
  function parseLine(line) {
    var p = line.split("\t");
    return { zh: p[0], b: +p[1], i: +p[2] };
  }

  // ---------- 搜索 ----------
  function zhOf(x) { return x.entry ? x.entry[0] : x.zh; }

  function searchZh(q) {
    var exact = [], prefix = [], contains = [];
    var seen = {};
    if (coreMap.has(q)) { exact.push({ entry: coreMap.get(q) }); seen[q] = 1; }

    var pool = byFirst.get(q.charAt(0)) || LINES;
    for (var i = 0; i < pool.length; i++) {
      var line = pool[i];
      var j = line.indexOf("\t");
      var zh = j > 0 ? line.slice(0, j) : line;
      if (zh === q) {
        if (!coreMap.has(zh) && !seen[zh]) { exact.push(parseLine(line)); seen[zh] = 1; }
        continue;
      }
      if (zh.indexOf(q) === 0) {
        if (prefix.length < 40) prefix.push(parseLine(line));
      } else if (q.length >= 2 && zh.indexOf(q) > -1 && contains.length < 40) {
        contains.push(parseLine(line));
      }
    }

    // 前缀只按首字分桶；包含匹配需要全库扫描（限流，避免卡顿）
    if (q.length >= 2 && contains.length < 20) {
      for (var k = 0; k < LINES.length && contains.length < 20; k++) {
        var ln = LINES[k];
        var p = ln.indexOf("\t");
        var w = p > 0 ? ln.slice(0, p) : ln;
        if (seen[w] || w === q || w.indexOf(q) === 0) continue;
        if (w.indexOf(q) > -1) { contains.push(parseLine(ln)); seen[w] = 1; }
      }
    }
    return { exact: exact, prefix: prefix, contains: contains };
  }

  function searchLatin(q) {
    var out = [], seen = new Set();
    var k = UG.ugKey(q);
    function push(e) { if (!seen.has(e[0])) { seen.add(e[0]); out.push({ entry: e }); } }

    // 1) 维语拉丁精确匹配优先（"su" 先给 水，而不是拼音 素）
    if (k && ulMap.has(k)) ulMap.get(k).forEach(push);

    // 2) 汉文拼音精确匹配
    var pk = foldPy(q);
    if (pk && pyMap.has(pk)) pyMap.get(pk).forEach(push);

    // 3) 维语拉丁前缀
    if (k && k.length >= 2) {
      ulMap.forEach(function (arr, key) {
        if (key !== k && key.indexOf(k) === 0) arr.forEach(push);
      });
    }
    return out;
  }

  function searchArabic(q) {
    var norm = UG.normalizeUey(q);
    var exact = [], starts = [], contains = [], seen = new Set();
    function push(arr, e) {
      if (seen.has(e[0])) return;
      seen.add(e[0]); arr.push({ entry: e });
    }
    CORE.forEach(function (e) {
      (e[2] || []).forEach(function (s) {
        var su = UG.normalizeUey(s[0]);
        if (su === norm) push(exact, e);
        else if (su.indexOf(norm) === 0) push(starts, e);
        else if (su.indexOf(norm) > -1) push(contains, e);
      });
    });
    return exact.concat(starts, contains);
  }

  // ---------- 渲染 ----------
  var resultsEl = $("results");
  var emptyEl = $("empty");
  var countEl = $("count");

  function tokHtml(uey, uly, cls, k) {
    var lang = cls === "ug" ? "ug-Arab" : "ug-Latn";
    var dir = cls === "ug" ? "rtl" : "ltr";
    var surface = cls === "ug" ? uey : uly;
    return '<span class="tok ' + cls + '" role="button" tabindex="0" lang="' + lang +
      '" dir="' + dir + '" data-k="' + esc(k) + '" data-uey="' + esc(uey) +
      '" data-uly="' + esc(uly) + '">' + esc(surface) + "</span>";
  }

  function heroHtml(entry) {
    var zh = entry[0], py = entry[1], senses = entry[2] || [];
    var h = '<article class="hero">';
    h += '<div class="hero-head"><div class="zh">' + esc(zh) + "</div>" +
      (py ? '<div class="py">' + esc(py) + "</div>" : "") +
      '<div class="badge">' + senses.length + " 个义项</div></div>";
    h += '<div class="senses">';
    senses.forEach(function (s, i) {
      var k = "s" + i;
      var extra = i >= 6 ? ' extra" hidden' : '"';
      h += '<div class="sense' + extra + "><div class=\"num\">" + (i + 1) + "</div>" +
        '<div class="body">' + tokHtml(s[0], s[1], "ug", k) + tokHtml(s[0], s[1], "ul", k) + "</div>" +
        '<div class="acts"><button type="button" data-copy="' + esc(s[0]) + '" data-copy2="' + esc(s[1]) + '">复制</button></div></div>';
    });
    h += "</div>";
    if (senses.length > 6) {
      h += '<button type="button" class="more" data-expand="1">展开全部 ' + senses.length + " 个义项</button>";
    }
    h += exampleHtml(zh);
    if (!EXAMPLES[zh]) h += '<div class="ex-slot" data-zh="' + esc(zh) + '"></div>';
    h += familyHtml(zh);
    h += "</article>";
    return h;
  }

  // 例句：维文逐词可点，拉丁按词转换，保留标点
  function ueyTokens(s) {
    var parts = String(s || "").split(/(\s+)/);
    return parts.map(function (p) {
      if (!p || /^\s+$/.test(p)) return p;
      var m = p.match(/^(.+?)([.,!?;:،؛؟…»«""'']*)$/);
      var core = m ? m[1] : p;
      var punct = m ? m[2] : "";
      if (!core) return esc(punct);
      var uly = UG.uey2ul(core);
      return '<span class="tok ug" role="button" tabindex="0" lang="ug-Arab" dir="rtl" data-uey="' +
        esc(core) + '" data-uly="' + esc(uly) + '">' + esc(core) + "</span>" + esc(punct);
    }).join("");
  }

  function exampleHtml(zh, arr) {
    arr = arr || EXAMPLES[zh];
    if (!arr || !arr.length) return "";
    var h = '<div class="section-title">例句</div>';
    arr.forEach(function (e) {
      h += '<div class="ex">' +
        '<div class="ex-zh">' + esc(e[0]) + "</div>" +
        '<div class="ex-ug ug">' + ueyTokens(e[1]) + "</div>" +
        '<div class="ex-ul ul">' + esc(e[2]) + "</div>" +
        "</div>";
    });
    return h;
  }

  // 长尾例句：按词头哈希加载分片，填充占位
  function hydrateExamples() {
    document.querySelectorAll(".ex-slot").forEach(function (slot) {
      var zh = slot.getAttribute("data-zh");
      if (!zh) return;
      if (EXAMPLES[zh]) { slot.innerHTML = exampleHtml(zh); return; }
      var b = exBucket(zh);
      loadExChunk(b, function () {
        var arr = (EX_CHUNKS["b" + String(b).padStart(2, "0")] || {})[zh];
        if (arr && arr.length) slot.innerHTML = exampleHtml(zh, arr);
      });
    });
  }

  function familyHtml(zh) {
    if (!zh) return "";
    var rows = [], seen = {};
    var pool = byFirst.get(zh.charAt(0)) || [];
    for (var i = 0; i < pool.length && rows.length < 12; i++) {
      var line = pool[i];
      var j = line.indexOf("\t");
      var w = j > 0 ? line.slice(0, j) : line;
      if (w === zh || seen[w]) continue;
      if (w.indexOf(zh) === 0) {
        seen[w] = 1;
        rows.push(parseLine(line));
      }
    }
    if (!rows.length) return "";
    var h = '<div class="section-title">以「' + esc(zh) + "」开头</div><div class=\"rows\">";
    rows.forEach(function (r) {
      var e = coreMap.get(r.zh);
      h += '<button type="button" class="row" data-zh="' + esc(r.zh) + '" data-b="' + r.b + '" data-i="' + r.i + '">' +
        '<span class="rz">' + esc(r.zh) + "</span>" +
        (e && e[1] ? '<span class="rp">' + esc(e[1]) + "</span>" : "") +
        '<span class="rn">' + (e ? (e[2] || []).length + " 义" : "") + "</span>" +
        '<span class="arrow">›</span></button>';
    });
    return h + "</div>";
  }

  function rowHtml(r, note) {
    var e = r.entry || coreMap.get(r.zh);
    var zh = e ? e[0] : r.zh;
    var py = e ? e[1] : "";
    return '<button type="button" class="row" data-zh="' + esc(zh) + '" data-b="' + (e ? -1 : r.b) +
      '" data-i="' + (r.i || 0) + '">' +
      '<span class="rz">' + esc(zh) + "</span>" +
      (py ? '<span class="rp">' + esc(py) + "</span>" : "") +
      '<span class="rn">' + esc(note || (e ? (e[2] || []).length + " 义" : "")) + "</span>" +
      '<span class="arrow">›</span></button>';
  }

  // ---------- 维-汉：索引懒加载 ----------
  function loadUgIndex(cb) {
    if (ugIndexLoaded) return cb(null);
    if (ugIndexLoading) { ugWaiters.push(cb); return; }
    ugIndexLoading = true;
    ugWaiters = [cb];
    var s = document.createElement("script");
    s.src = "data/ug_index.js";
    s.onload = function () {
      var lines = (window.UG_INDEX || "").split("\n").filter(Boolean);
      for (var i = 0; i < lines.length; i++) {
        var p = lines[i].split("\t");
        var k = p[0];
        if (!k) continue;
        var uly = p[1], b = +p[2], ix = +p[3];
        var arr = ugMap.get(k);
        if (!arr) { arr = []; ugMap.set(k, arr); }
        arr.push({ uly: uly, b: b, i: ix });
      }
      ugIndexLoaded = true;
      ugIndexLoading = false;
      var w = ugWaiters; ugWaiters = [];
      w.forEach(function (f) { f(null); });
    };
    s.onerror = function () {
      ugIndexLoading = false;
      var w = ugWaiters; ugWaiters = [];
      w.forEach(function (f) { f(new Error("ug index load failed")); });
    };
    document.head.appendChild(s);
  }

  function searchUg(q, cb) {
    loadUgIndex(function (err) {
      if (err) return cb(null);
      var key = UG.ugKey(q);
      if (!key) return cb(null);
      var qUly = isArabic(q) ? UG.uey2ul(UG.normalizeUey(q)) : UG.normalizeUly(q);
      var exact = (ugMap.get(key) || []).slice();
      exact.sort(function (a, b) { return (a.uly === qUly ? 0 : 1) - (b.uly === qUly ? 0 : 1); });
      var prefix = [];
      if (key.length >= 2) {
        ugMap.forEach(function (arr, k) {
          if (k !== key && k.indexOf(key) === 0 && prefix.length < 12) {
            for (var i = 0; i < arr.length && prefix.length < 12; i++) prefix.push(arr[i]);
          }
        });
      }
      cb({ key: key, exact: exact, prefix: prefix });
    });
  }

  function loadUgChunk(b, cb) {
    var name = bucketName(b);
    if (ugChunkCache[name]) return cb(null, ugChunkCache[name]);
    var s = document.createElement("script");
    s.src = "data/ug_chunks/" + name + ".js";
    s.onload = function () {
      var arr = (window.UG_CHUNKS || {})[name] || [];
      ugChunkCache[name] = arr;
      cb(null, arr);
    };
    s.onerror = function () { cb(new Error("ug chunk fail")); };
    document.head.appendChild(s);
  }

  function ugEntryHtml(e) {
    var uey = e[0], uly = e[1], zh = e[2] || [];
    var h = '<article class="hero ughero">';
    h += '<div class="hero-head"><div class="ug big-ug tok" role="button" tabindex="0" lang="ug-Arab" dir="rtl" data-k="head" data-uey="' +
      esc(uey) + '" data-uly="' + esc(uly) + '">' + esc(uey) + "</div>" +
      '<div class="badge">维语词条</div></div>';
    h += '<div class="ul big-ul" lang="ug-Latn" dir="ltr">' + esc(uly) + "</div>";
    h += '<div class="section-title">汉文释义</div><div class="gloss-list">';
    zh.forEach(function (z) {
      var cn = (z.split(/\s+/)[0] || z);
      h += '<button type="button" class="gloss" data-zh="' + esc(cn) + '">' +
        '<span class="gz">' + esc(z) + '</span><span class="ga">查汉文 ›</span></button>';
    });
    h += "</div></article>";
    return h;
  }

  function renderUgResults(res) {
    var first = res.exact[0] || res.prefix[0];
    if (!first) return;
    resultsEl.className = "mode-" + mode;
    resultsEl.innerHTML = '<div class="hero" id="pendingUg"><div class="hero-head"><div class="zh">…</div><div class="badge">载入中…</div></div></div>';
    emptyEl.hidden = true;
    loadUgChunk(first.b, function (err, arr) {
      var cur = document.getElementById("pendingUg");
      if (err || !arr || !arr[first.i] || !cur) return;
      var more = res.exact.length - 1;
      var h = ugEntryHtml(arr[first.i]);
      if (more > 0) {
        h += '<div class="section-title">同形词条</div><div class="rows"><div class="row" style="cursor:default">' +
          '<span class="rz">另有 ' + more + " 个同形词条</span></div></div>";
      }
      cur.outerHTML = h;
      countEl.textContent = "维语词条 · 全库 " + (META.ugEntries || 385396).toLocaleString() + " 条";
    });
  }

  function renderSearch(q) {
    q = (q || "").trim();
    resultsEl.className = "mode-" + mode;
    if (!q) {
      resultsEl.innerHTML = "";
      emptyEl.hidden = true;
      countEl.textContent = "全库 " + (META.entries || 0).toLocaleString() + " 词 · " +
        (META.senses || 0).toLocaleString() + " 义项 · " + (META.core || 0).toLocaleString() + " 核心词条已载入";
      return;
    }

    var hero = null, rows = [];

    if (isCJK(q)) {
      var r = searchZh(q);
      if (r.exact.length) hero = r.exact[0];
      else if (r.prefix.length) hero = r.prefix[0];
      r.exact.forEach(function (x, i) { if (i > 0) rows.push(x); });
      r.prefix.forEach(function (x) { if (hero !== x) rows.push(x); });
      r.contains.forEach(function (x) { rows.push(x); });
    } else if (isArabic(q)) {
      resultsEl.innerHTML = '<div class="empty"><p class="small">正在加载维语词库…</p></div>';
      searchUg(q, function (res) {
        if (res && (res.exact.length || res.prefix.length)) {
          renderUgResults(res);
        } else {
          resultsEl.innerHTML = "";
          emptyEl.hidden = false;
          countEl.textContent = "没有找到维语词条";
        }
      });
      return;
    } else if (isLatin(q)) {
      var k = UG.ugKey(q);
      var pk = foldPy(q);
      if ((k && ulMap.has(k)) || (pk && pyMap.has(pk))) {
        var l = searchLatin(q);
        if (l.length) { hero = l[0]; rows = l.slice(1); }
      } else {
        resultsEl.innerHTML = '<div class="empty"><p class="small">正在加载维语词库…</p></div>';
        searchUg(q, function (res) {
          if (res && (res.exact.length || res.prefix.length)) {
            renderUgResults(res);
          } else {
            resultsEl.innerHTML = "";
            emptyEl.hidden = false;
            countEl.textContent = "没有找到";
          }
        });
        return;
      }
    }

    var html = "";
    if (hero) {
      if (hero.entry) {
        html += heroHtml(hero.entry);
      } else {
        html += '<div class="hero" id="pendingHero"><div class="hero-head"><div class="zh">' +
          esc(hero.zh) + '</div><div class="badge">载入中…</div></div></div>';
        loadChunk(hero.b, function (err, arr) {
          if (err || !arr || !arr[hero.i]) return;
          var card = heroHtml(arr[hero.i]);
          var cur = document.getElementById("pendingHero");
          if (cur) { cur.outerHTML = card; hydrateExamples(); }
        });
      }
    }

    // 去重
    var seen = {};
    if (hero && hero.entry) seen[hero.entry[0]] = 1;
    if (hero && hero.zh) seen[hero.zh] = 1;
    var more = [];
    rows.forEach(function (x) {
      var z = x.entry ? x.entry[0] : x.zh;
      if (!z || seen[z]) return;
      seen[z] = 1;
      more.push(x);
    });

    if (more.length) {
      html += '<div class="section-title">其他相关词</div><div class="rows">';
      more.slice(0, 40).forEach(function (x) { html += rowHtml(x); });
      html += "</div>";
    }

    resultsEl.innerHTML = html;
    hydrateExamples();
    emptyEl.hidden = !!(hero || more.length);
    var n = (hero ? 1 : 0) + more.length;
    countEl.textContent = n ? "找到 " + n + " 条 · 全库 " + (META.entries || 0).toLocaleString() + " 词" :
      "全库 " + (META.entries || 0).toLocaleString() + " 词";
  }

  // ---------- 详情（分片） ----------
  function openEntry(zh, b, i) {
    if (coreMap.has(zh)) {
      resultsEl.innerHTML = heroHtml(coreMap.get(zh));
      resultsEl.className = "mode-" + mode;
      hydrateExamples();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (b < 0) return;
    loadChunk(b, function (err, arr) {
      if (err || !arr || !arr[i]) return;
      resultsEl.innerHTML = heroHtml(arr[i]);
      resultsEl.className = "mode-" + mode;
      hydrateExamples();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // ---------- 弹窗 ----------
  var pop = $("pop");

  function showPop(el) {
    var uey = el.getAttribute("data-uey") || "";
    var uly = el.getAttribute("data-uly") || "";
    var key = UG.ugKey(uly);
    var hit = key ? senseMap.get(key) : null;
    var isUey = el.classList.contains("ug");
    var morph = null, morphHit = null;
    if (!hit && MORPH) {
      morph = MORPH.analyze(uey);
      if (morph) morphHit = lemmaGloss.get(morph.lemma);
    }

    var html = '<div class="pop-head"><span class="pop-badge">' +
      (isUey ? "老维文 · 点击查看拉丁" : "拉丁维文 · 点击查看老维") +
      '</span><button type="button" class="pop-x" aria-label="关闭">×</button></div>';
    html += '<div class="ug pop-ug" lang="ug-Arab" dir="rtl">' + esc(uey) + "</div>";
    html += '<div class="ul pop-ul" lang="ug-Latn" dir="ltr">' + esc(uly) + "</div>";

    if (hit) {
      html += '<div class="pop-gloss"><span class="zh">' + esc(hit.zh) + "</span>" +
        (hit.py ? '<span class="py">' + esc(hit.py) + "</span>" : "") +
        '<div style="font-size:11.5px;color:var(--muted);margin-top:3px">词典对应词条</div></div>';
    } else if (morph) {
      var lmUly = UG.uey2ul(morph.lemma);
      html += '<div class="pop-gloss">';
      html += '<div class="pop-morph"><span class="pop-label">原形</span>' +
        '<span class="ug pop-lemma" lang="ug-Arab" dir="rtl">' + esc(morph.lemma) + "</span>" +
        '<span class="ul pop-lemma-ul" lang="ug-Latn" dir="ltr">' + esc(lmUly) + "</span></div>";
      if (morph.chain.length) {
        html += '<div class="pop-suffix">' + morph.chain.map(function (x) {
          return '<span class="sfx">-' + esc(x.s) + " " + esc(x.g) + "</span>";
        }).join("") + "</div>";
      }
      if (morphHit) {
        html += '<div class="pop-gloss-line"><span class="zh">' + esc(morphHit.zh) + "</span>" +
          (morphHit.py ? '<span class="py">' + esc(morphHit.py) + "</span>" : "") + "</div>";
      } else {
        html += '<div class="pop-note">原形未在核心词库中找到，可能是专名或长尾词。</div>';
      }
      html += "</div>";
    } else {
      html += '<div class="pop-note">未作为独立词条收录，可能是屈折形式、短语或专名。两种文字已按规则互转。</div>';
    }

    html += '<div class="pop-actions">' +
      '<button type="button" data-cp="' + esc(uey) + '">复制老维文</button>' +
      '<button type="button" data-cp="' + esc(uly) + '">复制拉丁维文</button>' +
      "</div>";

    pop.innerHTML = html;
    pop.hidden = false;

    // 高亮同义项的另一侧
    document.querySelectorAll(".tok.on").forEach(function (x) { x.classList.remove("on"); });
    var k = el.getAttribute("data-k");
    if (k) document.querySelectorAll('.tok[data-k="' + k + '"]').forEach(function (x) { x.classList.add("on"); });

    if (window.innerWidth <= 520) {
      pop.style.left = ""; pop.style.top = ""; pop.style.right = ""; pop.style.bottom = "";
      return;
    }
    var r = el.getBoundingClientRect();
    var pw = pop.offsetWidth, ph = pop.offsetHeight;
    var left = r.left + r.width / 2 - pw / 2;
    left = Math.max(10, Math.min(left, window.innerWidth - pw - 10));
    var top = r.bottom + 8;
    if (top + ph > window.innerHeight - 10) top = r.top - ph - 8;
    if (top < 10) top = 10;
    pop.style.left = left + "px";
    pop.style.top = top + "px";
  }

  function hidePop() {
    pop.hidden = true;
    document.querySelectorAll(".tok.on").forEach(function (x) { x.classList.remove("on"); });
  }

  // ---------- 事件 ----------
  var qEl = $("q");
  var clearBtn = $("clear");
  var timer = null;

  qEl.addEventListener("input", function () {
    clearBtn.hidden = !qEl.value;
    clearTimeout(timer);
    timer = setTimeout(function () { renderSearch(qEl.value); }, 90);
  });
  qEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { clearTimeout(timer); renderSearch(qEl.value); }
  });
  clearBtn.addEventListener("click", function () {
    qEl.value = ""; clearBtn.hidden = true; qEl.focus(); renderSearch("");
  });

  resultsEl.addEventListener("click", function (e) {
    var tok = e.target.closest(".tok");
    if (tok) { showPop(tok); return; }
    var gl = e.target.closest("[data-zh]");
    if (gl) {
      var w = gl.getAttribute("data-zh");
      qEl.value = w; clearBtn.hidden = false; renderSearch(w);
      return;
    }
    var exp = e.target.closest("[data-expand]");
    if (exp) {
      var card = exp.closest(".hero");
      if (card) {
        card.querySelectorAll(".sense.extra").forEach(function (s) { s.hidden = false; });
      }
      exp.remove();
      return;
    }
    var cpy = e.target.closest("[data-copy]");
    if (cpy) {
      var text = cpy.getAttribute("data-copy") + " / " + cpy.getAttribute("data-copy2");
      if (navigator.clipboard) navigator.clipboard.writeText(text);
      cpy.textContent = "已复制";
      setTimeout(function () { cpy.textContent = "复制"; }, 900);
      return;
    }
    var row = e.target.closest(".row");
    if (row) {
      openEntry(row.getAttribute("data-zh"), +row.getAttribute("data-b"), +row.getAttribute("data-i"));
    }
  });

  resultsEl.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var tok = e.target.closest(".tok");
    if (tok) { e.preventDefault(); showPop(tok); }
  });

  pop.addEventListener("click", function (e) {
    if (e.target.closest(".pop-x")) { hidePop(); return; }
    var cp = e.target.closest("[data-cp]");
    if (cp) {
      if (navigator.clipboard) navigator.clipboard.writeText(cp.getAttribute("data-cp"));
      cp.textContent = "已复制";
      setTimeout(function () { cp.textContent = "复制"; }, 900);
    }
  });

  document.addEventListener("click", function (e) {
    if (pop.hidden) return;
    if (pop.contains(e.target) || e.target.closest(".tok")) return;
    hidePop();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") hidePop();
    if (e.key === "/" && document.activeElement !== qEl) { e.preventDefault(); qEl.focus(); }
  });

  // ---------- 模式 ----------
  var modesEl = $("modes");
  function setMode(m) {
    mode = m;
    try { localStorage.setItem("hanug.mode", m); } catch (e) {}
    Array.prototype.forEach.call(modesEl.children, function (b) {
      b.classList.toggle("on", b.getAttribute("data-mode") === m);
    });
    resultsEl.className = "mode-" + m;
    hidePop();
  }
  modesEl.addEventListener("click", function (e) {
    var b = e.target.closest("[data-mode]");
    if (b) setMode(b.getAttribute("data-mode"));
  });
  setMode(mode);

  // ---------- 翻译 ----------
  var tabs = $("tabs");
  var dictView = $("dictView");
  var aiView = $("aiView");
  var dictBar = $("dictBar");
  var srcEl = $("src");
  var srcCount = $("srcCount");
  var goBtn = $("go");
  var aiOut = $("aiOut");
  var outUg = $("outUg");
  var outUl = $("outUl");
  var outZh = $("outZh");
  var aiErr = $("aiErr");
  var dirSeg = $("dirSeg");
  var copyBtn = $("copy");
  var dir = "zh2ug";
  var lastOut = "";

  function switchView(v) {
    var isAi = v === "ai";
    dictView.hidden = isAi;
    aiView.hidden = !isAi;
    dictBar.hidden = isAi;
    Array.prototype.forEach.call(tabs.children, function (b) {
      b.classList.toggle("on", b.getAttribute("data-view") === v);
    });
    if (isAi) srcEl.focus();
  }

  tabs.addEventListener("click", function (e) {
    var b = e.target.closest("[data-view]");
    if (b) switchView(b.getAttribute("data-view"));
  });

  dirSeg.addEventListener("click", function (e) {
    var b = e.target.closest("[data-dir]");
    if (!b) return;
    dir = b.getAttribute("data-dir");
    Array.prototype.forEach.call(dirSeg.children, function (x) {
      x.classList.toggle("on", x === b);
    });
    srcEl.placeholder = dir === "zh2ug"
      ? "输入汉文，翻译成维吾尔语…"
      : "输入维吾尔语（老维文 / 拉丁维文），翻译成汉文…";
    aiOut.hidden = true;
    aiErr.hidden = true;
  });

  srcEl.addEventListener("input", function () { srcCount.textContent = srcEl.value.length; });

  function aiPrompt(text) {
    if (dir === "zh2ug") {
      return "请把以下汉文翻译成维吾尔语。要求：老维文（ئۇيغۇر ئەرەب يېزىقى），2009 标准正字法，SOV 语序，用词自然；只输出维文译文，不要解释、不要转写。\n术语：维吾尔语=ئۇيغۇرچە；汉语/汉文=خەنزۇچە；词典=لۇغەت；新疆=شىنجاڭ；中国=جۇڭگو。\n\n" + text;
    }
    return "请把以下维吾尔语翻译成简体汉文。只输出汉文译文，不要解释。\n\n" + text;
  }

  function doTranslate() {
    var text = srcEl.value.trim();
    if (!text) { srcEl.focus(); return; }
    aiErr.hidden = true;
    aiOut.hidden = true;
    goBtn.disabled = true;
    goBtn.textContent = "翻译中…";
    fetch("https://index-translate.bilibili.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer EMPTY"
      },
      body: JSON.stringify({
        model: "Index-Translate-35B-A3B",
        messages: [{ role: "user", content: aiPrompt(text) }],
        max_tokens: 1600,
        temperature: 0.2
      })
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (d) {
      var out = (d.choices && d.choices[0] && d.choices[0].message &&
        d.choices[0].message.content || "").trim();
      if (!out) throw new Error("空译文");
      if (dir === "zh2ug") {
        var uey = UG.normalizeUey(out);
        var uly = UG.uey2ul(uey);
        outUg.innerHTML = ueyTokens(uey);
        outUl.textContent = uly;
        outUg.hidden = false;
        outUl.hidden = false;
        outZh.hidden = true;
        lastOut = uey + "\n" + uly;
      } else {
        outZh.textContent = out;
        outZh.hidden = false;
        outUg.hidden = true;
        outUl.hidden = true;
        lastOut = out;
      }
      aiOut.hidden = false;
    }).catch(function (err) {
      aiErr.textContent = "翻译失败：" + (err && err.message ? err.message : "网络错误") + "。请稍后重试。";
      aiErr.hidden = false;
    }).then(function () {
      goBtn.disabled = false;
      goBtn.textContent = "翻译";
    });
  }

  goBtn.addEventListener("click", doTranslate);
  srcEl.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); doTranslate(); }
  });
  copyBtn.addEventListener("click", function () {
    if (!lastOut) return;
    if (navigator.clipboard) navigator.clipboard.writeText(lastOut);
    copyBtn.textContent = "已复制";
    setTimeout(function () { copyBtn.textContent = "复制"; }, 900);
  });
  aiOut.addEventListener("click", function (e) {
    var t = e.target.closest(".tok");
    if (t) showPop(t);
  });

  // ---------- 初始化 ----------
  var pre = new URLSearchParams(location.search).get("q");
  if (pre) { qEl.value = pre; clearBtn.hidden = false; renderSearch(pre); }
  else renderSearch("");
})();
