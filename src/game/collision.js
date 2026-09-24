// Simple static collision on the X/Z plane. The player is a circle and each
// obstacle is a circle collider {x, z, radius}. Overlaps are resolved by
// pushing the player out along the contact normal, which keeps the tangential
// part of the motion so the player slides along obstacle edges.

const PUSH_ITERATIONS = 4;

// pos: {x, z}, mutated in place. Returns true if any collider was touched.
export function resolveOverlaps(pos, radius, colliders) {
  let touched = false;
  for (let iter = 0; iter < PUSH_ITERATIONS; iter++) {
    let moved = false;
    for (const c of colliders) {
      const minDist = radius + c.radius;
      const dx = pos.x - c.x;
      const dz = pos.z - c.z;
      const distSq = dx * dx + dz * dz;
      if (distSq >= minDist * minDist) continue;
      const dist = Math.sqrt(distSq);
      // Exactly centered: pick any stable direction instead of dividing by 0.
      const nx = dist > 1e-6 ? dx / dist : 1;
      const nz = dist > 1e-6 ? dz / dist : 0;
      pos.x = c.x + nx * minDist;
      pos.z = c.z + nz * minDist;
      moved = true;
    }
    if (!moved) break;
    touched = true;
  }
  return touched;
}

// Moves a circle by (dx, dz) against static colliders and a square bound.
// Large steps are split so fast movement cannot tunnel through small colliders.
export function moveCircle(pos, dx, dz, radius, colliders, bounds) {
  const maxStep = radius * 0.5;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / maxStep));
  for (let i = 0; i < steps; i++) {
    pos.x = clamp(pos.x + dx / steps, -bounds, bounds);
    pos.z = clamp(pos.z + dz / steps, -bounds, bounds);
    resolveOverlaps(pos, radius, colliders);
  }
  pos.x = clamp(pos.x, -bounds, bounds);
  pos.z = clamp(pos.z, -bounds, bounds);
  return pos;
}

// Nearest point to `point` where a circle of `radius` fits (used to move a
// clicked target out of an obstacle so the player does not push into it).
export function nearestFreePoint(point, radius, colliders, bounds) {
  const out = { x: clamp(point.x, -bounds, bounds), z: clamp(point.z, -bounds, bounds) };
  resolveOverlaps(out, radius, colliders);
  out.x = clamp(out.x, -bounds, bounds);
  out.z = clamp(out.z, -bounds, bounds);
  return out;
}

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}
