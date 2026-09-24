import { INVENTORY_CONFIG } from '../config.js';
import { getItemDefinition, ITEM_CATEGORY_LABELS } from '../items/itemDefinitions.js';
import { PLACE_FAIL } from '../items/Inventory.js';

const FAIL_TEXT = {
  [PLACE_FAIL.outOfBounds]: '無法放置：超出背包範圍',
  [PLACE_FAIL.overlap]: '無法放置：位置已被其他物品佔用',
};
const HINTS = {
  keyboard: `拖曳物品移動 · 點選後再點空格放置 · ${INVENTORY_CONFIG.keyLabel} / Esc 關閉`,
  touch: '拖曳物品移動 · 或輕觸物品後再輕觸空格放置',
};

// DOM view of an Inventory. It never changes the bag directly: every move goes
// through inventory.move(), and the view re-renders from the model on change,
// so an invalid drop simply leaves the card where the model says it is.
//
// Interaction (mouse and touch share one Pointer Events path):
// - drag an item card; a footprint preview shows valid / invalid placement,
// - or tap a card to select it, then tap a cell to place its top-left there,
// - mouse hover shows a tooltip (name, type, size).
// Closing goes through InputManager ('closeInventory'), like the bag button.
export class InventoryPanel {
  constructor(parent, inventory, input, config = INVENTORY_CONFIG) {
    this.inventory = inventory;
    this.input = input;
    this.config = config;
    this.open = false;
    this.selectedUid = null;
    this.press = null; // active pointer press / drag
    this.messageTimer = null;
    this.inputMode = 'keyboard';

    this.root = el('div', 'inventory-panel ui-interactive', parent);
    this.root.dataset.testid = 'inventory-panel';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', '背包');
    this.root.hidden = true;

    const header = el('div', 'inventory-header', this.root);
    el('div', 'inventory-title', header).textContent = '背包';
    this.closeButton = el('div', 'inventory-close', header);
    this.closeButton.dataset.testid = 'inventory-close';
    this.closeButton.setAttribute('role', 'button');
    this.closeButton.setAttribute('aria-label', '關閉背包');
    this.closeButton.textContent = '✕';

    this.grid = el('div', 'inventory-grid', this.root);
    this.grid.dataset.testid = 'inventory-grid';
    this.grid.style.setProperty('--cols', inventory.cols);
    this.grid.style.setProperty('--rows', inventory.rows);
    for (let i = 0; i < inventory.cols * inventory.rows; i++) el('div', 'inventory-cell', this.grid);
    this.layer = el('div', 'inventory-layer', this.grid);
    this.preview = el('div', 'inventory-preview', this.layer);
    this.preview.dataset.testid = 'inventory-preview';
    this.preview.hidden = true;

    this.info = el('div', 'inventory-info', this.root);
    this.info.dataset.testid = 'inventory-info';
    this.tooltip = el('div', 'inventory-tooltip', this.root);
    this.tooltip.dataset.testid = 'inventory-tooltip';
    this.tooltip.hidden = true;
    this.ghost = null;
    this.cards = new Map(); // uid -> card element

    this.onCloseDown = (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (e.button === 0) this.input.triggerAction('closeInventory');
    };
    // Keep every pointer inside the panel away from anything underneath.
    this.onPanelPointerDown = (e) => {
      e.stopPropagation();
      e.preventDefault();
    };
    this.onGridPointerDown = (e) => this.handlePointerDown(e);
    this.onGridPointerMove = (e) => this.handlePointerMove(e);
    this.onGridPointerUp = (e) => this.handlePointerUp(e);
    this.onGridPointerCancel = (e) => {
      if (this.press && e.pointerId === this.press.pointerId) this.endPress();
    };
    this.onGridPointerOut = (e) => {
      if (!e.relatedTarget || !this.grid.contains(e.relatedTarget)) this.hideTooltip();
    };
    this.onContextMenu = (e) => e.preventDefault();

    this.closeButton.addEventListener('pointerdown', this.onCloseDown);
    this.root.addEventListener('pointerdown', this.onPanelPointerDown);
    this.root.addEventListener('contextmenu', this.onContextMenu);
    this.grid.addEventListener('pointerdown', this.onGridPointerDown);
    this.grid.addEventListener('pointermove', this.onGridPointerMove);
    this.grid.addEventListener('pointerup', this.onGridPointerUp);
    this.grid.addEventListener('pointercancel', this.onGridPointerCancel);
    this.grid.addEventListener('lostpointercapture', this.onGridPointerCancel);
    this.grid.addEventListener('pointerout', this.onGridPointerOut);

    this.offChange = inventory.onChange(() => this.render());
    this.render();
  }

  isOpen() {
    return this.open;
  }

  setOpen(open) {
    if (open === this.open) return;
    this.open = open;
    this.root.hidden = !open;
    if (!open) {
      this.endPress();
      this.select(null);
      this.hideTooltip();
    }
    this.showInfo();
  }

