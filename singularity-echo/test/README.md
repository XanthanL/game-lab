# 奇点回响 · 回归脚本

`phase*.js` 是各阶段收尾时写的断言脚本，一个脚本对应一个 Phase，
跑完会打印每条断言的 PASS / FAIL，退出码非 0 表示有失败。

它们原本散在 `.workbuddy/shots/` 里 —— 那个目录被 `.gitignore` 排除，
等于没进版本控制。2026-09-14 搬到这里，并去掉了机器相关的绝对路径。

## 跑之前

需要 `playwright-core` 和一份 Chromium。脚本不写死浏览器路径，
由 `_browser.js` 按 `CHROME_EXE` 环境变量 → playwright registry →
ms-playwright 缓存目录（取装了的、版本号最大的）这个顺序找。

## 怎么跑

PowerShell：

```powershell
cd E:\Code\game-lab\singularity-echo\test
$env:NODE_PATH = "<装了 playwright-core 的 node_modules>"
node phase7-6c-check.js
```

Bash：

```bash
cd /e/Code/game-lab/singularity-echo/test
NODE_PATH="<装了 playwright-core 的 node_modules>" node phase7-6c-check.js
```

浏览器不在默认位置时：

```powershell
$env:CHROME_EXE = "C:\...\chrome-headless-shell.exe"
```

## 几条约定

- **断言必须自带 ok 字段**，只打印不算验证。脚本末尾的 `N PASS / M FAIL` 才是结论。
- `phase*-shots.js` 只出图不断言，用来目视核对；`phase*-check.js` 才是断言。
- 截图落在脚本旁边的 `phaseN/` 目录里，已被 `.gitignore` 排除，不会进仓库。
- 游戏路径是相对算出来的（`../index.html`），仓库搬到哪儿都能跑。
