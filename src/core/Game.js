import * as THREE from 'three';
import { InputManager } from '../input/InputManager.js';
import { KeyboardMoveSource } from '../input/KeyboardMoveSource.js';
import { KeyboardActionSource } from '../input/KeyboardActionSource.js';
import { Renderer } from '../render/Renderer.js';
import { CameraRig } from '../render/CameraRig.js';
import { World } from '../game/World.js';
import { Hud } from '../ui/Hud.js';
import { TouchJoystick } from '../ui/TouchJoystick.js';
import { AttackButton } from '../ui/AttackButton.js';
import { InventoryButton } from '../ui/InventoryButton.js';
import { InventoryPanel } from '../ui/InventoryPanel.js';
import { Inventory } from '../items/Inventory.js';
import { PLAYER_ATTACK, INVENTORY_CONFIG } from '../config.js';

const MAX_FRAME_DT = 0.1; // avoid huge steps after tab switches

// Composition root and the single game loop.
// Frame order: input (UI actions, move + actions) -> world update -> camera -> HUD -> render.
export class Game {
  constructor({ worldContainer, uiContainer }) {
    this.worldContainer = worldContainer;
    this.renderer = new Renderer(worldContainer);
    this.cameraRig = new CameraRig();
    this.world = new World();
    this.input = new InputManager({
      worldElement: this.renderer.canvas,
      uiActions: ['toggleInventory', 'closeInventory'],
    });

    this.keyboard = new KeyboardMoveSource();
    this.input.addMoveSource(this.keyboard);
    this.keyboardActions = new KeyboardActionSource(
      this.input,
      Object.fromEntries([
        ...PLAYER_ATTACK.keys.map((code) => [code, 'attack']),
        ...INVENTORY_CONFIG.toggleKeys.map((code) => [code, 'toggleInventory']),
        ...INVENTORY_CONFIG.closeKeys.map((code) => [code, 'closeInventory']),
      ]),
    );

    this.hud = new Hud(uiContainer);
    this.joystick = new TouchJoystick(uiContainer);
    this.input.addMoveSource(this.joystick);
    this.attackButton = new AttackButton(uiContainer, this.input);
    this.inventory = new Inventory(INVENTORY_CONFIG);
    this.inventoryButton = new InventoryButton(uiContainer, this.input);
    this.inventoryPanel = new InventoryPanel(uiContainer, this.inventory, this.input);
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
    this.hud.setInputMode(touch ? 'touch' : 'keyboard');
    this.inventoryPanel.setInputMode(touch ? 'touch' : 'keyboard');
    this.updateTouchControls();
  }

  // On-screen gameplay controls only show in touch mode with no panel open.
  updateTouchControls() {
    const show = this.touchMode && !this.inventoryPanel.isOpen();
    this.joystick.setVisible(show);
    this.attackButton.setVisible(show);
  }

  // The open bag blocks world input in InputManager (no move, world pointer
  // or attack) until it closes.
  setInventoryOpen(open) {
    this.inventoryPanel.setOpen(open);
    this.inventoryButton.setOpen(open);
    this.input.setWorldBlocked('inventory', open);
    this.updateTouchControls();
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

    if (this.input.consumeAction('toggleInventory')) this.setInventoryOpen(!this.inventoryPanel.isOpen());
    if (this.input.consumeAction('closeInventory')) this.setInventoryOpen(false);
    this.cameraRig.screenAxisToWorld(this.input.getMoveAxis(), this.moveDir);
    const player = this.world.player;
    player.setMoveDirection(this.moveDir);
    if (this.input.consumeAction('attack')) this.world.playerAttack();
    this.input.endFrame();
    this.world.update(dt);
    this.cameraRig.follow(player.position, dt);
    this.attackButton.setCooldown(player.attackCooldown / player.attack.interval);
    this.hud.update(
      player,
      this.world.focusEnemy,
      player.dead ? Math.max(0, player.config.respawnDelay - player.deadTime) : null,
    );
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
    this.keyboardActions.dispose();
    this.joystick.dispose();
    this.attackButton.dispose();
    this.inventoryButton.dispose();
    this.inventoryPanel.dispose();
    this.inventory.dispose();
    this.hud.dispose();
    this.world.dispose();
    this.renderer.dispose();
  }
}

function detectTouchPrimary() {
  return window.matchMedia?.('(pointer: coarse)').matches ?? false;
}
