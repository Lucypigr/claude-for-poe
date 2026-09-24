// On-screen attack button for touch screens. It is an HTML UI element, so its
// pointer events never reach the world canvas; each new contact reports one
// 'attack' action to InputManager (holding does not repeat). It is a separate
// element from the joystick, so their touches never mix.
export class AttackButton {
  constructor(parent, input, label = '攻擊') {
    this.input = input;
    this.pointers = new Set();

    this.el = document.createElement('div');
    this.el.className = 'attack-button ui-interactive';
    this.el.dataset.testid = 'attack-button';
    this.el.setAttribute('role', 'button');
    this.el.setAttribute('aria-label', label);
    this.el.textContent = label;
    parent.appendChild(this.el);

    this.onPointerDown = (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.pointers.add(e.pointerId);
      this.el.classList.add('is-pressed');
      this.input.triggerAction('attack');
    };
    this.onPointerEnd = (e) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size === 0) this.el.classList.remove('is-pressed');
    };
    this.onContextMenu = (e) => e.preventDefault();

    this.el.addEventListener('pointerdown', this.onPointerDown);
    this.el.addEventListener('pointerup', this.onPointerEnd);
    this.el.addEventListener('pointercancel', this.onPointerEnd);
    this.el.addEventListener('pointerleave', this.onPointerEnd);
    this.el.addEventListener('contextmenu', this.onContextMenu);
  }

  // cooldown: 0..1 fraction of the attack interval still remaining.
  setCooldown(fraction) {
    const v = fraction > 0 ? fraction.toFixed(2) : '0';
    if (v !== this.lastCooldown) {
      this.lastCooldown = v;
      this.el.style.setProperty('--cooldown', v);
    }
  }

  setVisible(visible) {
    this.el.hidden = !visible;
    if (!visible) {
      this.pointers.clear();
      this.el.classList.remove('is-pressed');
    }
  }

  dispose() {
    this.el.removeEventListener('pointerdown', this.onPointerDown);
    this.el.removeEventListener('pointerup', this.onPointerEnd);
    this.el.removeEventListener('pointercancel', this.onPointerEnd);
    this.el.removeEventListener('pointerleave', this.onPointerEnd);
    this.el.removeEventListener('contextmenu', this.onContextMenu);
    this.el.remove();
  }
}
