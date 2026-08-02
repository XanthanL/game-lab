import * as THREE from 'three';
import { BALANCE } from '../config/constants';
import type { Player } from '../player/Player';
import type { Particles } from '../engine/Particles';
import { sound } from '../audio/SoundManager';

interface XpGem {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  xp: number;
  slot: number;
  phase: number;
}

export class XpSystem {
  private mesh: THREE.InstancedMesh;
  private gems: XpGem[] = [];
  private free: number[] = [];
  private capacity: number;
  private readonly dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene, private particles: Particles) {
    this.capacity = BALANCE.GEM_CAPACITY;
    const geometry = new THREE.OctahedronGeometry(0.2, 0);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffe066,
      emissive: 0xffa500,
      emissiveIntensity: 1.5,
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, this.capacity);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);
    for (let i = 0; i < this.capacity; i++) {
      this.gems.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        xp: 0,
        slot: i,
        phase: Math.random() * Math.PI * 2,
      });
      this.free.push(i);
    }
  }

  drop(pos: THREE.Vector3, xp: number): void {
    if (this.free.length === 0) return;
    const slot = this.free.pop()!;
    const g = this.gems[slot];
    g.active = true;
    g.pos.copy(pos);
    g.vel.set((Math.random() - 0.5) * 1.5, 0, (Math.random() - 0.5) * 1.5);
    g.xp = xp;
    this.mesh.count++;
    this.write(g);
  }

  update(dt: number, player: Player, playerPos: THREE.Vector3, magnetRadius: number): void {
    for (const g of this.gems) {
      if (!g.active) continue;
      g.phase += dt * 3;
      const dx = playerPos.x - g.pos.x;
      const dz = playerPos.z - g.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < BALANCE.GEM_PICKUP_RADIUS) {
        player.xp += g.xp;
        this.particles.burst(g.pos, 0xffe066, 6, 2.5, 0.4, 0.12, 1.4);
        sound.play('pickup');
        this.release(g);
        continue;
      }
      if (dist < magnetRadius && dist > 0.01) {
        g.pos.x += (dx / dist) * 10 * dt;
        g.pos.z += (dz / dist) * 10 * dt;
      } else {
        g.pos.addScaledVector(g.vel, dt);
        g.vel.multiplyScalar(Math.max(0, 1 - 3 * dt));
      }
      this.write(g);
    }
  }

  clear(): void {
    this.free = [];
    for (let i = 0; i < this.capacity; i++) {
      this.gems[i].active = false;
      this.free.push(i);
    }
    this.mesh.count = 0;
  }

  private write(g: XpGem): void {
    this.dummy.position.set(g.pos.x, 0.35 + Math.sin(g.phase) * 0.12, g.pos.z);
    this.dummy.rotation.set(0, g.phase * 1.5, 0);
    this.dummy.scale.setScalar(1);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(g.slot, this.dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private release(g: XpGem): void {
    g.active = false;
    this.free.push(g.slot);
    this.mesh.count--;
    this.dummy.position.set(0, -100, 0);
    this.dummy.scale.setScalar(0.001);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(g.slot, this.dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
