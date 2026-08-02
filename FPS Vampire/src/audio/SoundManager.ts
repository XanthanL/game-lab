export class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private muted = false;
  private last: Record<string, number> = {};

  init(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(ctx.destination);
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0.22;
    this.musicGain.connect(this.master);
    this.startMusic();
  }

  get isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): void {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
  }

  play(name: string): void {
    if (!this.ctx || !this.master || this.muted) return;
    const now = performance.now();
    if (now - (this.last[name] ?? 0) < 60) return;
    this.last[name] = now;
    switch (name) {
      case 'shoot':
        this.tone(740, 0.09, 'square', 0.06);
        this.tone(1240, 0.05, 'square', 0.03, 0.01);
        break;
      case 'hit':
        this.tone(180, 0.06, 'triangle', 0.1);
        break;
      case 'kill':
        this.tone(320, 0.18, 'sine', 0.16);
        this.tone(140, 0.2, 'sine', 0.12, 0.02);
        break;
      case 'hurt':
        this.tone(110, 0.22, 'sawtooth', 0.2);
        break;
      case 'pickup':
        this.tone(880, 0.08, 'sine', 0.09);
        this.tone(1320, 0.1, 'sine', 0.06, 0.05);
        break;
      case 'levelup':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.12, i * 0.09));
        break;
      case 'boss':
        this.tone(55, 1.2, 'sawtooth', 0.22);
        this.tone(82.5, 1.0, 'sine', 0.18, 0.1);
        break;
      case 'swing':
        this.tone(520, 0.08, 'triangle', 0.08);
        this.tone(240, 0.1, 'triangle', 0.06, 0.02);
        break;
      case 'throw':
        this.tone(600, 0.07, 'square', 0.05);
        this.tone(900, 0.06, 'square', 0.04, 0.04);
        break;
      case 'lightning':
        this.tone(1200, 0.12, 'square', 0.1);
        this.tone(300, 0.2, 'sine', 0.12, 0.01);
        break;
      case 'death':
        this.tone(220, 0.5, 'sawtooth', 0.18);
        this.tone(110, 0.8, 'sine', 0.22, 0.15);
        break;
    }
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0): void {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private startMusic(): void {
    if (!this.ctx) return;
    const seq = [0, 3, 5, 7, 5, 3, 2, 0];
    let step = 0;
    window.setInterval(() => {
      if (!this.ctx || !this.musicGain || this.muted) return;
      const t0 = this.ctx.currentTime;
      const semis = seq[step % seq.length];
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220 * Math.pow(2, semis / 12), t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
      osc.connect(g);
      g.connect(this.musicGain);
      osc.start(t0);
      osc.stop(t0 + 0.5);
      if (step % 4 === 0) {
        const bass = this.ctx.createOscillator();
        const bg = this.ctx.createGain();
        bass.type = 'sine';
        bass.frequency.setValueAtTime(82.5, t0);
        bg.gain.setValueAtTime(0.0001, t0);
        bg.gain.exponentialRampToValueAtTime(0.06, t0 + 0.05);
        bg.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.8);
        bass.connect(bg);
        bg.connect(this.musicGain);
        bass.start(t0);
        bass.stop(t0 + 1.9);
      }
      step++;
    }, 380);
  }
}

export const sound = new SoundManager();
