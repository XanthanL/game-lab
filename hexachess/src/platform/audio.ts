// 程序化音效引擎：用 Web Audio 实时合成所有音效，无需任何外部音频文件，
// 完全契合「主包 ≤4MB / 资源矢量直绘」约束。浏览器与微信小游戏共用同一套合成逻辑，
// 平台层只负责提供一个 AudioContext（浏览器 new AudioContext，微信用 wx.createWebAudioContext）。
import { AudioEngine, SfxName } from './types';

// 标准 Web Audio 接口，微信小游戏的 WebAudioContext 子集与之兼容
type AnyCtx = any;

function createAudioEngine(getCtx: () => AnyCtx): AudioEngine {
  let muted = false;

  // 取音频上下文并在 suspended 时尝试恢复（移动端自动播放策略要求用户手势后）
  function ctx(): AnyCtx {
    const c = getCtx();
    if (!c) return null;
    if (c.state === 'suspended') {
      try {
        c.resume();
      } catch {
        /* ignore */
      }
    }
    return c;
  }

  // 单个带包络的音：指数 attack + 指数 decay，避免爆音
  function tone(opts: {
    freq: number;
    start: number;
    dur: number;
    type?: OscillatorType;
    peak?: number;
    slideTo?: number;
  }): void {
    const c = ctx();
    if (!c || muted) return;
    const t0 = c.currentTime + opts.start;
    const osc = c.createOscillator();
    const g = c.createGain();
    const peak = opts.peak ?? 0.18;
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.slideTo), t0 + opts.dur);
    }
    // 极短 attack 防爆音，exponential decay 到接近 0（不能为 0）
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + opts.dur + 0.03);
  }

  // 琶音：一串频率依次触发，营造「上行 / 和弦」感
  function arp(freqs: number[], start: number, step: number, dur: number, type: OscillatorType = 'triangle', peak = 0.16): void {
    freqs.forEach((f, i) => tone({ freq: f, start: start + i * step, dur, type, peak }));
  }

  const map: Record<SfxName, (step?: number) => void> = {
    // 抓取：短促低音，给出「拿起」反馈
    pick: () => tone({ freq: 330, start: 0, dur: 0.07, type: 'sine', peak: 0.15 }),
    // 放入将营：清脆小三度回落，给出「对上了」的满足感
    place: () => tone({ freq: 523, start: 0, dur: 0.13, type: 'sine', peak: 0.2, slideTo: 392 }),
    // 暂存：比 place 略闷，区分两种落点
    stack: () => tone({ freq: 392, start: 0, dur: 0.1, type: 'triangle', peak: 0.14 }),
    // 消除：明快上行琶音（C5-E5-G5）
    clear: () => arp([523, 659, 784], 0, 0.07, 0.14, 'triangle', 0.18),
    // 将杀：明亮大和弦 + 低频铺底（胜利感）
    checkmate: () => {
      arp([523, 659, 784, 1046], 0, 0.06, 0.5, 'triangle', 0.16);
      tone({ freq: 130, start: 0, dur: 0.55, type: 'sine', peak: 0.12 });
    },
    // 弹回：下行方波，轻微「不对」提示（不刺耳）
    bounce: () => tone({ freq: 300, start: 0, dur: 0.1, type: 'square', peak: 0.07, slideTo: 170 }),
    // 按钮：极短轻点
    click: () => tone({ freq: 200, start: 0, dur: 0.04, type: 'sine', peak: 0.12 }),
    // 通关：两声铃声（E5 + B5）
    win: () => {
      tone({ freq: 659, start: 0, dur: 0.18, type: 'sine', peak: 0.18 });
      tone({ freq: 988, start: 0.13, dur: 0.32, type: 'sine', peak: 0.16 });
    },
  // 提示：双音 ping
  hint: () => {
    tone({ freq: 880, start: 0, dur: 0.08, type: 'sine', peak: 0.14 });
    tone({ freq: 1100, start: 0.08, dur: 0.1, type: 'sine', peak: 0.12 });
  },
  // 合并：每颗棋子落叠的木质"咔哒"声。短促方波 + 快速下滑，像棋子磕在栈上；
  // step 越高音越亮，制造"一块一块往上摞"的节奏升调。
  merge: (step = 0) => {
    const base = 300 + Math.min(18, step) * 26; // 随层数升调，封顶避免刺耳
    tone({ freq: base, start: 0, dur: 0.05, type: 'square', peak: 0.12, slideTo: base * 0.7 });
    tone({ freq: base * 2.0, start: 0, dur: 0.03, type: 'sine', peak: 0.06 });
  },
  // 倒计时滴答：短促高频轻点（限时关最后 5s）
  tick: () => tone({ freq: 1250, start: 0, dur: 0.045, type: 'square', peak: 0.07 }),
  // 判负：低频三连下行，明确「这局堵死了」但不刺耳
  fail: () => {
    tone({ freq: 220, start: 0, dur: 0.16, type: 'sine', peak: 0.16, slideTo: 165 });
    tone({ freq: 165, start: 0.15, dur: 0.22, type: 'sine', peak: 0.13, slideTo: 110 });
  },
};

  return {
    resume() {
      const c = getCtx();
      if (c && c.state === 'suspended') {
        try {
          c.resume();
        } catch {
          /* ignore */
        }
      }
    },
    setMuted(m: boolean) {
      muted = m;
    },
    play(name: SfxName, opts?: { step?: number }) {
      try {
        map[name](opts?.step ?? 0);
      } catch {
        /* 音频失败不应影响游戏 */
      }
    },
  };
}

// 空引擎：无音频平台时游戏静音运行（保证逻辑与单测不受音频影响）
export function createNoopAudio(): AudioEngine {
  return { resume() {}, setMuted() {}, play() {} };
}

export { createAudioEngine };
