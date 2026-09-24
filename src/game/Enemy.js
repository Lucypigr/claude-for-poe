import * as THREE from 'three';
import { createEnemyModel } from './enemyModel.js';
import { moveCircle } from './collision.js';
import { Health } from './Health.js';
import { edgeDistance, yawTowards, turnTowards, applyFlash } from './combat.js';

const LUNGE_TIME = 0.22; // seconds of the attack lunge animation
const DEATH_TILT = Math.PI / 2;
const DEAD_TINT = new THREE.Color(0x3a3834);

// A melee enemy that chases the player on the X/Z plane and hits them at a
// fixed interval once in range. States: idle -> chase -> attack, or dead.
// Movement reuses the shared circle collision (rocks + other bodies), so it
// cannot pass through obstacles. Dead enemies neither move nor attack.
export class Enemy {
  constructor(type, spawn) {
    this.type = type;
    this.name = type.name;
    const model = createEnemyModel(type);
    this.object = model.root;
    this.body = model.body;
    this.materials = model.materials;
    this.healthBar = model.healthBar;
    this.position = this.object.position;
    this.position.set(spawn.x, 0, spawn.z);
    this.radius = type.radius;
    this.velocity = new THREE.Vector3();
    this.facing = 0;
    this.health = new Health(type.maxHealth);
    this.state = 'idle';
    this.attackCooldown = 0;
    this.hurtTime = 0;
    this.lungeTime = 0;
    this.deadTime = 0;
    this.knockback = { x: 0, z: 0 };
    this.baseColors = this.materials.map((m) => m.color.clone());
  }

  get x() {
    return this.position.x;
  }

  get z() {
    return this.position.z;
  }

  get dead() {
    return this.health.dead;
  }

  // Returns the damage actually taken. `from` ({x, z}) sets the knockback direction.
  takeDamage(amount, from) {
    const dealt = this.health.damage(amount);
    if (dealt <= 0) return 0;
    this.hurtTime = this.type.hurtFlashTime;
    this.healthBar.set(this.health.ratio);
    if (from) {
      const dx = this.position.x - from.x;
      const dz = this.position.z - from.z;
      const len = Math.hypot(dx, dz) || 1;
      this.knockback.x += (dx / len) * this.type.knockback;
      this.knockback.z += (dz / len) * this.type.knockback;
    }
    if (this.dead) {
      this.state = 'dead';
      this.velocity.set(0, 0, 0);
      this.knockback.x = this.knockback.z = 0;
      this.healthBar.group.visible = false;
    }
    return dealt;
  }

  // colliders: circle colliders to avoid (rocks, the player, other enemies).
  // Returns the damage dealt to the player this frame (0 if none).
  update(dt, player, colliders, bounds) {
    const t = this.type;
    this.hurtTime = Math.max(0, this.hurtTime - dt);
    applyFlash(this.materials, 0xffffff, this.hurtTime / t.hurtFlashTime);

    if (this.dead) {
      this.deadTime += dt;
      this.updateDeathVisual(dt);
      return 0;
    }

    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.lungeTime = Math.max(0, this.lungeTime - dt);

    if (this.knockback.x || this.knockback.z) {
      moveCircle(this.position, this.knockback.x, this.knockback.z, this.radius, colliders, bounds);
      this.knockback.x = this.knockback.z = 0;
    }

    let gap = edgeDistance(this, player);
    if (player.dead || gap > t.leashRange) this.state = 'idle';
    else if (this.state === 'idle' && gap <= t.aggroRange) this.state = 'chase';

    let dirX = 0;
    let dirZ = 0;
    if (this.state !== 'idle' && gap > t.engageRange) {
      const dx = player.position.x - this.position.x;
      const dz = player.position.z - this.position.z;
      const len = Math.hypot(dx, dz) || 1;
      dirX = dx / len;
      dirZ = dz / len;
    }
    const a = 1 - Math.exp(-t.accelSharpness * dt);
    this.velocity.x += (dirX * t.moveSpeed - this.velocity.x) * a;
    this.velocity.z += (dirZ * t.moveSpeed - this.velocity.z) * a;
    moveCircle(this.position, this.velocity.x * dt, this.velocity.z * dt, this.radius, colliders, bounds);

    let dealt = 0;
    if (this.state !== 'idle') {
      this.facing = turnTowards(this.facing, yawTowards(this.position, player.position), t.turnSharpness, dt);
      gap = edgeDistance(this, player);
      if (gap <= t.attackRange) {
        if (this.state !== 'attack') {
          this.state = 'attack';
          this.attackCooldown = Math.max(this.attackCooldown, t.firstAttackDelay);
        }
        if (this.attackCooldown <= 0) {
          this.attackCooldown = t.attackInterval;
          this.lungeTime = LUNGE_TIME;
          dealt = player.takeDamage(t.damage);
        }
      } else {
        this.state = 'chase';
      }
    }

    this.body.rotation.y = this.facing;
    // Quick forward lunge while attacking.
    const lunge = this.lungeTime > 0 ? Math.sin((1 - this.lungeTime / LUNGE_TIME) * Math.PI) : 0;
    this.body.position.set(Math.sin(this.facing) * lunge * 0.35, 0, Math.cos(this.facing) * lunge * 0.35);
    return dealt;
  }

  updateDeathVisual(dt) {
    const k = 1 - Math.exp(-8 * dt);
    this.body.rotation.z += (DEATH_TILT - this.body.rotation.z) * k;
    this.materials.forEach((m, i) => m.color.lerpColors(this.baseColors[i], DEAD_TINT, Math.min(1, this.deadTime * 2)));
    // Sink into the ground over the last part of the corpse time.
    const sinkStart = this.type.corpseTime * 0.6;
    if (this.deadTime > sinkStart) {
      const f = (this.deadTime - sinkStart) / (this.type.corpseTime - sinkStart);
      this.body.position.y = -Math.min(1, f) * 0.8;
    }
  }

  // Removes the model from the scene and frees its GPU resources. Sprites use
  // three's internal shared geometry, so only their materials are disposed.
  dispose() {
    this.object.removeFromParent();
    const geometries = new Set();
    const materials = new Set();
    this.object.traverse((obj) => {
      if (obj.geometry && !obj.isSprite) geometries.add(obj.geometry);
      if (obj.material) materials.add(obj.material);
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
  }
}
