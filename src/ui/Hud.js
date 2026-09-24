const HINTS = {
  keyboard: 'WASD / 方向鍵 移動',
  touch: '左下角拖曳搖桿移動',
};

// Minimal HTML overlay. Holds only display elements for now; interactive
// widgets (e.g. TouchJoystick) are created by the UI layer owner (Game).
export class Hud {
  constructor(parent) {
    this.hint = document.createElement('div');
    this.hint.className = 'hud-hint';
    this.hint.dataset.testid = 'hud-hint';
    parent.appendChild(this.hint);
  }

  setInputMode(mode) {
    this.hint.textContent = HINTS[mode] ?? '';
  }

  dispose() {
    this.hint.remove();
  }
}
