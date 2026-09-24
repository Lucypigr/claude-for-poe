import * as THREE from 'three';
import { CAMERA_CONFIG } from '../config.js';

const DEG = Math.PI / 180;

// Fixed-angle, high 3/4 ARPG camera. It never rotates; it only follows a
// target on the X/Z plane. Also converts screen-space move intent into world
// X/Z directions that match what the player sees.
export class CameraRig {
  constructor(config = CAMERA_CONFIG) {
    this.config = config;
    this.camera = new THREE.PerspectiveCamera(config.fovDeg, 1, config.near, config.far);

    const pitch = config.pitchDeg * DEG;
    const yaw = config.yawDeg * DEG;
    const horizontal = Math.cos(pitch) * config.distance;
    this.offset = new THREE.Vector3(
      Math.sin(yaw) * horizontal,
      Math.sin(pitch) * config.distance,
      Math.cos(yaw) * horizontal,
    );

    // Screen "up" on the ground = away from the camera; "right" is perpendicular.
    this.forward = new THREE.Vector2(-Math.sin(yaw), -Math.cos(yaw));
    this.right = new THREE.Vector2(Math.cos(yaw), -Math.sin(yaw));

    this.focus = new THREE.Vector3();
  }

  resize(aspect) {
    const { fovDeg, minHorizontalFovDeg, maxFovDeg } = this.config;
    // Widen vertical FOV on tall screens so the horizontal view stays usable.
    const neededVertical = 2 * Math.atan(Math.tan((minHorizontalFovDeg * DEG) / 2) / aspect) / DEG;
    this.camera.fov = Math.min(maxFovDeg, Math.max(fovDeg, neededVertical));
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  snapTo(target) {
    this.focus.copy(target);
    this.apply();
  }

  follow(target, dt) {
    const t = 1 - Math.exp(-this.config.followSharpness * dt);
    this.focus.lerp(target, t);
    this.apply();
  }

  apply() {
    this.camera.position.copy(this.focus).add(this.offset);
    this.camera.lookAt(this.focus);
  }

  // axis: {x, y} screen-space intent -> {x, z} world direction, same length.
  screenAxisToWorld(axis, out = { x: 0, z: 0 }) {
    out.x = this.right.x * axis.x + this.forward.x * axis.y;
    out.z = this.right.y * axis.x + this.forward.y * axis.y;
    return out;
  }
}
