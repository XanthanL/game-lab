import * as THREE from 'three';

export interface ViewmodelState {
  moving: boolean;
  sprinting: boolean;
  airborne: boolean;
}

type WeaponId = 'magicBolt' | 'soulBlade' | 'holyWater' | 'lightning' | 'whip';

interface WeaponModel {
  group: THREE.Group;
  accentMats: THREE.MeshStandardMaterial[];
  /** 发光部件在 root 空间的坐标（用于定位共享点光源） */
  accentAnchor: THREE.Vector3;
}

/**
 * 第一人称手持武器视图模型（我的世界方块风）。
 * 每类武器有独立体素模型，切换武器时整体替换；发光部件颜色随当前武器强调色变化。
 * 包含一只方块手（手掌+手指+袖子），握住武器握把。
 */
export class Viewmodel {
  readonly root = new THREE.Group();
  private readonly models = new Map<WeaponId, WeaponModel>();
  private active: WeaponId = 'magicBolt';
  private accent = 0x66ccff;
  /** 握把在 root 空间的位置——手与武器都钉在这里 */
  private readonly grip = new THREE.Vector3(0, -0.03, -0.15);
  private readonly basePos = new THREE.Vector3(0.26, -0.22, -0.55);
  private walkPhase = 0;
  private kickT = 0;
  private readonly glowLight: THREE.PointLight;

  private readonly skin: THREE.MeshStandardMaterial;
  private readonly sleeve: THREE.MeshStandardMaterial;
  private readonly wood: THREE.MeshStandardMaterial;
  private readonly metal: THREE.MeshStandardMaterial;
  private readonly steel: THREE.MeshStandardMaterial;
  private readonly glass: THREE.MeshStandardMaterial;

