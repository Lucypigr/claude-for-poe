import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveOverlaps, moveCircle, nearestFreePoint } from '../src/game/collision.js';
import { Player } from '../src/game/Player.js';

const DT = 1 / 60;
const rock = { x: 0, z: 0, radius: 1 };
const R = 0.5;

test('overlap is pushed out along the contact normal', () => {
  const pos = { x: 0.5, z: 0 };
  assert.equal(resolveOverlaps(pos, R, [rock]), true);
  assert.ok(Math.abs(pos.x - 1.5) < 1e-9 && pos.z === 0);
  const free = { x: 3, z: 0 };
  assert.equal(resolveOverlaps(free, R, [rock]), false);
});

test('a large step cannot tunnel through a collider', () => {
  const pos = { x: -3, z: 0 };
  moveCircle(pos, 6, 0, R, [rock], 50);
  assert.ok(pos.x <= -1.5 + 1e-9, `ended at ${pos.x}`);
});

test('moving diagonally into a collider slides along its edge', () => {
  const pos = { x: -1.5, z: -0.2 };
  for (let i = 0; i < 60; i++) moveCircle(pos, 0.05, 0.05, R, [rock], 50);
  assert.ok(Math.hypot(pos.x, pos.z) >= 1.5 - 1e-9, 'never inside the rock');
  assert.ok(pos.z > 1, `slid past the rock (z=${pos.z})`);
});

test('bounds are respected', () => {
  const pos = { x: 9, z: 0 };
  moveCircle(pos, 5, 0, R, [], 10);
  assert.equal(pos.x, 10);
});

test('target inside an obstacle is moved to the nearest free point', () => {
  const p = nearestFreePoint({ x: 0.2, z: 0 }, R, [rock], 50);
  assert.ok(Math.abs(Math.hypot(p.x, p.z) - 1.5) < 1e-9);
});

test('player blocked head-on gives up the target instead of pushing forever', () => {
  const p = new Player();
  p.position.set(-5, 0, 0);
  const wall = [{ x: 0, z: 0, radius: 1 }, { x: 0, z: 1.6, radius: 1 }, { x: 0, z: -1.6, radius: 1 }];
  p.setMoveTarget({ x: 5, z: 0 }, wall, 50);
  for (let i = 0; i < 300 && p.moveTarget; i++) {
    p.update(DT, 50, wall);
    for (const c of wall) assert.ok(Math.hypot(p.position.x - c.x, p.position.z - c.z) >= c.radius + p.radius - 1e-6);
  }
  assert.equal(p.moveTarget, null);
});

test('player walks around a single rock toward a target behind it at an angle', () => {
  const p = new Player();
  p.position.set(-4, 0, 0.3);
  p.setMoveTarget({ x: 4, z: 1.5 }, [rock], 50);
  for (let i = 0; i < 600 && p.moveTarget; i++) p.update(DT, 50, [rock]);
  assert.ok(Math.hypot(p.position.x - 4, p.position.z - 1.5) < 0.2, `ended at ${p.position.x},${p.position.z}`);
});
