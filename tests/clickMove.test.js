import { test } from 'node:test';
import assert from 'node:assert/strict';
import { steerToTarget } from '../src/game/moveTarget.js';
import { Player } from '../src/game/Player.js';
import { PLAYER_CONFIG } from '../src/config.js';

const DT = 1 / 60;
const opts = { stopDistance: 0.15, slowRadius: 0.8 };

test('steering is full speed far away, eases inside slowRadius, stops at stopDistance', () => {
  const out = { x: 0, z: 0 };
  assert.equal(steerToTarget({ x: 0, z: 0 }, { x: 10, z: 0 }, opts, out), false);
  assert.deepEqual(out, { x: 1, z: 0 });
  steerToTarget({ x: 0, z: 0 }, { x: 0, z: 0.4 }, opts, out);
  assert.ok(Math.abs(out.z - 0.5) < 1e-9);
  assert.equal(steerToTarget({ x: 0, z: 0 }, { x: 0.1, z: 0 }, opts, out), true);
  assert.deepEqual(out, { x: 0, z: 0 });
});

test('player walks to a target, stops within stopDistance and stays put', () => {
  const p = new Player();
  p.setMoveTarget({ x: 5, z: -3 });
  for (let i = 0; i < 240 && p.moveTarget; i++) p.update(DT, 50);
  assert.equal(p.moveTarget, null);
  const d = Math.hypot(p.position.x - 5, p.position.z + 3);
  assert.ok(d <= PLAYER_CONFIG.stopDistance + 1e-6, `stopped ${d} away`);
  const rest = p.position.clone();
  for (let i = 0; i < 60; i++) p.update(DT, 50);
  assert.ok(p.position.distanceTo(rest) < 1e-9, 'no drift or jitter after arrival');
});

test('direct input cancels the target; releasing it does not resume chasing', () => {
  const p = new Player();
  p.setMoveTarget({ x: 10, z: 0 });
  p.update(DT, 50);
  p.setMoveDirection({ x: 0, z: 1 });
  assert.equal(p.moveTarget, null);
  for (let i = 0; i < 30; i++) p.update(DT, 50);
  p.setMoveDirection({ x: 0, z: 0 });
  for (let i = 0; i < 120; i++) p.update(DT, 50);
  const x = p.position.x;
  for (let i = 0; i < 60; i++) p.update(DT, 50);
  assert.ok(Math.abs(p.position.x - x) < 1e-6, 'player stays stopped');
  assert.ok(p.position.x < 1, 'player did not continue toward the old target');
});

test('zero direct input keeps an active target', () => {
  const p = new Player();
  p.setMoveTarget({ x: 3, z: 0 });
  p.setMoveDirection({ x: 0, z: 0 });
  assert.ok(p.moveTarget);
});
