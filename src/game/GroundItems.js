import * as THREE from 'three';
import { GROUND_ITEM_CONFIG, RARITY_COLORS } from '../config.js';
import { getItemDefinition } from '../items/itemDefinitions.js';
import { nearestFreePoint } from './collision.js';

const LANDING_TRIES = 8; // angles tried per ring when looking for a free landing spot
const TOSS_HEIGHT = 0.8;
const MARKER_OPACITY = { far: 0.3, near: 0.85 };
const BEAM_OPACITY = { far: 0.22, near: 0.5 };

// Items lying in the world. Each entry keeps the ItemInstance it stands for
// (identity is item.uid, never the name) plus a programmatic model: a flat
// plate sized from the item's footprint in the definition's tint, a ground
// ring and a thin light beam in the rarity color. Geometry is shared; each
// entry owns its materials and frees them when removed. No DOM, no Inventory:
// labels and pickup are separate systems that read `entries`.
//
// entry: { item, def, x, z, object, materials, age, near }
export class GroundItems {
  constructor(scene, config = GROUND_ITEM_CONFIG, getDefinition = getItemDefinition) {
    this.scene = scene;
    this.config = config;
    this.getDefinition = getDefinition;
    this.entries = [];
    this.plateGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.plateGeometry.translate(0, 0.5, 0);
    this.markerGeometry = new THREE.RingGeometry(0.42, 0.54, 24);
    this.markerGeometry.rotateX(-Math.PI / 2);
    this.beamGeometry = new THREE.CylinderGeometry(0.035, 0.035, 1.3, 6, 1, true);
    this.beamGeometry.translate(0, 0.65, 0);
  }

  // Puts `item` on the ground at `at` ({x, z}). It is tossed there from
  // `from` (e.g. the corpse); `at` counts as its position right away.
  add(item, at, from = at) {
    const def = this.getDefinition(item.defId);
    if (!def) throw new Error(`Unknown item definition "${item.defId}"`);
    const rarity = item.data.rarity ?? def.rarity;
    const rarityColor = new THREE.Color(RARITY_COLORS[rarity] ?? RARITY_COLORS.normal);
    const tint = new THREE.Color(def.icon.color);

    const plateMaterial = new THREE.MeshStandardMaterial({
      color: tint,
      emissive: tint,
      emissiveIntensity: 0.25,
      roughness: 0.65,
      flatShading: true,
    });
    const markerMaterial = new THREE.MeshBasicMaterial({
      color: rarityColor,
      transparent: true,
      opacity: MARKER_OPACITY.far,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const beamMaterial = new THREE.MeshBasicMaterial({
      color: rarityColor,
      transparent: true,
      opacity: BEAM_OPACITY.far,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const object = new THREE.Group();
    object.name = 'ground-item';
    const plate = new THREE.Mesh(this.plateGeometry, plateMaterial);
    const cell = this.config.cellSize;
    plate.scale.set(def.width * cell, 0.08, def.height * cell);
    plate.rotation.y = hashAngle(item.uid);
    plate.castShadow = true;
    const marker = new THREE.Mesh(this.markerGeometry, markerMaterial);
    marker.position.y = 0.02;
    marker.renderOrder = 4;
    const beam = new THREE.Mesh(this.beamGeometry, beamMaterial);
    beam.renderOrder = 4;
    object.add(plate, marker, beam);
    object.position.set(from.x, 0, from.z);
    this.scene.add(object);

    const entry = {
      item,
      def,
      x: at.x,
      z: at.z,
      fromX: from.x,
      fromZ: from.z,
      object,
      marker,
      beam,
      materials: [plateMaterial, markerMaterial, beamMaterial],
      age: 0,
      near: false,
    };
    this.entries.push(entry);
    this.updateEntry(entry, 0);
    return entry;
  }

  // A spot near `origin` where a drop can land: outside rocks (a circle of
  // `clearance` fits, so the player can walk onto it), inside the bounds and,
  // when possible, not on top of another ground item. `startAngle` spreads
  // several drops from one death around the origin.
  findLandingSpot(origin, startAngle, colliders, bounds) {
    const { scatterRadius, clearance, dropSpacing } = this.config;
    let fallback = null;
    for (const radius of [scatterRadius, scatterRadius * 2]) {
      for (let k = 0; k < LANDING_TRIES; k++) {
        const angle = startAngle + (k * Math.PI * 2) / LANDING_TRIES;
        const candidate = { x: origin.x + Math.cos(angle) * radius, z: origin.z + Math.sin(angle) * radius };
        const spot = nearestFreePoint(candidate, clearance, colliders, bounds);
        fallback ??= spot;
        if (this.isClear(spot, dropSpacing)) return spot;
      }
    }
    return fallback;
  }

  isClear(spot, spacing) {
    return this.entries.every((e) => Math.hypot(e.x - spot.x, e.z - spot.z) >= spacing);
  }

  // Entries within `radius` of `position`, nearest first.
  inRange(position, radius, out = []) {
    out.length = 0;
    for (const e of this.entries) {
      e.distance = Math.hypot(e.x - position.x, e.z - position.z);
      if (e.distance <= radius) out.push(e);
    }
    return out.sort((a, b) => a.distance - b.distance);
  }

  // Takes an entry off the ground and frees its model. Returns its ItemInstance,
  // unchanged (same uid and data).
  remove(entry) {
    const i = this.entries.indexOf(entry);
    if (i < 0) return null;
    this.entries.splice(i, 1);
    entry.object.removeFromParent();
    entry.materials.forEach((m) => m.dispose());
    entry.removed = true;
    return entry.item;
  }

  // Toss animation and near-player highlight (player: {x, z} or null).
  update(dt, player) {
    const hint = this.config.hintRadius;
    for (const entry of this.entries) {
      this.updateEntry(entry, dt);
      const near = !!player && Math.hypot(entry.x - player.x, entry.z - player.z) <= hint;
      if (near !== entry.near) {
        entry.near = near;
        entry.marker.material.opacity = near ? MARKER_OPACITY.near : MARKER_OPACITY.far;
        entry.beam.material.opacity = near ? BEAM_OPACITY.near : BEAM_OPACITY.far;
      }
    }
  }

  updateEntry(entry, dt) {
    const flight = this.config.flightTime;
    if (entry.age >= flight) return;
    entry.age = Math.min(flight, entry.age + dt);
    const t = flight > 0 ? entry.age / flight : 1;
    entry.object.position.set(
      entry.fromX + (entry.x - entry.fromX) * t,
      4 * TOSS_HEIGHT * t * (1 - t),
      entry.fromZ + (entry.z - entry.fromZ) * t,
    );
  }

  dispose() {
    this.entries.slice().forEach((e) => this.remove(e));
    this.plateGeometry.dispose();
    this.markerGeometry.dispose();
    this.beamGeometry.dispose();
  }
}

// Stable per-item yaw so a plate does not change angle between frames.
function hashAngle(uid) {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (Math.imul(h, 31) + uid.charCodeAt(i)) | 0;
  return ((h >>> 0) / 4294967296) * Math.PI;
}
