import { getItemDefinition } from './itemDefinitions.js';
import { cloneItemData } from './ItemInstance.js';

export const INVENTORY_STATE_VERSION = 1;

// Failure reasons returned in results (UI maps them to text).
export const PLACE_FAIL = {
  unknownItem: 'unknown-item',
  invalidPosition: 'invalid-position',
  outOfBounds: 'out-of-bounds',
  overlap: 'overlap',
  duplicateUid: 'duplicate-uid',
  notFound: 'not-found',
  noSpace: 'no-space',
  invalidState: 'invalid-state',
};

// A cols x rows grid bag of ItemInstances. It is the only thing that changes an
// instance's gridX / gridY, and every mutation is validated here and reports an
// explicit result ({ ok: true, ... } or { ok: false, reason, ... }); a failed
// operation leaves the bag and the item exactly as they were. No DOM.
export class Inventory {
  constructor({ cols, rows }, getDefinition = getItemDefinition) {
    this.cols = cols;
    this.rows = rows;
    this.getDefinition = getDefinition;
    this.cells = new Array(cols * rows).fill(null); // uid occupying each cell, or null
    this.items = new Map(); // uid -> ItemInstance
    this.listeners = new Set();
  }

  // Footprint of an item in cells, from its definition.
  sizeOf(item) {
    const def = this.getDefinition(item.defId);
    return def ? { width: def.width, height: def.height } : null;
  }

  getItem(uid) {
    return this.items.get(uid) ?? null;
  }

  getItems() {
    return [...this.items.values()];
  }

  // uid occupying cell (x, y), or null (also for cells outside the grid).
  getUidAt(x, y) {
    if (!this.inBounds(x, y)) return null;
    return this.cells[y * this.cols + x];
  }

  inBounds(x, y) {
    return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < this.cols && y < this.rows;
  }

  // Can a width x height footprint go with its top-left at (x, y)?
  // `ignoreUid` lets an item overlap its own current cells (for moves).
  checkPlacement(width, height, x, y, ignoreUid = null) {
    if (!Number.isInteger(x) || !Number.isInteger(y)) return fail(PLACE_FAIL.invalidPosition);
    if (x < 0 || y < 0 || x + width > this.cols || y + height > this.rows) {
      return fail(PLACE_FAIL.outOfBounds);
    }
    const blockers = new Set();
    for (let cy = y; cy < y + height; cy++) {
      for (let cx = x; cx < x + width; cx++) {
        const uid = this.cells[cy * this.cols + cx];
        if (uid !== null && uid !== ignoreUid) blockers.add(uid);
      }
    }
    if (blockers.size > 0) return fail(PLACE_FAIL.overlap, { blockers: [...blockers] });
    return { ok: true };
  }

  // Same as checkPlacement, for an item (definition size; ignores its own cells).
  canPlace(item, x, y) {
    const size = this.sizeOf(item);
    if (!size) return fail(PLACE_FAIL.unknownItem);
    return this.checkPlacement(size.width, size.height, x, y, this.items.has(item.uid) ? item.uid : null);
  }

  // First free top-left cell for a footprint, scanning columns left to right
  // and each column top to bottom. Returns { x, y } or null.
  findFreeSlot(width, height) {
    for (let x = 0; x + width <= this.cols; x++) {
      for (let y = 0; y + height <= this.rows; y++) {
        if (this.checkPlacement(width, height, x, y).ok) return { x, y };
      }
    }
    return null;
  }

  // Puts a new instance into the bag with its top-left at (x, y).
  add(item, x, y) {
    if (this.items.has(item.uid)) return fail(PLACE_FAIL.duplicateUid);
    const size = this.sizeOf(item);
    if (!size) return fail(PLACE_FAIL.unknownItem);
    const check = this.checkPlacement(size.width, size.height, x, y);
    if (!check.ok) return check;
    this.items.set(item.uid, item);
    this.occupy(item, size, x, y);
    this.emit();
    return { ok: true, item };
  }

