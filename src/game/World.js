import * as THREE from 'three';
import { WORLD_CONFIG, ENEMY_TYPES, ENEMY_SPAWNS, FX_CONFIG, LOOT_TABLES } from '../config.js';
import { Player } from './Player.js';
import { Enemy } from './Enemy.js';
import { Effects } from './Effects.js';
import { GroundItems } from './GroundItems.js';
import { nearestFreePoint } from './collision.js';
import { rollLoot } from '../items/loot.js';

// The game scene: environment + entities. Rendering and input live elsewhere.
// Enemy deaths drop loot onto the ground (groundItems); picking it up into the
// bag is a separate system (ItemPickup) owned by Game.
// rng: () => [0, 1), injectable so loot rolls are reproducible in tests.
export class World {
  constructor(config = WORLD_CONFIG, spawns = ENEMY_SPAWNS, { rng = Math.random, lootTables = LOOT_TABLES } = {}) {
    this.config = config;
    this.rng = rng;
    this.lootTables = lootTables;
    this.colliders = []; // static circle colliders {x, z, radius} on the X/Z plane
    this.raycaster = new THREE.Raycaster();
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x0d0f14, 30, 70);

    this.addLights();
    this.addGround();
    this.addProps();

    this.player = new Player();
    this.scene.add(this.player.object);
    this.playerSpawn = { x: 0, z: 0 };

