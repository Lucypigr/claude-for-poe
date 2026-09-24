import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Inventory, PLACE_FAIL } from '../src/items/Inventory.js';
import { ITEM_DEFINITIONS, getItemDefinition } from '../src/items/itemDefinitions.js';
import { createItemInstance, generateItemUid } from '../src/items/ItemInstance.js';
import { INVENTORY_FIXTURE, seedInventoryFixture } from '../src/items/fixtures.js';
import { INVENTORY_CONFIG } from '../src/config.js';

const RING = ITEM_DEFINITIONS.copperBandRing; // 1x1
const CAP = ITEM_DEFINITIONS.rivetCap; // 2x2
const VEST = ITEM_DEFINITIONS.quiltedVest; // 2x3

function bag() {
  return new Inventory(INVENTORY_CONFIG);
}

// Snapshot of occupancy as rows of uid-or-dot, for exact before/after checks.
function cellsOf(inv) {
  return [...inv.cells];
}

function occupiedBy(inv, uid) {
  const out = [];
  for (let y = 0; y < inv.rows; y++) {
    for (let x = 0; x < inv.cols; x++) if (inv.getUidAt(x, y) === uid) out.push(`${x},${y}`);
  }
  return out;
}

test('bag is 12 x 5 = 60 empty cells', () => {
  const inv = bag();
  assert.equal(inv.cols, 12);
  assert.equal(inv.rows, 5);
  assert.equal(inv.cells.length, 60);
  assert.ok(inv.cells.every((c) => c === null));
});

test('definitions are immutable and include 1x1 and multi-cell sizes', () => {
  assert.ok(Object.isFrozen(ITEM_DEFINITIONS) && Object.isFrozen(RING) && Object.isFrozen(RING.icon));
  assert.throws(() => {
    RING.width = 3;
  });
  const sizes = Object.values(ITEM_DEFINITIONS).map((d) => `${d.width}x${d.height}`);
  assert.ok(sizes.includes('1x1') && sizes.includes('2x2') && sizes.includes('2x3'));
  assert.equal(getItemDefinition('nope'), null);
  assert.equal(getItemDefinition('toString'), null);
});

test('instances get unique uids and never share or alter definition data', () => {
  const uids = new Set();
  for (let i = 0; i < 1000; i++) uids.add(generateItemUid());
  assert.equal(uids.size, 1000);

  const data = { quality: 5, affixes: [{ id: 'a' }] };
  const a = createItemInstance(RING, { data });
  const b = createItemInstance(RING, { data });
  assert.notEqual(a.uid, b.uid);
  assert.equal(a.defId, 'copperBandRing');
  assert.deepEqual([a.gridX, a.gridY], [null, null]);
  a.data.affixes.push({ id: 'b' });
  assert.equal(b.data.affixes.length, 1);
  assert.equal(data.affixes.length, 1);
  a.data.name = 'renamed';
  assert.equal(RING.name, '銅紋指環');
});

test('1x1 and multi-cell items place legally and occupy their whole footprint', () => {
  const inv = bag();
  const ring = createItemInstance(RING);
  const vest = createItemInstance(VEST);
  assert.equal(inv.add(ring, 11, 4).ok, true);
  assert.equal(inv.add(vest, 0, 0).ok, true);
  assert.deepEqual([vest.gridX, vest.gridY], [0, 0]);
  assert.deepEqual(occupiedBy(inv, ring.uid), ['11,4']);
  assert.deepEqual(occupiedBy(inv, vest.uid), ['0,0', '1,0', '0,1', '1,1', '0,2', '1,2']);
  assert.equal(inv.getItems().length, 2);
});

