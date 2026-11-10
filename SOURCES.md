# 数据来源与许可

> 最后更新：2026-11-10

## 1. 词库

| 来源 | 文件 | 规模 | 许可 | 用途 |
|---|---|---|---|---|
| Anatilim Uyghur ↔ Chinese Dictionary（via `xhacker/chinese-uyghur`） | `ChineseUyghurStarDict.txt`（UEY）<br>`ChineseUyghurStarDict_CnUy_ULY.txt`（ULY）<br>`ChineseUyghurStarDict_UyCn.txt`（UEY）<br>`ChineseUyghurStarDict_UyCn_ULY.txt`（ULY） | 汉-维 328,902 行<br>维-汉 385,502 行 | **未附明确开源许可**（原始来源 anatilim.com） | 词库底座 |
| 现代汉语常用词表 | `modern_chinese_words.tsv` | 56,790 词（带频序/拼音） | 项目内使用，来源待补 | 排序/选词 |
| HSK 词表 | `hsk_all.tsv` | 4,997 词 | 项目内使用 | 核心层 |

### 重要说明

- **当前项目定位为个人学习/研究使用。**
- Anatilim 词典的著作权归原作者/出版方；本仓库不分发原始数据，只在本地 `data/raw/anatilim` 保存。
- **公开三端发布或商业使用前**，必须：
  1. 取得 Anatilim 的书面授权；或
  2. 用以下 CC 许可数据 + AI 生成 + 母语审校重建词库：
     - CUTE（COLING 2025）：CC BY 4.0，汉-维-藏-英平行/非平行语料
     - 汉维可比语料（ScienceDB）：CC BY 4.0，5,000+ 篇
     - UyZh-FolkSpeech：CC BY 4.0，1,984 条短句/词条 + 音频
     - Wiktionary / Wikidata：CC BY-SA / CC0（补充）
- 若公开，建议把 `data/raw`、`data/clean`、`app/data/chunks` 加入 `.gitignore`，只在 Release 中提供自建数据。


## 1.5 例句

| 来源 | 规模 | 许可/说明 | 用途 |
|---|---:|---|---|
| 汉南辞典 `02_数据管线/产出/examples.json` | 114,601 条 | 汉南项目自有语料；本项目只复用**汉文侧**，越南语侧未使用 | 汉文例句 |
| DeepSeek `deepseek-chat` | 按需 | 通过环境变量 `DEEPSEEK_API_KEY` 调用；AI 生成，未审校 | 维文翻译 |

- 例句目标 120,000 条（超过汉南 114,000）。
- 维文为 AI 翻译，需母语审校后才能作为“精校例句”发布。
- 若公开，建议在关于页注明“例句汉文侧来自汉南辞典语料，维文为 AI 翻译”。

## 2. 字体

| 字体 | 文件 | 许可 | 说明 |
|---|---|---|---|
| 霞鹜文楷 LXGW WenKai | `app/fonts/wenkai.woff2` | SIL OFL 1.1 | 汉文字体 |
| Noto Naskh Arabic | `app/fonts/naskh-400.woff2` | SIL OFL 1.1 | 老维文正文；Google Fonts 阿拉伯子集 |
| UKIJ 系列 | 未打包 | 条款不清晰 | 仅在系统已安装时作为回退 |

## 3. 代码与规则

- 前端、数据管线、双文字引擎：本项目自建。
- 双文字转换规则参考 ULY/UEY 公开正字法与社区实践；未复制第三方代码。
- 未复制汉南辞典代码；仅复用其设计令牌与发布思路。

## 4. 引用格式（若公开）

```
Han–Uyghur Dictionary (汉维辞典), 2026.
Dictionary data based on Anatilim Uyghur–Chinese Dictionary (used with permission / for research).
Uyghur script conversion implemented per ULY/UEY orthography.
```
