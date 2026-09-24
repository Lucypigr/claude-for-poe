import * as THREE from 'three';
import { PLAYER_CONFIG } from '../config.js';
import { createPlayerModel } from './playerModel.js';
import { moveCircle, nearestFreePoint } from './collision.js';
import { steerToTarget } from './moveTarget.js';

// Player state on the X/Z plane. It is steered only through
// setMoveDirection() (direct input) and setMoveTarget() (click/tap to move);
// input devices never write position/velocity directly. Direct input always
// wins: a non-zero direction cancels the current move target.
export class Player {
  constructor(config = PLAYER_CONFIG) {
    this.config = config;
    this.object = createPlayerModel();
    this.position = this.object.position;
    this.velocity = new THREE.Vector3();
    this.moveDirection = new THREE.Vector3();
    this.facing = 0; // radians around Y, 0 = +Z
    this.radius = config.radius;
    this.moveTarget = null; // {x, z} or null
    this.stuckTime = 0;
    this.steer = { x: 0, z: 0 };
  }

  // dir: world {x, z} with length <= 1 (analog input keeps partial speed).
  setMoveDirection(dir) {
    this.moveDirection.set(dir.x, 0, dir.z);
    if (this.moveDirection.lengthSq() > 1) this.moveDirection.normalize();
    if (this.moveDirection.lengthSq() > 1e-6) this.clearMoveTarget();
  }

  // Walk to a ground point. Points inside obstacles are moved to the nearest
  // spot the player fits, so the player never keeps pushing into a rock.
  setMoveTarget(point, colliders = [], bounds = Infinity) {
    this.moveTarget = nearestFreePoint(point, this.radius, colliders, bounds);
    this.stuckTime = 0;
  }

  clearMoveTarget() {
    this.moveTarget = null;
    this.stuckTime = 0;
  }

  update(dt, bounds, colliders = []) {
    const { moveSpeed, accelSharpness, turnSharpness } = this.config;

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

    if (dir.x * dir.x + dir.z * dir.z > 1e-4) {
      const target = Math.atan2(dir.x, dir.z);
      const delta = Math.atan2(Math.sin(target - this.facing), Math.cos(target - this.facing));
      this.facing += delta * (1 - Math.exp(-turnSharpness * dt));
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
