# -*- coding: utf-8 -*-
"""
Choir of Static — 一段 Blood Cultures 风格的实验性独立流行（器乐）

风格定位：Experimental Indie Pop / Psychedelic Pop / Chillwave / Bedroom Pop。
声音设计要点：
  * 暖而失谐的合成器垫（saw 多层 detune + 低通 + tremolo）
  * 磁带质感：tanh 饱和、wobble（磁带抖动）、轻度降采样
  * 松弛的 lo-fi 鼓：laid-back kick/snare、swing 的 8 分 hat
  * 抓耳但疏离的主旋律：saw+square 主奏 + 反馈 tape echo
  * formant 滤波的合成"吟唱"（ohh/ahh，模拟被磁带蒙住的远方人声）
  * 电话滤波（300–3400Hz）的远方旋律
  * 反向垫（reverse pad）、FM 铃、磁带底噪
  * 结尾 tape stop（磁带停止，音调坠落）

和声：D 大调，I → iii → vi → ♭VII   (Dmaj9 → F#m9 → Bm7 → Gmaj7#11)
BPM 88，共 32 小节（约 1:27）。

用法：py choir_of_static.py        （输出 choir_of_static.wav）
依赖：numpy, scipy
"""
import numpy as np
from scipy.signal import butter, lfilter, resample_poly, fftconvolve
from scipy.io import wavfile

SR = 44100
BPM = 88
SPB = SR * 60.0 / BPM          # 每拍采样数
TOTAL_BARS = 32
RNG = np.random.default_rng(42)

# ---------------------------------------------------------------- 基础工具

NOTE = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6,
        "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}


def nf(name):                                   # "D3" -> 频率 Hz
    letter, octv = name[:-1], int(name[-1])
    midi = 12 * (octv + 1) + NOTE[letter]
    return 440.0 * 2 ** ((midi - 69) / 12.0)


def mf(m):                                      # MIDI 音高 -> Hz
    return 440.0 * 2 ** ((m - 69) / 12.0)


def place(buf, sig, at):
    """把 sig 叠加到 buf 的 at 采样处（自动截断越界）"""
    at = int(at)
    if at >= len(buf) or at + len(sig) <= 0:
        return
    lo = max(at, 0)
    hi = min(at + len(sig), len(buf))
    buf[lo:hi] += sig[lo - at: hi - at]


def env_adsr(n, a, d, s, r):
    """ADSR 包络（时间单位：秒）。返回长度恒等于 n。"""
    e = np.zeros(n)
    i = 0
    na = min(int(a * SR), n)
    if na > 0:
        e[:na] = np.linspace(0, 1, na)
        i = na
    nd = min(int(d * SR), n - i)
    if nd > 0:
        e[i:i + nd] = np.linspace(1, s, nd)
        i += nd
    nr = min(int(r * SR), n - i)
    sust = n - i - nr
    if sust > 0:
        e[i:i + sust] = s
        i += sust
    if nr > 0:
        e[i:i + nr] = np.linspace(s, 0, nr)
    return e


def env_exp(n, tau):
    """指数衰减包络。"""
    return np.exp(-np.arange(n) / (tau * SR))


def sine(f, n, detune=0.0, phase=0.0):
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * f * (1 + detune) * t + phase).astype(np.float32)


def saw(f, n, detune=0.0, phase=0.0):
    t = np.arange(n) / SR
    ph = (f * (1 + detune) * t + phase / (2 * np.pi)) % 1.0
    return (2.0 * ph - 1.0).astype(np.float32)


def square(f, n, detune=0.0, phase=0.0):
    return np.sign(saw(f, n, detune, phase)).astype(np.float32)


def tri(f, n, detune=0.0, phase=0.0):
    t = np.arange(n) / SR
    ph = (f * (1 + detune) * t + phase / (2 * np.pi)) % 1.0
    return (4.0 * np.abs(ph - 0.5) - 1.0).astype(np.float32)


def noise(n):
    return RNG.standard_normal(n).astype(np.float32)


def butter_lp(x, cutoff, order=2):
    b, a = butter(order, cutoff / (SR / 2), "low")
    return lfilter(b, a, x)


def butter_hp(x, cutoff, order=2):
    b, a = butter(order, cutoff / (SR / 2), "high")
    return lfilter(b, a, x)


