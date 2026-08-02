/**
 * audio.js — 游戏音效与背景音乐(BGM)系统
 */

/* ============================================================
 * BGM 管理器
 * ============================================================ */
const BGM = {
  current: null,
  volume: 0.5,
  fadeDuration: 1200,
  isSwitching: false,

  play(scene, key, loop = true) {
    if (this.isSwitching) return;

    // 移动端：音频上下文未解锁（需首次触摸）时，延迟到解锁后再播
    if (scene.sound.locked) {
      scene.sound.once('unlocked', () => this.play(scene, key, loop));
      return;
    }

    if (this.current) {
      this.current.stop();
      this.current = null;
    }

    const audio = scene.sound.add(key, { loop, volume: this.volume });
    audio.on('error', (err) => {
      console.warn(`BGM play error: ${key}`, err);
    });
    audio.play();
    this.current = audio;
  },

  switch(scene, key, loop = true) {
    if (this.isSwitching || (this.current && this.current.key === key)) return;

    // 移动端音频未解锁时延迟播放
    if (scene.sound.locked) {
      scene.sound.once('unlocked', () => this.switch(scene, key, loop));
      return;
    }

    this.isSwitching = true;

    if (this.current) {
      scene.tweens.add({
        targets: this.current,
        volume: 0,
        duration: this.fadeDuration,
        ease: 'Power2',
        onComplete: () => {
          this.current.stop();
          this.current = null;
          this._startNew(scene, key, loop);
        }
      });
    } else {
      this._startNew(scene, key, loop);
    }
  },

  _startNew(scene, key, loop) {
    const audio = scene.sound.add(key, { loop, volume: 0 });
    audio.on('error', (err) => {
      console.warn(`BGM play error: ${key}`, err);
    });
    audio.play();
    this.current = audio;

    scene.tweens.add({
      targets: audio,
      volume: this.volume,
      duration: this.fadeDuration,
      ease: 'Power2',
      onComplete: () => {
        this.isSwitching = false;
      }
    });
  },

  stop() {
    if (this.current) {
      this.current.stop();
      this.current = null;
    }
    this.isSwitching = false;
  },

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.current) {
      this.current.volume = this.volume;
    }
  }
};
