import * as THREE from 'three';
import { InputManager } from '../input/InputManager.js';
import { KeyboardMoveSource } from '../input/KeyboardMoveSource.js';
import { Renderer } from '../render/Renderer.js';
import { CameraRig } from '../render/CameraRig.js';
import { World } from '../game/World.js';
import { Hud } from '../ui/Hud.js';
import { TouchJoystick } from '../ui/TouchJoystick.js';

const MAX_FRAME_DT = 0.1; // avoid huge steps after tab switches

// Composition root and the single game loop.
// Frame order: input -> world update -> camera -> render.
export class Game {
  constructor({ worldContainer, uiContainer }) {
    this.worldContainer = worldContainer;
    this.renderer = new Renderer(worldContainer);
    this.cameraRig = new CameraRig();
    this.world = new World();
    this.input = new InputManager({ worldElement: this.renderer.canvas });

    this.keyboard = new KeyboardMoveSource();
    this.input.addMoveSource(this.keyboard);

    this.hud = new Hud(uiContainer);
    this.joystick = new TouchJoystick(uiContainer);
    this.input.addMoveSource(this.joystick);
    this.setTouchMode(detectTouchPrimary());

    // Switch UI hints when the player actually uses a different device.
    this.onAnyPointerDown = (e) => this.setTouchMode(e.pointerType === 'touch');
    this.onAnyKeyDown = () => this.setTouchMode(false);
    window.addEventListener('pointerdown', this.onAnyPointerDown, { capture: true });
    window.addEventListener('keydown', this.onAnyKeyDown, { capture: true });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(worldContainer);
    this.resize();

    // Click/tap on the world canvas = walk there. InputManager only forwards
    // pointers that start on the canvas, so UI and joystick touches never land here.
    this.pointerNdc = new THREE.Vector2();
    this.groundHit = { x: 0, z: 0 };
    this.offWorldPointer = this.input.onWorldPointer((e) => this.onWorldPointer(e));

    this.cameraRig.snapTo(this.world.player.position);
    this.moveDir = { x: 0, z: 0 };
    this.lastTime = null;
  }

  setTouchMode(touch) {
    if (this.touchMode === touch) return;
    this.touchMode = touch;
    this.joystick.setVisible(touch);
    this.hud.setInputMode(touch ? 'touch' : 'keyboard');
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.worldContainer;
    if (w === 0 || h === 0) return;
    this.renderer.resize(w, h);
    this.cameraRig.resize(w / h);
  }

  onWorldPointer(e) {
    if (e.button !== 0) return; // primary button / touch contact only
    const rect = this.renderer.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    this.pointerNdc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    if (this.world.pickGround(this.pointerNdc, this.cameraRig.camera, this.groundHit)) {
      this.world.setPlayerMoveTarget(this.groundHit);
    }
  }

  start() {
    this.renderer.setAnimationLoop((time) => this.frame(time));
  }

  frame(timeMs) {
    const dt = this.lastTime === null ? 0 : Math.min((timeMs - this.lastTime) / 1000, MAX_FRAME_DT);
    this.lastTime = timeMs;

    this.cameraRig.screenAxisToWorld(this.input.getMoveAxis(), this.moveDir);
    this.world.player.setMoveDirection(this.moveDir);
    this.world.update(dt);
    this.cameraRig.follow(this.world.player.position, dt);
    this.renderer.render(this.world.scene, this.cameraRig.camera);
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('pointerdown', this.onAnyPointerDown, { capture: true });
    window.removeEventListener('keydown', this.onAnyKeyDown, { capture: true });
    this.resizeObserver.disconnect();
    this.offWorldPointer();
    this.input.dispose();
    this.keyboard.dispose();
    this.joystick.dispose();
    this.hud.dispose();
    this.world.dispose();
    this.renderer.dispose();
  }
}

function detectTouchPrimary() {
  return window.matchMedia?.('(pointer: coarse)').matches ?? false;
}
