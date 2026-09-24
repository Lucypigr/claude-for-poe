import { combineAxes } from './moveAxis.js';

// The single owner of player input. Move sources (keyboard, touch joystick,
// later gamepad) only report an axis; InputManager merges them into one
// movement intent. World actions (click/tap on the 3D view) are only accepted
// when the pointer event originates on the world canvas, so UI touches never
// leak into the world. Discrete actions (e.g. 'attack') are reported by action
// sources via triggerAction() and consumed once by the game loop.
export class InputManager {
  constructor({ worldElement }) {
    this.worldElement = worldElement;
    this.moveSources = new Set();
    this.worldPointerListeners = new Set();
    this.pendingActions = new Set();

    this.onWorldPointerDown = (e) => {
      if (e.target !== this.worldElement) return;
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
    const axes = [];
    for (const source of this.moveSources) axes.push(source.getAxis());
    return combineAxes(axes);
  }

  // One press = one action: repeated triggers before the next consume collapse
  // into a single press.
  triggerAction(name) {
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
  }
}