  setInputMode(mode) {
    this.inputMode = mode;
    this.showInfo();
  }

  render() {
    const alive = new Set();
    for (const item of this.inventory.getItems()) {
      alive.add(item.uid);
      let card = this.cards.get(item.uid);
      if (!card) {
        card = this.createCard(item);
        this.cards.set(item.uid, card);
      }
      placeBox(card, item.gridX, item.gridY, this.sizeOf(item), this.inventory);
      card.dataset.x = item.gridX;
      card.dataset.y = item.gridY;
      card.classList.toggle('is-selected', item.uid === this.selectedUid);
    }
    for (const [uid, card] of this.cards) {
      if (!alive.has(uid)) {
        card.remove();
        this.cards.delete(uid);
      }
    }
    if (this.selectedUid && !alive.has(this.selectedUid)) this.select(null);
  }

  createCard(item) {
    const def = getItemDefinition(item.defId);
    const card = el('div', `inventory-item rarity-${def.rarity}`, this.layer);
    card.dataset.testid = 'inventory-item';
    card.dataset.uid = item.uid;
    card.dataset.defId = def.id;
    card.style.setProperty('--item-color', def.icon.color);
    el('span', 'inventory-item-glyph', card).textContent = def.icon.glyph;
    if (def.height > 1) el('span', 'inventory-item-name', card).textContent = def.name;
    return card;
  }

  sizeOf(item) {
    return this.inventory.sizeOf(item);
  }

  // Grid cell under a client point (may be outside the grid).
  cellAt(clientX, clientY) {
    const r = this.grid.getBoundingClientRect();
    return {
      x: Math.floor(((clientX - r.left) / r.width) * this.inventory.cols),
      y: Math.floor(((clientY - r.top) / r.height) * this.inventory.rows),
    };
  }

  handlePointerDown(e) {
    e.stopPropagation();
    e.preventDefault();
    if (this.press || e.button !== 0) return;
    const card = e.target.closest?.('.inventory-item');
    const rect = card?.getBoundingClientRect();
    this.press = {
      pointerId: e.pointerId,
      uid: card?.dataset.uid ?? null,
      startX: e.clientX,
      startY: e.clientY,
      grabX: rect ? e.clientX - rect.left : 0,
      grabY: rect ? e.clientY - rect.top : 0,
      dragging: false,
      target: null,
    };
    this.grid.setPointerCapture?.(e.pointerId);
    this.hideTooltip();
  }

  handlePointerMove(e) {
    const press = this.press;
    if (!press) {
      if (e.pointerType === 'mouse') this.updateTooltip(e);
      return;
    }
    if (e.pointerId !== press.pointerId) return;
    e.preventDefault();
    if (!press.dragging) {
      if (!press.uid) return;
      const moved = Math.hypot(e.clientX - press.startX, e.clientY - press.startY);
      if (moved < this.config.dragThreshold) return;
      this.startDrag(press);
    }
    this.updateDrag(press, e.clientX, e.clientY);
  }

  handlePointerUp(e) {
    const press = this.press;
    if (!press || e.pointerId !== press.pointerId) return;
    e.preventDefault();
    if (press.dragging) {
      const { uid, target } = press;
      this.endPress();
      this.tryMove(uid, target.x, target.y);
    } else {
      this.endPress();
      this.tap(press.uid, this.cellAt(e.clientX, e.clientY));
    }
  }

  // Tap / click: select a card, or place the selected card at a cell.
  tap(uid, cell) {
    if (uid) {
      this.select(uid === this.selectedUid ? null : uid);
    } else if (this.selectedUid && this.inventory.inBounds(cell.x, cell.y)) {
      this.tryMove(this.selectedUid, cell.x, cell.y);
    }
  }

  tryMove(uid, x, y) {
    const result = this.inventory.move(uid, x, y);
    if (result.ok) {
      this.select(null);
    } else {
      this.showMessage(FAIL_TEXT[result.reason] ?? '無法放置');
    }
    return result;
  }

  startDrag(press) {
    press.dragging = true;
    const card = this.cards.get(press.uid);
    const rect = card.getBoundingClientRect();
    card.classList.add('is-dragging');
    this.ghost = card.cloneNode(true);
    this.ghost.className += ' inventory-ghost';
    this.ghost.classList.remove('is-dragging', 'is-selected');
    this.ghost.dataset.testid = 'inventory-ghost';
    this.ghost.style.width = `${rect.width}px`;
    this.ghost.style.height = `${rect.height}px`;
    this.root.appendChild(this.ghost);
    this.root.classList.add('is-dragging');
  }