test('out-of-bounds and overlapping placements fail and change nothing', () => {
  const inv = bag();
  const cap = createItemInstance(CAP);
  inv.add(cap, 3, 1);
  const before = cellsOf(inv);

  for (const [x, y] of [[-1, 0], [11, 0], [0, 4], [12, 0], [0, 5], [10, 4]]) {
    const r = inv.add(createItemInstance(CAP), x, y);
    assert.equal(r.ok, false, `${x},${y}`);
    assert.equal(r.reason, PLACE_FAIL.outOfBounds);
  }
  assert.equal(inv.add(createItemInstance(CAP), 1.5, 0).reason, PLACE_FAIL.invalidPosition);

  const vest = createItemInstance(VEST);
  const r = inv.add(vest, 2, 0); // covers x 2-3, y 0-2 -> hits the cap
  assert.equal(r.ok, false);
  assert.equal(r.reason, PLACE_FAIL.overlap);
  assert.deepEqual(r.blockers, [cap.uid]);
  assert.deepEqual([vest.gridX, vest.gridY], [null, null]);
  assert.deepEqual(cellsOf(inv), before);
  assert.equal(inv.getItems().length, 1);
});

test('adding the same uid twice or an unknown definition fails', () => {
  const inv = bag();
  const ring = createItemInstance(RING);
  inv.add(ring, 0, 0);
  assert.equal(inv.add(ring, 5, 0).reason, PLACE_FAIL.duplicateUid);
  assert.equal(inv.add({ ...createItemInstance(RING), defId: 'missing' }, 5, 0).reason, PLACE_FAIL.unknownItem);
  assert.deepEqual(occupiedBy(inv, ring.uid), ['0,0']);
});

test('invalid moves leave the item and the bag exactly as they were', () => {
  const inv = bag();
  const vest = createItemInstance(VEST);
  const cap = createItemInstance(CAP);
  inv.add(vest, 0, 0);
  inv.add(cap, 4, 0);
  const before = cellsOf(inv);
  let changes = 0;
  inv.onChange(() => changes++);

  assert.equal(inv.move(vest.uid, 11, 0).reason, PLACE_FAIL.outOfBounds);
  assert.equal(inv.move(vest.uid, 0, 3).reason, PLACE_FAIL.outOfBounds);
  assert.equal(inv.move(vest.uid, 3, 0).reason, PLACE_FAIL.overlap);
  assert.equal(inv.move('missing', 0, 0).reason, PLACE_FAIL.notFound);
  assert.deepEqual([vest.gridX, vest.gridY], [0, 0]);
  assert.deepEqual([cap.gridX, cap.gridY], [4, 0]);
  assert.deepEqual(cellsOf(inv), before);
  assert.equal(changes, 0);
});

test('a legal move frees old cells and occupies all new ones (overlapping itself is fine)', () => {
  const inv = bag();
  const vest = createItemInstance(VEST);
  inv.add(vest, 0, 0);
  const r = inv.move(vest.uid, 1, 1); // overlaps its own old cells
  assert.equal(r.ok, true);
  assert.equal(r.moved, true);
  assert.deepEqual([vest.gridX, vest.gridY], [1, 1]);
  assert.deepEqual(occupiedBy(inv, vest.uid), ['1,1', '2,1', '1,2', '2,2', '1,3', '2,3']);
  assert.equal(inv.getUidAt(0, 0), null);
  assert.equal(inv.cells.filter((c) => c !== null).length, 6);
  assert.equal(inv.move(vest.uid, 1, 1).moved, false);
});

test('instances of the same definition move independently by uid', () => {
  const inv = bag();
  const a = createItemInstance(RING);
  const b = createItemInstance(RING);
  inv.add(a, 0, 0);
  inv.add(b, 1, 0);
  assert.equal(inv.move(b.uid, 0, 0).reason, PLACE_FAIL.overlap);
  assert.equal(inv.move(a.uid, 5, 4).ok, true);
  assert.deepEqual([a.gridX, a.gridY, b.gridX, b.gridY], [5, 4, 1, 0]);
  assert.equal(inv.getUidAt(5, 4), a.uid);
  assert.equal(inv.getUidAt(1, 0), b.uid);
});

