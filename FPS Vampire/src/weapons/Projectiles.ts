import * as THREE from 'three';
import { BALANCE } from '../config/constants';
import type { Enemy } from '../enemies/Enemy';
import type { EnemyManager } from '../enemies/EnemyManager';

type ProjKind = 'linear' | 'boomerang';

interface ProjItem {
  active: boolean;
  slot: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  damage: number;
  radius: number;
  life: number;
  pierce: number;
  origin: THREE.Vector3;
  range: number;
  returning: boolean;
  hits: Enemy[];
  phase: number;
}

interface PoolDef {
  kind: ProjKind;
  mesh: THREE.InstancedMesh;
  free: number[];
  items: ProjItem[];
  count: number;
}

export class Projectiles {
  private pools: PoolDef[] = [];
  private readonly dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene, private enemies: EnemyManager) {
    this.addPool(scene, 'linear', this.boltGeometry(), this.boltMaterial(), BALANCE.PROJECTILE_CAPACITY);
    this.addPool(scene, 'boomerang', this.bladeGeometry(), this.bladeMaterial(), 24);
  }

  spawnLinear(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    speed: number,
    damage: number,
    pierce: number,
    range: number,
    radius: number
  ): void {
    const pool = this.pools[0];
    const slot = pool.free.pop();
    if (slot === undefined) return;
    const p = pool.items[slot];
    p.active = true;
    p.pos.copy(origin);
    p.vel.copy(dir).multiplyScalar(speed);
    p.damage = damage;
    p.pierce = pierce;
    p.radius = radius;
    p.life = range / speed;
    p.returning = false;
    p.phase = 0;
    pool.count++;
    this.write(pool, p);
  }

  spawnBoomerang(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    speed: number,
    damage: number,
    range: number,
    radius: number
  ): void {
    const pool = this.pools[1];
    const slot = pool.free.pop();
    if (slot === undefined) return;
    const p = pool.items[slot];
    p.active = true;
    p.pos.copy(origin);
    p.vel.copy(dir).multiplyScalar(speed);
    p.damage = damage;
    p.radius = radius;
    p.life = 8;
    p.origin.copy(origin);
    p.range = range;
    p.returning = false;
    p.hits.length = 0;
    p.phase = 0;
    pool.count++;
    this.write(pool, p);
  }

  update(dt: number): void {
    for (const pool of this.pools) {
      for (const p of pool.items) {
        if (!p.active) continue;
        if (pool.kind === 'boomerang') this.updateBoomerang(dt, pool, p);
        else this.updateLinear(dt, pool, p);
      }
    }
  }

  clear(): void {
    for (const pool of this.pools) {
      pool.free = [];
      for (let i = 0; i < pool.items.length; i++) {
        pool.items[i].active = false;
        pool.free.push(i);
      }
      pool.count = 0;
      pool.mesh.count = 0;
    }
  }

  private addPool(scene: THREE.Scene, kind: ProjKind, geometry: THREE.BufferGeometry, material: THREE.Material, capacity: number): void {
    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
    const items: ProjItem[] = [];
    const free: number[] = [];
    for (let i = 0; i < capacity; i++) {
      items.push({
        active: false,
        slot: i,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        damage: 0,
        radius: 0,
        life: 0,
        pierce: 0,
        origin: new THREE.Vector3(),
        range: 0,
        returning: false,
        hits: [],
        phase: 0,
      });
      free.push(i);
    }
    this.pools.push({ kind, mesh, free, items, count: 0 });
  }

  private updateLinear(dt: number, pool: PoolDef, p: ProjItem): void {
    p.life -= dt;
    p.pos.addScaledVector(p.vel, dt);
    let dead = p.life <= 0;
    if (!dead) {
      const hit = this.enemies.hitProjectile(p.pos, p.radius, p.damage);
      if (hit) {
        p.pierce--;
        dead = p.pierce < 0;
      }
    }
    if (dead) {
      this.release(pool, p);
      return;
    }
    this.write(pool, p);
  }

  private updateBoomerang(dt: number, pool: PoolDef, p: ProjItem): void {
    p.life -= dt;
    if (p.life <= 0) {
      this.release(pool, p);
      return;
    }
    p.phase += dt * 12;
    p.pos.addScaledVector(p.vel, dt);
    if (!p.returning) {
      if (p.pos.distanceToSquared(p.origin) >= p.range * p.range) {
        p.returning = true;
        p.vel.copy(p.origin).sub(p.pos).normalize().multiplyScalar(p.vel.length() * 1.5);
      }
    } else if (p.pos.distanceToSquared(p.origin) < 0.8) {
      this.release(pool, p);
      return;
    }
    for (const e of this.enemies.queryInRadius(p.pos, p.radius)) {
      if (!p.hits.includes(e)) {
        p.hits.push(e);
        this.enemies.applyDamage(e, p.damage);
      }
    }
    this.write(pool, p);
  }

  private write(pool: PoolDef, p: ProjItem): void {
    this.dummy.position.copy(p.pos);
    this.dummy.rotation.set(0, 0, p.phase);
    this.dummy.scale.setScalar(1);
    this.dummy.updateMatrix();
    pool.mesh.setMatrixAt(p.slot, this.dummy.matrix);
    pool.mesh.instanceMatrix.needsUpdate = true;
  }

  private release(pool: PoolDef, p: ProjItem): void {
    p.active = false;
    pool.free.push(p.slot);
    pool.count--;
    pool.mesh.count = pool.count;
    this.dummy.position.set(0, -100, 0);
    this.dummy.scale.setScalar(0.001);
    this.dummy.updateMatrix();
    pool.mesh.setMatrixAt(p.slot, this.dummy.matrix);
    pool.mesh.instanceMatrix.needsUpdate = true;
  }

  private boltGeometry(): THREE.BufferGeometry {
    return new THREE.IcosahedronGeometry(0.2, 0);
  }

  private boltMaterial(): THREE.Material {
    return new THREE.MeshStandardMaterial({
      color: 0xffc94d,
      emissive: 0xff9d00,
      emissiveIntensity: 2,
    });
  }

  private bladeGeometry(): THREE.BufferGeometry {
    return new THREE.BoxGeometry(0.16, 0.08, 1).translate(0, 1, 0);
  }

  private bladeMaterial(): THREE.Material {
    return new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.2,
    });
  }
}
