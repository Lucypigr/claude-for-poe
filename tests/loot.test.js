import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { rollLoot, pickWeighted } from '../src/items/loot.js';
import { ITEM_DEFINITIONS, getItemDefinition } from '../src/items/itemDefinitions.js';
import { createItemInstance } from '../src/items/ItemInstance.js';
import { Inventory, PLACE_FAIL } from '../src/items/Inventory.js';
import { GroundItems } from '../src/game/GroundItems.js';
import { ItemPickup } from '../src/game/ItemPickup.js';
import { Enemy } from '../src/game/Enemy.js';
import { World } from '../src/game/World.js';
import { LOOT_TABLES, ENEMY_TYPES, GROUND_ITEM_CONFIG, INVENTORY_CONFIG } from '../src/config.js';

const DT = 1 / 60;
const TYPE = ENEMY_TYPES.shaleStalker;
const RING = ITEM_DEFINITIONS.copperBandRing; // 1x1
const VEST = ITEM_DEFINITIONS.quiltedVest; // 2x3
const PICKUP = GROUND_ITEM_CONFIG.pickupRadius;

// rng that replays `values`, then repeats the last one.
function seq(...values) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

const TABLE = {
  dropChance: 0.5,
  minDrops: 1,
  maxDrops: 3,
  entries: [
    { defId: 'copperBandRing', weight: 1 },
    { defId: 'rivetCap', weight: 3 },
  ],
};

function fakePlayer(x = 0, z = 0) {
  return { position: new THREE.Vector3(x, 0, z), dead: false };
}

function ground() {
  return new GroundItems(new THREE.Scene());
}

// A bag whose every cell holds a 1x1 ring.
function fullBag() {
  const inv = new Inventory(INVENTORY_CONFIG);
  for (let i = 0; i < inv.cols * inv.rows; i++) assert.ok(inv.addAnywhere(createItemInstance(RING)).ok);
  return inv;
}

// World with one enemy spawn next to the player, and a loot rng that always drops.
function worldWithEnemy(rng = () => 0) {
  return new World(undefined, [{ type: 'shaleStalker', x: 1.5, z: 0 }], { rng });
}

function run(seconds, fn) {
  for (let i = 0, n = Math.round(seconds / DT); i < n; i++) fn(DT);
}

test('every loot table entry references an existing definition with a positive weight', () => {
  for (const [id, table] of Object.entries(LOOT_TABLES)) {
    assert.ok(table.dropChance > 0 && table.dropChance <= 1, id);
    assert.ok(Number.isInteger(table.minDrops) && table.maxDrops >= table.minDrops && table.minDrops >= 1, id);
    for (const e of table.entries) {
      assert.ok(getItemDefinition(e.defId), `${id}: ${e.defId}`);
      assert.ok(e.weight > 0, `${id}: ${e.defId}`);
    }
  }
  for (const type of Object.values(ENEMY_TYPES)) assert.ok(LOOT_TABLES[type.lootTable], type.name);
});

test('fixed rng: a roll at or above dropChance drops nothing, below it drops', () => {
  assert.deepEqual(rollLoot(TABLE, seq(0.5)), []);
  assert.deepEqual(rollLoot(TABLE, seq(0.99)), []);
  // chance 0.49 -> drop; count roll 0 -> minDrops (1); pick 0.1 -> first band (ring).
  const one = rollLoot(TABLE, seq(0.49, 0, 0.1));
  assert.equal(one.length, 1);
  assert.equal(one[0].defId, 'copperBandRing');
  // count roll 0.99 -> maxDrops (3); picks land in the cap band (weights 1:3).
  const three = rollLoot(TABLE, seq(0, 0.99, 0.3, 0.9, 0.26));
  assert.deepEqual(three.map((i) => i.defId), ['rivetCap', 'rivetCap', 'rivetCap']);
  assert.equal(pickWeighted(TABLE.entries, 0.2499), 'copperBandRing');
  assert.equal(pickWeighted(TABLE.entries, 0.25), 'rivetCap');
  assert.throws(() => rollLoot({ ...TABLE, entries: [{ defId: 'nope', weight: 1 }] }, () => 0));
});

test('drops are fresh instances with unique uids and leave definitions untouched', () => {
  const before = JSON.stringify(ITEM_DEFINITIONS);
  const items = [];
  for (let i = 0; i < 50; i++) items.push(...rollLoot(TABLE, seq(0, 0.99, 0.1, 0.5, 0.9)));
  assert.equal(items.length, 150);
  assert.equal(new Set(items.map((i) => i.uid)).size, 150);
  assert.ok(items.every((i) => i.gridX === null && i.gridY === null && !i.data.fixture));
  items[0].data.note = 'mine';
  assert.equal(items[1].data.note, undefined);
  assert.equal(JSON.stringify(ITEM_DEFINITIONS), before);
  assert.ok(Object.isFrozen(ITEM_DEFINITIONS.rivetCap));
});

