// Immutable item base data, keyed by id. Instances only reference a definition
// by `defId`; per-item state lives on the instance, so nothing an instance does
// can change these shared records (they are deep-frozen below).
//
// width / height: footprint in inventory cells.
// rarity: the base rarity a fresh instance starts with.
// icon: programmatic placeholder look (a glyph on a tinted card).
export const ITEM_DEFINITIONS = deepFreeze({
  copperBandRing: {
    id: 'copperBandRing',
    name: '銅紋指環',
    category: 'accessory',
    rarity: 'normal',
    width: 1,
    height: 1,
    icon: { glyph: '環', color: '#b8743a' },
  },
  riverstoneAmulet: {
    id: 'riverstoneAmulet',
    name: '河石墜飾',
    category: 'accessory',
    rarity: 'normal',
    width: 1,
    height: 1,
    icon: { glyph: '墜', color: '#4f8a8b' },
  },
  hideStrapBelt: {
    id: 'hideStrapBelt',
    name: '獸皮束帶',
    category: 'accessory',
    rarity: 'normal',
    width: 2,
    height: 1,
    icon: { glyph: '帶', color: '#7a5a3a' },
  },
  notchedShortsword: {
    id: 'notchedShortsword',
    name: '缺口短劍',
    category: 'weapon',
    rarity: 'normal',
    width: 1,
    height: 3,
    icon: { glyph: '劍', color: '#8a8f99' },
  },
  rivetCap: {
    id: 'rivetCap',
    name: '鉚釘盔',
    category: 'armour',
    rarity: 'normal',
    width: 2,
    height: 2,
    icon: { glyph: '盔', color: '#6d7480' },
  },
  plankBuckler: {
    id: 'plankBuckler',
    name: '木板圓盾',
    category: 'armour',
    rarity: 'normal',
    width: 2,
    height: 2,
    icon: { glyph: '盾', color: '#8b6b3d' },
  },
  quiltedVest: {
    id: 'quiltedVest',
    name: '縫綴背心',
    category: 'armour',
    rarity: 'normal',
    width: 2,
    height: 3,
    icon: { glyph: '甲', color: '#5d6b4f' },
  },
});

export const ITEM_CATEGORY_LABELS = {
  weapon: '武器',
  armour: '護甲',
  accessory: '飾品',
};

// Returns the definition for `id`, or null when unknown.
export function getItemDefinition(id) {
  return Object.hasOwn(ITEM_DEFINITIONS, id) ? ITEM_DEFINITIONS[id] : null;
}

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}
