import { getItemDefinition } from './itemDefinitions.js';
import { createItemInstance } from './ItemInstance.js';

// TEST FIXTURE — not a loot source. Fills a bag with sample items for tests
// and the dev-only `window.__game.debug.seedFixture()` tool; normal startup
// never uses it. Every fixture instance is tagged with data.fixture = true.
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
