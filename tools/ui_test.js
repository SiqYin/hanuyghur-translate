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

  await page.setViewport({ width: 1200, height: 980, deviceScaleFactor: 1 });
  await page.goto("http://localhost:5199/?q=" + encodeURIComponent("水"), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".hero", { timeout: 30000 });

  const info = await page.evaluate(() => {
    const hero = document.querySelector(".hero");
    return {
      zh: hero && hero.querySelector(".zh") && hero.querySelector(".zh").textContent,
      py: hero && hero.querySelector(".py") && hero.querySelector(".py").textContent,
      senses: document.querySelectorAll(".sense").length,
      hiddenSenses: document.querySelectorAll(".sense.extra[hidden]").length,
      ug: document.querySelectorAll(".tok.ug").length,
      ul: document.querySelectorAll(".tok.ul").length,
      firstUg: document.querySelector(".tok.ug") && document.querySelector(".tok.ug").textContent,
      firstUl: document.querySelector(".tok.ul") && document.querySelector(".tok.ul").textContent,
      count: document.getElementById("count").textContent
    };
  });
  console.log("HERO", JSON.stringify(info, null, 2));

  // 点击第一个老维文词
  await page.click(".tok.ug");
  await page.waitForSelector("#pop:not([hidden])", { timeout: 5000 });
  const pop = await page.evaluate(() => {
    const p = document.getElementById("pop");
    return {
      uey: p.querySelector(".pop-ug") && p.querySelector(".pop-ug").textContent,
      uly: p.querySelector(".pop-ul") && p.querySelector(".pop-ul").textContent,
      gloss: p.querySelector(".pop-gloss") && p.querySelector(".pop-gloss").textContent.trim(),
      note: p.querySelector(".pop-note") && p.querySelector(".pop-note").textContent.trim()
    };
  });
  console.log("POP", JSON.stringify(pop, null, 2));
  await page.screenshot({ path: "ui_pop.png" });

  // 关闭弹窗，切换老维文模式
  await page.click(".pop-x");
  await page.click('[data-mode="uey"]');
  const mode = await page.evaluate(() => {
    const ul = document.querySelector(".tok.ul");
    const ug = document.querySelector(".tok.ug");
    return {
      ulDisplay: ul ? getComputedStyle(ul).display : null,
      ugDisplay: ug ? getComputedStyle(ug).display : null,
      bodyMode: document.querySelector(".hero").parentElement.className
    };
  });
  console.log("MODE uey", JSON.stringify(mode));

  // 搜索学校
  await page.evaluate(() => { const q = document.getElementById("q"); q.value = "学校"; q.dispatchEvent(new Event("input", { bubbles: true })); });
  await new Promise(r => setTimeout(r, 800));
  const school = await page.evaluate(() => {
    const h = document.querySelector(".hero");
    return { zh: h && h.querySelector(".zh").textContent, first: h && h.querySelector(".tok.ug") && h.querySelector(".tok.ug").textContent };
  });
  console.log("SCHOOL", JSON.stringify(school));

  // 搜索拉丁 su
  await page.evaluate(() => { const q = document.getElementById("q"); q.value = "su"; q.dispatchEvent(new Event("input", { bubbles: true })); });
  await new Promise(r => setTimeout(r, 800));
  const su = await page.evaluate(() => {
    const h = document.querySelector(".hero");
    return { zh: h && h.querySelector(".zh").textContent, senses: document.querySelectorAll(".sense").length };
  });
  console.log("SU", JSON.stringify(su));

  // 搜索老维文
  await page.evaluate(() => { const q = document.getElementById("q"); q.value = "سۇ"; q.dispatchEvent(new Event("input", { bubbles: true })); });
  await new Promise(r => setTimeout(r, 800));
  const ar = await page.evaluate(() => {
    const h = document.querySelector(".hero");
    return { zh: h && h.querySelector(".zh").textContent, senses: document.querySelectorAll(".sense").length };
  });
  console.log("AR", JSON.stringify(ar));

  // 非核心词（分片加载）
  await page.evaluate(() => { const q = document.getElementById("q"); q.value = "半乳糖胺"; q.dispatchEvent(new Event("input", { bubbles: true })); });
  await new Promise(r => setTimeout(r, 1200));
  const rare = await page.evaluate(() => {
    const h = document.querySelector(".hero");
    return { zh: h && h.querySelector(".zh").textContent, ug: h && h.querySelector(".tok.ug") && h.querySelector(".tok.ug").textContent };
  });
  console.log("RARE", JSON.stringify(rare));

  console.log("ERRORS", JSON.stringify(errors, null, 2));
  await browser.close();
})();
