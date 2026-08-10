import * as THREE from 'three';
import { BALANCE, MAP, PLAYER } from '../config/constants';
import { ENEMY_TYPES, type EnemyConfig, type EnemyTypeId } from './enemyConfigs';
import { Enemy } from './Enemy';
import type { Player } from '../player/Player';

interface Pool {
  config: EnemyConfig;
  mesh: THREE.InstancedMesh;
  eyes: THREE.InstancedMesh;
  active: Map<number, Enemy>;
  free: number[];
  eyeFree: number[];
  eyeCount: number;
}

const FLASH_TIME = 0.12;
const FLASH_COLOR = new THREE.Color(2.5, 0.25, 0.25);
const WHITE = new THREE.Color(1, 1, 1);

export class EnemyManager {
  readonly enemies: Enemy[] = [];
  private pools = new Map<EnemyTypeId, Pool>();
  private aliveCount = 0;
  private spawnTimer = 1;
  private time = 0;
  private readonly playerPos = new THREE.Vector3();
  private readonly dummy = new THREE.Object3D();
  private readonly eyeDummy = new THREE.Object3D();
  private readonly tmpColor = new THREE.Color();
  onEnemyKilled?: (enemy: Enemy) => void;
  onEnemyDamaged?: (enemy: Enemy, amount: number) => void;

