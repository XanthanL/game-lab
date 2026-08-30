/**
 * 最后的守塔人 - Web Audio 音效系统
 * 所有音效均通过 Web Audio API 程序化生成，无外部音频文件
 */

class AudioEngine {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.masterGain = null;
        this.ambientNodes = [];
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.3;
            this.masterGain.connect(this.ctx.destination);
            this.initialized = true;
        } catch (e) {
            console.warn('Web Audio not supported');
            this.enabled = false;
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        if (this.masterGain) {
            this.masterGain.gain.value = this.enabled ? 0.3 : 0;
        }
        return this.enabled;
    }

    // 生成白噪声缓冲
    createNoiseBuffer(duration = 2) {
        const sampleRate = this.ctx.sampleRate;
        const length = sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    // 海浪环境音
    startWaves(intensity = 0.5) {
        if (!this.initialized || !this.enabled) return;
        this.stopAmbient();

        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer(4);
        noise.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 200 + intensity * 300;

        const gain = this.ctx.createGain();
        gain.gain.value = 0.08 * intensity;

        // LFO 模拟潮汐
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 0.1 + intensity * 0.1;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 0.04 * intensity;
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start();
        lfo.start();

        this.ambientNodes = [noise, lfo, gain, filter, lfoGain];
    }

    // 风声
    startWind(intensity = 0.5) {
        if (!this.initialized || !this.enabled) return;

        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer(3);
        noise.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 400 + intensity * 600;
        filter.Q.value = 0.5;

        const gain = this.ctx.createGain();
        gain.gain.value = 0.05 * intensity;

        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 0.3;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 200;
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start();
        lfo.start();

        this.ambientNodes.push(noise, lfo, gain, filter, lfoGain);
    }

    stopAmbient() {
        this.ambientNodes.forEach(node => {
            try {
                if (node.stop) node.stop();
                node.disconnect();
            } catch (e) {}
        });
        this.ambientNodes = [];
    }

    // 闪电音效
    playThunder() {
        if (!this.initialized || !this.enabled) return;
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer(1.5);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 1.2);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.5);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noise.start();
        noise.stop(this.ctx.currentTime + 1.5);
    }

    // 灯塔点亮音
    playLightOn() {
        if (!this.initialized || !this.enabled) return;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.3);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.8);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.8);
    }

    // 电台静电音
    playRadioStatic() {
        if (!this.initialized || !this.enabled) return;
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer(0.5);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 2000;
        filter.Q.value = 2;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noise.start();
        noise.stop(this.ctx.currentTime + 0.5);
    }

    // 汽笛/号角
    playHorn() {
        if (!this.initialized || !this.enabled) return;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        osc1.type = 'sawtooth';
        osc2.type = 'sawtooth';
        osc1.frequency.value = 130;
        osc2.frequency.value = 165;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 600;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.12, this.ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.12, this.ctx.currentTime + 1.0);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.8);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        osc1.start();
        osc2.start();
        osc1.stop(this.ctx.currentTime + 1.8);
        osc2.stop(this.ctx.currentTime + 1.8);
    }

    // 文字显示音（打字机效果）
    playType() {
        if (!this.initialized || !this.enabled) return;
        const osc = this.ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = 600 + Math.random() * 200;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.02, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.03);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.03);
    }

    // 转场音
    playTransition() {
        if (!this.initialized || !this.enabled) return;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(220, this.ctx.currentTime + 0.6);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.6);
    }

    // 尾声和弦
    playEnding() {
        if (!this.initialized || !this.enabled) return;
        const notes = [262, 330, 392, 523]; // C E G C
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;

            const gain = this.ctx.createGain();
            const startT = this.ctx.currentTime + i * 0.3;
            gain.gain.setValueAtTime(0, startT);
            gain.gain.linearRampToValueAtTime(0.08, startT + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, startT + 2.5);

            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(startT);
            osc.stop(startT + 2.5);
        });
    }

    // 根据场景设置环境音
    setSceneAmbient(scene) {
        this.stopAmbient();
        switch (scene) {
            case 'sunset':
                this.startWaves(0.4);
                break;
            case 'storm':
                this.startWaves(1.0);
                this.startWind(0.8);
                break;
            case 'night':
                this.startWaves(0.3);
                break;
            case 'dawn':
                this.startWaves(0.3);
                break;
        }
    }

    destroy() {
        this.stopAmbient();
        if (this.ctx) {
            this.ctx.close();
        }
    }
}
