// A concrete item: one per physical item in the game, whatever container it is
// in (bag today; ground and equipment later). Identity is `uid`, never the name.
//
// {
//   uid:   unique string id,
//   defId: ItemDefinition id (size, name and look come from the definition),
//   gridX, gridY: top-left cell while inside an inventory grid, else null,
//   data:  per-instance JSON-safe state reserved for later systems
//          (rarity override, affixes, sockets/links, ...). Never shared.
// }

// Random ids so instances created after a restore never collide with saved
// ones. Uses getRandomValues (unlike randomUUID it also works on plain-http LAN
// dev servers).
export function generateItemUid() {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return `itm_${Date.now().toString(36)}_${hex}`;
}

export function createItemInstance(definition, { uid = generateItemUid(), data = {} } = {}) {
  return {
    uid,
    defId: definition.id,
    gridX: null,
    gridY: null,
    data: cloneItemData(data),
  };
}

// Deep copy of JSON-safe instance data, so two instances never share objects.
export function cloneItemData(data) {
  return data === undefined ? {} : JSON.parse(JSON.stringify(data));
}
