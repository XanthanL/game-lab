import * as THREE from 'three';

export class Renderer {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xcfe9ff);
    this.scene.fog = new THREE.Fog(0xcfe9ff, 140, 360);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 300);
    this.scene.add(this.camera);

    this.resize();
    this.addLights();
    window.addEventListener('resize', () => this.resize());
  }

  private addLights(): void {
    const hemi = new THREE.HemisphereLight(0xffffff, 0xaebfd0, 1.0);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 1.15);
    dir.position.set(30, 60, 20);
    this.scene.add(dir);
    const fill = new THREE.DirectionalLight(0xcfe0ff, 0.35);
    fill.position.set(-20, 30, -30);
    this.scene.add(fill);
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
