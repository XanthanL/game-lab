# 角色卡 · C · 系统 / 平台

状态: 未认领

---

## 所有权

独占写入的分节（其余只读）：

utils / RNG / dom / audio / BGM manager / input / 手机端手牌模式（deck）/
5.3 设置项 / 致命错误屏显诊断 / i18n / flow / boot

判定：接线归你，结构归 B。面板长什么样是 B 的事，事件与持久化你写。

两条已知红线：
- BGM 现在是 fetch + decodeAudioData 整曲解码，LRU 4 首 = 峰值 335 MB 常驻
  （实测，见 ../test/probe-bgm-mem.js）。任何 BGM 改动先跑这个探针量一遍。
- BGM 走 fetch，file:// 下被 CORS 挡、静默失败，测音频必须起 http 服务。

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
