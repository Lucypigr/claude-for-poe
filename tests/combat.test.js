import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Health } from '../src/game/Health.js';
import { findNearestTarget, edgeDistance } from '../src/game/combat.js';
import { Player } from '../src/game/Player.js';
import { Enemy } from '../src/game/Enemy.js';
import { PLAYER_ATTACK, PLAYER_CONFIG, ENEMY_TYPES } from '../src/config.js';

const DT = 1 / 60;
const TYPE = ENEMY_TYPES.shaleStalker;
const BOUNDS = 50;

// Places an enemy so its edge is `gap` away from the player's edge along +X.
function enemyAtGap(player, gap, type = TYPE) {
  return new Enemy(type, { x: player.position.x + player.radius + type.radius + gap, z: 0 });
}

function run(seconds, fn) {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) fn(DT);
}

test('health clamps at zero, reports dealt damage and ignores hits when dead', () => {
  const h = new Health(30);
  assert.equal(h.damage(10), 10);
  assert.equal(h.damage(50), 20);
  assert.equal(h.current, 0);
  assert.ok(h.dead);
  assert.equal(h.damage(5), 0);
  h.reset();
  assert.equal(h.current, 30);
});

test('nearest living target within range is chosen; dead and far ones are skipped', () => {
  const p = new Player();
  const near = enemyAtGap(p, 0.5);
  const nearer = enemyAtGap(p, 0.2);
  const far = enemyAtGap(p, PLAYER_ATTACK.range + 0.1);
  assert.equal(findNearestTarget(p, PLAYER_ATTACK.range, [far, near, nearer]), nearer);
  nearer.takeDamage(1e9);
  assert.equal(findNearestTarget(p, PLAYER_ATTACK.range, [far, near, nearer]), near);
  assert.equal(findNearestTarget(p, PLAYER_ATTACK.range, [far]), null);
  assert.ok(Math.abs(edgeDistance(p, far) - (PLAYER_ATTACK.range + 0.1)) < 1e-9);
});

test('an attack damages only the nearest enemy, exactly once, and turns the player to it', () => {
  const p = new Player();
  const target = new Enemy(TYPE, { x: 0, z: -1.2 });
  const other = new Enemy(TYPE, { x: 1.6, z: 0 });
  const r = p.tryAttack([other, target]);
  assert.equal(r.target, target);
  assert.equal(r.damage, PLAYER_ATTACK.damage);
  assert.equal(target.health.current, TYPE.maxHealth - PLAYER_ATTACK.damage);
  assert.equal(other.health.current, TYPE.maxHealth);
  assert.ok(Math.abs(Math.abs(p.facing) - Math.PI) < 1e-9, `facing ${p.facing}`);
  // Time passing does not apply the same hit again.
  run(1, (dt) => p.update(dt, BOUNDS));
  assert.equal(target.health.current, TYPE.maxHealth - PLAYER_ATTACK.damage);
});

test('out-of-range attack swings but deals no damage', () => {
  const p = new Player();
  const e = enemyAtGap(p, PLAYER_ATTACK.range + 0.05);
  const r = p.tryAttack([e]);
  assert.deepEqual(r, { target: null, damage: 0 });
  assert.equal(e.health.current, TYPE.maxHealth);
});

test('attack interval is enforced in game time, independent of frame rate', () => {
  for (const dt of [1 / 30, 1 / 60, 1 / 144]) {
    const p = new Player();
    const e = enemyAtGap(p, 0.1, { ...TYPE, maxHealth: 1000 });
    let hits = 0;
    const steps = Math.round(2 / dt); // 2 seconds of mashing the button every frame
    for (let i = 0; i < steps; i++) {
      if (p.tryAttack([e])?.target) hits++;
      p.update(dt, BOUNDS);
    }
    const expected = Math.floor(2 / PLAYER_ATTACK.interval);
    assert.ok(Math.abs(hits - expected) <= 1, `dt=${dt}: ${hits} hits, expected ~${expected}`);
    assert.equal(e.health.current, 1000 - hits * PLAYER_ATTACK.damage);
  }
});

