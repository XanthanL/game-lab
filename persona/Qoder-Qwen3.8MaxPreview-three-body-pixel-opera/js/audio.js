/* === 三体 NDS像素舞台剧 - 芯片音乐引擎 === */

class ChiptuneEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.isPlaying = false;
        this.currentTrack = null;
        this.scheduledNotes = [];
        this.tempo = 120;
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
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // 音符频率表
    noteFreq(note) {
        const notes = {
            'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
            'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
        };
        const match = note.match(/^([A-G]#?)(\d)$/);
        if (!match) return 440;
        const semitone = notes[match[1]] + (parseInt(match[2]) + 1) * 12;
        return 440 * Math.pow(2, (semitone - 69) / 12);
    }

    // 播放单音符
    playNote(freq, startTime, duration, type = 'square', volume = 0.15, channel = null) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(volume, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.9);
        osc.connect(gain);
        gain.connect(channel || this.masterGain);
        osc.start(startTime);
        osc.stop(startTime + duration);
        return osc;
    }

    // 播放音效
    playSfx(type) {
        if (!this.ctx) return;
        this.resume();
        const now = this.ctx.currentTime;
        switch (type) {
            case 'blip': // 对话打字音
                this.playNote(880, now, 0.05, 'square', 0.08);
                break;
            case 'advance': // 翻页
                this.playNote(660, now, 0.08, 'square', 0.1);
                this.playNote(880, now + 0.06, 0.08, 'square', 0.1);
                break;
            case 'transition': // 转场
                this.playNote(220, now, 0.3, 'sawtooth', 0.1);
                this.playNote(330, now + 0.1, 0.3, 'sawtooth', 0.08);
                this.playNote(440, now + 0.2, 0.4, 'sawtooth', 0.06);
                break;
            case 'alarm': // 警报
                this.playNote(440, now, 0.15, 'square', 0.12);
                this.playNote(220, now + 0.2, 0.15, 'square', 0.12);
                this.playNote(440, now + 0.4, 0.15, 'square', 0.12);
                break;
            case 'signal': // 信号
                for (let i = 0; i < 5; i++) {
                    this.playNote(1200 + i * 200, now + i * 0.1, 0.08, 'sine', 0.1);
                }
                break;
            case 'cosmic': // 宇宙
                this.playNote(110, now, 1.5, 'sine', 0.1);
                this.playNote(165, now + 0.3, 1.2, 'sine', 0.08);
                this.playNote(220, now + 0.6, 1.0, 'sine', 0.06);
                break;
            case 'dramatic': // 戏剧性
                this.playNote(146.83, now, 0.5, 'sawtooth', 0.12);
                this.playNote(174.61, now + 0.4, 0.5, 'sawtooth', 0.12);
                this.playNote(130.81, now + 0.8, 0.8, 'sawtooth', 0.15);
                break;
        }
    }

    // BGM轨道定义
    getTrack(name) {
        const tracks = {
            // 标题 - 神秘宇宙感
            title: {
                tempo: 80,
                bass: ['C2', 'C2', 'G2', 'G2', 'A2', 'A2', 'F2', 'F2'],
                melody: ['C4', 'E4', 'G4', 'B4', 'A4', 'G4', 'E4', 'D4',
                         'C4', 'E4', 'G4', 'C5', 'B4', 'A4', 'G4', 'E4'],
                arp: ['C3', 'E3', 'G3', 'C4', 'E3', 'G3', 'C4', 'E4']
            },
            // 红岸基地 - 紧张压抑
            redcoast: {
                tempo: 100,
                bass: ['A2', 'A2', 'F2', 'F2', 'D2', 'D2', 'E2', 'E2'],
                melody: ['A4', 'C5', 'B4', 'A4', 'G4', 'A4', 'E4', 'D4',
                         'A4', 'C5', 'D5', 'C5', 'B4', 'A4', 'G4', 'A4'],
                arp: ['A3', 'C4', 'E4', 'A3', 'F3', 'A3', 'C4', 'F3']
            },
            // 三体游戏 - 史诗感
            game: {
                tempo: 110,
                bass: ['D2', 'D2', 'Bb2', 'Bb2', 'G2', 'G2', 'A2', 'A2'],
                melody: ['D4', 'F4', 'A4', 'D5', 'C5', 'Bb4', 'A4', 'G4',
                         'F4', 'A4', 'D5', 'F5', 'E5', 'D5', 'C5', 'A4'],
                arp: ['D3', 'F3', 'A3', 'D4', 'Bb3', 'D4', 'F4', 'Bb4']
            },
            // 宇宙真相 - 宏大悲壮
            truth: {
                tempo: 70,
                bass: ['E2', 'E2', 'C2', 'C2', 'A2', 'A2', 'B2', 'B2'],
                melody: ['E4', 'G4', 'B4', 'E5', 'D5', 'B4', 'G4', 'F#4',
                         'E4', 'G4', 'B4', 'D5', 'E5', 'D5', 'B4', 'G4'],
                arp: ['E3', 'G3', 'B3', 'E4', 'C3', 'E3', 'G3', 'C4']
            },
            // 终章 - 希望与决意
            finale: {
                tempo: 90,
                bass: ['C2', 'C2', 'Am2', 'G2', 'F2', 'F2', 'G2', 'G2'],
                melody: ['C5', 'D5', 'E5', 'G5', 'F5', 'E5', 'D5', 'C5',
                         'D5', 'E5', 'F5', 'A5', 'G5', 'F5', 'E5', 'D5'],
                arp: ['C3', 'E3', 'G3', 'C4', 'F3', 'A3', 'C4', 'F4']
            }
        };
        return tracks[name] || tracks.title;
    }

    // 播放BGM
    playBgm(trackName) {
        if (!this.ctx) return;
        this.stopBgm();
        this.resume();
        this.isPlaying = true;
        this.currentTrack = trackName;
        this._scheduleLoop(trackName);
    }

    _scheduleLoop(trackName) {
        if (!this.isPlaying || this.currentTrack !== trackName) return;
        const track = this.getTrack(trackName);
        const beatDur = 60 / track.tempo;
        const now = this.ctx.currentTime + 0.1;
        const loopLen = track.melody.length * beatDur;

        // 贝斯
        for (let i = 0; i < track.bass.length; i++) {
            const freq = this.noteFreq(track.bass[i]);
            const t = now + i * beatDur * 2;
            this.playNote(freq, t, beatDur * 1.8, 'triangle', 0.12);
        }

        // 旋律
        for (let i = 0; i < track.melody.length; i++) {
            const freq = this.noteFreq(track.melody[i]);
            const t = now + i * beatDur;
            this.playNote(freq, t, beatDur * 0.8, 'square', 0.07);
        }

        // 琶音
        for (let i = 0; i < track.arp.length; i++) {
            const freq = this.noteFreq(track.arp[i]);
            const t = now + i * beatDur * 0.5;
            this.playNote(freq, t, beatDur * 0.4, 'square', 0.04);
        }

        // 循环
        this._loopTimer = setTimeout(() => {
            this._scheduleLoop(trackName);
        }, loopLen * 1000);
    }

    stopBgm() {
        this.isPlaying = false;
        if (this._loopTimer) {
            clearTimeout(this._loopTimer);
            this._loopTimer = null;
        }
    }

    setVolume(v) {
        if (this.masterGain) {
            this.masterGain.gain.value = Math.max(0, Math.min(1, v));
        }
    }
}

// 全局音频实例
const Audio = new ChiptuneEngine();
