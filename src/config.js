// Tunable data for the current prototype. Systems read from here instead of
// hard-coding numbers so later Parts can swap in data files without rewrites.

export const PLAYER_CONFIG = {
  moveSpeed: 6, // world units per second at full input
  turnSharpness: 14, // higher = snappier facing
  accelSharpness: 18, // higher = less velocity smoothing
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
};

export const RENDER_CONFIG = {
  maxPixelRatio: 2,
  clearColor: 0x0d0f14,
};
