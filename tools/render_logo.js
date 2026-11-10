const fs = require('fs');
const path = require('path');
const p = require('./pptr/node_modules/puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const svg = fs.readFileSync(path.join(ROOT, 'app/assets/logo.svg'), 'utf8');

(async () => {
  const b = await p.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new', args: ['--no-sandbox']
  });
  const page = await b.newPage();
  const sizes = [1024, 512, 256, 192, 128, 64];
  for (const s of sizes) {
    await page.setViewport({ width: s, height: s, deviceScaleFactor: 1 });
    await page.setContent(
      `<html><body style="margin:0;background:transparent">` +
      `<div style="width:${s}px;height:${s}px">${svg.replace('width="512" height="512"', `width="${s}" height="${s}"`)}</div>` +
      `</body></html>`, { waitUntil: 'domcontentloaded' });
    const out = path.join(ROOT, 'app/assets', `logo-${s}.png`);
    await page.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: s, height: s } });
    console.log('wrote', out);
  }
  // 首页 favicon 用 64；README 用 1024
  const docs = path.join(ROOT, 'docs');
  fs.mkdirSync(docs, { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'app/assets/logo-1024.png'), path.join(docs, 'logo.png'));
  await b.close();
})();
