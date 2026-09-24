import { combineAxes } from './moveAxis.js';

// The single owner of player input. Move sources (keyboard, touch joystick,
// later gamepad) only report an axis; InputManager merges them into one
// movement intent. World actions (click/tap on the 3D view) are only accepted
// when the pointer event originates on the world canvas, so UI touches never
// leak into the world. Discrete actions (e.g. 'attack') are reported by action
// sources via triggerAction() and consumed once by the game loop.
//
// While world input is blocked (e.g. a modal panel such as the bag is open),
// suppression happens here, at the one input owner: the move axis reads zero,
// world pointers are dropped and gameplay actions are ignored. Only actions
// listed in `uiActions` (opening / closing panels) still go through.
const ZERO_AXIS = Object.freeze({ x: 0, y: 0 });

export class InputManager {
  constructor({ worldElement, uiActions = [] }) {
    this.worldElement = worldElement;
    this.uiActions = new Set(uiActions);
    this.moveSources = new Set();
    this.worldPointerListeners = new Set();
    this.pendingActions = new Set();
    this.worldBlockers = new Set();

    this.onWorldPointerDown = (e) => {
      if (e.target !== this.worldElement || this.isWorldBlocked()) return;
      for (const listener of this.worldPointerListeners) listener(e);
    };
    worldElement.addEventListener('pointerdown', this.onWorldPointerDown);
  }

  addMoveSource(source) {
    this.moveSources.add(source);
    return () => this.moveSources.delete(source);
  }

  // Screen-space movement intent, length <= 1.
  getMoveAxis() {
    if (this.isWorldBlocked()) return ZERO_AXIS;
    const axes = [];
    for (const source of this.moveSources) axes.push(source.getAxis());
    return combineAxes(axes);
  }

  // One press = one action: repeated triggers before the next consume collapse
  // into a single press.
  triggerAction(name) {
    if (this.isWorldBlocked() && !this.uiActions.has(name)) return;
    this.pendingActions.add(name);
  }

  // Returns true once per press, then forgets it.
  consumeAction(name) {
    return this.pendingActions.delete(name);
  }

  // Called at the end of each frame so unhandled presses do not fire later.
  endFrame() {
    this.pendingActions.clear();
  }

  // Blocks or unblocks world input on behalf of `key` (e.g. 'inventory'); world
  // input stays blocked while any key is blocking. Blocking drops gameplay
  // presses that are still pending so they do not fire later.
  setWorldBlocked(key, blocked) {
    if (!blocked) {
      this.worldBlockers.delete(key);
      return;
    }
    this.worldBlockers.add(key);
    for (const name of this.pendingActions) {
      if (!this.uiActions.has(name)) this.pendingActions.delete(name);
    }
  }

  isWorldBlocked() {
    return this.worldBlockers.size > 0;
  }

  // Reserved hook for future world actions (targeting, skills). Returns an
  // unsubscribe function.
  onWorldPointer(listener) {
    this.worldPointerListeners.add(listener);
    return () => this.worldPointerListeners.delete(listener);
  }

  dispose() {
    this.worldElement.removeEventListener('pointerdown', this.onWorldPointerDown);
    this.moveSources.clear();
    this.worldPointerListeners.clear();
    this.pendingActions.clear();
    this.worldBlockers.clear();
  }
}
