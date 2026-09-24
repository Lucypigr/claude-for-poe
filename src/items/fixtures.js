import { getItemDefinition } from './itemDefinitions.js';
import { createItemInstance } from './ItemInstance.js';

// TEST FIXTURE — not a loot source. Pre-fills the bag so the grid UI can be
// used before ground drops exist. Every fixture instance is tagged with
// data.fixture = true. Remove once real drops can fill the bag.
export const INVENTORY_FIXTURE = [
  { defId: 'quiltedVest', x: 0, y: 0 },
  { defId: 'rivetCap', x: 2, y: 0 },
  { defId: 'plankBuckler', x: 2, y: 2 },
  { defId: 'notchedShortsword', x: 4, y: 0 },
  { defId: 'hideStrapBelt', x: 5, y: 0 },
  { defId: 'copperBandRing', x: 5, y: 1 },
  { defId: 'copperBandRing', x: 6, y: 1 },
  { defId: 'riverstoneAmulet', x: 7, y: 0 },
];

// Adds the fixture items to `inventory`. Returns the add() results.
export function seedInventoryFixture(inventory, fixture = INVENTORY_FIXTURE) {
  return fixture.map(({ defId, x, y }) =>
    inventory.add(createItemInstance(getItemDefinition(defId), { data: { fixture: true } }), x, y),
  );
}
