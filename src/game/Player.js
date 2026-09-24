import * as THREE from 'three';
import { PLAYER_CONFIG } from '../config.js';
import { createPlayerModel } from './playerModel.js';

// Player state on the X/Z plane. The only way to steer it is
// setMoveDirection(); input devices never write position/velocity directly.
export class Player {
  constructor(config = PLAYER_CONFIG) {
    this.config = config;
    this.object = createPlayerModel();
    this.position = this.object.position;
    this.velocity = new THREE.Vector3();
    this.moveDirection = new THREE.Vector3();
    this.facing = 0; // radians around Y, 0 = +Z
  }

  // dir: world {x, z} with length <= 1 (analog input keeps partial speed).
  setMoveDirection(dir) {
    this.moveDirection.set(dir.x, 0, dir.z);
    if (this.moveDirection.lengthSq() > 1) this.moveDirection.normalize();
  }

  update(dt, bounds) {
    const { moveSpeed, accelSharpness, turnSharpness } = this.config;
    const targetVx = this.moveDirection.x * moveSpeed;
    const targetVz = this.moveDirection.z * moveSpeed;
    const a = 1 - Math.exp(-accelSharpness * dt);
    this.velocity.x += (targetVx - this.velocity.x) * a;
    this.velocity.z += (targetVz - this.velocity.z) * a;

    this.position.x = THREE.MathUtils.clamp(this.position.x + this.velocity.x * dt, -bounds, bounds);
    this.position.z = THREE.MathUtils.clamp(this.position.z + this.velocity.z * dt, -bounds, bounds);

    if (this.moveDirection.lengthSq() > 1e-4) {
      const target = Math.atan2(this.moveDirection.x, this.moveDirection.z);
      const delta = Math.atan2(Math.sin(target - this.facing), Math.cos(target - this.facing));
      this.facing += delta * (1 - Math.exp(-turnSharpness * dt));
      this.object.rotation.y = this.facing;
    }
  }
}
