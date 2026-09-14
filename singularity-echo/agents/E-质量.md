# 角色卡 · E · 质量 / 度量

状态: 未认领

---

## 所有权

你不写 ../index.html —— 你只写探针与测试，不改实现。
发现的问题写进报告，交给对应的负责人去改。这样你能和所有人完全并行、零冲突。

你的产出：
- ../test/probe-*.js（新探针）
- 维护并扩充 ../test/phase*-check.js（已有 50 个）
- 报告写进 ../DEV-PLAN.md 或直接在会话里回复
- agents/BASELINE.md 只有你能改

方法：先量后改，而且你只量不改。探针必须输出可复现的数字，不能只打印状态。
参考 ../test/probe-bgm-mem.js（量出 BGM 峰值 335 MB）。

已验证的坑：
- 测音频必须起 http 服务（file:// 下 fetch 被 CORS 挡、静默失败）
- 页面全局拿不到 BGM / G / P 这些脚本内的 const，要借 NOVA.debug(code) 在作用域内 eval
- headless 截 WebGL 要 --use-angle=swiftshader 且不能带 --disable-gpu，否则纯黑

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