test('an enemy death can be claimed for loot exactly once', () => {
  const e = new Enemy(TYPE, { x: 0, z: 0 });
  assert.equal(e.claimLoot(), false); // alive
  e.takeDamage(1e9);
  assert.equal(e.claimLoot(), true);
  assert.equal(e.claimLoot(), false);
  e.takeDamage(10);
  assert.equal(e.claimLoot(), false);
});

test('killing an enemy puts its drop on the ground near the corpse, not in a bag', () => {
  const world = worldWithEnemy(seq(0, 0, 0)); // drop, 1 item (count roll 0), first entry
  const enemy = world.enemies[0];
  const at = { x: enemy.position.x, z: enemy.position.z };
  enemy.takeDamage(1e9);
  world.update(DT);
  assert.equal(world.groundItems.entries.length, 1);
  const entry = world.groundItems.entries[0];
  assert.equal(entry.item.defId, LOOT_TABLES.shaleStalker.entries[0].defId);
  assert.equal(entry.item.gridX, null);
  assert.ok(Math.hypot(entry.x - at.x, entry.z - at.z) <= GROUND_ITEM_CONFIG.scatterRadius * 2 + 1e-6);
  assert.equal(entry.object.parent, world.scene);
  world.dispose();
});

test('a nothing-drop roll leaves the ground empty', () => {
  const world = worldWithEnemy(() => 0.999);
  world.enemies[0].takeDamage(1e9);
  run(1, (dt) => world.update(dt));
  assert.equal(world.groundItems.entries.length, 0);
  world.dispose();
});

test('death animation, corpse removal and respawn never repeat a drop', () => {
  const world = worldWithEnemy(() => 0); // always drops minDrops items
  const perDeath = LOOT_TABLES.shaleStalker.minDrops;
  world.player.position.set(-30, 0, -30); // out of aggro so the enemy stays put
  const first = world.enemies[0];
  first.takeDamage(1e9);
  run(TYPE.corpseTime + TYPE.respawnDelay + 1, (dt) => world.update(dt));
  assert.ok(!world.enemies.includes(first), 'corpse removed');
  assert.equal(world.enemies.length, 1, 'respawned');
  assert.equal(world.groundItems.entries.length, perDeath);

  // The respawned enemy is a new life with its own single drop.
  world.enemies[0].takeDamage(1e9);
  run(TYPE.corpseTime + 1, (dt) => world.update(dt));
  assert.equal(world.groundItems.entries.length, perDeath * 2);
  assert.equal(new Set(world.groundItems.entries.map((e) => e.item.uid)).size, perDeath * 2);
  world.dispose();
});

test('multiple drops land apart and outside rocks', () => {
  const world = worldWithEnemy(() => 0);
  const origin = { x: 5, z: 5 };
  world.colliders.push({ x: 5.9, z: 5, radius: 0.6 });
  for (let i = 0; i < 4; i++) {
    const at = world.groundItems.findLandingSpot(origin, 0, world.colliders, world.config.playBounds);
    world.groundItems.add(createItemInstance(RING), at, origin);
  }
  const spots = world.groundItems.entries;
  for (const a of spots) {
    for (const c of world.colliders) {
      assert.ok(Math.hypot(a.x - c.x, a.z - c.z) >= c.radius + GROUND_ITEM_CONFIG.clearance - 1e-6);
    }
    for (const b of spots) {
      if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= GROUND_ITEM_CONFIG.dropSpacing - 1e-6);
    }
  }
  world.dispose();
});

test('ground items outside the pickup radius stay; walking in adds them to the bag via its grid rules', () => {
  const g = ground();
  const inv = new Inventory(INVENTORY_CONFIG);
  const pickup = new ItemPickup(g, inv);
  const item = createItemInstance(VEST, { data: { note: 'kept' } });
  const entry = g.add(item, { x: 3, z: 0 });
  const player = fakePlayer(3 - PICKUP - 0.05, 0);

  assert.deepEqual(pickup.update(player), []);
  assert.equal(g.entries.length, 1);
  assert.equal(inv.getItems().length, 0);

  let disposed = 0;
  entry.materials.forEach((m) => m.addEventListener('dispose', () => disposed++));
  player.position.x = 3 - PICKUP + 0.05;
  const events = pickup.update(player);
  assert.deepEqual(events.map((e) => e.type), ['picked']);
  assert.equal(events[0].item, item);
  assert.equal(g.entries.length, 0);
  assert.equal(entry.object.parent, null);
  assert.equal(disposed, entry.materials.length);
  // Same instance, same uid and data, placed legally at the first free slot.
  assert.equal(inv.getItem(item.uid), item);
  assert.deepEqual(item.data, { note: 'kept' });
  assert.deepEqual([item.gridX, item.gridY], [0, 0]);
  assert.equal(inv.cells.filter((c) => c === item.uid).length, VEST.width * VEST.height);
  pickup.dispose();
  g.dispose();
});

