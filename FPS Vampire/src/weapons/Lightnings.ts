import * as THREE from 'three';

interface Bolt {
  active: boolean;
  pos: THREE.Vector3;
  life: number;
  slot: number;
}

export class Lightnings {
  private mesh: THREE.InstancedMesh;
  private bolts: Bolt[] = [];
  private free: number[] = [];
  private capacity = 16;
  private readonly dummy = new THREE.Object3D();
  private static readonly DURATION = 0.16;

  constructor(scene: THREE.Scene) {
    const geometry = new THREE.CylinderGeometry(0.09, 0.09, 5, 5);
    const material = new THREE.MeshBasicMaterial({
      color: 0xbfdbfe,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, this.capacity);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);
    for (let i = 0; i < this.capacity; i++) {
      this.bolts.push({ active: false, pos: new THREE.Vector3(), life: 0, slot: i });
      this.free.push(i);
    }
  }

  spawn(pos: THREE.Vector3): void {
    if (this.free.length === 0) return;
    const slot = this.free.pop()!;
    const b = this.bolts[slot];
    b.active = true;
    b.pos.copy(pos);
    b.pos.y = 0;
    b.life = Lightnings.DURATION;
    this.mesh.count++;
    this.write(b);
  }

  update(dt: number): void {
    for (const b of this.bolts) {
      if (!b.active) continue;
      b.life -= dt;
      if (b.life <= 0) {
        this.release(b);
        continue;
      }
      this.write(b);
    }
  }

  clear(): void {
    this.free = [];
    for (let i = 0; i < this.capacity; i++) {
      this.bolts[i].active = false;
      this.free.push(i);
    }
    this.mesh.count = 0;
  }

  private write(b: Bolt): void {
    const s = b.life / Lightnings.DURATION;
    this.dummy.position.set(b.pos.x, 2.5 * s, b.pos.z);
    this.dummy.rotation.set(0, 0, 0);
    this.dummy.scale.set(s, s, s);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(b.slot, this.dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private release(b: Bolt): void {
    b.active = false;
    this.free.push(b.slot);
    this.mesh.count--;
    this.dummy.position.set(0, -100, 0);
    this.dummy.scale.setScalar(0.001);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(b.slot, this.dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
