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
