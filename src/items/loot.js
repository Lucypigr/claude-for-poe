import { getItemDefinition } from './itemDefinitions.js';
import { createItemInstance } from './ItemInstance.js';

// Rolls one drop from a loot table (see LOOT_TABLES in config.js) and returns
// fresh ItemInstances, each with its own uid; [] when nothing drops. No DOM,
// no scene: where the items end up is the caller's business.
//
// rng: () => number in [0, 1). Injected so tests can force exact outcomes.
// Draw order: 1 for the drop chance, then (only if something drops) 1 for the
// count when minDrops < maxDrops, then 1 per item for the weighted pick.
export function rollLoot(table, rng = Math.random, getDefinition = getItemDefinition) {
  if (!table || rng() >= table.dropChance) return [];
  const { minDrops, maxDrops } = table;
  const count = maxDrops > minDrops ? minDrops + Math.floor(rng() * (maxDrops - minDrops + 1)) : minDrops;
  const items = [];
  for (let i = 0; i < count; i++) {
    const defId = pickWeighted(table.entries, rng());
    const def = getDefinition(defId);
    if (!def) throw new Error(`Loot table references unknown item "${defId}"`);
    items.push(createItemInstance(def));
  }
  return items;
}

// roll in [0, 1) -> the defId of the entry whose weight band contains it.
export function pickWeighted(entries, roll) {
  let total = 0;
  for (const e of entries) total += e.weight;
  let at = roll * total;
  for (const e of entries) {
    if (at < e.weight) return e.defId;
    at -= e.weight;
  }
  return entries[entries.length - 1].defId;
}
