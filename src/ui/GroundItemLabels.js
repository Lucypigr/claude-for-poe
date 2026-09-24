import * as THREE from 'three';
import { GROUND_ITEM_CONFIG, RARITY_COLORS } from '../config.js';

// Name tags for ground items, drawn as an HTML overlay under the rest of the
// UI. Display only: the layer and every label have pointer-events: none, so
// clicks and taps pass straight through to the world canvas (click-to-move)
// and never block the joystick, attack button or bag.
//
// Label elements come from a fixed pool of config.maxLabels; only the items
// nearest the player get one. Overlapping labels are stacked upward, nearest
// item first. DOM is only written when a label's text, position or state changes.
export class GroundItemLabels {
  constructor(parent, config = GROUND_ITEM_CONFIG) {
    this.config = config;
    this.root = document.createElement('div');
    this.root.className = 'ground-labels';
    this.root.dataset.testid = 'ground-labels';
    parent.appendChild(this.root);
    this.pool = []; // { el, uid, width, height, x, y, near, shown }
    this.byUid = new Map(); // uid -> pool label shown last frame
    this.width = 0;
    this.height = 0;
    this.projected = new THREE.Vector3();
    this.candidates = [];
    this.placed = [];
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
  }

  // entries: GroundItems entries; camera: world camera with an up-to-date
  // matrixWorld; player: { x, z }.
  update(entries, camera, player) {
    const candidates = this.candidates;
    candidates.length = 0;
    for (const entry of entries) {
      const v = this.projected.set(entry.object.position.x, this.config.labelY, entry.object.position.z).project(camera);
      if (v.z < -1 || v.z > 1 || v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.1) continue;
      candidates.push({
        entry,
        sx: (v.x + 1) * 0.5 * this.width,
        sy: (1 - v.y) * 0.5 * this.height,
        distance: Math.hypot(entry.x - player.x, entry.z - player.z),
      });
    }
    candidates.sort((a, b) => a.distance - b.distance);
    if (candidates.length > this.config.maxLabels) candidates.length = this.config.maxLabels;

    // Keep each item on the label it had, so text is only set (and measured) once.
    const used = new Set();
    const next = new Map();
    for (const c of candidates) {
      const label = this.byUid.get(c.entry.item.uid);
      if (label) {
        used.add(label);
        next.set(c.entry.item.uid, label);
        c.label = label;
      } else {
        c.label = null;
      }
    }
    for (const c of candidates) {
      if (c.label) continue;
      c.label = this.pool.find((l) => !used.has(l)) ?? this.createLabel();
      used.add(c.label);
      next.set(c.entry.item.uid, c.label);
      this.assign(c.label, c.entry);
    }
    this.byUid = next;

    // Stack: each label sits centered above its item, pushed up past any
    // nearer item's label it would overlap (or down, if up leaves the screen),
    // and is kept inside the view.
    const placed = this.placed;
    placed.length = 0;
    const gap = this.config.labelGap;
    for (const c of candidates) {
      const { label } = c;
      const x = clamp(c.sx - label.width / 2, gap, this.width - label.width - gap);
      let y = this.stack(x, c.sy - label.height, label, -1);
      if (y < gap) y = this.stack(x, c.sy - label.height, label, 1);
      y = clamp(y, gap, this.height - label.height - gap);
      placed.push({ x, y, w: label.width, h: label.height });
      this.show(label, Math.round(x), Math.round(y), c.entry.near);
    }
    for (const label of this.pool) if (!used.has(label)) this.hide(label);
  }

  // Moves a label starting at (x, y) past every placed label it overlaps,
  // upward (dir -1) or downward (dir 1). Returns the free y.
  stack(x, y, label, dir) {
    const gap = this.config.labelGap;
    const placed = this.placed;
    for (let moved = true, guard = 0; moved && guard <= placed.length; guard++) {
      moved = false;
      for (const p of placed) {
        if (x < p.x + p.w && x + label.width > p.x && y < p.y + p.h + gap && y + label.height + gap > p.y) {
          y = dir < 0 ? p.y - label.height - gap : p.y + p.h + gap;
          moved = true;
        }
      }
    }
    return y;
  }

  createLabel() {
    const el = document.createElement('div');
    el.className = 'ground-label';
    el.dataset.testid = 'ground-label';
    this.root.appendChild(el);
    const label = { el, uid: null, width: 0, height: 0, x: null, y: null, near: false, shown: true };
    this.pool.push(label);
    return label;
  }

  assign(label, entry) {
    const rarity = entry.item.data.rarity ?? entry.def.rarity;
    label.uid = entry.item.uid;
    label.el.dataset.uid = entry.item.uid;
    label.el.textContent = entry.def.name;
    label.el.style.setProperty('--label-color', RARITY_COLORS[rarity] ?? RARITY_COLORS.normal);
    label.el.hidden = false;
    label.shown = true;
    label.width = label.el.offsetWidth; // one layout read per new text
    label.height = label.el.offsetHeight;
  }

  show(label, x, y, near) {
    if (!label.shown) {
      label.el.hidden = false;
      label.shown = true;
    }
    if (x !== label.x || y !== label.y) {
      label.x = x;
      label.y = y;
      label.el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }
    if (near !== label.near) {
      label.near = near;
      label.el.classList.toggle('is-near', near);
    }
  }

  hide(label) {
    if (!label.shown) return;
    label.el.hidden = true;
    label.shown = false;
  }

  dispose() {
    this.root.remove();
    this.pool.length = 0;
    this.byUid.clear();
  }
}

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}
