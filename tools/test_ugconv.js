"use strict";

/*
 * ugconv.js 测试
 * 语料以 2008 年 1 月自治区民语委鉴定验收的拉丁维文（ULY）方案为准：
 *   - ئې/ې → ë（不再是 é）
 *   - ژ → zh、ج → j
 *   - 词中 hamza → '（mu'ellim、sün'iy、qa'ide）
 *   - 二合字母歧义处加 '（tallan'ghan、in'glizche）；无歧义不加（shinjang、sheher）
 * 每个用例同时验证 uey2ul 与 ul2uey 回环。
 */

const U = require("./ugconv.js");

const pairs = [
  // --- 基础词 ---
  ["سۇ", "su"],
  ["ئوت", "ot"],
  ["تاغ", "tagh"],
  ["يېمەك", "yëmek"],
  ["ئىچمەك", "ichmek"],
  ["كىتاب", "kitab"],
  ["مەكتەپ", "mektep"],
  ["ئۇستاز", "ustaz"],
  ["ئوقۇغۇچى", "oqughuchi"],
  ["دوست", "dost"],
  ["ئۆي", "öy"],
  ["ئۆيلەر", "öyler"],
  ["ئۆيلەردە", "öylerde"],
  ["ئۆيلەردىكىلەر", "öylerdikiler"],
  ["ئىشىك", "ishik"],
  ["قەلەم", "qelem"],
  ["قەلىمى", "qelimi"],
  ["ئات", "at"],
  ["ئىتى", "iti"],
  ["مەن", "men"],
  ["سەن", "sen"],
  ["ئۇ", "u"],
  ["بىز", "biz"],
  ["ئۇلار", "ular"],
  ["ياخشى", "yaxshi"],
  ["يامان", "yaman"],
  ["چوڭ", "chong"],
  ["كىچىك", "kichik"],
  ["يېڭى", "yëngi"],
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
  ["جاۋاب", "jawab"],
  ["ئىش", "ish"],
  ["ئىشچى", "ishchi"],
  ["ئىشلىمەك", "ishlimek"],
  ["يازماق", "yazmaq"],
  ["ئوقۇماق", "oqumaq"],

  // --- ë（2008 修订：é → ë）---
  ["تېلېفون", "tëlëfon"],
  ["ئىنتېرنېت", "intërnët"],
  ["كومپيۇتېر", "kompyutër"],
  ["بېيجىڭ", "bëyjing"],
  ["تېخنىكا", "tëxnika"],
  ["ئېغىر", "ëghir"],
  ["ئېھتىمال", "ëhtimal"],
  ["سۆزلەر", "sözler"],
  ["ئۇنىۋېرسىتېت", "uniwërsitët"],
  ["خەنزۇچە-ئۇيغۇرچە لۇغەت", "xenzuche-uyghurche lughet"],

  // --- zh / j（2008 起固定）---
  ["چېرتيوژ", "chërtyozh"],
  ["ژۇرنال", "zhurnal"],
  ["جۈملىدىن", "jümlidin"],
  ["جەمئىيەت", "jem'iyet"],
  ["جۇڭگو", "junggo"],

  // --- 词中 hamza → ' ---
  ["مۇئەللىم", "mu'ellim"],
  ["مەسئۇل", "mes'ul"],
  ["مەسئۇلىيەت", "mes'uliyet"],
  ["شائىر", "sha'ir"],
  ["تائام", "ta'am"],
  ["قائىدە", "qa'ide"],
  ["مائارىپ", "ma'arip"],
  ["سۈنئىي", "sün'iy"],
  ["ئائىلە", "a'ile"],
  ["سوئال", "so'al"],
  ["مەئنا", "me'na"],
  ["ھەئە", "he'e"],
  ["ئەنئەنە", "en'ene"],
  ["مۇئامىلە", "mu'amile"],
  ["تەئسىر", "te'sir"],
  ["ئەقىلگە", "eqilge"],
  ["ئىگە", "ige"],
  ["ئەھمىيەت", "ehmiyet"],
  ["ئىنتايىن", "intayin"],

  // --- 二合字母歧义 → '；无歧义不加 ---
  ["تاللانغان", "tallan'ghan"],
  ["ساقلانغان", "saqlan'ghan"],
  ["ئىنگلىزچە", "in'glizche"],
  ["ئىنگلىز", "in'gliz"],
  ["شىنجاڭ", "shinjang"],
  ["شەھەر", "sheher"],
  ["جاڭغا", "janggha"],
  ["ئاڭا", "anga"],
  ["ئۈرۈمچى", "ürümchi"],
  ["رەھمەت", "rehmet"],
  ["مەرھەمەت", "merhemet"],
  ["كەچۈرۈڭ", "kechürüng"],
  ["ئوقۇغۇچىلار", "oqughuchilar"],
  ["مەكتەپتە", "mektepte"],
  ["كىتابنى", "kitabni"],
  ["لۇغەت", "lughet"],
  ["خوش", "xosh"],
  ["ياق", "yaq"],
  ["خەلق", "xelq"],
  ["قەشقەر", "qeshqer"],

  // --- 借词正字法：و/ۇ 后直接连 ە/ې，不带 hamza（双向均不加撇号）---
  ["گۇەن", "guen"],
  ["يۈەن", "yüen"],
  ["جۇڭخۇا", "jungxua"],
  ["گۇاڭدۇڭ", "guangdung"],
  ["كۇەيبەن", "kueyben"],
  ["سىچۇەن", "sichuen"],

  // --- 短句 ---
  ["مەن سۇ ئىچىمەن", "men su ichimen"],
  ["ئىشىكنى ئېچىڭ", "ishikni ëching"]
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

// --- 官方验收句：《世界人权宣言》第一条（ULY 官方样例，ë 版）---
// 来源：en.wikipedia "Uyghur Latin Yëziqi"；其中 مۇئامىلە 按元音间 hamza 规则转 mu'amile
const UDHR_UEY = "ھەممە ئادەم تۇغۇلۇشىدىنلا ئەركىن، ئىززەت-ھۆرمەت ۋە ھوقۇقتا بابباراۋەر بولۇپ تۇغۇلغان. ئۇلار ئەقىلگە ۋە ۋىجدانغا ئىگە ھەمدە بىر-بىرىگە قېرىنداشلىق مۇناسىۋىتىگە خاس روھ بىلەن مۇئامىلە قىلىشى كېرەك.";
const UDHR_ULY = "Hemme adem tughulushidinla erkin, izzet-hörmet we hoquqta babbarawer bolup tughulghan. Ular eqilge we wijdan'gha ige hemde bir-birige qërindashliq munasiwitige xas roh bilen mu'amile qilishi kërek.";

{
  const gotUl = U.capitalizeUly(U.uey2ul(UDHR_UEY));
  if (gotUl === UDHR_ULY) pass++;
  else { fail++; fails.push({ name: "UDHR uey2ul", expect: UDHR_ULY, got: gotUl }); }

  const gotUey = U.ul2uey(UDHR_ULY);
  const gotNorm = U.normalizeUey(gotUey);
  if (gotNorm === U.normalizeUey(UDHR_UEY)) pass++;
  else { fail++; fails.push({ name: "UDHR ul2uey", got: gotUey }); }
}

// --- 大写与合法性 ---
const extra = [
  // مەنا（无 hamza 写法）单向：官方拉丁拼写带隔音符；反向还原为带 hamza 的规范老维文 مەئنا
  ["exception fwd", U.uey2ul("مەنا"), "me'na"],
  ["exception back", U.normalizeUey(U.ul2uey("me'na")), "مەئنا"],
  ["capitalize", U.capitalizeUly("bu bir kitab. u kirdi."), "Bu bir kitab. U kirdi."],
  ["capitalize keeps caps", U.capitalizeUly("Shinjang"), "Shinjang"],
  ["capitalize ë", U.capitalizeUly("ëghir"), "Ëghir"],
  ["legal uly", U.isLegalUly("uyghur tëlëfon"), true],
  ["illegal ç", U.isLegalUly("neçə"), false],
  ["illegal ə", U.isLegalUly("rənglik"), false],
  ["legal apostrophe", U.isLegalUly("tallan'ghan"), true],
  ["normalizeUey presentation", U.normalizeUey("ﻣﻪﻛﺘﻪﭖ"), "مەكتەپ"],
  ["normalizeUey kaf", U.normalizeUey("کتاب"), "كتاب"],
  ["normalizeUey yeh", U.normalizeUey("یىل"), "يىل"],
  ["normalizeUey digits", U.normalizeUey("٢٠٢٦"), "2026"],
  ["normalizeUey zwnj", U.normalizeUey("ئۆ\u200Cي"), "ئۆي"],
  ["normalizeUey punct", U.normalizeUey("ئۇ، ياخشى؛ شۇنداقمۇ؟"), "ئۇ, ياخشى; شۇنداقمۇ؟".replace("؟", "?")],
  ["normalizeUly legacy é", U.normalizeUly("Téléfon"), "tëlëfon"],
  ["normalizeUly v-key", U.normalizeUly("Uyghurvche"), "uyghurüche"],
  ["key uey", U.ugKey("ئۆي"), "oy"],
  ["key uly", U.ugKey("öy"), "oy"],
  ["key inflected", U.ugKey("ئۆيلەردىكىلەر"), "oylerdikiler"],
  ["key uly inflected", U.ugKey("öylerdikiler"), "oylerdikiler"],
  ["key legacy é input", U.ugKey("téléfon"), "telefon"],
  ["key ë input", U.ugKey("tëlëfon"), "telefon"],
  ["key apostrophe", U.ugKey("tallan'ghan"), "tallanghan"],
  ["detect zh", U.detectScript("水"), "zh"],
  ["detect uey", U.detectScript("ئۇيغۇر"), "uey"],
  ["detect uly", U.detectScript("uyghur"), "uly"],
  ["detect mixed", U.detectScript("水 su"), "mixed"]
];

for (const [name, got, expect] of extra) {
  if (got === expect) pass++;
  else { fail++; fails.push({ name, expect, got }); }
}

console.log(`cases=${pairs.length + 2 + extra.length} pass=${pass} fail=${fail}`);
if (fails.length) {
  console.log(JSON.stringify(fails, null, 2));
  process.exit(1);
}