def butter_bp(x, lo, hi, order=2):
    b, a = butter(order, [lo / (SR / 2), hi / (SR / 2)], "band")
    return lfilter(b, a, x)


def soft_clip(x, drive=1.0):
    return np.tanh(drive * x)


def normalize(x, peak=0.95):
    m = np.max(np.abs(x))
    return x * (peak / m) if m > 0 else x


def fade_in(x, sec=0.01):
    n = min(int(sec * SR), len(x))
    x[:n] *= np.linspace(0, 1, n)
    return x


def fade_out(x, sec=0.05):
    n = min(int(sec * SR), len(x))
    x[-n:] *= np.linspace(1, 0, n)
    return x


def tape_wobble(x, rate=0.45, depth=7.0):
    """模拟磁带抖动：对整段信号做缓慢的时间/音高摆动。"""
    n = len(x)
    t = np.arange(n) / SR
    src = np.arange(n, dtype=np.float64) - depth * np.sin(2 * np.pi * rate * t)
    src = np.clip(src, 0, n - 1)
    i0 = np.floor(src).astype(np.int64)
    i1 = np.minimum(i0 + 1, n - 1)
    fr = (src - i0).astype(np.float32)
    return (x[i0] * (1 - fr) + x[i1] * fr).astype(np.float32)


def tape_delay(x, D_sec=0.375, g=0.42, taps=16, lp=2600.0):
    """反馈式磁带回声（comb 卷积实现），带低通。"""
    D = int(D_sec * SR)
    h = np.zeros(D * taps + 1)
    h[0] = 1.0
    for k in range(1, taps + 1):
        h[k * D] = g ** k
    y = fftconvolve(x, h)
    return butter_lp(y, lp, 1)


def reverb(x, mix=0.28, size=1.0):
    """简易 Schroeder 风格混响：多 comb 卷积。"""
    delays = [37.0, 53.0, 71.0, 89.0, 107.0, 131.0]
    out = np.zeros(len(x))
    for d in delays:
        D = int(d * size * SR / 1000)
        taps = max(2, int(1.3 * SR / D))
        h = np.zeros(D * taps + 1)
        h[0] = 1.0
        fb = 0.62
        for k in range(1, taps + 1):
            h[k * D] = fb ** k
        out += fftconvolve(x, h)[:len(x)]
    out /= len(delays)
    return x + mix * out


def pan(mono, p):
    """等功率声像。p ∈ [-1, 1]。"""
    a = (p + 1) * np.pi / 4
    return mono * np.cos(a), mono * np.sin(a)


def note_synth(osc, f, n, detune, phase, lp=None, env=None):
    s = osc(f, n, detune, phase)
    if lp is not None:
        s = butter_lp(s, lp, 2)
    if env is not None:
        s = s * env[:len(s)]
    return s.astype(np.float32)


# ---------------------------------------------------------------- 音色合成

def synth_pad(freqs, n, brightness=700.0, tremolo=True):
    """暖而失谐的合唱垫：3 层 saw。"""
    out = np.zeros(n, dtype=np.float32)
    for f in freqs:
        out += 0.5 * saw(f, n, -0.004, 0.0)
        out += 0.7 * saw(f, n, 0.0, 1.7)
        out += 0.5 * saw(f, n, +0.005, 3.1)
    out /= 1.7
    out = butter_lp(out, brightness, 2)
    if tremolo:
        t = np.arange(n) / SR
        out *= (1.0 + 0.10 * np.sin(2 * np.pi * 0.13 * t)) / 1.0
    return out.astype(np.float32)


def synth_bass(f, n):
    """lo-fi 低音：正弦 + 饱和 + 微失谐层。"""
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 2 * t)
    s = soft_clip(s * 1.6, 2.0)
    s = butter_lp(s, 420, 1)
    return s.astype(np.float32)


def synth_kick(n=0.30):
    """软而蓬松的 lo-fi kick：正弦音高下滑 + 饱和。"""
    N = int(n * SR)
    t = np.arange(N) / SR
    freq = 45.0 + 85.0 * np.exp(-t / 0.022)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    s = np.sin(phase)
    s = soft_clip(s * 2.2, 1.8)
    s *= env_exp(N, 0.12)
    return s.astype(np.float32)


