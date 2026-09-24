// Tunable data for the current prototype. Systems read from here instead of
// hard-coding numbers so later Parts can swap in data files without rewrites.

export const PLAYER_CONFIG = {
  moveSpeed: 6, // world units per second at full input
  turnSharpness: 14, // higher = snappier facing
  accelSharpness: 18, // higher = less velocity smoothing
  radius: 0.45, // collision circle on the X/Z plane
  stopDistance: 0.15, // click/tap move: arrived when this close to the target
  slowRadius: 0.8, // click/tap move: ease speed down inside this distance
  stuckTimeout: 0.35, // seconds without progress before a move target is dropped
  stuckProgressRatio: 0.25, // progress below this fraction of expected counts as stuck
  maxHealth: 100,
  hurtFlashTime: 0.25, // seconds the model flashes after taking damage
  respawnDelay: 3, // seconds after death before reviving at the spawn point
};

// The one basic melee attack for now. Ranges are measured edge to edge
// (distance between centers minus both collision radii) on the X/Z plane.
export const PLAYER_ATTACK = {
  name: '橫斬',
  damage: 25,
  range: 1.2,
  interval: 0.5, // seconds between swings (game time)
  swingTime: 0.18, // facing is locked toward the target while swinging
  keys: ['Space', 'KeyJ'], // KeyboardEvent.code
  keyLabel: 'Space / J',
};

// Enemy archetypes, keyed by id. Visuals are programmatic placeholders.
export const ENEMY_TYPES = {
  shaleStalker: {
    name: '頁岩潛獵者',
    maxHealth: 60,
    moveSpeed: 3.4,
    accelSharpness: 10,
    turnSharpness: 10,
    radius: 0.5,
    aggroRange: 8, // starts chasing when the player gets this close
    leashRange: 16, // gives up when the player gets this far away
    engageRange: 0.25, // stops closing in at this gap
    attackRange: 0.6, // can hit the player at this gap
    attackInterval: 1.2, // seconds between hits (game time)
    firstAttackDelay: 0.45, // wind-up after first reaching the player
    damage: 8,
    knockback: 0.35, // world units pushed back per player hit
    hurtFlashTime: 0.15,
    corpseTime: 2.5, // seconds a corpse stays before being removed
    respawnDelay: 6, // seconds after removal before the spawn point refills
    lootTable: 'shaleStalker', // key into LOOT_TABLES
    bodyColor: 0x5e6b4a,
    accentColor: 0xa4552c,
    eyeColor: 0xffc84a,
  },
};

export const ENEMY_SPAWNS = [
  { type: 'shaleStalker', x: 9, z: 4 },
  { type: 'shaleStalker', x: -8, z: 7 },
  { type: 'shaleStalker', x: 4, z: -10 },
  { type: 'shaleStalker', x: -10, z: -5 },
];

// Drop rules, keyed by id (enemy types name theirs in `lootTable`). Each death
// rolls once: with probability dropChance it drops minDrops..maxDrops items
// (uniform), each picked by weight from `entries` (defIds in ITEM_DEFINITIONS).
export const LOOT_TABLES = {
  shaleStalker: {
    dropChance: 0.7,
    minDrops: 1,
    maxDrops: 2,
    entries: [
      { defId: 'copperBandRing', weight: 14 },
      { defId: 'riverstoneAmulet', weight: 10 },
      { defId: 'hideStrapBelt', weight: 12 },
      { defId: 'notchedShortsword', weight: 10 },
      { defId: 'rivetCap', weight: 9 },
      { defId: 'plankBuckler', weight: 9 },
      { defId: 'quiltedVest', weight: 6 },
    ],
  },
};

// Items lying on the ground and their pickup.
export const GROUND_ITEM_CONFIG = {
  pickupRadius: 0.9, // player center to item center; walking this close picks it up
  hintRadius: 3.5, // labels / markers light up inside this distance
  scatterRadius: 0.9, // drops land this far from the death point
  dropSpacing: 0.75, // try to keep drops at least this far apart
  clearance: 0.45, // drops land where a circle this size fits (the player can reach them)
  flightTime: 0.35, // seconds of the little toss from the corpse to the landing spot
  cellSize: 0.26, // world units per inventory cell for the on-ground model
  labelY: 0.75, // label anchor height above the ground
  maxLabels: 12, // label elements are pooled; only the nearest this many are shown
  labelGap: 3, // px between stacked labels
  noticeTime: 1.8, // seconds a pickup / bag-full notice stays up
};

// Text / marker color per rarity. Unknown rarities fall back to normal.
export const RARITY_COLORS = {
  normal: '#e6e0d0',
  magic: '#8fb0ff',
  rare: '#f0d468',
};

export const FX_CONFIG = {
  slashTime: 0.2,
  sparkTime: 0.3,
  deathBurstTime: 0.6,
  slashColor: 0xf3e3b0,
  enemyHitColor: 0xffb347,
  playerHitColor: 0xff4a3a,
  deathColor: 0xb8b2a2,
  healthBarWidth: 1.1,
  healthBarHeight: 0.13,
  healthBarY: 1.55,
};

// Grid bag. Item sizes come from ITEM_DEFINITIONS (src/items/itemDefinitions.js).
export const INVENTORY_CONFIG = {
  cols: 12,
  rows: 5,
  toggleKeys: ['KeyI'], // KeyboardEvent.code, open / close
  closeKeys: ['Escape'],
  keyLabel: 'I',
  dragThreshold: 6, // px a pointer must travel before a press becomes a drag
  messageTime: 1.6, // seconds a "cannot place" message stays up
};

export const CAMERA_CONFIG = {
  distance: 20,
  pitchDeg: 55, // angle above the ground plane
  yawDeg: 45, // fixed diagonal view, never rotates at runtime
  fovDeg: 40,
  minHorizontalFovDeg: 42, // keeps portrait phones from getting a narrow view
  maxFovDeg: 75,
  followSharpness: 7,
  near: 0.5,
  far: 200,
};

export const WORLD_CONFIG = {
  groundSize: 80,
  playBounds: 36, // player is kept inside [-playBounds, playBounds] on X and Z
  propSeed: 7,
  propCount: 40,
  rockColliderScale: 0.85, // collider radius = rock scale * this (rocks are irregular)
};

export const RENDER_CONFIG = {
  maxPixelRatio: 2,
  clearColor: 0x0d0f14,
};
