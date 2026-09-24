import { PLAYER_ATTACK, INVENTORY_CONFIG, GROUND_ITEM_CONFIG } from '../config.js';
import { getItemDefinition } from '../items/itemDefinitions.js';
import { PLACE_FAIL } from '../items/Inventory.js';

const HINTS = {
  keyboard: `WASD / 方向鍵 或 點擊地面 移動 · ${PLAYER_ATTACK.keyLabel} 攻擊 · ${INVENTORY_CONFIG.keyLabel} 背包 · 走近物品拾取`,
  touch: '左下角拖曳搖桿 或 輕觸地面 移動 · 右下角按鈕 攻擊 · 右上角 背包 · 走近物品拾取',
};

// HTML overlay for display only (no input): hint, player life, the current
// target's life, a red edge flash when hurt, a death banner and a short
// pickup notice. Interactive
// widgets (TouchJoystick, AttackButton, InventoryButton, InventoryPanel) are created by the UI owner (Game).
// DOM is only written when a displayed value changes.
export class Hud {
  constructor(parent) {
    this.root = el('div', 'hud-stack', parent);
    this.hint = el('div', 'hud-hint', this.root);
    this.hint.dataset.testid = 'hud-hint';

    this.playerBar = createBar(this.root, 'hud-bar is-player', '生命');
    this.playerBar.root.dataset.testid = 'player-health';
    this.targetBar = createBar(this.root, 'hud-bar is-target', '');
    this.targetBar.root.dataset.testid = 'target-health';
    this.targetBar.root.hidden = true;

    this.vignette = el('div', 'hud-hurt', parent);
    this.banner = el('div', 'hud-banner', parent);
    this.banner.dataset.testid = 'death-banner';
    this.banner.hidden = true;
    this.notice = el('div', 'hud-notice', parent);
    this.notice.dataset.testid = 'hud-notice';
    this.notice.hidden = true;
    this.noticeTimer = null;

    this.lastPlayerHp = null;
    this.lastTarget = undefined;
  }

  setInputMode(mode) {
    this.hint.textContent = HINTS[mode] ?? '';
  }

  // player: Player; target: Enemy or null; respawnIn: seconds or null.
  update(player, target, respawnIn) {
    const hp = player.health;
    if (hp.current !== this.lastPlayerHp) {
      if (this.lastPlayerHp !== null && hp.current < this.lastPlayerHp) this.flashHurt();
      this.lastPlayerHp = hp.current;
      this.playerBar.set(hp.current, hp.max);
    }

    const shownTarget = target ?? null; // a dead target stays shown at 0 until removed
    if (shownTarget !== this.lastTarget) {
      this.lastTarget = shownTarget;
      this.targetBar.root.hidden = !shownTarget;
      if (shownTarget) this.targetBar.label.textContent = shownTarget.name;
    }
    if (shownTarget) this.targetBar.set(shownTarget.health.current, shownTarget.health.max);

    const bannerText = respawnIn === null ? '' : `你倒下了 · ${Math.ceil(respawnIn)} 秒後重生`;
    if (bannerText !== this.banner.textContent) {
      this.banner.textContent = bannerText;
      this.banner.hidden = !bannerText;
    }
  }

  // event: an ItemPickup event ({ type: 'picked' | 'blocked', item, reason }).
  showPickup(event) {
    const name = getItemDefinition(event.item.defId)?.name ?? '物品';
    if (event.type === 'picked') this.showNotice(`拾取：${name}`, false);
    else if (event.reason === PLACE_FAIL.noSpace) this.showNotice(`背包空間不足，${name} 留在地上`, true);
    else this.showNotice(`無法拾取：${name}`, true);
  }

  showNotice(text, isError) {
    clearTimeout(this.noticeTimer);
    this.notice.textContent = text;
    this.notice.classList.toggle('is-error', isError);
    this.notice.hidden = false;
    this.noticeTimer = setTimeout(() => {
      this.noticeTimer = null;
      this.notice.hidden = true;
    }, GROUND_ITEM_CONFIG.noticeTime * 1000);
  }

  flashHurt() {
    // Restart the CSS animation.
    this.vignette.classList.remove('is-active');
    void this.vignette.offsetWidth;
    this.vignette.classList.add('is-active');
  }

  dispose() {
    clearTimeout(this.noticeTimer);
    this.notice.remove();
    this.root.remove();
    this.vignette.remove();
    this.banner.remove();
  }
}

function el(tag, className, parent) {
  const node = document.createElement(tag);
  node.className = className;
  parent.appendChild(node);
  return node;
}

function createBar(parent, className, labelText) {
  const root = el('div', className, parent);
  const label = el('span', 'hud-bar-label', root);
  label.textContent = labelText;
  const track = el('div', 'hud-bar-track', root);
  const fill = el('div', 'hud-bar-fill', track);
  const value = el('span', 'hud-bar-value', root);
  let last = '';
  return {
    root,
    label,
    set(current, max) {
      const text = `${Math.max(0, Math.ceil(current))} / ${max}`;
      if (text === last) return;
      last = text;
      value.textContent = text;
      fill.style.transform = `scaleX(${max > 0 ? Math.max(0, current) / max : 0})`;
    },
  };
}