def synth_snare():
    """laid-back 的 lo-fi snare：噪声带通 + 三角波身。"""
    N = int(0.24 * SR)
    nz = noise(N) * env_exp(N, 0.045)
    nz = butter_bp(nz, 1100, 4200, 2)
    body = tri(192, N) * env_exp(N, 0.045) * 0.6
    s = nz + body
    s = soft_clip(s * 2.0, 1.4)
    return s.astype(np.float32)


def synth_hat(open_=False, n=None):
    """闭/开 hat：短噪音，高通。"""
    N = int((0.32 if open_ else 0.06) * SR) if n is None else int(n * SR)
    nz = noise(N)
    nz = butter_hp(nz, 7000, 2)
    nz *= env_exp(N, 0.05 if open_ else 0.018)
    return (nz * 0.5).astype(np.float32)


def synth_shaker():
    N = int(0.035 * SR)
    nz = noise(N)
    nz = butter_bp(nz, 6500, 12500, 2)
    nz *= env_exp(N, 0.012)
    return (nz * 0.45).astype(np.float32)


# formant 参数（元音）: (F1, F2, 带宽)
VOWELS = {
    "a": (760, 1250),
    "e": (500, 1850),
    "i": (300, 2300),
    "o": (430, 900),
    "u": (320, 720),
}


def synth_chant(f, n, vowel="a"):
    """formant 滤波的合成吟唱：saw 源 → 两级 bandpass → 微饱和。"""
    s = saw(f, n, 0.0, 0.0) + 0.4 * saw(f * 2.0, n, 0.0, 1.0)
    s = butter_lp(s, 3500, 2)
    f1, f2 = VOWELS[vowel]
    s = butter_bp(s, f1 - 90, f1 + 90, 2)
    s = butter_bp(s, f2 - 140, f2 + 140, 2)
    s = soft_clip(s * 1.4, 1.2)
    s = butter_lp(s, 4200, 2)
    return s.astype(np.float32)


def synth_telephone(f, n):
    """电话滤波的远方旋律：bandpass 300–3400 + 饱和。"""
    s = saw(f, n, 0.0, 0.0) + 0.5 * square(f, n, 0.0, 1.0)
    s = butter_bp(s, 320, 3350, 2)
    s = soft_clip(s * 2.0, 1.6)
    return s.astype(np.float32)


def synth_bell(f, n=2.6):
    """FM 铃：carrier 与 modulator，指数衰减 + 微失谐对。"""
    N = int(n * SR)
    t = np.arange(N) / SR
    out = np.zeros(N)
    for det in (-0.0025, 0.0025):
        fc = f * (1 + det)
        fm = fc * 3.4
        idx = 2.4 * np.exp(-t / 0.5)
        s = np.sin(2 * np.pi * fc * t + idx * np.sin(2 * np.pi * fm * t))
        out += s * 0.5
    out *= env_exp(N, 0.9)
    out = butter_lp(out, 9000, 2)
    return out.astype(np.float32)


def synth_reverse_pad(freqs, n):
    """反向垫：琶音 + 长音，整体反转，低通。"""
    bar_beats = 4.0
    beat = 0.0
    seg = np.zeros(n, dtype=np.float32)
    i = 0
    for f in freqs:
        dur = 0.75 * SPB
        at = int(beat * SPB)
        s = synth_pad([f], int(dur) + 1, brightness=900.0, tremolo=False)
        s *= env_adsr(len(s), 0.05, 0.1, 0.8, 0.15)
        place(seg, s, at)
        beat += 0.75
    # 长音铺底
    long = synth_pad(freqs[0:1] + freqs[2:3], n, brightness=700.0, tremolo=False)
    long *= env_adsr(len(long), 2.0, 0.3, 0.35, 1.0)
    seg += 0.5 * long
    seg = butter_lp(seg, 1400, 2)
    return seg[::-1].copy().astype(np.float32)


def tape_stop(x, seconds=3.2):
    """磁带停止：速度指数衰减到 ~0，音调坠落。"""
    n = len(x)
    tt = np.arange(n) / SR
    vel = np.exp(-tt * 2.2 / 1.0)            # 速度曲线
    pos = np.cumsum(vel)                       # 原始位置（采样）
    pos = pos * (n - 1) / pos[-1]
    y = np.interp(np.arange(n), pos, x)
    return y.astype(np.float32)


