/**
 * 奇点回响 · 音频管理器
 * 
 * @module audio
 */

// ==================== 音效事件总线 ====================
export const AudioEvents = {
  init: 'audio_init',
  ready: 'audio_ready',
  mute: 'audio_mute',
  unmute: 'audio_unmute',
  
  emit(event, data) {
    const e = new CustomEvent(event, { detail: data });
    window.dispatchEvent(e);
  },
  
  on(event, callback) {
    window.addEventListener(event, callback);
  }
};

// ==================== 音频上下文管理 ====================
class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.muted = false;
    this.volume = 0.7;
    
    // 音源映射表
    this.sounds = {};
    this.music = null;
    
    // 效果器链
    this.reverbNode = null;
    this.compressorNode = null;
    
    this.initialized = false;
  }
  
  /**
   * Set game reference for screen shake integration
   */
  setGameRef(gameObj) {
    window.Game = gameObj;
  }
  
  async init() {
    if (this.initialized) return;
    
    try {
      // 创建音频上下文
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      
      // 主增益节点
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      
      // 压缩器（防止爆音）
      this.compressorNode = this.ctx.createDynamicsCompressor();
      this.compressorNode.threshold.setValueAtTime(-24, this.ctx.currentTime);
      this.compressorNode.ratio.setValueAtTime(12, this.ctx.currentTime);
      this.compressorNode.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressorNode.release.setValueAtTime(0.25, this.ctx.currentTime);
      
      // 混响效果
      this.initReverb();
      
      // 连接节点链
      this.masterGain.connect(this.compressorNode);
      this.compressorNode.connect(this.ctx.destination);
      
      // 加载音效资源
      await this.loadAllSounds();
      
      this.initialized = true;
      AudioEvents.emit(AudioEvents.ready, { status: 'initialized' });
      
    } catch (err) {
      console.warn('Audio init failed:', err);
      AudioEvents.emit(AudioEvents.ready, { status: 'failed', error: err });
    }
  }
  
  initReverb() {
    // 简单的脉冲响应混响
    const bufferSize = this.ctx.sampleRate * 2; // 2 秒
    const impulse = this.ctx.createBuffer(2, bufferSize, this.ctx.sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < bufferSize; i++) {
        channelData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.5));
      }
    }
    
    this.reverbNode = this.ctx.createConvolver();
    this.reverbNode.buffer = impulse;
    
    const reverbGain = this.ctx.createGain();
    reverbGain.gain.value = 0.3; // 30% 混响量
    
    this.reverbNode.connect(reverbGain);
    reverbGain.connect(this.ctx.destination);
  }
  
  async loadAllSounds() {
    // Core combat sounds - optimized for variety
    this.sounds['shoot'] = this.synthesizeSound({
      type: 'square',
      attack: 0.01,
      decay: 0.08,
      frequency: [880, 660],
      filterQ: 5,
      pitchModulate: true
    });
    
    this.sounds['hit'] = this.synthesizeSound({
      type: 'sawtooth',
      attack: 0.01,
      decay: 0.25,
      frequency: [220, 110, 55],
      filterQ: 10,
      noise: true
    });
    
    this.sounds['explosion'] = this.createExplosionSound();
    
    this.sounds['shield'] = this.synthesizeSound({
      type: 'sine',
      attack: 0.05,
      decay: 0.4,
      frequency: [1200, 1600, 2000],
      filterQ: 2,
      arpeggio: true
    });
    
    this.sounds['powerup'] = this.synthesizeSound({
      type: 'triangle',
      attack: 0.03,
      decay: 0.5,
      frequency: [523, 659, 784, 988, 1047],
      filterQ: 3,
      ascending: true
    });
    
    this.sounds['ui_click'] = this.synthesizeSound({
      type: 'sine',
      attack: 0.005,
      decay: 0.03,
      frequency: [800, 1200],
      filterQ: 0
    });
    
    this.sounds['boss_enter'] = this.synthesizeSound({
      type: 'square',
      attack: 0.3,
      decay: 2.0,
      frequency: [55, 82, 98, 110],
      filterQ: 8,
      deep: true
    });
    
    // New ambient and effect sounds
    this.sounds['dash'] = this.createDashSound();
    this.sounds['shield_break'] = this.createShieldBreakSound();
    this.sounds['level_up'] = this.createLevelUpSound();
    this.sounds['enemy_die'] = this.createEnemyDieSound();
    this.sounds['wave_start'] = this.createWaveStartSound();
    this.sounds['low_health_warning'] = this.createLowHealthWarning();
    
    // Background music placeholder (would need external audio file)
    this.musicTracks = {
      'battle': null,
      'boss': null,
      'menu': null
    };
    
    console.log('[Audio] All sounds loaded:', Object.keys(this.sounds).length);
  }
  
  /**
   * Create explosion sound with noise buffer
   */
  createExplosionSound() {
    return {
      play: (vol = 1) => {
        if (!this.ctx || this.muted) return;
        
        const t = this.ctx.currentTime;
        const duration = 0.8;
        const bufferSize = this.ctx.sampleRate * duration;
        
        // Create noise buffer
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const channelData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          channelData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
        }
        
        // Noise source
        const noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        
        // Filter to shape the explosion
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, t);
        filter.frequency.exponentialRampToValueAtTime(100, t + duration);
        
        // Gain envelope
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol * 0.8, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
        
        // Connect chain
        noiseSource.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        
        // Add reverb
        if (this.reverbNode) {
          const wet = this.ctx.createGain();
          wet.gain.value = vol * 0.4;
          gain.connect(wet);
          wet.connect(this.reverbNode);
        }
        
        noiseSource.start(t);
      }
    };
  }
  
  /**
   * Create dash sound (whoosh effect)
   */
  createDashSound() {
    return {
      play: (vol = 0.5) => {
        if (!this.ctx || this.muted) return;
        
        const t = this.ctx.currentTime;
        
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.value = 2;
        
        const gain = this.ctx.createGain();
        
        // Whoosh envelope - quick rise, slow fall
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.linearRampToValueAtTime(800, t + 0.1);
        
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(vol, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start(t);
        osc.stop(t + 0.3);
      }
    };
  }
  
  /**
   * Create shield break sound
   */
  createShieldBreakSound() {
    return {
      play: (vol = 0.7) => {
        if (!this.ctx || this.muted) return;
        
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 500;
        
        const gain = this.ctx.createGain();
        
        // Sharp burst with rapid decay
        osc.frequency.setValueAtTime(1200, t);
        osc.frequency.exponentialRampToValueAtTime(200, t + 0.15);
        
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start(t);
        osc.stop(t + 0.2);
      }
    };
  }
  
  /**
   * Create level up sound (chord progression)
   */
  createLevelUpSound() {
    return {
      play: (vol = 0.8) => {
        if (!this.ctx || this.muted) return;
        
        const t = this.ctx.currentTime;
        const frequencies = [523.25, 659.25, 783.99, 1046.50]; // C major chord
        
        frequencies.forEach((freq, i) => {
          const osc = this.ctx.createOscillator();
          osc.type = 'triangle';
          
          const gain = this.ctx.createGain();
          
          // Stagger start times slightly
          const delay = i * 0.05;
          
          gain.gain.setValueAtTime(0, t + delay);
          gain.gain.linearRampToValueAtTime(vol * 0.6, t + delay + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.6);
          
          osc.frequency.value = freq;
          osc.connect(gain);
          gain.connect(this.masterGain);
          
          osc.start(t + delay);
          osc.stop(t + delay + 0.6);
        });
      }
    };
  }
  
  /**
   * Create enemy death sound
   */
  createEnemyDieSound() {
    return {
      play: (vol = 0.6) => {
        if (!this.ctx || this.muted) return;
        
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'square';
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        
        const gain = this.ctx.createGain();
        
        // Quick descending slide
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.15);
        
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start(t);
        osc.stop(t + 0.15);
      }
    };
  }
  
  /**
   * Create wave start announcement
   */
  createWaveStartSound() {
    return {
      play: (vol = 1.0) => {
        if (!this.ctx || this.muted) return;
        
        const t = this.ctx.currentTime;
        
        // Two-tone alert sound
        [1047, 1319].forEach((freq, i) => {
          const osc = this.ctx.createOscillator();
          osc.type = 'square';
          
          const gain = this.ctx.createGain();
          
          const delay = i * 0.1;
          
          gain.gain.setValueAtTime(0, t + delay);
          gain.gain.linearRampToValueAtTime(vol * 0.7, t + delay + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.3);
          
          osc.frequency.value = freq;
          osc.connect(gain);
          gain.connect(this.masterGain);
          
          osc.start(t + delay);
          osc.stop(t + delay + 0.3);
        });
      }
    };
  }
  
  /**
   * Create low health warning beep
   */
  createLowHealthWarning() {
    return {
      play: (vol = 0.8) => {
        if (!this.ctx || this.muted) return;
        
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'square';
        
        const gain = this.ctx.createGain();
        
        // Rapid pulsing
        osc.frequency.setValueAtTime(600, t);
        
        gain.gain.setValueAtTime(0, t);
        gain.gain.setValueAtTime(vol * 0.8, t + 0.05);
        gain.gain.setValueAtTime(0, t + 0.1);
        gain.gain.setValueAtTime(vol * 0.8, t + 0.15);
        gain.gain.setValueAtTime(0, t + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start(t);
        osc.stop(t + 0.3);
      }
    };
  }
  
  synthesizeSound(params) {
    const { type, attack, decay, frequency, filterQ } = params;
    
    return {
      play: (vol = 1) => {
        if (!this.ctx || this.muted) return;
        
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();
        
        osc.type = type;
        filter.type = 'lowpass';
        filter.Q.value = filterQ;
        
        // 频率包络
        if (Array.isArray(frequency)) {
          osc.frequency.setValueAtTime(frequency[0], t);
          for (let i = 1; i < frequency.length; i++) {
            osc.frequency.linearRampToValueAtTime(frequency[i], t + attack + decay * i);
          }
        } else {
          osc.frequency.setValueAtTime(frequency, t);
        }
        
        // 音量包络
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(vol, t + attack);
        gain.gain.exponentialRampToValueAtTime(0.001, t + attack + decay);
        
        // 连接节点
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        
        // 应用混响
        if (this.reverbNode) {
          const wet = this.ctx.createGain();
          wet.gain.value = vol * 0.2;
          gain.connect(wet);
          wet.connect(this.reverbNode);
        }
        
        osc.start(t);
        osc.stop(t + attack + decay + 0.2);
      }
    };
  }
  
  playSound(name, options = {}) {
    const sound = this.sounds[name];
    if (!sound) {
      console.warn(`Sound not found: ${name}`);
      return null;
    }
    
    // Screen shake on explosion sounds
    if (name === 'explosion' && Game) {
      triggerShake(8, 5);
    } else if (name === 'boss_death' && Game) {
      triggerShake(30, 15); // Massive shake for boss death
    }
    
    // Support spatialization (3D audio)
    if (options.x !== undefined && options.y !== undefined) {
      const pan = this.computePan(options.x, options.y);
      this.applyPanning(sound, pan, options.vol);
    } else {
      sound.play(options.vol || 1);
    }
    
    return sound;
  }
  
  computePan(x, y) {
    // Convert screen coordinates to left-right channel mix ratio
    const screenCenter = canvas.width / 2;
    const pan = (x - screenCenter) / screenCenter;
    return Math.max(-1, Math.min(1, pan));
  }
  
  applyPanning(sound, pan, vol) {
    if (!this.ctx || this.muted) return;
    
    const t = this.ctx.currentTime;
    
    // 立体声 pannner
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = pan;
    
    const gain = this.ctx.createGain();
    gain.gain.value = vol || 1;
    
    // 重新播放声音并添加空间化
    const { type, attack, decay, frequency, filterQ } = this.extractParams(sound);
    
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    
    osc.type = type;
    filter.type = 'lowpass';
    filter.Q.value = filterQ;
    
    if (Array.isArray(frequency)) {
      osc.frequency.setValueAtTime(frequency[0], t);
      for (let i = 1; i < frequency.length; i++) {
        osc.frequency.linearRampToValueAtTime(frequency[i], t + attack + decay * i);
      }
    } else {
      osc.frequency.setValueAtTime(frequency, t);
    }
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(this.masterGain);
    
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol || 1, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, t + attack + decay);
    
    osc.start(t);
    osc.stop(t + attack + decay + 0.2);
  }
  
  extractParams(sound) {
    // 简化版：返回默认参数
    return {
      type: 'square',
      attack: 0.1,
      decay: 0.3,
      frequency: [440],
      filterQ: 5
    };
  }
  
  // ==================== 背景音乐控制 ====================
  async playMusic(musicId) {
    if (this.muted) return;
    
    // 停止当前音乐
    this.stopMusic();
    
    // TODO: 加载实际的音乐片段
    // 这里用占位符
    this.music = { id: musicId, playing: true };
    
    // 示例：淡入效果
    if (this.masterGain) {
      this.masterGain.gain.linearRampToValueAtTime(this.volume * 0.3, this.ctx.currentTime + 2);
    }
  }
  
  stopMusic() {
    if (!this.music) return;
    
    // 淡出效果
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1);
    }
    
    this.music = null;
  }
  
  pauseMusic() {
    if (!this.music?.playing) return;
    
    this.music.paused = true;
    this.stopMusic();
  }
  
  resumeMusic() {
    if (!this.music?.paused) return;
    
    this.music.paused = false;
    this.playMusic(this.music.id);
  }
  
  // ==================== 全局控制 ====================
  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain) {
      this.masterGain.gain.value = this.volume;
    }
  }
  
  toggleMute() {
    this.muted = !this.muted;
    
    if (this.muted) {
      AudioEvents.emit(AudioEvents.mute);
    } else {
      AudioEvents.emit(AudioEvents.unmute);
    }
    
    return this.muted;
  }
  
  isMuted() {
    return this.muted;
  }
  
  dispose() {
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.music = null;
    this.sounds = {};
    this.initialized = false;
  }
}

// ==================== 单例导出 ====================
export const audioManager = new AudioManager();

// ==================== 快捷 API ====================
export const playSound = (name, options) => audioManager.playSound(name, options);
export const playShoot = () => playSound('shoot');
export const playHit = () => playSound('hit');
export const playExplosion = () => playSound('explosion');
export const playShield = () => playSound('shield');
export const playPowerUp = () => playSound('powerup');
export const playUI = () => playSound('ui_click');

export const startMusic = (musicId) => audioManager.playMusic(musicId);
export const stopMusic = () => audioManager.stopMusic();

export const toggleMute = () => audioManager.toggleMute();
export const setVolume = (vol) => audioManager.setVolume(vol);
