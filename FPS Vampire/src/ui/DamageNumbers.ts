import * as THREE from 'three';

interface DmgItem {
  el: HTMLElement;
  active: boolean;
  pos: THREE.Vector3;
  life: number;
  maxLife: number;
}

export class DamageNumbers {
  private items: DmgItem[] = [];
  private readonly max = 80;
  private readonly tmp = new THREE.Vector3();

  constructor(container: HTMLElement) {
    for (let i = 0; i < this.max; i++) {
      const el = document.createElement('div');
      el.className = 'dmg-num';
      el.style.display = 'none';
      container.appendChild(el);
      this.items.push({ el, active: false, pos: new THREE.Vector3(), life: 0, maxLife: 1 });
    }
  }

  show(pos: THREE.Vector3, text: string, cls = ''): void {
    const item = this.items.find((x) => !x.active);
    if (!item) return;
    item.active = true;
    item.pos.copy(pos);
    item.maxLife = 0.7;
    item.life = item.maxLife;
    item.el.textContent = text;
    item.el.className = `dmg-num${cls ? ` ${cls}` : ''}`;
    item.el.style.display = 'block';
  }

  update(dt: number, camera: THREE.PerspectiveCamera): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (const item of this.items) {
      if (!item.active) continue;
      item.life -= dt;
      if (item.life <= 0) {
        item.active = false;
        item.el.style.display = 'none';
        continue;
      }
      this.tmp.copy(item.pos).project(camera);
      if (this.tmp.z > 1) {
        item.el.style.display = 'none';
        continue;
      }
      const k = item.life / item.maxLife;
      item.el.style.left = `${(this.tmp.x * 0.5 + 0.5) * w}px`;
      item.el.style.top = `${(-this.tmp.y * 0.5 + 0.5) * h}px`;
      item.el.style.opacity = String(Math.min(1, k * 1.6));
      item.el.style.transform = `translate(-50%, -50%) translateY(${-(1 - k) * 26}px)`;
    }
  }

  clear(): void {
    for (const item of this.items) {
      item.active = false;
      item.el.style.display = 'none';
    }
  }
}