# ---------------------------------------------------------------- 编曲数据
# 和弦进行：I → iii → vi → ♭VII  (D 大调)
CHORDS = [
    ("D2", ["D3", "F#3", "A3", "E4"]),        # Dmaj9
    ("F#2", ["F#3", "A3", "C#4", "E4"]),      # F#m9
    ("B2", ["D3", "F#3", "A3", "D4"]),        # Bm7
    ("G2", ["B2", "D3", "F#3", "C#4"]),       # Gmaj7#11
]
CHORD_FREQS = [[nf(x) for x in voic] for _, voic in CHORDS]
BASS_FREQS = [nf(b) for b, _ in CHORDS]

# 主旋律（MIDI 音高），主题 A：抓耳但带 ♭VII 色彩的线条
THEME_A = [
    (1.5, 0.5, 76), (2.0, 0.5, 74), (2.5, 1.0, 71), (3.5, 0.5, 69),
    (0.5, 0.5, 73), (1.0, 0.5, 74), (1.5, 1.0, 76), (3.0, 1.0, 74),
    (0.5, 0.5, 74), (1.0, 0.5, 71), (1.5, 1.0, 66), (3.5, 1.0, 67),
    (0.5, 1.0, 69), (1.5, 1.0, 71), (2.5, 1.5, 73),
]
# 主题 B：更装饰、更急切
THEME_B = [
    (1.5, 0.5, 76), (2.0, 0.5, 79), (2.5, 0.5, 78), (3.0, 0.5, 76), (3.5, 0.5, 74),
    (0.5, 1.5, 73), (2.0, 0.5, 74), (2.5, 0.5, 76), (3.0, 1.0, 78),
    (0.5, 0.5, 74), (1.0, 0.5, 71), (1.5, 0.5, 67), (2.0, 0.5, 69), (2.5, 1.5, 71),
    (0.5, 2.0, 69), (3.0, 1.0, 78),
]
# 副歌：更高的音区，两拍长句
CHORUS = [
    (1.0, 0.5, 78), (1.5, 0.5, 76), (2.0, 0.5, 74), (2.5, 0.5, 73),
    (3.0, 1.0, 74), (3.75, 0.25, 76),
    (0.0, 1.0, 78), (1.0, 0.5, 79), (1.5, 0.5, 81), (2.0, 1.0, 79), (3.0, 1.0, 76),
    (0.5, 1.0, 74), (1.5, 1.0, 71), (2.5, 1.5, 78),
    (0.0, 2.0, 76), (2.0, 2.0, 74),
]
# 吟唱（合成人声），(beat, dur, midi, vowel)
CHANT_A = [   # verse 的暗色吟唱
    (0.0, 2.0, 62, "o"), (2.0, 2.0, 64, "a"),
    (0.0, 2.0, 66, "o"), (2.0, 2.0, 64, "a"),
    (0.0, 4.0, 64, "u"),
    (0.0, 4.0, 62, "o"),
]
CHANT_B = [   # chorus 的亮色吟唱（三度和声感）
    (0.0, 2.0, 69, "a"), (2.0, 2.0, 67, "e"),
    (0.0, 2.0, 71, "a"), (2.0, 2.0, 69, "e"),
    (0.0, 4.0, 66, "o"),
    (0.0, 4.0, 67, "a"),
]
CHANT_C = [   # bridge 的雾中长吟
    (0.0, 4.0, 64, "u"),
    (0.0, 4.0, 66, "o"),
    (0.0, 4.0, 64, "u"),
    (0.0, 4.0, 62, "o"),
]
# 电话远方旋律（intro / bridge / outro 用；beat 为小节内相对位置）
TELEPHONE = [
    (0.0, 1.0, 76), (1.0, 0.5, 74), (1.5, 0.5, 71), (2.0, 1.0, 69), (3.0, 1.0, 71),
    (4.0, 1.0, 73), (5.0, 1.0, 74), (6.0, 2.0, 71), (8.0, 1.0, 74), (9.0, 1.0, 76),
    (10.0, 2.0, 78), (12.0, 2.0, 73), (14.0, 2.0, 71),
]
SWING = 0.30      # 8 分 off-beat 的摆动比例
LAID_BACK = 0.05  # 鼓整体后移（秒），模拟松弛


