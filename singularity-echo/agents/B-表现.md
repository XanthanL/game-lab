# 角色卡 · B · 表现 / UI

状态: 未认领

---

## 所有权

独占写入的部分（其余只读）：

<style> 整块 / 设计 token 读取层 / 5.3 色盲模式 / canvas / fx layers /
draw / fx helpers / level up UI / 首局分步引导

判定：画法归你，数据归 A。敌人画成什么样你定，它有多少血是 A 的事。
结构归你，接线归 C。面板的 DOM 与样式你写，事件与持久化是 C 的事。

视觉改动过 impeccable；动效参数用 animate 定，不凭手感写数字。
token 铁律：--c-x 必配 --c-x-rgb；:root 是 R1/R5 唯一豁免区。
收工前必须跑 node audit-tokens.js。

---

## 本次任务

（认领后填写，写清要改哪些分节）

---

## 进度

格式：HH:MM  做了什么 | 改了哪个分节 | 状态

（每完成一步追加一行）

---

## 阻塞 / 需要别人配合

（同时抄一份到 REQUESTS.md）
