import * as THREE from 'three';
import { FX_CONFIG } from '../config.js';

// TECH PLACEHOLDER: original low-poly "shale stalker" — a hunched, low
// four-legged creature with a ridge of stone spines and two glowing eyes, so
// it reads differently from the upright player. Replace with a real asset later.
// Returns { root, body, materials, healthBar }. `root` sits at the collision
// position and never rotates (keeps the health bar aligned); `body` is turned
// to face and animated.
export function createEnemyModel(type) {
  const root = new THREE.Group();
  root.name = 'enemy-placeholder';
  const body = new THREE.Group();
  root.add(body);

  const hide = new THREE.MeshStandardMaterial({ color: type.bodyColor, roughness: 0.85, flatShading: true });
  const spine = new THREE.MeshStandardMaterial({ color: type.accentColor, roughness: 0.6, flatShading: true });
  const eye = new THREE.MeshStandardMaterial({ color: type.eyeColor, emissive: type.eyeColor, emissiveIntensity: 1.5 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 1.0), hide);
  torso.position.set(0, 0.55, 0);
  torso.rotation.x = -0.18; // hunched forward
  const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 0), hide);
  head.position.set(0, 0.62, 0.62);
  const eyeGeometry = new THREE.OctahedronGeometry(0.06, 0);
  const eyeL = new THREE.Mesh(eyeGeometry, eye);
  const eyeR = new THREE.Mesh(eyeGeometry, eye);
  eyeL.position.set(-0.12, 0.7, 0.86);
  eyeR.position.set(0.12, 0.7, 0.86);

  const parts = [torso, head, eyeL, eyeR];
  const spineGeometry = new THREE.ConeGeometry(0.1, 0.4, 4);
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(spineGeometry, spine);
    s.position.set(0, 0.88 - i * 0.04, 0.3 - i * 0.24);
    s.rotation.x = -0.35;
    parts.push(s);
  }
  const legGeometry = new THREE.CylinderGeometry(0.07, 0.05, 0.5, 5);
  for (const [x, z] of [[-0.36, 0.35], [0.36, 0.35], [-0.36, -0.35], [0.36, -0.35]]) {
    const leg = new THREE.Mesh(legGeometry, hide);
    leg.position.set(x, 0.25, z);
    leg.rotation.z = x < 0 ? 0.25 : -0.25;
    parts.push(leg);
  }
  for (const mesh of parts) {
    mesh.castShadow = true;
    body.add(mesh);
  }

  const healthBar = createHealthBar();
  root.add(healthBar.group);

  return { root, body, materials: [hide, spine], healthBar };
}

// Camera-facing bar made of two sprites, both placed at the bar's center.
// Sprite.center works in screen space, so the fill is kept left-aligned by
// moving its anchor instead of offsetting it along a world axis (which the
// diagonal camera would turn into a screen-space diagonal).
function createHealthBar() {
  const { healthBarWidth: w, healthBarHeight: h, healthBarY: y } = FX_CONFIG;
  const group = new THREE.Group();
  group.position.y = y;
  const make = (color, opacity) => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false }),
    );
    sprite.scale.set(w, h, 1);
    sprite.renderOrder = 10;
    group.add(sprite);
    return sprite;
  };
  const back = make(0x120c0a, 0.75);
  const fill = make(0xd8402e, 1);
  fill.renderOrder = 11;
  return {
    group,
    set(ratio) {
      const r = Math.max(0.0001, ratio);
      fill.scale.x = w * r;
      fill.center.x = 0.5 / r; // bar center sits w/2 from the fill's left edge
    },
    back,
    fill,
  };
}
