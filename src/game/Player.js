import * as THREE from 'three';
import { PLAYER_CONFIG, PLAYER_ATTACK, FX_CONFIG } from '../config.js';
import { createPlayerModel } from './playerModel.js';
import { moveCircle, nearestFreePoint } from './collision.js';
import { steerToTarget } from './moveTarget.js';
import { Health } from './Health.js';
import { findNearestTarget, yawTowards, turnTowards, applyFlash } from './combat.js';

const DEATH_TILT = 1.35; // radians the placeholder model tips over when dead

// Player state on the X/Z plane. It is steered only through
// setMoveDirection() (direct input) and setMoveTarget() (click/tap to move);
// input devices never write position/velocity directly. Direct input always
// wins: a non-zero direction cancels the current move target. Attacks go
// through tryAttack(); damage comes in through takeDamage().
export class Player {
  constructor(config = PLAYER_CONFIG, attack = PLAYER_ATTACK) {
    this.config = config;
    this.attack = attack;
    this.object = createPlayerModel();
    this.materials = collectMaterials(this.object);
    this.position = this.object.position;
    this.velocity = new THREE.Vector3();
    this.moveDirection = new THREE.Vector3();
    this.facing = 0; // radians around Y, 0 = +Z
    this.radius = config.radius;
    this.moveTarget = null; // {x, z} or null
    this.stuckTime = 0;
    this.steer = { x: 0, z: 0 };

    this.health = new Health(config.maxHealth);
    this.attackCooldown = 0; // seconds of game time until the next swing
    this.swingTime = 0;
    this.hurtTime = 0;
    this.deadTime = 0;
  }

  // Circle-collider view so enemies can treat the player as an obstacle.
  get x() {
    return this.position.x;
  }

  get z() {
    return this.position.z;
  }

  get dead() {
    return this.health.dead;
  }

  // dir: world {x, z} with length <= 1 (analog input keeps partial speed).
  setMoveDirection(dir) {
    if (this.dead) return;
    this.moveDirection.set(dir.x, 0, dir.z);
    if (this.moveDirection.lengthSq() > 1) this.moveDirection.normalize();
    if (this.moveDirection.lengthSq() > 1e-6) this.clearMoveTarget();
  }

  // Walk to a ground point. Points inside obstacles are moved to the nearest
  // spot the player fits, so the player never keeps pushing into a rock.
  setMoveTarget(point, colliders = [], bounds = Infinity) {
    if (this.dead) return;
    this.moveTarget = nearestFreePoint(point, this.radius, colliders, bounds);
    this.stuckTime = 0;
  }

  clearMoveTarget() {
    this.moveTarget = null;
    this.stuckTime = 0;
  }

  // Starts one basic attack against the nearest living enemy in range.
  // Returns null if the attack cannot start (dead or still on cooldown);
  // otherwise { target, damage } where target is null for a swing that hit
  // nothing. Damage is applied exactly once, here.
  tryAttack(enemies) {
    if (this.dead || this.attackCooldown > 0) return null;
    const { damage, range, interval, swingTime } = this.attack;
    this.attackCooldown = interval;
    this.swingTime = swingTime;
    const target = findNearestTarget(this, range, enemies);
    if (!target) return { target: null, damage: 0 };
    this.facing = yawTowards(this.position, target.position);
    this.object.rotation.y = this.facing;
    return { target, damage: target.takeDamage(damage, this.position) };
  }

  // Returns the damage actually taken.
  takeDamage(amount) {
    const dealt = this.health.damage(amount);
    if (dealt > 0) {
      this.hurtTime = this.config.hurtFlashTime;
      if (this.dead) this.die();
    }
    return dealt;
  }

  die() {
    this.clearMoveTarget();
    this.moveDirection.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
    this.deadTime = 0;
  }

  revive(point) {
    this.health.reset();
    this.position.set(point.x, 0, point.z);
    this.velocity.set(0, 0, 0);
    this.attackCooldown = 0;
    this.swingTime = 0;
    this.hurtTime = 0;
    this.deadTime = 0;
    this.object.rotation.z = 0;
  }

  update(dt, bounds, colliders = []) {
    const { moveSpeed, accelSharpness, turnSharpness } = this.config;

    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.swingTime = Math.max(0, this.swingTime - dt);
    this.hurtTime = Math.max(0, this.hurtTime - dt);
    applyFlash(this.materials, FX_CONFIG.playerHitColor, this.hurtTime / this.config.hurtFlashTime);

    if (this.dead) {
      // Dead: no movement or turning; the placeholder tips over.
      this.deadTime += dt;
      this.object.rotation.z += (DEATH_TILT - this.object.rotation.z) * (1 - Math.exp(-8 * dt));
      return;
    }

    let dir = this.moveDirection;
    const targetDistBefore = this.moveTarget ? this.distanceToTarget() : 0;
    if (this.moveTarget && dir.lengthSq() <= 1e-6) {
      if (steerToTarget(this.position, this.moveTarget, this.config, this.steer)) {
        // Arrived: stop dead instead of drifting past and turning back.
        this.clearMoveTarget();
        this.velocity.set(0, 0, 0);
      }
      dir = this.steer;
    }

    const targetVx = dir.x * moveSpeed;
    const targetVz = dir.z * moveSpeed;
    const a = 1 - Math.exp(-accelSharpness * dt);
    this.velocity.x += (targetVx - this.velocity.x) * a;
    this.velocity.z += (targetVz - this.velocity.z) * a;

    moveCircle(this.position, this.velocity.x * dt, this.velocity.z * dt, this.radius, colliders, bounds);

    if (this.moveTarget) this.updateStuck(dt, targetDistBefore, Math.hypot(dir.x, dir.z));

    // While swinging, keep facing the attack target instead of the move direction.
    if (this.swingTime <= 0 && dir.x * dir.x + dir.z * dir.z > 1e-4) {
      this.facing = turnTowards(this.facing, Math.atan2(dir.x, dir.z), turnSharpness, dt);
      this.object.rotation.y = this.facing;
    }
  }

  distanceToTarget() {
    return Math.hypot(this.moveTarget.x - this.position.x, this.moveTarget.z - this.position.z);
  }

  // Give up on a target the player cannot get closer to (e.g. blocked head-on
  // by an obstacle), so it does not keep pushing against the obstacle forever.
  updateStuck(dt, distBefore, steerLength) {
    if (dt <= 0) return;
    const progress = distBefore - this.distanceToTarget();
    const expected = this.config.moveSpeed * steerLength * dt;
    if (progress < expected * this.config.stuckProgressRatio) this.stuckTime += dt;
    else this.stuckTime = 0;
    if (this.stuckTime >= this.config.stuckTimeout) {
      this.clearMoveTarget();
    }
  }
}

function collectMaterials(root) {
  const materials = new Set();
  root.traverse((obj) => obj.material && materials.add(obj.material));
  return [...materials];
}
