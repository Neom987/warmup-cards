# 两个游戏 · A Game For Two

一个仓库，两个双人游戏，都在一台手机上玩，都不联网、不上传任何数据。

**入口是根目录的 `index.html`** —— 一张纸和一盏灯，选一个进去。

| | 项目 | 一句话 |
|---|---|---|
| 左 · 纸 | [`heart/`](heart/) **心跳取证** | 抽一张真心话念出来回答；你停得越久，波形抖得越厉害，纸也越烫 |
| 右 · 灯 | [`warmup/`](warmup/) **升温** | 开局定好这一晚的规则，然后一张接一张：翻牌，照做，或者跳过 |

> 18+ · 两个游戏都请在双方都同意、且随时可以说停的前提下使用。

---

## 目录

```
index.html          导航页（Pages 入口）：两个游戏二选一
heart/              心跳取证 · 多文件静态页，无构建
warmup/             升温 · 单文件应用，由 build.py 从 src/ 生成
```

两个项目互不依赖，各自完整：`heart/` 有自己的一套 `tools/` 回归脚本，
`warmup/` 有自己的构建链与校验脚本。搬动任何一个都不影响另一个。

## 打开方式

- **本地**：直接双击 `index.html`。两个游戏都只用了相对路径，`file://` 下能完整运行
- **线上**：`https://neom987.github.io/warmup-cards/`（GitHub Pages，`main` / `(root)`）

## 各自的文档

- 心跳取证：[`heart/README.md`](heart/README.md)（怎么玩、怎么改）· [`heart/PROJECT.md`](heart/PROJECT.md)（为什么长成这样）
- 升温：[`warmup/README.md`](warmup/README.md) · [`warmup/PROJECT.md`](warmup/PROJECT.md)

## 开发

```bash
npm i                                  # 只为了跑回归（jsdom / puppeteer-core）
cd heart && node tools/flow.js         # 心跳取证主流程，40 条断言，不需要浏览器
cd warmup && python build.py           # 升温：src/ → index.html（单文件产物）
cd warmup && python check_cards.py     # 升温卡片校验
```

`node_modules/` 放在仓库根，两个子项目里的脚本都能往上找到，不用各装一份。

## 第三方库

只有 `heart/vendor/` 里的 chroma.js 与 anime.js，已复制入库，本地引入。
导航页本身零依赖、零请求。`warmup/` 的产物也是零依赖单文件。

## 许可

代码 MIT。字体为 SIL Open Font License 1.1，见 [`warmup/OFL.txt`](warmup/OFL.txt)。
