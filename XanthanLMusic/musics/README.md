# Choir of Static（静电合唱团）

一段 **Blood Cultures 风格**的实验性独立流行（器乐），纯程序化合成，无采样、无 AI 音频模型——每一秒都是用 Python + numpy/scipy 从零合成的波形。

## 成品

| 文件 | 说明 |
|---|---|
| `index.html` + `player.js` | **可视化播放器**（见下文） |
| `choir_of_static.mp3` | 320kbps MP3，直接播放 |
| `choir_of_static.wav` | 44.1kHz / 16-bit 立体声母带 |
| `choir_of_static.py` | 合成脚本（重新渲染：`py choir_of_static.py`） |

时长 1:28（88.3s），BPM 88。

## 🎛 可视化播放器

打开方式（推荐，能获得完整频谱可视化）：

```powershell
py -m http.server 8000
# 浏览器访问 http://localhost:8000
```

直接双击 `index.html` 也可以播放并听到声音，但受浏览器本地文件安全策略限制（Chrome/Edge 会静音 Web Audio 分析的媒体源），频谱可视化会停用，页面顶部会显示说明横幅——此时运行下面的命令即可获得完整效果。

> 如果你双击打开后**没有声音**：这通常是浏览器安全策略导致的旧版行为；已修复为本地文件模式下音频元素直接播放（保证出声，仅频谱不可用）。若仍未出声，请用下方命令经服务器打开，或检查系统/标签页音量。

可视化内容与音乐一一对应：

- **迷幻流动背景**：慢速色相漂移 + 叠加正弦场，对应冷波/迷幻的朦胧底色
- **双磁带盘**：左右旋转的 lo-fi 磁带盘，播放时转动、暂停即停
- **中央频谱环**：Web Audio API 实时分析，72 根环形频谱条 + 内圈时域波形，色相随时间漂移
- **REC 灯 + 段落标签**：播放时红灯呼吸；按歌曲结构实时显示当前段落（Intro → Verse A → Verse B → Chorus I → Bridge → Chorus II → Outro I → Outro II 磁带停止）
- **控制条**：播放/暂停（支持空格键）、进度拖拽、音量

## 风格定位：为什么它像 Blood Cultures

Blood Cultures 的声音内核是「**旋律抓耳，但像从磁带里传来的旧记忆**」。本曲对应手法：

- **冷波质感（Chillwave）**：全局磁带饱和（tanh）、磁带抖动（wobble）、轻度降采样（44.1k→32k→44.1k）、贯穿全曲的磁带底噪。
- **迷幻和声（Psychedelic Pop）**：`Dmaj9 → F#m9 → Bm7 → Gmaj7#11`（I → iii → vi → ♭VII），♭VII 和弦带来异世界感；主旋律在 D 大调内游走，避开传统解决，用半音倾向音制造「熟悉但悬空」的感觉。
- **卧室电子（Bedroom/Indietronica）**：鼓是松弛的 lo-fi 鼓机——kick/snare 整体后移（laid-back）、8 分 hat 带 30% swing、shaker 随机散布；每件乐器都带着自己的微失谐与瑕疵。
- **疏离的内核**：
  - 主旋律（saw+square 合成器）经过 **0.375s 反馈式磁带回声**，像在空房间里回响；
  - **formant 滤波的合成吟唱**（ohh/ahh/uu 元音轮换）模拟「被磁带蒙住的远方人声」；
  - **电话滤波（300–3400Hz）的远方旋律**，intro/bridge 里像隔壁房间传来的电台；
  - 反向垫（reverse pad）、FM 铃、结尾 3 秒 **tape stop**（磁带停止，音调坠落）。

## 结构（32 小节，每小节 ≈2.73s）

| 段落 | 小节 | 内容 |
|---|---|---|
| Intro | 1–4 | 反向垫 + 磁带底噪 + 电话远方旋律 + FM 铃 |
| Verse A | 5–8 | 鼓进入，主题 A 主旋律 |
| Verse B | 9–12 | 加 shaker，主题 B（更装饰），暗色吟唱 |
| Chorus 1 | 13–16 | 更亮的和声、更密鼓、副歌旋律 + 亮色吟唱 |
| Bridge | 17–20 | 抽离：只剩 kick + 暗垫 + 雾中长吟 + 电话 |
| Chorus 2 | 21–24 | 最满：副歌 + 低八度厚化层 + 吟唱 + 铃 |
| Outro 1 | 25–28 | 元素逐个退场 |
| Outro 2 | 29–32 | 反向垫 + 铃 → **tape stop** 收尾 |

## 音色清单（全部合成器合成）

- **Pad**：3 层失谐 saw（±4–5 cents）+ 低通 + 慢 tremolo，模拟磁带合唱
- **Lead**：失谐 saw×2 + square，低通 3200Hz，0.375s 磁带回声
- **Bass**：正弦 + 二次谐波 + 饱和 + 低通 420Hz
- **Kick / Snare / Hat / Shaker**：音高下滑正弦、带通噪声、高通噪声，均做饱和与 laid-back 处理
- **吟唱**：saw 源 → 两级 formant 带通（元音 a/e/i/o/u）
- **电话人声**：saw+square → 300–3400Hz 带通 + 饱和
- **FM 铃**：carrier/modulator 3.4:1，指数衰减，微失谐对

## 混音母带链

1. 各轨等功率声像混合（`MIX_SCALE=0.32` 控制峰值）
2. 磁带饱和 `tanh`
3. 空气感（并行 5kHz 高通，让 hat/铃 shimmer）
4. 磁带抖动（wobble）
5. 轻度降采样 lo-fi 质感
6. 结尾 3.2s tape stop + 淡入淡出
7. 峰值归一化 0.92 + dither → 16-bit

## 重新渲染 / 调参

```powershell
py choir_of_static.py     # 输出 choir_of_static.wav
ffmpeg -i choir_of_static.wav -codec:a libmp3lame -b:a 320k choir_of_static.mp3
```

常用调整点（脚本顶部与各 `do_*` 函数）：
- `BPM`（88）、`TOTAL_BARS`（32）
- `CHORDS` / `CHORD_FREQS`：换和弦进行
- `THEME_A / THEME_B / CHORUS`：换旋律（`(起始拍, 时值拍, MIDI音高)`）
- `CHANT_*`：换吟唱线与元音
- `SWING` / `LAID_BACK`：改鼓的松弛度
- `MIX_SCALE`、各 `do_*` 的 gain：改混音平衡
