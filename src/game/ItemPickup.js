import { GROUND_ITEM_CONFIG } from '../config.js';

// Walk-over pickup: moves ground items the player stands near into the bag.
// It only asks the Inventory for a legal spot (addAnywhere) and takes the item
// off the ground after the bag accepted it, so a full bag leaves the item on
// the ground untouched and nothing in the bag changes. A failed item is not
// retried every frame: only after the bag changed, or after the player left
// and came back into range. Pickup is a world interaction, so it pauses while
// world input is blocked (e.g. the bag panel is open).
//
// update() returns this frame's events: { type: 'picked' | 'blocked', item, reason }.
// 'blocked' is reported once per stay in range, not every retry.
export class ItemPickup {
  constructor(groundItems, inventory, { config = GROUND_ITEM_CONFIG, isBlocked = () => false } = {}) {
    this.groundItems = groundItems;
    this.inventory = inventory;
    this.config = config;
    this.isBlocked = isBlocked;
    this.revision = 0; // bumps on every bag change
    this.failed = new Map(); // ground entry -> bag revision of its last failed try
    this.near = [];
    this.events = [];
    this.offChange = inventory.onChange(() => this.revision++);
  }

  // player: { position, dead }.
  update(player) {
    const events = this.events;
    events.length = 0;
    if (!player || player.dead || this.isBlocked()) return events;

    const near = this.groundItems.inRange(player.position, this.config.pickupRadius, this.near);
    for (const entry of this.failed.keys()) {
      if (!near.includes(entry)) this.failed.delete(entry); // left range: report again next time
    }
    for (const entry of near) {
      const failedAt = this.failed.get(entry);
      if (failedAt === this.revision) continue; // bag unchanged since the last try
      const result = this.inventory.addAnywhere(entry.item);
      if (result.ok) {
        this.failed.delete(entry);
        this.groundItems.remove(entry);
        events.push({ type: 'picked', item: entry.item });
      } else {
        if (failedAt === undefined) events.push({ type: 'blocked', item: entry.item, reason: result.reason });
        this.failed.set(entry, this.revision);
      }
    }
    return events;
  }

  dispose() {
    this.offChange();
    this.failed.clear();
  }
}
