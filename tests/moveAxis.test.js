import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAxis, clampAxis, applyDeadzone, combineAxes, axisLength } from '../src/input/moveAxis.js';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('digital diagonal is not faster than straight', () => {
  close(axisLength(normalizeAxis(1, 1)), 1);
  close(axisLength(normalizeAxis(0, 1)), 1);
  assert.deepEqual(normalizeAxis(0, 0), { x: 0, y: 0 });
});

test('analog axis keeps partial tilt and clamps to 1', () => {
  assert.deepEqual(clampAxis(0.3, 0.4), { x: 0.3, y: 0.4 });
  close(axisLength(clampAxis(3, 4)), 1);
});

test('deadzone zeroes small input and rescales the rest', () => {
  assert.deepEqual(applyDeadzone({ x: 0.05, y: 0 }, 0.1), { x: 0, y: 0 });
  close(applyDeadzone({ x: 1, y: 0 }, 0.1).x, 1);
  close(applyDeadzone({ x: 0.55, y: 0 }, 0.1).x, 0.5);
});

test('combined sources never exceed unit length', () => {
  const kb = normalizeAxis(1, 1);
  const stick = { x: 1, y: 0 };
  assert.ok(axisLength(combineAxes([kb, stick])) <= 1 + 1e-9);
  assert.deepEqual(combineAxes([]), { x: 0, y: 0 });
});
