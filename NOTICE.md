# 数据来源与授权说明 / Data Sources and Licensing

本仓库包含两类内容，授权状态不同。

## 1. 源代码

`app/`、`desktop/`、`mobile/`、`tools/` 下的程序以 **MIT** 发布，见 [LICENSE](LICENSE)。

## 2. 词典数据（`app/data/`）

| 数据 | 来源 | 状态 |
|---|---|---|
| 汉维词库（328,900 词头 / 532,192 义项） | [Anatilim 汉维双向词典](https://github.com/xhacker/chinese-uyghur)，原仓库 `xhacker/chinese-uyghur` | 原仓库未附明确的开源许可证。本项目按“个人学习 / 研究”定位使用，**未主张任何权利**。 |
| 维汉词库（371,784 词头） | 由上述汉维数据反演生成 | 同上 |
| 例句汉文侧（114,385 条） | 汉南辞典项目语料 `examples.json` | 本项目自有语料，仅复用汉文侧 |
| 例句维文侧 | AI 批量翻译（Index-Translate 公共网关） | 生成内容，未经母语审校 |

## 3. 使用边界

- 个人学习、研究、离线查词：可以直接使用。
- 公开分发、商业使用、二次训练：**请先取得原始数据权利人的许可**，或替换为明确授权的语料。
- 若您是权利人，认为本仓库的使用超出许可范围，请开 issue 说明，我们会在确认后移除相关数据，或改为按授权重建。

## 4. 字体

| 字体 | 文件 | 许可 |
|---|---|---|
| 霞鹜文楷 LXGW WenKai | `app/fonts/wenkai.woff2` | SIL OFL 1.1 |
| Noto Naskh Arabic（阿拉伯字符子集） | `app/fonts/naskh-400.woff2` | SIL OFL 1.1 |

UKIJ 系列字体授权条款不清晰，本项目不随包分发，仅在系统已安装时作为回退。

---

# Data Sources and Licensing (English)

- **Code** under `app/`, `desktop/`, `mobile/`, `tools/` is MIT licensed.
- **Dictionary data** under `app/data/` comes from the Anatilim Chinese–Uyghur dictionary (`xhacker/chinese-uyghur`), which ships **no explicit open-source licence**. It is used here for personal study and research; no rights are claimed. The Uyghur→Hanwen side is derived from the same data.
- **Example sentences**: the Hanwen side reuses our own Hannan dictionary corpus (114,385 sentences); the Uyghur side is AI-translated and not yet natively reviewed.
- For redistribution, commercial use or model training, obtain permission from the original rights holder, or replace the data with clearly licensed corpora.
- If you are a rights holder and believe this use exceeds your licence, please open an issue and we will remove the data or rebuild it under a proper licence.
