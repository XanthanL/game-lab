import * as THREE from 'three';
import { Renderer } from '../engine/Renderer';
import { Particles } from '../engine/Particles';
import { World } from '../world/World';
import { Player } from '../player/Player';
import { PlayerController } from '../player/PlayerController';
import { HUD } from '../ui/HUD';
import { DamageNumbers } from '../ui/DamageNumbers';
import { sound } from '../audio/SoundManager';
import { EnemyManager } from '../enemies/EnemyManager';
import { Projectiles } from '../weapons/Projectiles';
import { WeaponManager } from '../weapons/WeaponManager';
import { WEAPON_CONFIGS } from '../weapons/weaponConfigs';
import { XpSystem } from '../systems/XpSystem';
import { UpgradeSystem, type UpgradeOption } from '../systems/UpgradeSystem';
import { WaveSystem } from '../systems/WaveSystem';

type OverlayState = 'start' | 'playing' | 'paused' | 'levelup' | 'gameover';

const SAVE_KEY = 'fps-vampire-best';

interface BestStats {
  time: number;
  kills: number;
  level: number;
}

const WEAPON_TAGS: Record<string, string> = {
  magicBolt: '追踪弹',
  soulBlade: '回旋切割',
  holyWater: '范围灼烧',
  lightning: '群体落雷',
  whip: '近战挥击',
};

export class Game {
  private renderer: Renderer;
  private world: World;
  private player: Player;
  private controller: PlayerController;
  private hud: HUD;
  private enemies: EnemyManager;
  private projectiles: Projectiles;
  private weapons: WeaponManager;
  private xp: XpSystem;
  private upgrades: UpgradeSystem;
  private waves: WaveSystem;
  private particles: Particles;
  private dmgNumbers: DamageNumbers;
  private readonly fireOrigin = new THREE.Vector3();
  private readonly tmpVec = new THREE.Vector3();
  private lastTime = 0;
  private running = false;
  private paused = false;
  private elapsed = 0;
  private shakeAmount = 0;
  private overlayState: OverlayState = 'start';
  private overlay: HTMLElement;
  private startBtn: HTMLButtonElement;
  private overlayTitle: HTMLElement;
  private overlayStats: HTMLElement;
  private pointerError: HTMLElement;
  private damageFlash: HTMLElement;
  private upgradePanel: HTMLElement;
  private upgradeOptions: HTMLElement;
  private bestStats: HTMLElement;
  private weaponRoster: HTMLElement;
  private best: BestStats = { time: 0, kills: 0, level: 1 };
  private newRecord = false;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    this.world = new World(this.renderer.scene);
    this.player = new Player();
    this.controller = new PlayerController(this.renderer.camera, canvas, this.player);
    this.particles = new Particles(this.renderer.scene);
    this.dmgNumbers = new DamageNumbers(document.body);
    this.enemies = new EnemyManager(this.renderer.scene);
    this.projectiles = new Projectiles(this.renderer.scene, this.enemies);
    this.weapons = new WeaponManager(this.renderer.scene, this.projectiles, this.enemies, this.player);
    this.xp = new XpSystem(this.renderer.scene, this.particles);
    this.upgrades = new UpgradeSystem(this.player, this.weapons);
    this.hud = new HUD();
    this.overlay = this.require('overlay');
    this.startBtn = this.require('start-btn') as HTMLButtonElement;
    this.overlayTitle = this.require('overlay-title');
    this.overlayStats = this.require('overlay-stats');
    this.pointerError = this.require('pointer-error');
    this.damageFlash = this.require('damage-flash');
    this.upgradePanel = this.require('upgrade-panel');
    this.upgradeOptions = this.require('upgrade-options');
    this.bestStats = this.require('best-stats');
    this.weaponRoster = this.require('weapon-roster');

    this.best = this.loadBest();
    this.renderRoster();
    this.renderBest();