test('enemy chases the player, then hits at its attack interval', () => {
  const p = new Player();
  const e = new Enemy(TYPE, { x: 6, z: 0 });
  let t = 0;
  let firstHit = null;
  let hits = 0;
  run(6, (dt) => {
    t += dt;
    p.update(dt, BOUNDS, [e]);
    if (e.update(dt, p, [p], BOUNDS) > 0) {
      hits++;
      firstHit ??= t;
    }
  });
  assert.ok(firstHit !== null, 'enemy reached and hit the player');
  const expected = 1 + Math.floor((6 - firstHit) / TYPE.attackInterval);
  assert.ok(Math.abs(hits - expected) <= 1, `${hits} hits, expected ~${expected}`);
  assert.equal(p.health.current, PLAYER_CONFIG.maxHealth - hits * TYPE.damage);
  assert.ok(edgeDistance(p, e) >= -1e-6, 'enemy does not overlap the player');
});

test('enemy out of aggro range stays idle', () => {
  const p = new Player();
  const e = enemyAtGap(p, TYPE.aggroRange + 1);
  const start = e.position.clone();
  run(2, (dt) => e.update(dt, p, [p], BOUNDS));
  assert.equal(e.state, 'idle');
  assert.ok(e.position.distanceTo(start) < 1e-9);
});

test('dead enemy stops moving and attacking', () => {
  const p = new Player();
  const e = enemyAtGap(p, 0.1);
  run(0.1, (dt) => e.update(dt, p, [p], BOUNDS));
  e.takeDamage(TYPE.maxHealth);
  assert.ok(e.dead);
  assert.equal(e.state, 'dead');
  const pos = e.position.clone();
  const hp = p.health.current;
  let dealt = 0;
  run(3, (dt) => (dealt += e.update(dt, p, [p], BOUNDS)));
  assert.equal(dealt, 0);
  assert.equal(p.health.current, hp);
  assert.ok(Math.hypot(e.position.x - pos.x, e.position.z - pos.z) < 1e-9);
  assert.equal(e.takeDamage(10), 0, 'no damage after death');
});

test('dead player cannot move or attack; enemies stop attacking it; revive restores it', () => {
  const p = new Player();
  const e = enemyAtGap(p, 0.1);
  p.takeDamage(1e9);
  assert.ok(p.dead);
  p.setMoveDirection({ x: 1, z: 0 });
  p.setMoveTarget({ x: 5, z: 5 });
  assert.equal(p.tryAttack([e]), null);
  const pos = p.position.clone();
  let dealt = 0;
  run(2, (dt) => {
    p.update(dt, BOUNDS);
    dealt += e.update(dt, p, [], BOUNDS);
  });
  assert.equal(dealt, 0);
  assert.equal(e.health.current, TYPE.maxHealth);
  assert.ok(p.position.distanceTo(pos) < 1e-9);
  p.revive({ x: 0, z: 0 });
  assert.equal(p.health.current, p.health.max);
  assert.ok(p.tryAttack([e]));
});

test('chasing enemy does not pass through a rock between it and the player', () => {
  const p = new Player();
  const rock = { x: 3, z: 0, radius: 1 };
  const e = new Enemy(TYPE, { x: 6, z: 0 });
  run(4, (dt) => {
    e.update(dt, p, [rock, p], BOUNDS);
    assert.ok(Math.hypot(e.position.x - rock.x, e.position.z - rock.z) >= rock.radius + e.radius - 1e-6);
  });
  assert.ok(e.position.x > rock.x, 'stays on its side of the rock');
});

test('knockback from hits cannot push an enemy into a rock', () => {
  const p = new Player();
  const rock = { x: 2.6, z: 0, radius: 0.6 };
  const e = new Enemy({ ...TYPE, maxHealth: 1000, knockback: 3 }, { x: 1.4, z: 0 });
  for (let i = 0; i < 5; i++) {
    e.takeDamage(1, p.position);
    e.update(DT, p, [rock, p], BOUNDS);
    assert.ok(Math.hypot(e.position.x - rock.x, e.position.z - rock.z) >= rock.radius + e.radius - 1e-6);
  }
});
