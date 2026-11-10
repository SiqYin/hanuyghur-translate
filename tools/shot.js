"use strict";
const puppeteer = require("./pptr/node_modules/puppeteer-core");

(async () => {
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 1000, deviceScaleFactor: 1 });
  await page.goto("http://localhost:5199/?q=" + encodeURIComponent("水"), { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(".hero", { timeout: 30000 });
  await new Promise(r => setTimeout(r, 500));

  await page.click('[data-mode="uey"]');
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: "shot_uey.png" });

  await page.click('[data-mode="uly"]');
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: "shot_uly.png" });

  await page.click('[data-mode="both"]');
  await new Promise(r => setTimeout(r, 300));
  await page.click(".tok.ug");
  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: "shot_pop.png" });

  await page.click(".pop-x");
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.evaluate(() => { const q = document.getElementById("q"); q.value = "学校"; q.dispatchEvent(new Event("input", { bubbles: true })); });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: "shot_mobile.png" });

  await browser.close();
  console.log("done");
})();
