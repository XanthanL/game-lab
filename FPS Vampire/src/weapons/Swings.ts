import * as THREE from 'three';

interface Swing {
  active: boolean;
  pos: THREE.Vector3;
  yaw: number;
  life: number;
  maxLife: number;
  slot: number;
}

export class Swings {
  private mesh: THREE.InstancedMesh;
  private swings: Swing[] = [];
  private free: number[] = [];
  private capacity = 8;
  private readonly dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene) {
    const geometry = new THREE.RingGeometry(1.0, 3.4, 14, 1, -1.55, 3.1);
    geometry.rotateX(-Math.PI / 2);
    geometry.rotateY(Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff8a8a,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, this.capacity);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);
    for (let i = 0; i < this.capacity; i++) {
      this.swings.push({ active: false, pos: new THREE.Vector3(), yaw: 0, life: 0, maxLife: 1, slot: i });
      this.free.push(i);
    }
  }

  spawn(pos: THREE.Vector3, yaw: number): void {
    if (this.free.length === 0) return;
    const slot = this.free.pop()!;
    const s = this.swings[slot];
    s.active = true;
    s.pos.copy(pos);
    s.yaw = yaw;
    s.maxLife = 0.18;
    s.life = s.maxLife;
    this.mesh.count++;
    this.write(s);
  }

  update(dt: number): void {
    for (const s of this.swings) {
      if (!s.active) continue;
      s.life -= dt;
      if (s.life <= 0) {
        this.release(s);
        continue;
      }
      this.write(s);
    }
  }

  clear(): void {
    this.free = [];
    for (let i = 0; i < this.capacity; i++) {
      this.swings[i].active = false;
      this.free.push(i);
    }
    this.mesh.count = 0;
  }

  private write(s: Swing): void {
    const k = s.life / s.maxLife;
    const scale = 0.6 + 0.5 * k;
    this.dummy.position.set(s.pos.x, 0.14, s.pos.z);
    this.dummy.rotation.set(0, s.yaw, 0);
    this.dummy.scale.set(scale, 1, scale);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(s.slot, this.dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private release(s: Swing): void {
    s.active = false;
    this.free.push(s.slot);
    this.mesh.count--;
    this.dummy.position.set(0, -100, 0);
    this.dummy.scale.setScalar(0.001);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(s.slot, this.dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
