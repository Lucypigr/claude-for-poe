// Pure combat helpers on the X/Z plane. Entities are anything with
// `position` ({x, z}), `radius` and `dead`.

// Gap between two circles (negative when overlapping).
export function edgeDistance(a, b) {
  return Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z) - a.radius - b.radius;
}

// Nearest living candidate whose edge is within `range` of the attacker, or null.
export function findNearestTarget(attacker, range, candidates) {
  let best = null;
  let bestGap = Infinity;
  for (const c of candidates) {
    if (c.dead || c === attacker) continue;
    const gap = edgeDistance(attacker, c);
    if (gap <= range && gap < bestGap) {
      best = c;
      bestGap = gap;
    }
  }
  return best;
}

// Yaw (radians around Y, 0 = +Z) that faces from `from` toward `to`.
export function yawTowards(from, to) {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

// Moves `current` yaw toward `target` along the shortest arc.
export function turnTowards(current, target, sharpness, dt) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * (1 - Math.exp(-sharpness * dt));
}

// Emissive flash for hit feedback; t in [0, 1] (0 = off).
export function applyFlash(materials, color, t) {
  for (const m of materials) {
    if (!m.emissive) continue;
    m.emissive.setHex(color);
    m.emissiveIntensity = t;
  }
}