def bar_notes(notes, bar, shift=0.0):
    """把 (beat, dur, ...) 列表转换为 (start_sample, dur_sample, payload)。"""
    out = []
    for n in notes:
        b, d = n[0], n[1]
        start = (bar * 4 + b + shift) * SPB
        dur = d * SPB
        out.append((start, dur, n[2:]))
    return out


# ---------------------------------------------------------------- 主流程

def render():
    import numpy as _np
    total = int(TOTAL_BARS * 4 * SPB) + SR
    L = np.zeros(total, dtype=np.float32)
    R = np.zeros(total, dtype=np.float32)
    MIX_SCALE = 0.32

    def add_mono(sig, at, p=0.0, gain=1.0, scaled=True):
        sig = sig * gain * (MIX_SCALE if scaled else 1.0)
        l, r = pan(sig, p)
        place(L, l, at)
        place(R, r, at)

    # ---- 磁带底噪（贯穿全曲，结尾随 tape stop 消失）
    noise_len = total
    tape_hiss = noise(noise_len) * 0.006
    tape_hiss = butter_lp(tape_hiss, 9000, 1)
    tape_hiss *= 1.0 + 0.5 * np.sin(2 * np.pi * 0.23 * np.arange(noise_len) / SR)
    add_mono(tape_hiss, 0, 0.0, 1.0, scaled=False)

    def do_pad(bar, brightness, gain, swell=True):
        ch = CHORD_FREQS[bar % 4]
        n = int(4 * SPB) + int(0.15 * SR)
        pad = synth_pad(ch, n, brightness=brightness)
        pad = butter_lp(pad, brightness * 1.6, 1)  # 二次抬升让垫更"气"
        if swell:
            pad *= env_adsr(len(pad), 0.6, 0.2, 6.0, 0.0)
        else:
            pad *= env_adsr(len(pad), 0.05, 0.2, 6.0, 0.0)
        at = int(bar * 4 * SPB - 0.1 * SR)      # 提前进入，重叠
        add_mono(pad, at, 0.0, gain)

    def do_bass(bar, gain):
        f = BASS_FREQS[bar % 4]
        n = int(4 * SPB)
        t = np.arange(n) / SR
        # 节奏：0 拍长音 2.5 拍，3 拍短音
        notes = []
        b = synth_bass(f, int(2.5 * SPB)); b *= env_adsr(len(b), 0.01, 0.1, 0.85, 0.25)
        notes.append((0, b))
        b2 = synth_bass(f, int(0.6 * SPB)); b2 *= env_adsr(len(b2), 0.01, 0.05, 0.8, 0.1)
        notes.append((3.0 * SPB, b2))
        for at, s in notes:
            add_mono(s, bar * 4 * SPB + at, -0.15, gain)

    def do_drums(bar, dense=False, shaker=False, minimal=False):
        b4 = bar * 4 * SPB
        if minimal:
            # bridge：只有 kick（很松）
            k = synth_kick()
            add_mono(k, b4 + 0.0 * SPB, 0.0, 0.55)
            return
        # kick：1 与 3 拍（3 拍微后移）
        for beat in (0.0, 2.0):
            k = synth_kick()
            add_mono(k, b4 + beat * SPB + (LAID_BACK if beat > 0 else 0.0), 0.0, 0.62)
        if dense:
            k = synth_kick(n=0.22)
            add_mono(k, b4 + 3.5 * SPB, 0.0, 0.40)
        # snare：2 与 4 拍，后移（laid-back）
        for beat in (1.0, 3.0):
            s = synth_snare()
            add_mono(s, b4 + beat * SPB + LAID_BACK, 0.12, 0.40)
        # hats：swing 8 分；dense 时加 16 分点缀
        for k in range(4):
            on = k * 1.0
            off = k + 0.5 + SWING * 0.5
            h = synth_hat()
            add_mono(h, b4 + off * SPB, 0.35, 0.75)
            if dense:
                hh = synth_hat()
                add_mono(hh, b4 + (k + 0.25) * SPB, 0.3, 0.42)
        if shaker:
            for k in range(8):
                if RNG.random() < 0.55:
                    sh = synth_shaker()
                    add_mono(sh, b4 + (k * 0.5 + RNG.uniform(0.05, 0.4)) * SPB,
                             RNG.uniform(-0.4, 0.4), 0.70)

    def do_lead(notes, bar, gain, shift=0.0, echo=True, oct_shift=0):
        for start, dur, payload in bar_notes(notes, bar, shift):
            f = mf(payload[0] + oct_shift)
            n = int(dur)
            s = np.zeros(n)
            s += 0.6 * saw(f, n, -0.002, 0.0)
            s += 0.6 * saw(f, n, +0.002, 1.0)
            s += 0.5 * square(f, n, 0.0, 2.0)
            s = butter_lp(s, 3200, 2)
            s *= env_adsr(n, 0.012, 0.12, 0.55, 0.18)
            if echo:
                s = tape_delay(s, 0.375, 0.40)
            add_mono(s, start, 0.22, gain)

    def do_chant(notes, bar, gain, shift=0.0):
        for start, dur, payload in bar_notes(notes, bar, shift):
            f = mf(payload[0])
            vowel = payload[1]
            n = int(dur) + int(0.4 * SR)
            s = synth_chant(f, n, vowel)
            s *= env_adsr(n, 0.15, 0.2, 0.8, 0.6)
            s = tape_delay(s, 0.5, 0.35, lp=1800.0)
            add_mono(s, start, -0.3, gain)
            s2 = synth_chant(f * 2.0, n, vowel)
            s2 *= env_adsr(n, 0.15, 0.2, 0.6, 0.6)
            add_mono(s2, start, -0.3, gain * 0.25)

    def do_telephone(bar, gain, n_bars=1):
        for start, dur, payload in bar_notes(TELEPHONE, bar):
            f = mf(payload[0])
            n = int(dur)
            s = synth_telephone(f, n)
            s *= env_adsr(n, 0.03, 0.1, 0.8, 0.12)
            s = reverb(s, 0.5, 0.7)
            add_mono(s, start, 0.45, gain)

    def do_bell(bar, beat, f=880.0, gain=0.22):
        s = synth_bell(f)
        s = reverb(s, 0.4, 1.0)
        add_mono(s, (bar * 4 + beat) * SPB, 0.3, gain)

    # ============ 结构 ============
    # S1-4  Intro：反向垫 + 噪音 + 电话旋律
    for b in range(4):
        if b == 0 or b == 1:
            rp = synth_reverse_pad(CHORD_FREQS[0], int(4 * SPB) + 1)
            add_mono(rp, b * 4 * SPB, 0.0, 0.26)
    do_telephone(0, 0.22)
    do_telephone(2, 0.16)
    do_bell(3, 3.5, f=1174.66, gain=0.12)     # D6

    # S5-8  Verse A：鼓 + 低音 + 垫 + 主题 A
    for b in range(4, 8):
        do_pad(b, 700, 0.20)
        do_bass(b, 0.30)
        do_drums(b, dense=False, shaker=False)
        do_lead(THEME_A, b, 0.62)

    # S9-12  Verse B：+ shaker、主题 B、暗色吟唱
    for b in range(8, 12):
        do_pad(b, 800, 0.20)
        do_bass(b, 0.30)
        do_drums(b, dense=False, shaker=True)
        do_lead(THEME_B, b, 0.66)
        do_chant(CHANT_A, b, 0.36)

    # S13-16  Chorus 1：更亮、更密
    for b in range(12, 16):
        do_pad(b, 1000, 0.23)
        do_bass(b, 0.32)
        do_drums(b, dense=True, shaker=True)
        do_lead(CHORUS, b, 0.70)
        do_chant(CHANT_B, b, 0.40)
    do_bell(15, 3.4, f=880.0, gain=0.18)

    # S17-20  Bridge：雾中，抽离（只有 kick + 垫 + 吟唱 + 电话）
    for b in range(16, 20):
        do_pad(b, 500, 0.14, swell=False)
        do_drums(b, minimal=True)
        do_chant(CHANT_C, b, 0.24)
    do_telephone(16, 0.18)
    do_telephone(18, 0.13)
    do_bell(19, 3.0, f=659.26, gain=0.10)     # E5

    # S21-24  Chorus 2：最满（lead 加低八度厚化）
    for b in range(20, 24):
        do_pad(b, 1100, 0.24)
        do_bass(b, 0.32)
        do_drums(b, dense=True, shaker=True)
        do_lead(CHORUS, b, 0.70)
        do_lead(CHORUS, b, 0.10, oct_shift=-12)  # 低八度厚化层
        do_chant(CHANT_B, b, 0.42)
    do_bell(23, 3.6, f=1318.51, gain=0.20)    # E6

    # S25-28  Outro 1：逐渐抽离
    for b in range(24, 28):
        do_pad(b, 600, 0.18)
        do_bass(b, 0.22)
        if b % 2 == 0:
            do_drums(b, dense=False, shaker=False)
        do_lead(THEME_A, b, 0.40)
    do_bell(27, 3.2, f=880.0, gain=0.14)

    # S29-32  Outro 2：反向垫 + 噪音 + 铃 → tape stop
    for b in range(28, 32):
        if b < 30:
            rp = synth_reverse_pad(CHORD_FREQS[3], int(4 * SPB) + 1)
            add_mono(rp, b * 4 * SPB, 0.0, 0.22)
    do_bell(30, 1.0, f=1046.5, gain=0.16)     # C6
    do_bell(31, 0.5, f=1567.98, gain=0.10)    # G6

    # ---- 合并立体声
    mixL = L.copy()
    mixR = R.copy()

    # ---- master 处理
    mix = np.stack([mixL, mixR])
    mix = np.nan_to_num(mix)
    # 磁带饱和：mix 峰值≈1.3，tanh 工作在线性区，保留高频与动态
    mix = soft_clip(mix * 0.9, 0.9)
    mix = normalize(mix, 0.9)
    # 空气感：并行高通 5kHz（让 hat/铃更 shimmer）
    air = np.stack([butter_hp(mix[0], 5000, 1), butter_hp(mix[1], 5000, 1)])
    mix = mix + 0.18 * air
    mix = np.nan_to_num(mix)
    # 磁带抖动
    mix = np.stack([tape_wobble(mix[0]), tape_wobble(mix[1])])
    # 轻度降采样（lo-fi 质感）：44100 -> 32000 -> 44100
    mix = np.stack([resample_poly(mix[0], 32000, 44100),
                    resample_poly(mix[1], 32000, 44100)])
    mix = np.stack([resample_poly(mix[0], 44100, 32000),
                    resample_poly(mix[1], 44100, 32000)])
    mix = np.stack([mix[0][:total], mix[1][:total]])

    # ---- tape stop（最后 3.2 秒）
    stop_len = int(3.2 * SR)
    for ch in range(2):
        tail = mix[ch][-stop_len:]
        tail = tape_stop(tail, seconds=3.2)
        mix[ch][-stop_len:] = tail
    # 全曲淡入淡出
    mix = np.stack([fade_in(mix[0], 0.8), fade_in(mix[1], 0.8)])
    mix = np.stack([fade_out(mix[0], 1.2), fade_out(mix[1], 1.2)])

    mix = np.nan_to_num(mix)
    mix -= mix.mean(axis=1, keepdims=True)
    mix = normalize(mix, 0.92)

    # 16-bit 输出（带 dither）
    dither = RNG.uniform(-0.5, 0.5, mix.shape) / 32767.0
    pcm = np.clip((mix + dither) * 32767.0, -32768, 32767).astype(np.int16)
    stereo = np.stack([pcm[0], pcm[1]], axis=1)
    wavfile.write("choir_of_static.wav", SR, stereo)
    return stereo


if __name__ == "__main__":
    stereo = render()
    dur = len(stereo) / SR
    print(f"渲染完成: choir_of_static.wav  {dur:.1f}s  {SR}Hz 16-bit 立体声")
    peak = np.max(np.abs(stereo.astype(np.float32) / 32767.0))
    rms = np.sqrt(np.mean((stereo.astype(np.float32) / 32767.0) ** 2))
    print(f"峰值: {peak:.3f}   RMS: {rms:.4f}")