test('addAnywhere fills the first free slot and reports a full bag', () => {
  const inv = bag();
  inv.add(createItemInstance(CAP), 0, 0);
  const vest = createItemInstance(VEST);
  assert.equal(inv.addAnywhere(vest).ok, true);
  assert.deepEqual([vest.gridX, vest.gridY], [0, 2]); // column-major scan
  const full = bag();
  for (let i = 0; i < 60; i++) assert.equal(full.addAnywhere(createItemInstance(RING)).ok, true);
  assert.equal(full.addAnywhere(createItemInstance(RING)).reason, PLACE_FAIL.noSpace);
});

test('remove frees the cells and keeps the instance identity and data', () => {
  const inv = bag();
  const cap = createItemInstance(CAP, { data: { quality: 3 } });
  inv.add(cap, 2, 2);
  const r = inv.remove(cap.uid);
  assert.equal(r.ok, true);
  assert.equal(r.item, cap);
  assert.deepEqual([cap.gridX, cap.gridY, cap.data.quality], [null, null, 3]);
  assert.ok(inv.cells.every((c) => c === null));
  assert.equal(inv.remove(cap.uid).reason, PLACE_FAIL.notFound);
});

test('JSON serialize / restore keeps uid, position, size and instance data', () => {
  const inv = bag();
  const vest = createItemInstance(VEST, { data: { sockets: [{ color: 'r' }], quality: 7 } });
  const ring = createItemInstance(RING);
  inv.add(vest, 3, 1);
  inv.add(ring, 11, 4);

  const json = JSON.stringify(inv.serialize());
  const copy = bag();
  const r = copy.restore(JSON.parse(json));
  assert.equal(r.ok, true);
  assert.deepEqual(copy.serialize(), inv.serialize());
  const restored = copy.getItem(vest.uid);
  assert.deepEqual([restored.gridX, restored.gridY], [3, 1]);
  assert.deepEqual(copy.sizeOf(restored), { width: 2, height: 3 });
  assert.deepEqual(restored.data, { sockets: [{ color: 'r' }], quality: 7 });
  assert.notEqual(restored.data, vest.data);
  assert.deepEqual(occupiedBy(copy, vest.uid), occupiedBy(inv, vest.uid));
  assert.equal(copy.getUidAt(11, 4), ring.uid);
});

test('a bad snapshot is rejected and the current contents are kept', () => {
  const inv = bag();
  const ring = createItemInstance(RING);
  inv.add(ring, 0, 0);
  const before = cellsOf(inv);
  const good = inv.serialize();

  const overlapping = structuredClone(good);
  overlapping.items.push({ ...overlapping.items[0], uid: 'other' });
  const duplicate = structuredClone(good);
  duplicate.items.push({ ...duplicate.items[0], gridX: 5 });
  const resized = structuredClone(good);
  resized.items[0].width = 2;
  const unknown = structuredClone(good);
  unknown.items[0].defId = 'missing';
  const outside = structuredClone(good);
  outside.items[0].gridX = 12;

  assert.equal(inv.restore(overlapping).reason, PLACE_FAIL.overlap);
  assert.equal(inv.restore(duplicate).reason, PLACE_FAIL.duplicateUid);
  assert.equal(inv.restore(resized).reason, PLACE_FAIL.invalidState);
  assert.equal(inv.restore(unknown).reason, PLACE_FAIL.unknownItem);
  assert.equal(inv.restore(outside).reason, PLACE_FAIL.outOfBounds);
  assert.equal(inv.restore({ ...good, version: 99 }).reason, PLACE_FAIL.invalidState);
  assert.equal(inv.restore({ ...good, cols: 10 }).reason, PLACE_FAIL.invalidState);
  assert.equal(inv.restore(null).reason, PLACE_FAIL.invalidState);
  assert.deepEqual(cellsOf(inv), before);
  assert.equal(inv.getItem(ring.uid), ring);
});

test('the test fixture seeds cleanly and tags its items', () => {
  const inv = bag();
  const results = seedInventoryFixture(inv);
  assert.ok(results.every((r) => r.ok));
  assert.equal(inv.getItems().length, INVENTORY_FIXTURE.length);
  assert.ok(inv.getItems().every((item) => item.data.fixture === true));
});
