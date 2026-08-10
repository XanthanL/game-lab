function el(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing element #${id}`);
  return node;
}

export class HUD {
  private healthFill: HTMLElement;
  private healthText: HTMLElement;
  private xpFill: HTMLElement;
  private xpText: HTMLElement;
  private staminaFill: HTMLElement;
  private level: HTMLElement;
  private time: HTMLElement;
  private kills: HTMLElement;
  private root: HTMLElement;
  private crosshair: HTMLElement;
  private announceEl: HTMLElement;
  private damageDirRot: HTMLElement;
  private damageArrow: HTMLElement;
  private announceTimer = 0;

  constructor() {
    this.root = el('hud');
    this.healthFill = el('hud-health-fill');
    this.healthText = el('hud-health-text');
    this.xpFill = el('hud-xp-fill');
    this.xpText = el('hud-xp-text');
    this.staminaFill = el('hud-stamina-fill');
    this.level = el('hud-level');
    this.time = el('hud-time');
    this.kills = el('hud-kills');
    this.crosshair = el('crosshair');
    this.announceEl = el('announce');
    this.damageDirRot = el('damage-dir-rot');
    this.damageArrow = el('damage-arrow');
  }

  setHealth(hp: number, maxHp: number): void {
    const ratio = Math.max(0, Math.min(1, hp / maxHp));
    this.healthFill.style.width = `${ratio * 100}%`;
    this.healthText.textContent = `${Math.ceil(hp)} / ${maxHp}`;
  }

  setXp(cur: number, next: number): void {
    const ratio = Math.max(0, Math.min(1, cur / next));
    this.xpFill.style.width = `${ratio * 100}%`;
    this.xpText.textContent = `${cur} / ${next}`;
  }

  setLevel(level: number): void {
    this.level.textContent = String(level);
  }

  setTime(seconds: number): void {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    this.time.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  setKills(kills: number): void {
    this.kills.textContent = String(kills);
  }

  setStamina(ratio: number): void {
    const r = Math.max(0, Math.min(1, ratio));
    this.staminaFill.style.width = `${r * 100}%`;
  }

  /** rel: 相对玩家朝向的角度（弧度），0=正前方，正值=右侧。 */
  showDamageDir(rel: number): void {
    this.damageDirRot.style.transform = `rotate(${rel}rad)`;
    this.damageArrow.classList.remove('active');
    void this.damageArrow.offsetWidth;
    this.damageArrow.classList.add('active');
  }

  announce(text: string): void {
    this.announceEl.textContent = text;
    this.announceEl.classList.remove('show');
    void this.announceEl.offsetWidth;
    this.announceEl.classList.add('show');
    window.clearTimeout(this.announceTimer);
    this.announceTimer = window.setTimeout(() => this.announceEl.classList.remove('show'), 2700);
  }

  show(): void {
    this.root.classList.remove('hidden');
    this.crosshair.classList.remove('hidden');
  }

  hide(): void {
    this.root.classList.add('hidden');
    this.crosshair.classList.add('hidden');
  }
}
