const path = require('path');
const p = require('./pptr/node_modules/puppeteer-core');
const ROOT = path.resolve(__dirname, '..');
const fs = require('fs');
const b64 = f => 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'app/assets', f)).toString('base64');

(async () => {
  const b = await p.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox'] });
  const page = await b.newPage();
  await page.setViewport({ width: 1120, height: 760, deviceScaleFactor: 2 });
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  body{margin:0;background:#f7f5f0;font-family:"Microsoft YaHei",sans-serif;color:#211c17}
  .wrap{padding:34px 40px}
  h1{font-size:20px;margin:0 0 4px;font-weight:600}
  p.sub{margin:0 0 24px;font-size:12px;color:#7c6f5f}
  .row{display:flex;gap:22px;align-items:flex-end}
  .cell{text-align:center;font-size:11px;color:#7c6f5f}
  .big{padding:18px;border-radius:26px;background:#fffdf8;border:1px solid #e7dfd0}
  .dark{background:#141416;border-color:#141416}
  img{display:block}
  .sizes{margin-top:26px;display:flex;gap:26px;align-items:flex-end;padding:18px 22px;background:#fffdf8;border:1px solid #e7dfd0;border-radius:18px}
  .tag{font-size:10.5px;color:#a89a88;margin-top:6px;letter-spacing:.06em}
  </style></head><body><div class="wrap">
  <h1>汉维辞典 · Logo 草案</h1>
  <p class="sub">左上 #000000 → 右下 #3A6DA2，中央白色五瓣梅花（花瓣尖端带缺刻）</p>
  <div class="row">
    <div class="cell"><div class="big"><img src="${b64('logo-512.png')}" width="300"></div><div class="tag">浅色背景 · 300px</div></div>
    <div class="cell"><div class="big dark"><img src="${b64('logo-512.png')}" width="300"></div><div class="tag">深色背景 · 300px</div></div>
  </div>
  <div class="sizes">
    <div class="cell"><img src="${b64('logo-192.png')}" width="128"><div class="tag">128</div></div>
    <div class="cell"><img src="${b64('logo-128.png')}" width="96"><div class="tag">96</div></div>
    <div class="cell"><img src="${b64('logo-64.png')}" width="64"><div class="tag">64</div></div>
    <div class="cell"><img src="${b64('logo-64.png')}" width="32"><div class="tag">32</div></div>
    <div class="cell"><img src="${b64('logo-64.png')}" width="20"><div class="tag">20 · favicon</div></div>
  </div>
  </div></body></html>`;
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 400));
  fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
  await page.screenshot({ path: path.join(ROOT, 'docs', 'logo-draft.png'), fullPage: true });
  console.log('wrote docs/logo-draft.png');
  await b.close();
})();
