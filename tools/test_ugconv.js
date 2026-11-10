"use strict";

const U = require("./ugconv.js");

const pairs = [
  ["سۇ", "su"],
  ["ئوت", "ot"],
  ["تاغ", "tagh"],
  ["يېمەك", "yémek"],
  ["ئىچمەك", "ichmek"],
  ["كىتاب", "kitab"],
  ["مەكتەپ", "mektep"],
  ["ئۇستاز", "ustaz"],
  ["ئوقۇغۇچى", "oqughuchi"],
  ["دوست", "dost"],
  ["ئائىلە", "aile"],
  ["ئۆي", "öy"],
  ["ئۆيلەر", "öyler"],
  ["ئۆيلەردە", "öylerde"],
  ["ئۆيلەردىكىلەر", "öylerdikiler"],
  ["ئىشىك", "ishik"],
  ["قەلەم", "qelem"],
  ["قەلىمى", "qelimi"],
  ["ئات", "at"],
  ["ئىتى", "iti"],
  ["مۇئەللىم", "mu'ellim"],
  ["مەسئۇل", "mes'ul"],
  ["شائىر", "shair"],
  ["تائام", "taam"],
  ["قەغەز", "qeghez"],
  ["تىل", "til"],
  ["ئۇيغۇر تىلى", "uyghur tili"],
  ["خەنزۇچە", "xenzuche"],
  ["ئۇيغۇرچە", "uyghurche"],
  ["لۇغەت", "lughet"],
  ["ئىنتېرنېت", "intérnét"],
  ["تېلېفون", "téléfon"],
  ["كومپيۇتېر", "kompyutér"],
  ["رەھمەت", "rehmet"],
  ["ياخشىمۇسىز", "yaxshimusiz"],
  ["خوش", "xosh"],
  ["ھەئە", "he'e"],
  ["ياق", "yaq"],
  ["مەرھەمەت", "merhemet"],
  ["كەچۈرۈڭ", "kechürüng"],
  ["ئوقۇغۇچىلار", "oqughuchilar"],
  ["مەكتەپتە", "mektepte"],
  ["كىتابنى", "kitabni"],
  ["مەن", "men"],
  ["سەن", "sen"],
  ["ئۇ", "u"],
  ["بىز", "biz"],
  ["ئۇلار", "ular"],
  ["ياخشى", "yaxshi"],
  ["يامان", "yaman"],
  ["چوڭ", "chong"],
  ["كىچىك", "kichik"],
  ["يېڭى", "yéngi"],
  ["كونا", "kona"],
  ["بىر", "bir"],
  ["ئىككى", "ikki"],
  ["ئۈچ", "üch"],
  ["تۆت", "töt"],
  ["بەش", "besh"],
  ["ئون", "on"],
  ["يۈز", "yüz"],
  ["بۈگۈن", "bügün"],
  ["ئەتە", "ete"],
  ["تۈنۈگۈن", "tünügün"],
  ["ھازىر", "hazir"],
  ["جۇڭگو", "junggo"],
  ["بېيجىڭ", "béyjing"],
  ["شىنجاڭ", "shinjang"],
  ["ئۈرۈمچى", "ürümchi"],
  ["ئۇنىۋېرسىتېت", "uniwérsitét"],
  ["سوئال", "soal"],
  ["جاۋاب", "jawab"],
  ["ئىش", "ish"],
  ["ئىشچى", "ishchi"],
  ["ئىشلىمەك", "ishlimek"],
  ["يازماق", "yazmaq"],
  ["ئوقۇماق", "oqumaq"],
  ["مەن سۇ ئىچىمەن", "men su ichimen"],
  ["ئىشىكنى ئېچىڭ", "ishikni éching"],
  ["خەنزۇچە-ئۇيغۇرچە لۇغەت", "xenzuche-uyghurche lughet"]
];

let pass = 0, fail = 0;
const fails = [];

for (const [uey, uly] of pairs) {
  const gotUl = U.uey2ul(uey);
  const gotUey = U.ul2uey(uly);
  if (gotUl !== uly) {
    fail++; fails.push({ uey, expect: uly, got: gotUl, dir: "uey2ul" });
  } else if (gotUey !== uey) {
    fail++; fails.push({ uey, expect: uey, got: gotUey, dir: "ul2uey", uly });
  } else {
    pass++;
  }
}

// 归一化与键
const extra = [
  ["normalizeUey presentation", U.normalizeUey("ﻣﻪﻛﺘﻪﭖ"), "مەكتەپ"],
  ["normalizeUey kaf", U.normalizeUey("کتاب"), "كتاب"],
  ["normalizeUey yeh", U.normalizeUey("یىل"), "يىل"],
  ["normalizeUey digits", U.normalizeUey("٢٠٢٦"), "2026"],
  ["normalizeUey zwnj", U.normalizeUey("ئۆ\u200Cي"), "ئۆي"],
  ["key uey", U.ugKey("ئۆي"), "oy"],
  ["key uly", U.ugKey("öy"), "oy"],
  ["key inflected", U.ugKey("ئۆيلەردىكىلەر"), "oylerdikiler"],
  ["key uly inflected", U.ugKey("öylerdikiler"), "oylerdikiler"],
  ["detect zh", U.detectScript("水"), "zh"],
  ["detect uey", U.detectScript("ئۇيغۇر"), "uey"],
  ["detect uly", U.detectScript("uyghur"), "uly"],
  ["detect mixed", U.detectScript("水 su"), "mixed"]
];

for (const [name, got, expect] of extra) {
  if (got === expect) pass++;
  else { fail++; fails.push({ name, expect, got }); }
}

console.log(`cases=${pairs.length + extra.length} pass=${pass} fail=${fail}`);
if (fails.length) {
  console.log(JSON.stringify(fails, null, 2));
  process.exit(1);
}
