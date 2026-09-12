# 锐角 ACUTE ANGLE 2.0 · 官网（v0.8 skill 重做版）

单页静态官网，无框架、无依赖、无构建。v1 保留于 `../acute-angle/`；本版按 website-style-router **v0.8.0** 重做——
同一条业务信息，换掉了整套视觉身份：**近黑深底 + 淡钴蓝唯一强调色 + Familjen Grotesk / IBM Plex 字体族（自托管）**。

## 本地查看

双击 `index.html`，或：

```
python -m http.server 8124
# 打开 http://localhost:8124
```

## 上线

整个文件夹拖到任意静态托管即可。大陆服务器部署需页脚补 ICP（未预放）。

## 开业前必填（红色虚线 [待填]）

全部在 `index.html`，搜索 `[待填` 逐个替换：创意园园名、详址、营业时间、电话、微信号（`id="wx-id"`，复制按钮复制该格文字）、二维码（把 `.qr-slot` 虚线框换成 `<img>`）、服务项目 ×3 行、预约说明第二条。

## 与 v1 的差异（为什么长得完全不同）

| 维度 | v1 | v2 |
|---|---|---|
| 底色 | 纯白 #FFFFFF | **ink 近黑 #110F09**，深底浅字 |
| 强调色 | 钴蓝 #1F3FD8 | 淡钴蓝 **#87AAF1**（深底自动调亮，8.2:1） |
| 字体 | 系统栈（Inter 首位） | **Familjen Grotesk / IBM Plex Sans / Plex Mono 自托管**（49KB）+ CJK 系统栈 |
| 视觉签名 | 板头状态位 / 台账白底 hover | **label rail 通栏竖线 / kicker 延伸细线 / 深底反白台账 / 底色微差分区 / 数字右对齐** |
| 首选技术栈判定 | （v0.6 无此门） | pick_stack 确定性判定 `plain-html` |

选型与冲突处理详见 `design-system/MASTER.md`（含 G1.6 批次查重记录）。

## 文件结构

```
acute-angle-2.0/
├─ index.html              页面（日常只改这个）
├─ site.css                布局层（含 @font-face）
├─ fonts/                  自托管 woff2 ×3（Latin 子集）
├─ design-system/
│  ├─ tokens.css           全站唯一生效的设计变量（含 --surface/--variant 指纹）
│  └─ MASTER.md            设计系统文档（选型/查重/签名/never）
├─ tech-stack.md           Phase 1.5 技术栈判定
├─ source-map.md           内容溯源
└─ content-profile.md      画像/排除/批次冲突/待补
```
