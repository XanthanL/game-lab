# Nova Drift · 背景音乐 (BGM)

> **风格基准**：Le Metroid《Black Hole》式 chillsynth / space lofi —— 空灵暖 analog pad + 稀疏 lo-fi 鼓点 + 长混响，全 instrumental。
> **命名规范**：每首统一用 `「中文 / English」` 带括号 + 中英文格式。
> **文件名约定**：磁盘文件名中的 `___` 代表 ` / `（因为 `/` 在文件名里非法），例如 `「凝醒___Cryo_Wake」.mp3` = 「凝醒 / Cryo Wake」。
> **总大小**：9 个文件 ≈ 50 MB，不要一次性全载，见 §3 加载优化。

---

## 1. 文件清单

| # | 场景 | 曲名 | 文件名 | 分轨 | BPM | 大小 | 状态 |
|---|------|------|--------|------|-----|------|------|
| 1 | 主菜单 / 标题 | 「凝醒 / Cryo Wake」 | `「凝醒___Cryo_Wake」.mp3` | 单 | 82 | 4.2M | ✅ |
| 2 | 巡航 / 早期波次 | 「彗尾 / Comet Trail」 | `「彗尾___Comet_Trail」1.mp3` · `2.mp3` | **双** | 88 | 4.1M / 5.3M | ✅ |
| 3 | 战斗中段 | 「陨雨 / Asteroid Rain」 | `「陨雨___Asteroid_Rain」.mp3` | 单 | 96 | 5.0M | ✅ |
| 4 | 巨像降临（每 5 波 Boss） | 「星之巨像 / Colossus」 | `「星之巨像___Colossus」.mp3` | 单 | 80 | 4.4M | ✅ |
| 5 | 模块 LV6 镀金质变 | 「镀金裂变 / Goldbreak」 | `「镀金裂变___Goldbreak」.mp3` | 单 | 90 | 6.2M | ✅ |
| 6 | 第 15 波肃清后无尽漂移 | 「无尽漂移 / Endless Drift」 | `「无尽漂移___Endless_Drift」1.mp3` · `2.mp3` | **双** | 86 | 5.4M / 5.6M | ✅ |
| 7 | 结算 / 陨落 | 「余晖 / Afterglow」 | `「余晖___Afterglow」.mp3` | 单 | 76 | 5.5M | ✅ |

---

## 2. 播放逻辑

**阶段 ↔ 曲组映射**：每个游戏阶段绑定一个曲组（曲组 = 该曲名下所有分轨文件的集合）。

- **单轨曲组**（#1 凝醒、#3 陨雨、#4 星之巨像、#5 镀金裂变、#7 余晖）：该阶段内 `loop = true`，单曲循环到离开此阶段。
- **双轨曲组**（#2 彗尾、#6 无尽漂移）：
  1. 玩家**进入该阶段时随机加载 1 首**（part1 / part2 等概率起手）；
  2. 当前曲 `ended`（放完）后**自动切换到另一首**，如此往复（随机起手 + 严格交替轮动）；
  3. 两首交替时不留空档（见 §3 交叉淡入）。
- **阶段切换**（如 巡航 → 战斗 → Boss → 无尽）：切换曲组，并以 ~1.2–1.5s 交叉淡入过渡，避免突兀断点。

---

## 3. 加载优化（实现要点）

1. **按需加载，不一次性全载**：9 文件 ≈ 50MB，只解码当前阶段所需曲组；离开阶段即停止并释放。
2. **预载下一轮换曲**：双轨曲组当前曲开始播放后，后台**低优先级** `fetch` 另一首并解码缓存，使切换无缝。
3. **解码一次、缓存复用**：`AudioBuffer` 解码后存入 `Map<url, AudioBuffer>`，跨阶段复用，不重复解码；设上限（如 4 个）+ LRU 回收最久未用，控制内存。
4. **单首循环用 `<audio loop>` 流式播放**更省内存（边下边播）；需要交叉淡入/轮换时用 **Web Audio API**（`AudioBufferSourceNode` + `GainNode` 渐变）。二者按场景取舍。
5. **自动播放策略**：浏览器禁止无手势自动播放。首次用户手势（开始按钮 / 首次点击 / 触摸）后调用 `audioCtx.resume()` 解锁；`visibilitychange` 隐藏时 `suspend()`、可见时 `resume()`，省流量。
6. **交叉淡入避免空档**：切换曲目时旧曲 gain 渐出 + 新曲 gain 渐入（1–1.5s 重叠），不出现静音间隙。
7. **移动端省流**：用 `navigator.connection`（如 `saveData` / `effectiveType='2g'`）判断，省流模式下只预载当前曲、不预载下一首。
8. **文件侧再压**（可选）：当前 mp3 已 4–6MB，可后续 `ffmpeg -b:a 128k` 或转 Opus/WebM 进一步瘦身；`<audio preload>` 仅对当前曲设 `auto`。

### 实现草图（JS · Web Audio 版）