    this.effects = new Effects(this.scene);
    this.groundItems = new GroundItems(this.scene);
    this.enemies = [];
    this.focusEnemy = null; // last enemy the player fought, shown in the HUD
    this.bodyColliders = []; // scratch list: rocks + moving bodies, rebuilt per mover
    this.spawns = spawns.map((s) => ({ type: ENEMY_TYPES[s.type], x: s.x, z: s.z, enemy: null, timer: 0 }));
    this.spawns.forEach((spawn) => this.spawnEnemy(spawn));
  }

  spawnEnemy(spawn) {
    const bodies = this.collidersFor(null);
    const at = nearestFreePoint(spawn, spawn.type.radius, bodies, this.config.playBounds);
    const enemy = new Enemy(spawn.type, at);
    spawn.enemy = enemy;
    this.enemies.push(enemy);
    this.scene.add(enemy.object);
    return enemy;
  }

  removeEnemy(enemy) {
    const i = this.enemies.indexOf(enemy);
    if (i >= 0) this.enemies.splice(i, 1);
    if (this.focusEnemy === enemy) this.focusEnemy = null;
    enemy.dispose();
  }

  // Rolls the enemy's loot table once and puts the drops on the ground around
  // the corpse. Returns the ground entries created.
  dropLoot(enemy) {
    const items = rollLoot(this.lootTables[enemy.type.lootTable], this.rng);
    if (items.length === 0) return [];
    const origin = { x: enemy.position.x, z: enemy.position.z };
    const startAngle = this.rng() * Math.PI * 2;
    return items.map((item, i) => {
      const angle = startAngle + (i * Math.PI * 2) / items.length;
      const at = this.groundItems.findLandingSpot(origin, angle, this.colliders, this.config.playBounds);
      return this.groundItems.add(item, at, origin);
    });
  }

  // Static rocks plus every living body except `self`, for circle collision.
  collidersFor(self) {
    const list = this.bodyColliders;
    list.length = 0;
    for (const c of this.colliders) list.push(c);
    if (self !== this.player && !this.player.dead) list.push(this.player);
    for (const e of this.enemies) if (e !== self && !e.dead) list.push(e);
    return list;
  }

  // Swing the player's basic attack. Returns Player.tryAttack()'s result.
  playerAttack() {
    const player = this.player;
    const result = player.tryAttack(this.enemies);
    if (!result) return null;
    const reach = player.radius + player.attack.range;
    this.effects.spawnSlash(player.position, player.facing, reach, !!result.target);
    if (result.target) {
      this.focusEnemy = result.target;
      this.effects.spawnSpark(result.target.position, FX_CONFIG.enemyHitColor);
      if (result.target.dead) this.effects.spawnDeathBurst(result.target.position);
    }
    return result;
  }

  addLights() {
    this.scene.add(new THREE.HemisphereLight(0xbfc8d8, 0x2a2118, 0.9));

    const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
    sun.position.set(8, 16, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const s = sun.shadow.camera;
    s.left = -14;
    s.right = 14;
    s.top = 14;
    s.bottom = -14;
    s.near = 1;
    s.far = 40;
    this.sun = sun;
    this.scene.add(sun, sun.target);
  }

  addGround() {
    const size = this.config.groundSize;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshStandardMaterial({ color: 0x3a3a2e, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.ground = ground;

    const grid = new THREE.GridHelper(size, size / 2, 0x55553f, 0x46463a);
    grid.position.y = 0.01;
    this.scene.add(grid);
  }

  // Scattered stones give a sense of motion; deterministic for reproducibility.
  addProps() {
    const rand = mulberry32(this.config.propSeed);
    const geometry = new THREE.DodecahedronGeometry(1, 0);
    const material = new THREE.MeshStandardMaterial({ color: 0x6b6558, roughness: 0.9, flatShading: true });
    const limit = this.config.playBounds;
    for (let i = 0; i < this.config.propCount; i++) {
      const x = (rand() * 2 - 1) * limit;
      const z = (rand() * 2 - 1) * limit;
      if (Math.hypot(x, z) < 4) continue; // keep the spawn area clear
      const rock = new THREE.Mesh(geometry, material);
      const scale = 0.4 + rand() * 0.9;
      rock.scale.set(scale, scale * (0.6 + rand() * 0.6), scale);
      rock.position.set(x, scale * 0.4, z);
      rock.rotation.y = rand() * Math.PI;
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.scene.add(rock);
      this.colliders.push({ x, z, radius: scale * this.config.rockColliderScale });
    }
  }

  // ndc: pointer in normalized device coords. Writes the ground hit into
  // `out` ({x, z}) and returns true, or returns false if the ground was missed.
  pickGround(ndc, camera, out) {
    this.raycaster.setFromCamera(ndc, camera);
    const hit = this.raycaster.intersectObject(this.ground, false)[0];
    if (!hit) return false;
    out.x = hit.point.x;
    out.z = hit.point.z;
    return true;
  }

  setPlayerMoveTarget(point) {
    this.player.setMoveTarget(point, this.colliders, this.config.playBounds);
  }

  update(dt) {
    const bounds = this.config.playBounds;
    const player = this.player;
    player.update(dt, bounds, this.collidersFor(player));

    for (const enemy of this.enemies) {
      const dealt = enemy.update(dt, player, this.collidersFor(enemy), bounds);
      if (dealt > 0) {
        this.focusEnemy = enemy;
        this.effects.spawnSpark(player.position, FX_CONFIG.playerHitColor);
      }
      // Before updateSpawns, so even a corpse removed this frame drops once.
      if (enemy.claimLoot()) this.dropLoot(enemy);
    }
    this.updateSpawns(dt);

    if (player.dead && player.deadTime >= player.config.respawnDelay) {
      player.revive(nearestFreePoint(this.playerSpawn, player.radius, this.collidersFor(player), bounds));
    }
    this.effects.update(dt);
    this.groundItems.update(dt, player.dead ? null : player.position);

    // Keep the shadow frustum centered on the player.
    const p = this.player.position;
    this.sun.position.set(p.x + 8, 16, p.z + 6);
    this.sun.target.position.copy(p);
  }

  // Corpses are removed after corpseTime; the spawn point refills later.
  updateSpawns(dt) {
    for (const spawn of this.spawns) {
      const enemy = spawn.enemy;
      if (enemy) {
        if (enemy.dead && enemy.deadTime >= spawn.type.corpseTime) {
          this.removeEnemy(enemy);
          spawn.enemy = null;
          spawn.timer = spawn.type.respawnDelay;
        }
      } else if ((spawn.timer -= dt) <= 0) {
        this.spawnEnemy(spawn);
      }
    }
  }

  dispose() {
    this.effects.dispose();
    this.groundItems.dispose();
    this.enemies.slice().forEach((e) => this.removeEnemy(e));
    const geometries = new Set();
    const materials = new Set();
    this.scene.traverse((obj) => {
      if (obj.geometry) geometries.add(obj.geometry);
      if (obj.material) [].concat(obj.material).forEach((m) => materials.add(m));
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    this.sun.shadow.map?.dispose();
    this.scene.clear();
  }
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