  updateDrag(press, clientX, clientY) {
    const r = this.grid.getBoundingClientRect();
    const cellW = r.width / this.inventory.cols;
    const cellH = r.height / this.inventory.rows;
    const left = clientX - press.grabX;
    const top = clientY - press.grabY;
    // The ghost is positioned inside the (transformed) panel's padding box.
    const panel = this.root.getBoundingClientRect();
    const gx = left - panel.left - this.root.clientLeft;
    const gy = top - panel.top - this.root.clientTop;
    this.ghost.style.transform = `translate(${gx}px, ${gy}px)`;

    // Snap the card's top-left to the nearest cell.
    const x = Math.round((left - r.left) / cellW);
    const y = Math.round((top - r.top) / cellH);
    if (press.target && press.target.x === x && press.target.y === y) return;
    const item = this.inventory.getItem(press.uid);
    const valid = this.inventory.canPlace(item, x, y).ok;
    press.target = { x, y, valid };
    placeBox(this.preview, x, y, this.sizeOf(item), this.inventory);
    this.preview.hidden = false;
    this.preview.classList.toggle('is-valid', valid);
    this.preview.classList.toggle('is-invalid', !valid);
    this.preview.dataset.valid = String(valid);
  }

  endPress() {
    const press = this.press;
    if (!press) return;
    this.press = null;
    if (this.grid.hasPointerCapture?.(press.pointerId)) this.grid.releasePointerCapture(press.pointerId);
    if (press.dragging) {
      this.cards.get(press.uid)?.classList.remove('is-dragging');
      this.ghost?.remove();
      this.ghost = null;
      this.preview.hidden = true;
      this.root.classList.remove('is-dragging');
    }
  }

  select(uid) {
    this.selectedUid = uid;
    this.clearMessage(); // a new selection replaces any old error
    for (const [cardUid, card] of this.cards) card.classList.toggle('is-selected', cardUid === uid);
    this.showInfo();
  }

  updateTooltip(e) {
    const card = e.target.closest?.('.inventory-item');
    if (!card) {
      this.hideTooltip();
      return;
    }
    const item = this.inventory.getItem(card.dataset.uid);
    if (!item) return;
    if (this.tooltip.dataset.uid !== item.uid) {
      this.tooltip.dataset.uid = item.uid;
      this.tooltip.textContent = describe(item, this.sizeOf(item));
    }
    this.tooltip.hidden = false;
    const panel = this.root.getBoundingClientRect();
    this.tooltip.style.transform = `translate(${e.clientX - panel.left + 14}px, ${e.clientY - panel.top + 14}px)`;
  }

  hideTooltip() {
    this.tooltip.hidden = true;
    delete this.tooltip.dataset.uid;
  }

  // Footer line: an error message, else the selected item, else a usage hint.
  showMessage(text) {
    clearTimeout(this.messageTimer);
    this.info.textContent = text;
    this.info.classList.add('is-error');
    this.messageTimer = setTimeout(() => {
      this.messageTimer = null;
      this.showInfo();
    }, this.config.messageTime * 1000);
  }

  clearMessage() {
    clearTimeout(this.messageTimer);
    this.messageTimer = null;
  }

  showInfo() {
    if (this.messageTimer !== null) return;
    this.info.classList.remove('is-error');
    const item = this.selectedUid && this.inventory.getItem(this.selectedUid);
    this.info.textContent = item ? `已選取：${describe(item, this.sizeOf(item))}` : HINTS[this.inputMode];
  }

  dispose() {
    this.endPress();
    clearTimeout(this.messageTimer);
    this.offChange();
    this.closeButton.removeEventListener('pointerdown', this.onCloseDown);
    this.root.removeEventListener('pointerdown', this.onPanelPointerDown);
    this.root.removeEventListener('contextmenu', this.onContextMenu);
    this.grid.removeEventListener('pointerdown', this.onGridPointerDown);
    this.grid.removeEventListener('pointermove', this.onGridPointerMove);
    this.grid.removeEventListener('pointerup', this.onGridPointerUp);
    this.grid.removeEventListener('pointercancel', this.onGridPointerCancel);
    this.grid.removeEventListener('lostpointercapture', this.onGridPointerCancel);
    this.grid.removeEventListener('pointerout', this.onGridPointerOut);
    this.root.remove();
  }
}

function describe(item, size) {
  const def = getItemDefinition(item.defId);
  return `${def.name} · ${ITEM_CATEGORY_LABELS[def.category] ?? def.category} · ${size.width}×${size.height}`;
}

// Positions a footprint box in grid percentages, so it scales with the cells.
function placeBox(node, x, y, size, inventory) {
  node.style.left = `${(x / inventory.cols) * 100}%`;
  node.style.top = `${(y / inventory.rows) * 100}%`;
  node.style.width = `${(size.width / inventory.cols) * 100}%`;
  node.style.height = `${(size.height / inventory.rows) * 100}%`;
}

function el(tag, className, parent) {
  const node = document.createElement(tag);
  node.className = className;
  parent.appendChild(node);
  return node;
}
