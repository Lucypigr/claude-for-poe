import * as THREE from 'three';
import { FX_CONFIG } from '../config.js';

const SLASH_ARC = (Math.PI * 2) / 3;

// Short-lived, programmatic combat effects (no external assets): a slash arc
// for each swing, a spark ring on hits and a wider burst on deaths. Geometry
// is shared; each effect owns its material and frees it when it ends.
export class Effects {
  constructor(scene, config = FX_CONFIG) {
    this.scene = scene;
    this.config = config;
    this.active = [];
    // Flat arc centered on +Z (the model's forward) once laid on the ground.
    this.slashGeometry = new THREE.RingGeometry(0.35, 1, 24, 1, -Math.PI / 2 - SLASH_ARC / 2, SLASH_ARC);
    this.slashGeometry.rotateX(-Math.PI / 2);
    this.ringGeometry = new THREE.RingGeometry(0.55, 0.8, 24);
    this.ringGeometry.rotateX(-Math.PI / 2);
  }

  // reach: distance from the center to the arc's outer edge.
  spawnSlash(position, facing, reach, hit) {
    const mesh = this.add(this.slashGeometry, this.config.slashColor, this.config.slashTime);
    mesh.position.set(position.x, 0.8, position.z);
    mesh.rotation.y = facing;
    mesh.scale.setScalar(reach);
    mesh.userData.fx = { from: reach * 0.8, to: reach * 1.05, opacity: hit ? 1 : 0.55 };
  }

  spawnSpark(position, color) {
    const mesh = this.add(this.ringGeometry, color, this.config.sparkTime);
    mesh.position.set(position.x, 0.9, position.z);
    mesh.userData.fx = { from: 0.3, to: 1.3, opacity: 1 };
  }

  spawnDeathBurst(position) {
    const mesh = this.add(this.ringGeometry, this.config.deathColor, this.config.deathBurstTime);
    mesh.position.set(position.x, 0.1, position.z);
    mesh.userData.fx = { from: 0.5, to: 2.6, opacity: 0.9 };
  }

  add(geometry, color, life) {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 5;
    this.scene.add(mesh);
    this.active.push({ mesh, life, age: 0 });
    return mesh;
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const fx = this.active[i];
      fx.age += dt;
      const t = Math.min(1, fx.age / fx.life);
      const { from, to, opacity } = fx.mesh.userData.fx;
      fx.mesh.scale.setScalar(from + (to - from) * (1 - (1 - t) * (1 - t)));
      fx.mesh.material.opacity = opacity * (1 - t);
      if (t >= 1) {
        this.remove(fx);
        this.active.splice(i, 1);
      }
    }
  }

  remove(fx) {
    fx.mesh.removeFromParent();
    fx.mesh.material.dispose();
  }

  dispose() {
    this.active.forEach((fx) => this.remove(fx));
    this.active.length = 0;
    this.slashGeometry.dispose();
    this.ringGeometry.dispose();
  }
}