    this.player.onDamaged = (amount) => {
      this.flashDamage();
      this.shake(0.35);
      sound.play('hurt');
      const p = this.tmpVec.set(this.controller.position.x, 1.8, this.controller.position.z);
      this.dmgNumbers.show(p, String(Math.round(amount)), 'player');
    };
    this.enemies.onEnemyKilled = (enemy) => {
      this.player.kills++;
      this.xp.drop(enemy.pos, enemy.xp);
      this.particles.burst(enemy.pos, enemy.config.color, 12, 3.5, 0.45, 0.2, 1.6);
      sound.play('kill');
    };
    this.enemies.onEnemyDamaged = (enemy, amount) => {
      const p = this.tmpVec.set(enemy.pos.x, enemy.scale, enemy.pos.z);
      this.dmgNumbers.show(p, String(Math.round(amount)));
      this.particles.burst(p, 0xffd23f, 2, 1.8, 0.3, 0.09, 0.8);
    };
    this.weapons.onHeavy = () => this.shake(0.18);
    this.waves = new WaveSystem(this.enemies, (msg) => {
      this.hud.announce(msg);
      if (msg.includes('BOSS')) {
        sound.play('boss');
        this.shake(0.3);
      }
    });
    this.weapons.addWeapon(WEAPON_CONFIGS.magicBolt);
    this.bindUI();
  }

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  private bindUI(): void {
    this.controller.setLockCallback((locked) => {
      if (locked) {
        this.paused = false;
        this.overlay.classList.add('hidden');
        this.pointerError.classList.add('hidden');
        this.overlayState = 'playing';
        this.hud.show();
      } else {
        this.paused = true;
        this.hud.hide();
        if (this.overlayState === 'playing') {
          this.showOverlay('paused');
        } else if (this.overlayState === 'start') {
          // 从开始界面尝试锁定失败，提示用户而非静默切到「已暂停」
          this.pointerError.classList.remove('hidden');
        }
      }
    });
    this.startBtn.addEventListener('click', () => {
      sound.init();
      if (this.overlayState === 'gameover') {
        this.restart();
      } else {
        this.controller.lock();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') {
        sound.toggleMute();
        this.hud.announce(sound.isMuted ? '♪ 音效：关' : '♪ 音效：开');
      }
    });
  }

  private restart(): void {
    this.enemies.clear();
    this.projectiles.clear();
    this.xp.clear();
    this.particles.clear();
    this.dmgNumbers.clear();
    this.weapons.clear();
    this.weapons.addWeapon(WEAPON_CONFIGS.magicBolt);
    this.waves.reset();
    this.player.reset();
    this.controller.position.set(0, 0, 0);
    this.elapsed = 0;
    this.shakeAmount = 0;
    this.overlayState = 'start';
    this.paused = false;
    this.overlay.classList.add('hidden');
    this.upgradePanel.classList.add('hidden');
    this.hud.show();
    this.controller.lock();
  }

  private showOverlay(state: 'start' | 'paused' | 'gameover'): void {
    this.overlayState = state;
    if (state === 'start') {
      this.overlayTitle.textContent = 'FPS VAMPIRE';
      this.startBtn.textContent = '点击进入游戏';
      this.bestStats.classList.remove('hidden');
    } else if (state === 'paused') {
      this.overlayTitle.textContent = '已暂停';
      this.startBtn.textContent = '继续游戏';
      this.bestStats.classList.add('hidden');
    } else {
      const survived = Math.floor(this.elapsed);
      this.newRecord = false;
      if (survived > this.best.time) {
        this.best.time = survived;
        this.newRecord = true;
      }
      if (this.player.kills > this.best.kills) this.best.kills = this.player.kills;
      if (this.player.level > this.best.level) this.best.level = this.player.level;
      this.saveBest();
      this.renderBest();
      this.overlayTitle.textContent = '游戏结束';
      this.startBtn.textContent = '重新开始';
      this.overlayStats.textContent =
        `存活 ${this.fmtTime(survived)} · 击杀 ${this.player.kills} · 等级 ${this.player.level}` +
        (this.newRecord ? ' 🏆 新纪录！' : '');
      this.overlayStats.classList.remove('hidden');
      this.bestStats.classList.remove('hidden');
    }
    this.overlay.classList.remove('hidden');
  }

  private fmtTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  private loadBest(): BestStats {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Partial<BestStats>;
        return {
          time: Number(d.time) || 0,
          kills: Number(d.kills) || 0,
          level: Number(d.level) || 1,
        };
      }
    } catch {
      /* ignore */
    }
    return { time: 0, kills: 0, level: 1 };
  }

  private saveBest(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.best));
    } catch {
      /* ignore */
    }
  }

  private renderBest(): void {
    this.require('best-time').textContent = this.fmtTime(this.best.time);
    this.require('best-kills').textContent = String(this.best.kills);
    this.require('best-level').textContent = String(this.best.level);
  }

  private renderRoster(): void {
    this.weaponRoster.innerHTML = '';
    for (const cfg of Object.values(WEAPON_CONFIGS)) {
      const chip = document.createElement('div');
      chip.className = 'weapon-chip';
      chip.innerHTML = `
        <div class="weapon-chip-icon">${cfg.icon}</div>
        <div class="weapon-chip-name">${cfg.name}</div>
        <div class="weapon-chip-tag">${WEAPON_TAGS[cfg.id] ?? ''}</div>`;
      this.weaponRoster.appendChild(chip);
    }
  }

  private openLevelUp(): void {
    const options = this.upgrades.roll(3);
    if (options.length === 0) {
      this.player.heal(this.player.stats.maxHp * 0.3);
      return;
    }
    this.overlayState = 'levelup';
    this.paused = true;
    this.hud.hide();
    sound.play('levelup');
    document.exitPointerLock();
    this.renderUpgradeOptions(options);
    this.upgradePanel.classList.remove('hidden');
  }

  private renderUpgradeOptions(options: UpgradeOption[]): void {
    this.upgradeOptions.innerHTML = '';
    for (const option of options) {
      const card = document.createElement('div');
      const isNew = option.kind === 'weapon' && option.level === 0;
      card.className = `upgrade-option${isNew ? ' new-weapon' : ''}`;
      card.innerHTML = `
        <div class="upgrade-icon">${option.icon}</div>
        <div class="upgrade-name">${option.name}</div>
        <div class="upgrade-desc">${option.desc}</div>
        <div class="upgrade-level">Lv ${option.level} → ${option.nextLevel}</div>`;
      card.addEventListener('click', () => this.chooseOption(option));
      this.upgradeOptions.appendChild(card);
    }
  }

  private chooseOption(option: UpgradeOption): void {
    this.upgrades.apply(option);
    this.upgradePanel.classList.add('hidden');
    this.overlayState = 'playing';
    this.paused = false;
    this.hud.show();
    this.controller.lock();
  }

  private flashDamage(): void {
    this.damageFlash.classList.remove('active');
    void this.damageFlash.offsetWidth;
    this.damageFlash.classList.add('active');
  }

  private shake(amount: number): void {
    this.shakeAmount = Math.min(1, this.shakeAmount + amount);
  }

  private applyShake(dt: number): void {
    if (this.shakeAmount <= 0) return;
    const s = this.shakeAmount * this.shakeAmount;
    const cam = this.renderer.camera;
    cam.position.x += (Math.random() - 0.5) * 0.4 * s;
    cam.position.y += (Math.random() - 0.5) * 0.4 * s;
    this.shakeAmount = Math.max(0, this.shakeAmount - dt * 2.2);
  }

  private require(id: string): HTMLElement {
    const node = document.getElementById(id);
    if (!node) throw new Error(`missing element #${id}`);
    return node;
  }

  private loop = (): void => {
    if (!this.running) return;
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    if (!this.paused) {
      this.elapsed += dt;
      this.player.update(dt);
      if (this.player.alive) {
        this.controller.update(dt, this.world.obstacles);
        this.applyShake(dt);
        const origin = this.fireOrigin.set(
          this.controller.position.x,
          this.controller.position.y + 1.3,
          this.controller.position.z
        );
        this.enemies.update(dt, this.player, this.controller.position);
        this.projectiles.update(dt);
        this.weapons.update(dt, origin, this.controller.yaw);
        this.xp.update(dt, this.player, this.controller.position, this.player.stats.magnet);
        this.particles.update(dt);
        this.dmgNumbers.update(dt, this.renderer.camera);
        this.waves.update(this.elapsed);
        if (this.upgrades.checkLevelUp()) {
          this.openLevelUp();
        }
      } else if (this.overlayState !== 'gameover') {
        this.paused = true;
        this.dmgNumbers.clear();
        document.exitPointerLock();
        this.hud.hide();
        sound.play('death');
        this.showOverlay('gameover');
      }
      this.hud.setTime(this.elapsed);
      this.hud.setLevel(this.player.level);
      this.hud.setXp(this.player.xp, this.upgrades.xpToNext(this.player.level));
      this.hud.setHealth(this.player.hp, this.player.stats.maxHp);
      this.hud.setKills(this.player.kills);
    }
    this.renderer.render();
    requestAnimationFrame(this.loop);
  };
}
