import * as THREE from 'three';
import { MAP } from '../config/constants';

export interface Obstacle {
  x: number;
  z: number;
  radius: number;
}

export class World {
  readonly obstacles: Obstacle[] = [];

  constructor(private scene: THREE.Scene) {
    this.buildGround();
    this.buildWalls();
    this.buildDecor();
    this.buildSky();
  }

  private buildGround(): void {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: 0x1a1a24, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    const grid = new THREE.GridHelper(MAP.HALF_SIZE * 2, 40, 0x2c2c3e, 0x232333);
    grid.position.y = 0.01;
    this.scene.add(grid);
  }

  private buildWalls(): void {
    const h = MAP.HALF_SIZE;
    const t = 1.5;
    const material = new THREE.MeshStandardMaterial({ color: 0x3a3a4a, roughness: 0.9 });
    const wall = (x: number, z: number, w: number, d: number): void => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 3, d), material);
      mesh.position.set(x, 1.5, z);
      this.scene.add(mesh);
    };
    wall(0, -h - t / 2, h * 2 + t, t);
    wall(0, h + t / 2, h * 2 + t, t);
    wall(-h - t / 2, 0, t, h * 2 + t);
    wall(h + t / 2, 0, t, h * 2 + t);
  }

  private buildSky(): void {
    const count = 400;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 500;
      positions[i * 3 + 1] = 20 + Math.random() * 250;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 500;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0x9aa7c7,
      size: 1.2,
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: false,
      fog: false,
    });
    this.scene.add(new THREE.Points(geometry, material));
  }

  private buildDecor(): void {
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x4a4a5a, roughness: 0.8 });
    const spots: Array<[number, number]> = [
      [20, 20],
      [-25, 18],
      [30, -30],
      [-30, -25],
      [5, -35],
      [-10, 35],
      [35, 5],
      [-35, -5],
    ];
    for (const [x, z] of spots) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 4, 8), pillarMat);
      pillar.position.set(x, 2, z);
      this.scene.add(pillar);
      this.obstacles.push({ x, z, radius: 0.9 });
    }

    const rockMat = new THREE.MeshStandardMaterial({ color: 0x555566, roughness: 0.9 });
    const rocks: Array<[number, number, number]> = [
      [15, -10, 0.7],
      [-18, 12, 0.9],
      [22, 45, 0.6],
      [-45, 20, 0.8],
      [40, -45, 0.7],
      [-8, -48, 0.6],
    ];
    for (const [x, z, s] of rocks) {
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), rockMat);
      rock.position.set(x, s * 0.6, z);
      this.scene.add(rock);
      this.obstacles.push({ x, z, radius: s * 1.1 });
    }
  }
}
