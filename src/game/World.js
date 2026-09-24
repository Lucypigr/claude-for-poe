import * as THREE from 'three';
import { WORLD_CONFIG } from '../config.js';
import { Player } from './Player.js';

// The game scene: environment + entities. Rendering and input live elsewhere.
export class World {
  constructor(config = WORLD_CONFIG) {
    this.config = config;
    this.colliders = []; // static circle colliders {x, z, radius} on the X/Z plane
    this.raycaster = new THREE.Raycaster();
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x0d0f14, 30, 70);

    this.addLights();
    this.addGround();
    this.addProps();

    this.player = new Player();
    this.scene.add(this.player.object);
  }

  addLights() {
    this.scene.add(new THREE.HemisphereLight(0xbfc8d8, 0x2a2118, 0.9));

    const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
    sun.position.set(8, 16, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const s = sun.shadow.camera;
    s.left = -14;
    s.right = 14;
    s.top = 14;
    s.bottom = -14;
    s.near = 1;
    s.far = 40;
    this.sun = sun;
    this.scene.add(sun, sun.target);
  }

  addGround() {
    const size = this.config.groundSize;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshStandardMaterial({ color: 0x3a3a2e, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.ground = ground;

    const grid = new THREE.GridHelper(size, size / 2, 0x55553f, 0x46463a);
    grid.position.y = 0.01;
    this.scene.add(grid);
  }

  // Scattered stones give a sense of motion; deterministic for reproducibility.
  addProps() {
    const rand = mulberry32(this.config.propSeed);
    const geometry = new THREE.DodecahedronGeometry(1, 0);
    const material = new THREE.MeshStandardMaterial({ color: 0x6b6558, roughness: 0.9, flatShading: true });
    const limit = this.config.playBounds;
    for (let i = 0; i < this.config.propCount; i++) {
      const x = (rand() * 2 - 1) * limit;
      const z = (rand() * 2 - 1) * limit;
      if (Math.hypot(x, z) < 4) continue; // keep the spawn area clear
      const rock = new THREE.Mesh(geometry, material);
      const scale = 0.4 + rand() * 0.9;
      rock.scale.set(scale, scale * (0.6 + rand() * 0.6), scale);
      rock.position.set(x, scale * 0.4, z);
      rock.rotation.y = rand() * Math.PI;
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.scene.add(rock);
      this.colliders.push({ x, z, radius: scale * this.config.rockColliderScale });
    }
  }

  // ndc: pointer in normalized device coords. Writes the ground hit into
  // `out` ({x, z}) and returns true, or returns false if the ground was missed.
  pickGround(ndc, camera, out) {
    this.raycaster.setFromCamera(ndc, camera);
    const hit = this.raycaster.intersectObject(this.ground, false)[0];
    if (!hit) return false;
    out.x = hit.point.x;
    out.z = hit.point.z;
    return true;
  }

  setPlayerMoveTarget(point) {
    this.player.setMoveTarget(point, this.colliders, this.config.playBounds);
  }

  update(dt) {
    this.player.update(dt, this.config.playBounds, this.colliders);
    // Keep the shadow frustum centered on the player.
    const p = this.player.position;
    this.sun.position.set(p.x + 8, 16, p.z + 6);
    this.sun.target.position.copy(p);
  }

  dispose() {
    const geometries = new Set();
    const materials = new Set();
    this.scene.traverse((obj) => {
      if (obj.geometry) geometries.add(obj.geometry);
      if (obj.material) [].concat(obj.material).forEach((m) => materials.add(m));
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    this.sun.shadow.map?.dispose();
    this.scene.clear();
  }
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