```js
// BGMManager —— 阶段曲组 + 随机起手/交替轮动 + 交叉淡入 + 懒加载
class BGMManager {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.groups = {
      menu:   { urls: ['bgms/「凝醒___Cryo_Wake」.mp3'], loop: true },
      cruise: { urls: ['bgms/「彗尾___Comet_Trail」1.mp3','bgms/「彗尾___Comet_Trail」2.mp3'], loop: false },
      combat: { urls: ['bgms/「陨雨___Asteroid_Rain」.mp3'], loop: true },
      boss:   { urls: ['bgms/「星之巨像___Colossus」.mp3'], loop: true },
      evolve: { urls: ['bgms/「镀金裂变___Goldbreak」.mp3'], loop: true },
      endless:{ urls: ['bgms/「无尽漂移___Endless_Drift」1.mp3','bgms/「无尽漂移___Endless_Drift」2.mp3'], loop: false },
      end:    { urls: ['bgms/「余晖___Afterglow」.mp3'], loop: true },
    };
    this.bufCache = new Map();   // url -> AudioBuffer（解码一次复用）
    this.cur = null; this.curGain = null;
    this.rotIdx = 0;
  }

  unlock() { if (this.ctx.state === 'suspended') this.ctx.resume(); }   // 首次手势调用

  async _decode(url) {
    if (this.bufCache.has(url)) return this.bufCache.get(url);
    const res = await fetch(url, { priority: 'low' });   // 低优先级预载
    const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
    if (this.bufCache.size >= 4) this.bufCache.delete(this.bufCache.keys().next().value); // LRU
    return this.bufCache.set(url, buf).get(url);
  }

  async _voice(url, fade = 1.2, gain = 1) {
    const buf = await this._decode(url);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = 0;
    src.connect(g).connect(this.ctx.destination);
    g.gain.linearRampToValueAtTime(gain, this.ctx.currentTime + fade);  // 淡入
    src.start();
    return { src, g };
  }

  async play(groupId) {
    const grp = this.groups[groupId];
    if (this.curGain) {                       // 先淡出旧曲
      const t = this.ctx.currentTime;
      this.curGain.gain.cancelScheduledValues(t);
      this.curGain.gain.linearRampToValueAtTime(0, t + 1.2);
      this.cur?.stop?.(t + 1.3);
    }
    if (grp.loop) {
      const { src, g } = await this._voice(grp.urls[0]);
      src.loop = true; this.cur = src; this.curGain = g;
    } else {
      this.rotIdx = Math.random() < 0.5 ? 0 : 1;   // 随机起手
      const step = async () => {
        const { src, g } = await this._voice(grp.urls[this.rotIdx]);
        this.cur = src; this.curGain = g;
        src.onended = () => {                       // 放完 → 切换另一首，往复
          this.rotIdx = (this.rotIdx + 1) % grp.urls.length;
          step();
        };
        this._decode(grp.urls[this.rotIdx]);        // 后台预载下一轮
      };
      step();
    }
  }

  switchTo(groupId) { this.play(groupId); }          // 阶段切换（自带交叉淡入）
  onVisibility(hidden) { hidden ? this.ctx.suspend() : this.ctx.resume(); }  // 省流量
}
```

---

## 4. 分曲参考（Suno 提示词，留档）

### 1. 「凝醒 / Cryo Wake」 · 82 BPM — 主菜单
- Style：`chillsynth, space ambient, ethereal warm analog pads, sparse lo-fi beats, reverb-drenched synth arpeggio, dreamy cosmic, weightless, 82 BPM, instrumental`
- Lyrics：`[Slow Intro] [Ambient Pad Swell] [Verse Instrumental] [Chorus Instrumental] [Bridge] [Outro Fade]`

### 2. 「彗尾 / Comet Trail」 · 88 BPM — 巡航（双轨 1/2）
- Style：`chillsynth, space lofi, gentle drifting analog pads, soft hi-hat pulse, twinkling synth arpeggio, warm and airy, mid-tempo, 88 BPM, instrumental`
- Lyrics：`[Intro] [Verse Instrumental] [Build] [Chorus Instrumental] [Verse] [Outro]`

### 3. 「陨雨 / Asteroid Rain」 · 96 BPM — 战斗
- Style：`chillsynth with drive, space synthwave, pulsing bassline, building tension, warm analog pads, sparse beats, still atmospheric and ethereal, 96 BPM, instrumental`
- Lyrics：`[Intro] [Verse Instrumental] [Pre-Chorus Build] [Chorus Instrumental] [Drop] [Bridge] [Outro]`

### 4. 「星之巨像 / Colossus」 · 80 BPM — Boss
- Style：`cinematic space synth, ominous low drone, swelling ominous pads, tense arpeggio, epic but ethereal, slow build, ominous, 80 BPM, instrumental`
- Lyrics：`[Low Drone Intro] [Rising Tension] [Main Theme Instrumental] [Climax] [Resolve] [Outro]`

### 5. 「镀金裂变 / Goldbreak」 · 90 BPM — 质变
- Style：`chillsynth, shimmering bright analog synth, uplifting arpeggio, sparkling bells, warm glow, hopeful cosmic, mid-tempo, 90 BPM, instrumental`
- Lyrics：`[Sparkle Intro] [Verse Instrumental] [Shimmer Build] [Chorus Instrumental Bright] [Outro]`

### 6. 「无尽漂移 / Endless Drift」 · 86 BPM — 无尽（双轨 1/2）
- Style：`chillsynth, weightless ambient space, vast reverb pads, slow comet-tail synth, serene and infinite, dreamy, 86 BPM, instrumental`
- Lyrics：`[Vast Intro] [Ambient Instrumental] [Drift Verse] [Chorus Instrumental] [Endless Loop Outro]`

### 7. 「余晖 / Afterglow」 · 76 BPM — 结算
- Style：`chillsynth, melancholic but warm space ambient, soft piano, fading analog pads, gentle, reflective, bittersweet, 76 BPM, instrumental`
- Lyrics：`[Soft Piano Intro] [Verse Instrumental] [Reflection] [Chorus Instrumental] [Fade Out]`
