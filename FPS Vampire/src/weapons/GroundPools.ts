import * as THREE from 'three';
import type { EnemyManager } from '../enemies/EnemyManager';

interface PoolItem {
  active: boolean;
  pos: THREE.Vector3;
  radius: number;
  life: number;
  maxLife: number;
  age: number;
  tick: number;
  tickTimer: number;
  damage: number;
  slot: number;
}

export class GroundPools {
  private mesh: THREE.InstancedMesh;
  private items: PoolItem[] = [];
  private free: number[] = [];
  private capacity = 24;
  private readonly dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene, private enemies: EnemyManager) {
    const geometry = new THREE.CylinderGeometry(1, 1, 0.05, 24);
    const material = new THREE.MeshStandardMaterial({
      color: 0x7c3aed,
      emissive: 0x6d28d9,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, this.capacity);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);
    for (let i = 0; i < this.capacity; i++) {
      this.items.push({
        active: false,
        pos: new THREE.Vector3(),
        radius: 0,
        life: 0,
        maxLife: 1,
        age: 0,
        tick: 0.4,
        tickTimer: 0,
        damage: 0,
        slot: i,
      });
      this.free.push(i);
    }
  }

  spawn(pos: THREE.Vector3, radius: number, duration: number, tick: number, damage: number): void {
    if (this.free.length === 0) return;
    const slot = this.free.pop()!;
    const it = this.items[slot];
    it.active = true;
    it.pos.copy(pos);
    it.radius = radius;
    it.maxLife = duration;
    it.life = duration;
    it.age = 0;
    it.tick = tick;
    it.tickTimer = 0;
    it.damage = damage;
    this.mesh.count++;
    this.write(it);
  }

  update(dt: number): void {
    for (const it of this.items) {
      if (!it.active) continue;
      it.life -= dt;
      it.age += dt;
      it.tickTimer -= dt;
      if (it.tickTimer <= 0) {
        it.tickTimer = it.tick;
        for (const e of this.enemies.queryInRadius(it.pos, it.radius)) {
          this.enemies.applyDamage(e, it.damage);
        }
      }
      if (it.life <= 0) {
        this.release(it);
        continue;
      }
      this.write(it);
    }
  }

  clear(): void {
    this.free = [];
    for (let i = 0; i < this.capacity; i++) {
      this.items[i].active = false;
      this.free.push(i);
    }
    this.mesh.count = 0;
  }

  private write(it: PoolItem): void {
    const growth = Math.min(1, it.age / 0.2);
    const fade = it.life < 0.5 ? it.life / 0.5 : 1;
    const s = growth * fade;
    this.dummy.position.set(it.pos.x, 0.06, it.pos.z);
    this.dummy.rotation.set(0, 0, 0);
    this.dummy.scale.set(it.radius * s, 1, it.radius * s);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(it.slot, this.dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private release(it: PoolItem): void {
    it.active = false;
    this.free.push(it.slot);
    this.mesh.count--;
    this.dummy.position.set(0, -100, 0);
    this.dummy.scale.setScalar(0.001);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(it.slot, this.dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
