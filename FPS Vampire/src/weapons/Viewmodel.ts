import * as THREE from 'three';

export interface ViewmodelState {
  moving: boolean;
  sprinting: boolean;
  airborne: boolean;
}

/**
 * 第一人称手持武器视图模型（我的世界方块风）。
 * 一只由方块拼出的手，握住一支体素法杖：
 * - 木柄（棕方块）+ 金属护手横档 + 顶端发光水晶方块（强调色）。
 * - 走路摆动、冲刺下沉、跳跃上抬、开火后坐力，水晶颜色随当前武器切换。
 */
export class Viewmodel {
  readonly root = new THREE.Group();
  private readonly crystalMat: THREE.MeshStandardMaterial;
  private readonly glowLight: THREE.PointLight;
  private readonly basePos = new THREE.Vector3(0.26, -0.22, -0.55);
  private walkPhase = 0;
  private kickT = 0;

  constructor(camera: THREE.PerspectiveCamera) {
    this.crystalMat = new THREE.MeshStandardMaterial({
      color: 0x66ccff,
      emissive: 0x66ccff,
      emissiveIntensity: 1.3,
      roughness: 0.3,
      metalness: 0.1,
    });
    this.glowLight = new THREE.PointLight(0x66ccff, 0.8, 4, 2);

    const skin = new THREE.MeshStandardMaterial({ color: 0xe0ad88, roughness: 0.8 });
    const sleeve = new THREE.MeshStandardMaterial({ color: 0x3a4a6b, roughness: 0.9 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.7 });
    const guardMat = new THREE.MeshStandardMaterial({ color: 0x9aa0ad, roughness: 0.4, metalness: 0.8 });

    const box = (w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh =>
      new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

    // 手臂 + 手（方块拼出，像 Minecraft 的角色手）
    const sleeveMesh = box(0.16, 0.16, 0.22, sleeve);
    sleeveMesh.position.set(0.12, 0.14, 0.18);
    sleeveMesh.rotation.set(0.35, 0, -0.6);

    const forearm = box(0.13, 0.13, 0.42, skin);
    forearm.position.set(0.05, 0.05, -0.02);
    forearm.rotation.set(0.35, 0, -0.6);

    const palm = box(0.14, 0.13, 0.16, skin);
    palm.position.set(0, 0, -0.18);

    const fingerGeo = box(0.03, 0.03, 0.1, skin);
    const fingers = [
      [0.045, -0.02, -0.28],
      [0.015, -0.03, -0.29],
      [-0.015, -0.03, -0.29],
      [-0.045, -0.02, -0.28],
    ].map(([x, y, z]) => {
      const f = fingerGeo.clone();
      f.position.set(x, y, z);
      return f;
    });

    // 体素法杖：木柄 + 护手横档 + 顶端发光水晶
    const staff = new THREE.Group();
    staff.position.set(0.0, 0.0, -0.16);
    staff.rotation.set(-0.35, 0, 0);

    const handle = box(0.07, 0.7, 0.07, wood);
    handle.position.set(0, 0.16, 0);

    const guard = box(0.28, 0.06, 0.07, guardMat);
    guard.position.set(0, 0.0, 0);

    const crystal = box(0.17, 0.17, 0.17, this.crystalMat);
    crystal.position.set(0, 0.46, 0);
    this.glowLight.position.copy(crystal.position);

    const tip = box(0.07, 0.1, 0.07, guardMat);
    tip.position.set(0, 0.58, 0);

    staff.add(handle, guard, crystal, tip, this.glowLight);

    const parts: THREE.Object3D[] = [sleeveMesh, forearm, palm, ...fingers, staff];
    for (const p of parts) {
      p.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.renderOrder = 999;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.depthTest = false;
        mat.depthWrite = false;
        mat.fog = false;
      });
      this.root.add(p);
    }

    this.root.position.copy(this.basePos);
    this.root.visible = false;
    camera.add(this.root);
  }

  setAccent(color: number): void {
    this.crystalMat.color.setHex(color);
    this.crystalMat.emissive.setHex(color);
    this.glowLight.color.setHex(color);
  }

  kick(): void {
    this.kickT = 1;
  }

  setVisible(v: boolean): void {
    this.root.visible = v;
  }

  update(dt: number, state: ViewmodelState): void {
    this.kickT = Math.max(0, this.kickT - dt * 6);
    if (state.moving) this.walkPhase += dt * (state.sprinting ? 15 : 10);

    const bobY = state.moving ? Math.sin(this.walkPhase) * (state.sprinting ? 0.05 : 0.03) : 0;
    const bobX = state.moving ? Math.cos(this.walkPhase * 0.5) * (state.sprinting ? 0.03 : 0.02) : 0;
    const sprintDrop = state.sprinting ? 0.13 : 0;
    const airLift = state.airborne ? 0.07 : 0;
    const recoilZ = this.kickT * 0.14;
    const recoilPitch = this.kickT * 0.28;

    this.root.position.set(
      this.basePos.x + bobX,
      this.basePos.y - sprintDrop + airLift + bobY,
      this.basePos.z + recoilZ
    );
    this.root.rotation.set(
      recoilPitch + (state.airborne ? 0.05 : 0),
      0,
      state.sprinting ? 0.22 : 0
    );

    const pulse = 1.2 + Math.sin(performance.now() * 0.004) * 0.3;
    this.crystalMat.emissiveIntensity = pulse;
    this.glowLight.intensity = 0.7 + this.kickT * 0.9;
  }
}
