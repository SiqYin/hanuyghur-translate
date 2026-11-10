"use strict";
const puppeteer = require("./pptr/node_modules/puppeteer-core");

(async () => {
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu"]
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.setViewport({ width: 1200, height: 1000 });

  async function go(q) {
    await page.goto("http://localhost:5199/?q=" + encodeURIComponent(q) + "&t=" + Date.now(),
      { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector(".hero", { timeout: 60000 });
    await new Promise(r => setTimeout(r, 300));
  }

  await go("水");
  console.log("ZH", await page.evaluate(() => ({
    zh: document.querySelector(".hero .zh") && document.querySelector(".hero .zh").textContent,
    senses: document.querySelectorAll(".sense").length,
    firstUg: document.querySelector(".tok.ug") && document.querySelector(".tok.ug").textContent,
    firstUl: document.querySelector(".tok.ul") && document.querySelector(".tok.ul").textContent,
    ex: document.querySelectorAll(".ex").length
  })));

  // 例句屈折词点击（用「叫」的例句：چاقىردى -> چاقىرماق）
  await go("叫");
  const toks = await page.$$(".ex-ug .tok");
  if (toks.length) {
    await toks[toks.length - 1].click();
    await new Promise(r => setTimeout(r, 300));
    console.log("MORPH", await page.evaluate(() => {
      const p = document.getElementById("pop");
      return {
        lemma: p.querySelector(".pop-lemma") && p.querySelector(".pop-lemma").textContent,
        sfx: [...p.querySelectorAll(".sfx")].map(x => x.textContent),
        gloss: p.querySelector(".pop-gloss-line") && p.querySelector(".pop-gloss-line").textContent
      };
    }));
    await page.keyboard.press("Escape");
  }

  await go("学校");
  console.log("SCHOOL", await page.evaluate(() => ({
    zh: document.querySelector(".hero .zh").textContent,
    first: document.querySelector(".tok.ug") && document.querySelector(".tok.ug").textContent
  })));

  await go("su");
  console.log("SU", await page.evaluate(() => ({
    zh: document.querySelector(".hero .zh") && document.querySelector(".hero .zh").textContent
  })));

  await go("ئۆي");
  console.log("UG_OY", await page.evaluate(() => ({
    ug: document.querySelector(".big-ug") && document.querySelector(".big-ug").textContent,
    ul: document.querySelector(".big-ul") && document.querySelector(".big-ul").textContent,
    glosses: [...document.querySelectorAll(".gloss .gz")].slice(0, 4).map(x => x.textContent)
  })));
  await page.screenshot({ path: "shot_ug_final.png" });

  await go("ئوي");
  console.log("UG_OY2", await page.evaluate(() => ({
    ug: document.querySelector(".big-ug") && document.querySelector(".big-ug").textContent,
    ul: document.querySelector(".big-ul") && document.querySelector(".big-ul").textContent
  })));

  await go("半乳糖胺");
  console.log("RARE", await page.evaluate(() => ({
    zh: document.querySelector(".hero .zh").textContent,
    ug: document.querySelector(".tok.ug") && document.querySelector(".tok.ug").textContent
  })));

  await page.click('[data-mode="uey"]');
  console.log("MODE", await page.evaluate(() => ({
    ul: getComputedStyle(document.querySelector(".tok.ul") || document.body).display,
    ug: getComputedStyle(document.querySelector(".tok.ug") || document.body).display
  })));

  console.log("ERRORS", errors);
  await browser.close();
})();
