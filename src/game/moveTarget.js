// Steering toward a click/tap move target on the X/Z plane.
// Produces the same kind of {x, z} direction (length <= 1) that direct input
// produces, so the player has one movement path regardless of input type.

// Returns true when pos is within stopDistance of target (arrived). Otherwise
// writes the direction into `out`; its length eases from 1 down to 0 inside
// slowRadius so the player does not overshoot and oscillate around the target.
export function steerToTarget(pos, target, { stopDistance, slowRadius }, out = { x: 0, z: 0 }) {
  const dx = target.x - pos.x;
  const dz = target.z - pos.z;
  const dist = Math.hypot(dx, dz);
  if (dist <= stopDistance) {
    out.x = 0;
    out.z = 0;
    return true;
  }
  const scale = Math.min(1, dist / slowRadius) / dist;
  out.x = dx * scale;
  out.z = dz * scale;
  return false;
}