  // Puts a new instance into the first free slot (for pickups later).
  addAnywhere(item) {
    if (this.items.has(item.uid)) return fail(PLACE_FAIL.duplicateUid);
    const size = this.sizeOf(item);
    if (!size) return fail(PLACE_FAIL.unknownItem);
    const slot = this.findFreeSlot(size.width, size.height);
    if (!slot) return fail(PLACE_FAIL.noSpace);
    return this.add(item, slot.x, slot.y);
  }

  // Moves an item already in the bag so its top-left is at (x, y). The item may
  // overlap its own old cells but never another item; no swapping.
  move(uid, x, y) {
    const item = this.items.get(uid);
    if (!item) return fail(PLACE_FAIL.notFound);
    const size = this.sizeOf(item);
    const check = this.checkPlacement(size.width, size.height, x, y, uid);
    if (!check.ok) return check;
    if (item.gridX === x && item.gridY === y) return { ok: true, item, moved: false };
    this.release(item, size);
    this.occupy(item, size, x, y);
    this.emit();
    return { ok: true, item, moved: true };
  }

  // Takes an item out of the bag; it keeps its uid and data, loses its cell.
  remove(uid) {
    const item = this.items.get(uid);
    if (!item) return fail(PLACE_FAIL.notFound);
    this.release(item, this.sizeOf(item));
    this.items.delete(uid);
    item.gridX = null;
    item.gridY = null;
    this.emit();
    return { ok: true, item };
  }

  occupy(item, size, x, y) {
    for (let cy = y; cy < y + size.height; cy++) {
      for (let cx = x; cx < x + size.width; cx++) this.cells[cy * this.cols + cx] = item.uid;
    }
    item.gridX = x;
    item.gridY = y;
  }

  release(item, size) {
    for (let cy = item.gridY; cy < item.gridY + size.height; cy++) {
      for (let cx = item.gridX; cx < item.gridX + size.width; cx++) this.cells[cy * this.cols + cx] = null;
    }
  }

  // Plain JSON-safe snapshot. width / height are stored so a restore can detect
  // a definition whose size changed since the save.
  serialize() {
    return {
      version: INVENTORY_STATE_VERSION,
      cols: this.cols,
      rows: this.rows,
      items: this.getItems().map((item) => {
        const size = this.sizeOf(item);
        return {
          uid: item.uid,
          defId: item.defId,
          gridX: item.gridX,
          gridY: item.gridY,
          width: size.width,
          height: size.height,
          data: cloneItemData(item.data),
        };
      }),
    };
  }

  // Replaces the contents with a serialize() snapshot. All-or-nothing: the
  // whole snapshot is validated in a scratch bag first; on any problem the
  // current contents are kept and the failing entry is reported.
  restore(state) {
    if (!state || state.version !== INVENTORY_STATE_VERSION || !Array.isArray(state.items)) {
      return fail(PLACE_FAIL.invalidState);
    }
    if (state.cols !== this.cols || state.rows !== this.rows) return fail(PLACE_FAIL.invalidState);

    const scratch = new Inventory({ cols: this.cols, rows: this.rows }, this.getDefinition);
    for (const saved of state.items) {
      if (!saved || typeof saved.uid !== 'string' || !saved.uid) return fail(PLACE_FAIL.invalidState, { uid: null });
      const def = this.getDefinition(saved.defId);
      if (!def) return fail(PLACE_FAIL.unknownItem, { uid: saved.uid });
      if (saved.width !== def.width || saved.height !== def.height) {
        return fail(PLACE_FAIL.invalidState, { uid: saved.uid });
      }
      const item = { uid: saved.uid, defId: saved.defId, gridX: null, gridY: null, data: cloneItemData(saved.data) };
      const result = scratch.add(item, saved.gridX, saved.gridY);
      if (!result.ok) return { ...result, uid: saved.uid };
    }

    for (const item of this.items.values()) {
      item.gridX = null;
      item.gridY = null;
    }
    this.cells = scratch.cells;
    this.items = scratch.items;
    this.emit();
    return { ok: true };
  }

  // Called after every successful change. Returns an unsubscribe function.
  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    for (const listener of this.listeners) listener(this);
  }

  dispose() {
    this.listeners.clear();
  }
}

function fail(reason, extra) {
  return { ok: false, reason, ...extra };
}
