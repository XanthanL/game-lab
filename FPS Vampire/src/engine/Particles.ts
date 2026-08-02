import * as THREE from 'three';

interface Particle {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  slot: number;
}

export class Particles {
  private mesh: THREE.InstancedMesh;
  private particles: Particle[] = [];
  private free: number[] = [];
  private capacity: number;
  private readonly dummy = new THREE.Object3D();
  private readonly tmpColor = new THREE.Color();

  constructor(scene: THREE.Scene, capacity = 320) {
    this.capacity = capacity;
    const geometry = new THREE.IcosahedronGeometry(1, 0);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);
    for (let i = 0; i < capacity; i++) {
      this.particles.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        size: 0.1,
        slot: i,
      });
      this.free.push(i);
    }
  }

  burst(
    pos: THREE.Vector3,
    color: number,
    count: number,
    speed: number,
    life: number,
    size: number,
    upBias = 0
  ): void {
    for (let i = 0; i < count; i++) {
      if (this.free.length === 0) return;
      const slot = this.free.pop()!;
      const p = this.particles[slot];
      p.active = true;
      p.pos.copy(pos);
      const theta = Math.random() * Math.PI * 2;
      const r = speed * (0.4 + Math.random() * 0.6);
      p.vel.set(Math.cos(theta) * r, upBias + Math.random() * speed * 0.6, Math.sin(theta) * r);
      p.maxLife = life * (0.6 + Math.random() * 0.6);
      p.life = p.maxLife;
      p.size = size * (0.6 + Math.random() * 0.8);
      this.mesh.count++;
      this.mesh.setColorAt(slot, this.tmpColor.setHex(color));
      this.write(p);
    }
  }

  update(dt: number): void {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      p.pos.addScaledVector(p.vel, dt);
      p.vel.y -= dt * 3;
      if (p.life <= 0) {
        this.release(p);
        continue;
      }
      this.write(p);
    }
  }

  clear(): void {
    this.free = [];
    for (let i = 0; i < this.capacity; i++) {
      this.particles[i].active = false;
      this.free.push(i);
    }
    this.mesh.count = 0;
  }

  private write(p: Particle): void {
    const s = p.size * (p.life / p.maxLife);
    this.dummy.position.copy(p.pos);
    this.dummy.rotation.set(0, 0, 0);
    this.dummy.scale.setScalar(Math.max(0.001, s));
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(p.slot, this.dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  private release(p: Particle): void {
    p.active = false;
    this.free.push(p.slot);
    this.mesh.count--;
    this.dummy.position.set(0, -100, 0);
    this.dummy.scale.setScalar(0.001);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(p.slot, this.dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
