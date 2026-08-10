import * as THREE from 'three';
import { MAP, PLAYER } from '../config/constants';
import type { Obstacle } from '../world/World';
import type { Player } from './Player';

export class PlayerController {
  readonly position = new THREE.Vector3();
  private yawValue = 0;
  private pitch = 0;
  private readonly velocity = new THREE.Vector3();
  private readonly keys = new Set<string>();
  private locked = false;
  private onLockChange?: (locked: boolean) => void;
  // 跳跃 / 垂直
  private vy = 0;
  private grounded = true;
  // 冲刺 / 体力
  private stamina = PLAYER.STAMINA_MAX;
  private sprinting = false;
  private moving = false;

  constructor(
    private camera: THREE.PerspectiveCamera,
    private domElement: HTMLElement,
    private player: Player
  ) {
    this.domElement.tabIndex = -1;
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.key && e.key.length === 1) this.keys.delete(e.key.toLowerCase());
    });
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('mousemove', (e) => this.onMouseMove(e));
    document.addEventListener('pointerlockchange', () => this.onPointerLockChange());
  }

  setLockCallback(fn: (locked: boolean) => void): void {
    this.onLockChange = fn;
  }

  get isLocked(): boolean {
    return this.locked;
  }

  get yaw(): number {
    return this.yawValue;
  }

  get isGrounded(): boolean {
    return this.grounded;
  }

  get isSprinting(): boolean {
    return this.sprinting;
  }

  get isMoving(): boolean {
    return this.moving;
  }

  get staminaRatio(): number {
    return this.stamina / PLAYER.STAMINA_MAX;
  }

  reset(): void {
    this.position.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
    this.vy = 0;
    this.grounded = true;
    this.stamina = PLAYER.STAMINA_MAX;
    this.sprinting = false;
    this.moving = false;
    this.keys.clear();
  }

  lock(): void {
    if (this.locked) return;
    this.domElement.focus({ preventScroll: true });
    try {
      const p = this.domElement.requestPointerLock() as unknown;
      if (p instanceof Promise) {
        p.catch(() => this.onLockChange?.(false));
      }
    } catch {
      this.onLockChange?.(false);
    }
  }

  update(dt: number, obstacles: Obstacle[]): void {
    this.updateMove(dt);
    this.clampToBounds();
    this.resolveCollisions(obstacles);
    this.camera.rotation.set(this.pitch, this.yawValue, 0, 'YXZ');
    this.camera.position.set(
      this.position.x,
      this.position.y + PLAYER.EYE_HEIGHT,
      this.position.z
    );
  }

  private onKeyDown(e: KeyboardEvent): void {
    this.keys.add(e.code);
    if (e.key && e.key.length === 1) {
      this.keys.add(e.key.toLowerCase());
    }
    if (this.locked && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    // 跳跃：仅在落地且非长按重复时触发
    if (e.code === 'Space' && this.locked && !e.repeat && this.grounded) {
      this.vy = PLAYER.JUMP_SPEED;
      this.grounded = false;
    }
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.locked) return;
    this.yawValue -= e.movementX * PLAYER.LOOK_SENSITIVITY;
    this.pitch -= e.movementY * PLAYER.LOOK_SENSITIVITY;
    const limit = Math.PI / 2 - 0.01;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -limit, limit);
  }

  private updateMove(dt: number): void {
    const has = (a: string, b: string): boolean => this.keys.has(a) || this.keys.has(b);
    let forward = 0;
    let strafe = 0;
    if (has('KeyW', 'w')) forward += 1;
    if (has('KeyS', 's')) forward -= 1;
    if (has('KeyA', 'a')) strafe -= 1;
    if (has('KeyD', 'd')) strafe += 1;
    this.moving = forward !== 0 || strafe !== 0;

    // 冲刺 + 体力
    const sprintKey = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const canStart = this.stamina > (this.sprinting ? 0 : PLAYER.SPRINT_MIN);
    this.sprinting = sprintKey && this.moving && canStart;
    if (this.sprinting) {
      this.stamina = Math.max(0, this.stamina - PLAYER.STAMINA_DRAIN * dt);
    } else {
      this.stamina = Math.min(PLAYER.STAMINA_MAX, this.stamina + PLAYER.STAMINA_REGEN * dt);
    }

    const sin = Math.sin(this.yawValue);
    const cos = Math.cos(this.yawValue);
    const speed = this.player.stats.moveSpeed * (this.sprinting ? PLAYER.SPRINT_MULT : 1);
    const target = new THREE.Vector3(
      (-sin * forward + cos * strafe) * speed,
      0,
      (-cos * forward - sin * strafe) * speed
    );
    const t = 1 - Math.exp(-12 * dt);
    this.velocity.lerp(target, t);
    this.position.addScaledVector(this.velocity, dt);

    // 垂直：重力 + 跳跃
    this.vy -= PLAYER.GRAVITY * dt;
    this.position.y += this.vy * dt;
    if (this.position.y <= 0) {
      this.position.y = 0;
      this.vy = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }
  }

  private clampToBounds(): void {
    const half = MAP.HALF_SIZE;
    this.position.x = THREE.MathUtils.clamp(this.position.x, -half, half);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -half, half);
  }

  private resolveCollisions(obstacles: Obstacle[]): void {
    const r = PLAYER.RADIUS;
    for (const o of obstacles) {
      const dx = this.position.x - o.x;
      const dz = this.position.z - o.z;
      const minDist = o.radius + r;
      const distSq = dx * dx + dz * dz;
      if (distSq >= minDist * minDist || distSq < 1e-8) continue;
      const dist = Math.sqrt(distSq);
      const push = minDist - dist;
      this.position.x += (dx / dist) * push;
      this.position.z += (dz / dist) * push;
    }
  }

  private onPointerLockChange(): void {
    this.locked = document.pointerLockElement === this.domElement;
    this.keys.clear();
    if (this.locked) {
      this.domElement.focus({ preventScroll: true });
    }
    this.onLockChange?.(this.locked);
  }
}
