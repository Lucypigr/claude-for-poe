// On-screen bag button (top-right). Like AttackButton it only reports an action
// ('toggleInventory') to InputManager; the game loop decides what it does.
// Being an HTML UI element, its pointer events never reach the world canvas.
export class InventoryButton {
  constructor(parent, input, label = '背包') {
    this.input = input;

    this.el = document.createElement('div');
    this.el.className = 'inventory-toggle ui-interactive';
    this.el.dataset.testid = 'inventory-toggle';
    this.el.setAttribute('role', 'button');
    this.el.setAttribute('aria-label', label);
    this.el.setAttribute('aria-pressed', 'false');
    this.el.textContent = label;
    parent.appendChild(this.el);

    this.onPointerDown = (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (e.button !== 0) return;
      this.input.triggerAction('toggleInventory');
    };
    this.onContextMenu = (e) => e.preventDefault();

    this.el.addEventListener('pointerdown', this.onPointerDown);
    this.el.addEventListener('contextmenu', this.onContextMenu);
  }

  setOpen(open) {
    this.el.classList.toggle('is-open', open);
    this.el.setAttribute('aria-pressed', String(open));
  }

  dispose() {
    this.el.removeEventListener('pointerdown', this.onPointerDown);
    this.el.removeEventListener('contextmenu', this.onContextMenu);
    this.el.remove();
  }
}