  constructor(camera: THREE.PerspectiveCamera) {
    this.skin = new THREE.MeshStandardMaterial({ color: 0xe0ad88, roughness: 0.85 });
    this.sleeve = new THREE.MeshStandardMaterial({ color: 0x3a4a6b, roughness: 0.9 });
    this.wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.7 });
    this.metal = new THREE.MeshStandardMaterial({ color: 0x9aa0ad, roughness: 0.4, metalness: 0.85 });
    this.steel = new THREE.MeshStandardMaterial({ color: 0xcdd6e6, roughness: 0.35, metalness: 0.6 });
    this.glass = new THREE.MeshStandardMaterial({
      color: 0xbfe6ff,
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      opacity: 0.4,
    });

    this.glowLight = new THREE.PointLight(this.accent, 0.8, 4, 2);

    // 方块手（只建一次，固定在握把处）
    const hand = this.buildHand();
    hand.position.copy(this.grip);
    this.root.add(hand);

    // 五把武器的独立体素模型
    this.models.set('magicBolt', this.buildStaff());
    this.models.set('soulBlade', this.buildSword());
    this.models.set('holyWater', this.buildVial());
    this.models.set('lightning', this.buildTotem());
    this.models.set('whip', this.buildFlail());

    for (const m of this.models.values()) {
      m.group.position.copy(this.grip);
      m.group.visible = false;
      m.group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.depthTest = false;
        mat.depthWrite = false;
        mat.fog = false;
        mesh.renderOrder = 999;
      });
      this.root.add(m.group);
    }

    this.glowLight.position.copy(this.models.get(this.active)!.accentAnchor);
    this.root.add(this.glowLight);

    this.setWeapon('magicBolt');
    this.root.position.copy(this.basePos);
    this.root.visible = false;
    camera.add(this.root);
  }

  private box(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
    return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  }

  /** 一只方块手：袖子 + 前臂 + 手掌 + 四指，局部坐标已对齐到握把原点。 */
  private buildHand(): THREE.Group {
    const g = new THREE.Group();

    const sleeveMesh = this.box(0.16, 0.16, 0.22, this.sleeve);
    sleeveMesh.position.set(0.12, 0.17, 0.33);
    sleeveMesh.rotation.set(0.35, 0, -0.6);

    const forearm = this.box(0.13, 0.13, 0.42, this.skin);
    forearm.position.set(0.05, 0.08, 0.13);
    forearm.rotation.set(0.35, 0, -0.6);

    const palm = this.box(0.14, 0.13, 0.16, this.skin);
    palm.position.set(0, 0.03, -0.03);

    const fingerGeo = this.box(0.03, 0.03, 0.1, this.skin);
    const fingers: Array<[number, number, number]> = [
      [0.045, 0.01, -0.13],
      [0.015, 0.0, -0.14],
      [-0.015, 0.0, -0.14],
      [-0.045, 0.01, -0.13],
    ];
    for (const [x, y, z] of fingers) {
      const f = fingerGeo.clone();
      f.position.set(x, y, z);
      g.add(f);
    }

    g.add(sleeveMesh, forearm, palm);
    return g;
  }

  /** 魔弹：法杖——木柄 + 护手横档 + 顶端发光水晶 */
  private buildStaff(): WeaponModel {
    const g = new THREE.Group();
    const accent = this.accentMat(this.accent);

    const handle = this.box(0.07, 0.7, 0.07, this.wood);
    handle.position.set(0, 0.35, 0);

    const guard = this.box(0.28, 0.06, 0.07, this.metal);
    guard.position.set(0, 0.06, 0);

    const crystal = this.box(0.18, 0.18, 0.18, accent);
    crystal.position.set(0, 0.6, 0);

    const tip = this.box(0.07, 0.1, 0.07, this.metal);
    tip.position.set(0, 0.74, 0);

    g.add(handle, guard, crystal, tip);
    return {
      group: g,
      accentMats: [accent],
      accentAnchor: this.grip.clone().add(new THREE.Vector3(0, 0.6, 0)),
    };
  }

  /** 飞剑：剑——握把 + 护手 + 钢刃 + 护手发光宝石 */
  private buildSword(): WeaponModel {
    const g = new THREE.Group();
    const accent = this.accentMat(this.accent);

    const pommel = this.box(0.09, 0.09, 0.09, this.metal);
    pommel.position.set(0, 0, 0);

    const grip = this.box(0.06, 0.22, 0.06, this.wood);
    grip.position.set(0, 0.11, 0);

    const crossguard = this.box(0.3, 0.06, 0.08, this.metal);
    crossguard.position.set(0, 0.22, 0);

    const blade = this.box(0.08, 0.95, 0.03, this.steel);
    blade.position.set(0, 0.695, 0);

    const gem = this.box(0.09, 0.09, 0.09, accent);
    gem.position.set(0, 0.22, 0);

    g.add(pommel, grip, crossguard, blade, gem);
    return {
      group: g,
      accentMats: [accent],
      accentAnchor: this.grip.clone().add(new THREE.Vector3(0, 0.22, 0)),
    };
  }

  /** 圣水：玻璃瓶——瓶身 + 颈 + 木塞，瓶内发光圣水 */
  private buildVial(): WeaponModel {
    const g = new THREE.Group();
    const accent = this.accentMat(this.accent);

    const body = this.box(0.24, 0.34, 0.24, this.glass);
    body.position.set(0, 0, 0);

    const liquid = this.box(0.17, 0.26, 0.17, accent);
    liquid.position.set(0, -0.02, 0);

    const neck = this.box(0.09, 0.12, 0.09, this.glass);
    neck.position.set(0, 0.23, 0);

    const cork = this.box(0.11, 0.08, 0.11, this.wood);
    cork.position.set(0, 0.33, 0);

    g.add(body, liquid, neck, cork);
    return {
      group: g,
      accentMats: [accent],
      accentAnchor: this.grip.clone().add(new THREE.Vector3(0, -0.02, 0)),
    };
  }

  /** 雷击：雷杖——木柄 + 金属环 + 顶端发光雷球 */
  private buildTotem(): WeaponModel {
    const g = new THREE.Group();
    const accent = this.accentMat(this.accent);

    const handle = this.box(0.08, 0.5, 0.08, this.wood);
    handle.position.set(0, 0.25, 0);

    const ring = this.box(0.27, 0.06, 0.27, this.metal);
    ring.position.set(0, 0.1, 0);

    const orb = this.box(0.24, 0.24, 0.24, accent);
    orb.position.set(0, 0.66, 0);

    g.add(handle, ring, orb);
    return {
      group: g,
      accentMats: [accent],
      accentAnchor: this.grip.clone().add(new THREE.Vector3(0, 0.66, 0)),
    };
  }

  /** 鞭刃：流星锤——握把 + 护手 + 链节 + 发光尖刺球 */
  private buildFlail(): WeaponModel {
    const g = new THREE.Group();
    const accent = this.accentMat(this.accent);

    const handle = this.box(0.07, 0.42, 0.07, this.wood);
    handle.position.set(0, 0.21, 0);

    const guard = this.box(0.18, 0.06, 0.1, this.metal);
    guard.position.set(0, 0.42, 0);

    const link1 = this.box(0.06, 0.06, 0.06, this.metal);
    link1.position.set(0, 0.52, 0.04);

    const link2 = this.box(0.06, 0.06, 0.06, this.metal);
    link2.position.set(0, 0.62, 0.1);

    const ball = this.box(0.2, 0.2, 0.2, accent);
    ball.position.set(0, 0.72, 0.16);

    g.add(handle, guard, link1, link2, ball);
    return {
      group: g,
      accentMats: [accent],
      accentAnchor: this.grip.clone().add(new THREE.Vector3(0, 0.72, 0.16)),
    };
  }

  private accentMat(color: number): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 1.3,
      roughness: 0.3,
      metalness: 0.1,
    });
  }

  /** 切换到指定武器模型（整体替换手里的模型）。 */
  setWeapon(id: string): void {
    const m = this.models.get(id as WeaponId);
    if (!m) return;
    const prev = this.models.get(this.active);
    if (prev) prev.group.visible = false;
    this.active = id as WeaponId;
    m.group.visible = true;
    this.glowLight.position.copy(m.accentAnchor);
    this.applyAccent();
  }

  setAccent(color: number): void {
    this.accent = color;
    this.applyAccent();
  }

  private applyAccent(): void {
    const m = this.models.get(this.active);
    if (!m) return;
    for (const mat of m.accentMats) {
      mat.color.setHex(this.accent);
      mat.emissive.setHex(this.accent);
    }
    this.glowLight.color.setHex(this.accent);
  }

  kick(): void {
    this.kickT = 1;
  }

  setVisible(v: boolean): void {
    this.root.visible = v;
  }

  update(dt: number, state: ViewmodelState): void {
    this.kickT = Math.max(0, this.kickT - dt * 14);
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
    const m = this.models.get(this.active);
    if (m) for (const mat of m.accentMats) mat.emissiveIntensity = pulse;
    this.glowLight.intensity = 0.7 + this.kickT * 0.9;
  }
}
