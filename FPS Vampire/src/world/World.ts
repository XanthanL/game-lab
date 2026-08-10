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
      new THREE.MeshStandardMaterial({ color: 0xbcd0a8, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    const grid = new THREE.GridHelper(MAP.HALF_SIZE * 2, 40, 0x9fb48f, 0x8aa07c);
    grid.position.y = 0.01;
    this.scene.add(grid);
  }

  private buildWalls(): void {
    const h = MAP.HALF_SIZE;
    const t = 1.5;
    const material = new THREE.MeshStandardMaterial({ color: 0xc2cbd6, roughness: 0.9 });
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
    // 浅色天空下用几团柔和的白云点缀，替代原先的暗色星空
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false });
    const makeCloud = (x: number, y: number, z: number, s: number): void => {
      const g = new THREE.Group();
      const puffs: Array<[number, number, number, number]> = [
        [0, 0, 0, 1],
        [s * 0.9, -s * 0.1, 0, 0.7],
        [-s * 0.9, -s * 0.1, 0, 0.7],
        [s * 0.4, s * 0.3, s * 0.2, 0.6],
      ];
      for (const [px, py, pz, ps] of puffs) {
        const box = new THREE.Mesh(new THREE.BoxGeometry(s * 2 * ps, s * 0.9 * ps, s * 1.4 * ps), cloudMat);
        box.position.set(px, py, pz);
        g.add(box);
      }
      g.position.set(x, y, z);
      this.scene.add(g);
    };
    makeCloud(-40, 60, -60, 6);
    makeCloud(50, 72, -30, 8);
    makeCloud(10, 90, 40, 7);
    makeCloud(-70, 80, 50, 5);
    makeCloud(70, 64, 60, 6);
  }

  private buildDecor(): void {
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xc8cdd6, roughness: 0.8 });
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

    const rockMat = new THREE.MeshStandardMaterial({ color: 0xb9bfca, roughness: 0.9 });
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