  constructor(scene: THREE.Scene) {
    for (const config of ENEMY_TYPES) {
      const material = new THREE.MeshStandardMaterial({
        color: config.color,
        roughness: 0.5,
        metalness: 0.1,
        emissive: new THREE.Color(config.color),
        emissiveIntensity: 1.4,
      });
      const mesh = new THREE.InstancedMesh(this.geometryFor(config), material, config.poolSize);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < config.poolSize; i++) {
        mesh.setColorAt(i, WHITE);
        this.hideInstance(mesh, i);
      }
      scene.add(mesh);

      const eyeGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2d2d });
      const eyes = new THREE.InstancedMesh(eyeGeo, eyeMat, config.poolSize * 2);
      eyes.count = 0;
      eyes.frustumCulled = false;
      eyes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < config.poolSize * 2; i++) {
        this.hideInstance(eyes, i);
      }
      scene.add(eyes);

      this.pools.set(config.id, {
        config,
        mesh,
        eyes,
        active: new Map(),
        free: Array.from({ length: config.poolSize }, (_, i) => i),
        eyeFree: Array.from({ length: config.poolSize * 2 }, (_, i) => i),
        eyeCount: 0,
      });
    }
  }

  update(dt: number, player: Player, playerPos: THREE.Vector3): void {
    this.time += dt;
    this.playerPos.copy(playerPos);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const batch = Math.min(BALANCE.SPAWN_BATCH_MAX, 1 + Math.floor(this.time / 25));
      for (let i = 0; i < batch; i++) this.trySpawn();
      const interval = Math.max(
        BALANCE.SPAWN_MIN_INTERVAL,
        BALANCE.SPAWN_START_INTERVAL - this.time * BALANCE.SPAWN_INTERVAL_DECAY
      );
      this.spawnTimer = interval;
    }
    for (const enemy of this.enemies) {
      this.updateEnemy(dt, enemy, player);
    }
  }

  getNearestEnemy(origin: THREE.Vector3, maxRange: number): Enemy | null {
    let best: Enemy | null = null;
    let bestD = maxRange * maxRange;
    for (const e of this.enemies) {
      if (e.dying) continue;
      const dx = e.pos.x - origin.x;
      const dz = e.pos.z - origin.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  queryInRadius(pos: THREE.Vector3, radius: number): Enemy[] {
    const out: Enemy[] = [];
    const rr = radius * radius;
    for (const e of this.enemies) {
      if (e.dying) continue;
      const dx = e.pos.x - pos.x;
      const dz = e.pos.z - pos.z;
      if (dx * dx + dz * dz <= rr) out.push(e);
    }
    return out;
  }

  queryInArc(pos: THREE.Vector3, range: number, yaw: number, halfAngle: number): Enemy[] {
    const out: Enemy[] = [];
    const rr = range * range;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const cosHalf = Math.cos(halfAngle);
    for (const e of this.enemies) {
      if (e.dying) continue;
      const dx = e.pos.x - pos.x;
      const dz = e.pos.z - pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > rr) continue;
      if (d2 < 1e-5) {
        out.push(e);
        continue;
      }
      const dot = (dx * fx + dz * fz) / Math.sqrt(d2);
      if (dot >= cosHalf) out.push(e);
    }
    return out;
  }

  hitProjectile(pos: THREE.Vector3, radius: number, damage: number): Enemy | null {
    let best: Enemy | null = null;
    let bestD = Infinity;
    for (const e of this.enemies) {
      if (e.dying) continue;
      const rr = e.radius + radius;
      const dx = e.pos.x - pos.x;
      const dz = e.pos.z - pos.z;
      const d = dx * dx + dz * dz;
      if (d > rr * rr) continue;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    if (best) this.applyDamage(best, damage);
    return best;
  }

  applyDamage(enemy: Enemy, amount: number): boolean {
    if (!enemy.active || enemy.dying) return false;
    enemy.hp -= amount;
    enemy.flashTimer = FLASH_TIME;
    this.onEnemyDamaged?.(enemy, amount);
    if (enemy.hp <= 0) {
      enemy.dying = true;
      enemy.dieT = 0;
      this.onEnemyKilled?.(enemy);
      return true;
    }
    return false;
  }

  forceSpawn(typeId: EnemyTypeId, count: number, nearPlayer: boolean): void {
    for (let i = 0; i < count; i++) {
      if (nearPlayer) this.trySpawnOfType(typeId, 14, 20);
      else this.trySpawnOfType(typeId, BALANCE.SPAWN_DIST_MIN, BALANCE.SPAWN_DIST_MAX);
    }
  }

  clear(): void {
    for (const pool of this.pools.values()) {
      pool.active.clear();
      pool.free = Array.from({ length: pool.config.poolSize }, (_, i) => i);
      pool.mesh.count = 0;
      pool.eyeFree = Array.from({ length: pool.config.poolSize * 2 }, (_, i) => i);
      pool.eyeCount = 0;
      pool.eyes.count = 0;
      for (let i = 0; i < pool.config.poolSize; i++) {
        this.hideInstance(pool.mesh, i);
        this.hideInstance(pool.eyes, i);
      }
    }
    this.enemies.length = 0;
    this.aliveCount = 0;
    this.time = 0;
    this.spawnTimer = 1;
  }

  private geometryFor(config: EnemyConfig): THREE.BufferGeometry {
    // 所有敌人统一为正方形方块（体素风），保证稳定可见、不依赖几何合并。
    const size = config.radius * 2;
    return new THREE.BoxGeometry(size, size, size).translate(0, size / 2, 0);
  }

  private trySpawn(): void {
    if (this.aliveCount >= BALANCE.MAX_ALIVE_ENEMIES) return;
    const config = this.pickType();
    this.trySpawnOfType(config.id, BALANCE.SPAWN_DIST_MIN, BALANCE.SPAWN_DIST_MAX);
  }

  private trySpawnOfType(typeId: EnemyTypeId, dMin: number, dMax: number): void {
    const pool = this.pools.get(typeId);
    if (!pool) return;
    if (pool.free.length === 0 || pool.eyeFree.length < 2) return;
    const slot = pool.free.shift()!;
    const pos = this.randomSpawnPos(dMin, dMax);
    if (!pos) {
      pool.free.push(slot);
      return;
    }
    const scale = pool.config.scale * (0.85 + Math.random() * 0.3);
    const enemy = new Enemy(
      pool.config,
      slot,
      pool.config.hp * this.hpMult(),
      pool.config.speed,
      pool.config.damage,
      pool.config.xp,
      scale
    );
    enemy.pos.copy(pos);
    enemy.eyeA = pool.eyeFree.pop()!;
    enemy.eyeB = pool.eyeFree.pop()!;
    pool.eyeCount += 2;
    pool.eyes.count = pool.eyeCount;
    pool.active.set(slot, enemy);
    this.enemies.push(enemy);
    this.aliveCount++;
    pool.mesh.count = pool.active.size;
    this.writeInstance(pool, enemy, 1);
  }

  private randomSpawnPos(dMin: number, dMax: number): THREE.Vector3 | null {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = dMin + Math.random() * (dMax - dMin);
      const x = THREE.MathUtils.clamp(
        this.playerPos.x + Math.cos(angle) * dist,
        -MAP.HALF_SIZE + 2,
        MAP.HALF_SIZE - 2
      );
      const z = THREE.MathUtils.clamp(
        this.playerPos.z + Math.sin(angle) * dist,
        -MAP.HALF_SIZE + 2,
        MAP.HALF_SIZE - 2
      );
      const dx = x - this.playerPos.x;
      const dz = z - this.playerPos.z;
      if (dx * dx + dz * dz > dMin * dMin) return new THREE.Vector3(x, 0, z);
    }
    return null;
  }

  private pickType(): EnemyConfig {
    const available = ENEMY_TYPES.filter((c) => c.unlockAt <= this.time);
    const total = available.reduce((s, c) => s + c.weight, 0);
    let r = Math.random() * total;
    for (const c of available) {
      r -= c.weight;
      if (r <= 0) return c;
    }
    return available[available.length - 1];
  }

  private hpMult(): number {
    return 1 + (this.time / 60) * BALANCE.HP_SCALE_PER_MIN;
  }

  private updateEnemy(dt: number, enemy: Enemy, player: Player): void {
    const pool = this.pools.get(enemy.config.id)!;
    enemy.flashTimer = Math.max(0, enemy.flashTimer - dt);

    if (enemy.dying) {
      enemy.dieT += dt;
      if (enemy.dieT >= BALANCE.ENEMY_DIE_TIME) {
        this.release(enemy, pool);
        return;
      }
      this.writeInstance(pool, enemy, 1 - enemy.dieT / BALANCE.ENEMY_DIE_TIME);
      return;
    }

    enemy.hitCooldown = Math.max(0, enemy.hitCooldown - dt);
    const dx = this.playerPos.x - enemy.pos.x;
    const dz = this.playerPos.z - enemy.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.001) {
      enemy.yaw = Math.atan2(dx, dz);
      enemy.wobblePhase += dt * 2.4;
      const wobble = Math.sin(enemy.wobblePhase) * 0.35 * dt;
      enemy.pos.x += ((dx / dist) * enemy.speed + (-dz / dist) * wobble) * dt;
      enemy.pos.z += ((dz / dist) * enemy.speed + (dx / dist) * wobble) * dt;
    }
    if (dist < enemy.radius + PLAYER.RADIUS + 0.2 && enemy.hitCooldown <= 0) {
      enemy.hitCooldown = BALANCE.CONTACT_DAMAGE_INTERVAL;
      player.takeDamage(enemy.damage, enemy.pos);
    }
    this.writeInstance(pool, enemy, 1);
  }

  private writeInstance(pool: Pool, enemy: Enemy, scaleMul: number): void {
    const mesh = pool.mesh;
    const s = enemy.scale * scaleMul;
    this.dummy.position.set(enemy.pos.x, 0, enemy.pos.z);
    this.dummy.rotation.set(0, enemy.yaw, 0);
    this.dummy.scale.set(s, s, s);
    this.dummy.updateMatrix();
    mesh.setMatrixAt(enemy.slot, this.dummy.matrix);

    const flash = enemy.flashTimer > 0 ? Math.min(1, enemy.flashTimer / FLASH_TIME) : 0;
    const color = this.tmpColor.copy(FLASH_COLOR).lerp(WHITE, 1 - flash);
    mesh.setColorAt(enemy.slot, color);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    this.writeEyes(pool, enemy, s);
  }

  private writeEyes(pool: Pool, enemy: Enemy, s: number): void {
    const yaw = enemy.yaw;
    const c = Math.cos(yaw);
    const sn = Math.sin(yaw);
    const h = 0.2 * s;
    const f = 0.32 * s;
    const ey = 0.72 * s;
    const x = enemy.pos.x;
    const z = enemy.pos.z;
    this.eyeDummy.position.set(x - h * c + f * sn, ey, z + h * sn + f * c);
    this.eyeDummy.rotation.set(0, yaw, 0);
    this.eyeDummy.scale.setScalar(s);
    this.eyeDummy.updateMatrix();
    pool.eyes.setMatrixAt(enemy.eyeA, this.eyeDummy.matrix);
    this.eyeDummy.position.set(x + h * c + f * sn, ey, z - h * sn + f * c);
    this.eyeDummy.updateMatrix();
    pool.eyes.setMatrixAt(enemy.eyeB, this.eyeDummy.matrix);
    pool.eyes.instanceMatrix.needsUpdate = true;
  }

  private release(enemy: Enemy, pool: Pool): void {
    pool.active.delete(enemy.slot);
    pool.free.push(enemy.slot);
    pool.eyeFree.push(enemy.eyeA);
    pool.eyeFree.push(enemy.eyeB);
    pool.eyeCount -= 2;
    pool.eyes.count = pool.eyeCount;
    const i = this.enemies.indexOf(enemy);
    if (i >= 0) this.enemies.splice(i, 1);
    this.aliveCount--;
    pool.mesh.count = pool.active.size;
    this.hideInstance(pool.mesh, enemy.slot);
    this.hideInstance(pool.eyes, enemy.eyeA);
    this.hideInstance(pool.eyes, enemy.eyeB);
  }

  private hideInstance(mesh: THREE.InstancedMesh, slot: number): void {
    this.dummy.position.set(0, -100, 0);
    this.dummy.scale.setScalar(0.001);
    this.dummy.updateMatrix();
    mesh.setMatrixAt(slot, this.dummy.matrix);
    mesh.instanceMatrix.needsUpdate = true;
  }
}