test('a full bag leaves the item on the ground and the bag unchanged; freeing space picks it up', () => {
  const g = ground();
  const inv = fullBag();
  const pickup = new ItemPickup(g, inv);
  const item = createItemInstance(RING);
  g.add(item, { x: 0, z: 0 });
  const before = JSON.stringify(inv.serialize());
  const player = fakePlayer(0, 0);

  const events = pickup.update(player);
  assert.deepEqual(events.map((e) => [e.type, e.reason]), [['blocked', PLACE_FAIL.noSpace]]);
  // Standing there does not spam the notice or change anything.
  for (let i = 0; i < 30; i++) assert.deepEqual(pickup.update(player), []);
  assert.equal(g.entries.length, 1);
  assert.equal(g.entries[0].item, item);
  assert.equal(JSON.stringify(inv.serialize()), before);
  assert.equal(inv.getItem(item.uid), null);

  // Leaving and coming back reports it again.
  player.position.x = 10;
  pickup.update(player);
  player.position.x = 0;
  assert.equal(pickup.update(player)[0].type, 'blocked');

  inv.remove(inv.getUidAt(7, 2));
  assert.deepEqual(pickup.update(player).map((e) => e.type), ['picked']);
  assert.deepEqual([item.gridX, item.gridY], [7, 2]);
  assert.equal(g.entries.length, 0);
  pickup.dispose();
  g.dispose();
});

test('free cells without room for the footprint keep a large item on the ground', () => {
  const g = ground();
  const inv = fullBag();
  // Free a 1-wide column: 5 cells, but a 2x3 vest does not fit.
  for (let y = 0; y < inv.rows; y++) inv.remove(inv.getUidAt(4, y));
  const pickup = new ItemPickup(g, inv);
  const vest = createItemInstance(VEST);
  g.add(vest, { x: 0, z: 0 });
  assert.equal(pickup.update(fakePlayer())[0].reason, PLACE_FAIL.noSpace);
  assert.equal(g.entries.length, 1);
  assert.equal(inv.getItems().length, 55);
  // A 1x1 item next to it still fits.
  const ring = createItemInstance(RING);
  g.add(ring, { x: 0.3, z: 0 });
  const events = pickup.update(fakePlayer());
  assert.deepEqual(events.map((e) => [e.type, e.item.uid]), [['picked', ring.uid]]);
  assert.equal(g.entries.length, 1);
  assert.equal(g.entries[0].item, vest);
  pickup.dispose();
  g.dispose();
});

test('several items in range are each picked up once, nearest first', () => {
  const g = ground();
  const inv = new Inventory(INVENTORY_CONFIG);
  const pickup = new ItemPickup(g, inv);
  const far = createItemInstance(RING);
  const near = createItemInstance(RING);
  g.add(far, { x: 0.6, z: 0 });
  g.add(near, { x: 0.1, z: 0 });
  const events = pickup.update(fakePlayer());
  assert.deepEqual(events.map((e) => e.item.uid), [near.uid, far.uid]);
  assert.deepEqual(pickup.update(fakePlayer()), []);
  assert.equal(inv.getItems().length, 2);
  pickup.dispose();
  g.dispose();
});

test('pickup pauses while world input is blocked and for a dead player', () => {
  const g = ground();
  const inv = new Inventory(INVENTORY_CONFIG);
  let blocked = true;
  const pickup = new ItemPickup(g, inv, { isBlocked: () => blocked });
  g.add(createItemInstance(RING), { x: 0, z: 0 });
  const player = fakePlayer();
  assert.deepEqual(pickup.update(player), []);
  blocked = false;
  player.dead = true;
  assert.deepEqual(pickup.update(player), []);
  assert.equal(g.entries.length, 1);
  player.dead = false;
  assert.equal(pickup.update(player).length, 1);
  assert.equal(inv.getItems().length, 1);
  pickup.dispose();
  g.dispose();
});

test('removing ground items frees their materials; dispose frees shared geometry', () => {
  const g = ground();
  const entries = [g.add(createItemInstance(RING), { x: 0, z: 0 }), g.add(createItemInstance(VEST), { x: 2, z: 0 })];
  let materials = 0;
  let geometries = 0;
  entries.forEach((e) => e.materials.forEach((m) => m.addEventListener('dispose', () => materials++)));
  [g.plateGeometry, g.markerGeometry, g.beamGeometry].forEach((geo) => geo.addEventListener('dispose', () => geometries++));
  assert.equal(g.remove(entries[0]), entries[0].item);
  assert.equal(g.remove(entries[0]), null); // second removal is a no-op
  g.dispose();
  assert.equal(materials, 6);
  assert.equal(geometries, 3);
  assert.equal(g.entries.length, 0);
  assert.equal(g.scene.children.length, 0);
});
