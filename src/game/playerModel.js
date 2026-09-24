import * as THREE from 'three';

// TECH PLACEHOLDER: simple original low-poly figure so facing and movement are
// readable. Replace with a real character asset in a later Part.
export function createPlayerModel() {
  const root = new THREE.Group();
  root.name = 'player-placeholder';

  const cloth = new THREE.MeshStandardMaterial({ color: 0x3b5b7a, roughness: 0.8, flatShading: true });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9b38c, roughness: 0.7, flatShading: true });
  const accent = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.5, flatShading: true });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 1.0, 7), cloth);
  body.position.y = 0.75;

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 0), skin);
  head.position.y = 1.5;

  // Front marker (+Z is the model's forward) so rotation is visible from above.
  const chest = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 4), accent);
  chest.rotation.x = Math.PI / 2;
  chest.position.set(0, 1.0, 0.36);

  const shoulders = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.16, 0.3), cloth);
  shoulders.position.y = 1.22;

  for (const mesh of [body, head, chest, shoulders]) {
    mesh.castShadow = true;
    root.add(mesh);
  }
  return root;
}
