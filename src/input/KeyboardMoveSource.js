import { normalizeAxis } from './moveAxis.js';

const KEY_DIRECTIONS = {
  KeyW: [0, 1],
  ArrowUp: [0, 1],
  KeyS: [0, -1],
  ArrowDown: [0, -1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

// Reads WASD / arrow keys and exposes a normalized screen-space axis.
// It never touches game state; InputManager polls getAxis().
export class KeyboardMoveSource {
  constructor(target = window) {
    this.target = target;
    this.pressed = new Set();

    this.onKeyDown = (e) => {
      if (!(e.code in KEY_DIRECTIONS) || isTypingTarget(e.target)) return;
      this.pressed.add(e.code);
      e.preventDefault();
    };
    this.onKeyUp = (e) => {
      this.pressed.delete(e.code);
    };
    // Avoid "stuck" keys when the window loses focus mid-press.
    this.onBlur = () => this.pressed.clear();

    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onBlur);
  }

  getAxis() {
    let x = 0;
    let y = 0;
    for (const code of this.pressed) {
      const [dx, dy] = KEY_DIRECTIONS[code];
      x += dx;
      y += dy;
    }
    return normalizeAxis(x, y);
  }

  dispose() {
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onBlur);
    this.pressed.clear();
  }
}

function isTypingTarget(el) {
  return el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}
