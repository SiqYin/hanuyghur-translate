# 汉维辞典 · خەنزۇچە-ئۇيغۇرچە لۇغەت

汉↔维双向词典。维吾尔语同时支持**老维文（UEY，阿拉伯字母，RTL）**与**拉丁维文（ULY，LTR）**，双文字并行显示、点击互查。

## 当前能力

- 汉-维：328,900 词头 / **532,192 义项**
- 维-汉：**371,784 词头**（由对齐数据反演，独立词条已接入）
- 三种显示模式：老维文 / 拉丁维文 / 对照
- 点击任意维文词：弹出另一种文字、词典对应词条、复制
- 分片加载：全库索引 7.3 MB + 核心词条 5.6 MB，其余 64 个分片按需加载
- 词形还原：`ئىچىمەن → ئىچمەك`，点击屈折词显示原形、词尾、释义
- 例句：600+ 条，逐词可点；复用汉南 114,385 条汉文句，只补维文；目标 120,000
- AI 翻译：汉-维 / 维-汉，输出老维文 + 拉丁维文，逐词可点

## 快速开始

```bash
# 本地预览
python -m http.server 5199 --directory app
# http://localhost:5199/?q=水
```

## 目录

```
app/                 前端（原生 HTML/CSS/JS，无框架）
  index.html
  style.css
  app.js
  ugconv.js          双文字引擎（浏览器）
  data/              meta / core / index / examples_core / examples_chunks / chunks
tools/
  ugconv.js          双文字引擎（唯一实现，Node + 浏览器共用）
  test_ugconv.js     93 条转换用例
  import_anatilim.py 原始词典导入/清洗
  build_app_data.py  词库编译、义项排序、分片
  build_ug_data.py   维-汉反演数据编译
  invert_zh_ug.py    由汉-维反演维-汉
  gen_examples.py    例句生成（批量两段式）
  translate_examples.py 复用汉南汉文句、只补维文翻译
  gen_lexicon.py     AI 词条生成
  build_examples.py  例句转拉丁 + 写前端
  ui_test.js         Puppeteer 交互回归
data/
  raw/anatilim/      原始词典（不随公开仓库分发）
  clean/             清洗后 JSONL
  cache/             AI 生成缓存
```

## 数据管线

```bash
# 1. 导入原始词典（需要 data/raw/anatilim 四个文件）
python tools/import_anatilim.py

# 2. 编译前端数据
python tools/build_app_data.py

# 3. 生成例句
python tools/gen_examples.py --limit 300 --batch 3 --workers 4
python tools/build_examples.py

# 4. 测试
node tools/test_ugconv.js
node tools/ui_test.js
```

## 技术要点

- **单一真源**：词库只存 UEY；ULY 由 `tools/ugconv.js` 构建期派生。
- **一个键两种文字**：所有维语词生成折叠 ULY `key`，UEY/ULY 查询归一化到同一键。
- **RTL 只作用于内容层**：`lang="ug-Arab"` + `dir="rtl"` + `unicode-bidi:isolate`；`letter-spacing:0`。
- **无框架**：静态数据 + 原生 JS，便于 Electron/Capacitor/Pages 三端复用。
- **数据分层**：核心词条首屏，长尾分片按需加载。

## 许可

代码：待定（建议 MIT）。
词典数据：见 `SOURCES.md`。**Anatilim 数据未附明确开源许可，公开分发前需授权或替换。**

## 路线

- [x] 双文字引擎
- [x] 32.9 万汉维词库 + 分片
- [x] 三态显示 + 点击对照
- [x] 维-汉独立词条（37 万）
- [x] 词形还原（后缀 + 弱化）
- [~] 例句接入 + 逐词可点（600+ / 120k，放量中）
- [ ] 三端打包
- [ ] 评测与 v1.0
