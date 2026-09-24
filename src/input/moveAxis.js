// Pure helpers for 2D movement intent. Axis convention (screen space):
// x = right (+) / left (-), y = up (+) / down (-). Magnitude is always <= 1.

export const ZERO_AXIS = Object.freeze({ x: 0, y: 0 });

export function axisLength(axis) {
  return Math.hypot(axis.x, axis.y);
}

// Digital input (keys): any non-zero direction becomes unit length so
// diagonals are not faster than straight lines.
export function normalizeAxis(x, y) {
  const len = Math.hypot(x, y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}

// Analog input (sticks): keep partial tilt, but never exceed length 1.
export function clampAxis(x, y, max = 1) {
  const len = Math.hypot(x, y);
  if (len <= max) return { x, y };
  return { x: (x / len) * max, y: (y / len) * max };
}

// Radial deadzone that rescales the remaining range back to [0, 1].
export function applyDeadzone(axis, deadzone) {
  const len = axisLength(axis);
  if (len <= deadzone) return { x: 0, y: 0 };
  const scaled = Math.min(1, (len - deadzone) / (1 - deadzone));
  return { x: (axis.x / len) * scaled, y: (axis.y / len) * scaled };
}

// Merge several sources into one intent; result is clamped to length 1.
export function combineAxes(axes) {
  let x = 0;
  let y = 0;
  for (const a of axes) {
    x += a.x;
    y += a.y;
  }
  return clampAxis(x, y);
}
