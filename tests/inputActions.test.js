import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InputManager } from '../src/input/InputManager.js';
import { KeyboardActionSource } from '../src/input/KeyboardActionSource.js';

function key(type, code, repeat = false) {
  const e = new Event(type, { cancelable: true });
  Object.assign(e, { code });
  Object.defineProperty(e, 'repeat', { value: repeat });
  return e;
}

function setup() {
  const canvas = new EventTarget();
  const keys = new EventTarget();
  const input = new InputManager({ worldElement: canvas });
  const actions = new KeyboardActionSource(input, { Space: 'attack', KeyJ: 'attack' }, keys);
  return { canvas, keys, input, actions };
}

test('a key press is consumed exactly once', () => {
  const { keys, input } = setup();
  keys.dispatchEvent(key('keydown', 'KeyJ'));
  assert.equal(input.consumeAction('attack'), true);
  assert.equal(input.consumeAction('attack'), false);
});

test('holding the key (auto-repeat) does not re-trigger', () => {
  const { keys, input } = setup();
  keys.dispatchEvent(key('keydown', 'Space'));
  assert.equal(input.consumeAction('attack'), true);
  for (let i = 0; i < 5; i++) {
    keys.dispatchEvent(key('keydown', 'Space', true));
    assert.equal(input.consumeAction('attack'), false);
    input.endFrame();
  }
});

test('unbound keys do nothing; bound keys prevent default', () => {
  const { keys, input } = setup();
  keys.dispatchEvent(key('keydown', 'KeyW'));
  assert.equal(input.consumeAction('attack'), false);
  const e = key('keydown', 'Space');
  keys.dispatchEvent(e);
  assert.ok(e.defaultPrevented);
});

test('unconsumed presses are dropped at end of frame', () => {
  const { input } = setup();
  input.triggerAction('attack');
  input.endFrame();
  assert.equal(input.consumeAction('attack'), false);
});

test('actions and world pointers stay separate', () => {
  const { canvas, input } = setup();
  let worldPointers = 0;
  input.onWorldPointer(() => worldPointers++);
  // UI button press -> action only.
  input.triggerAction('attack');
  assert.equal(worldPointers, 0);
  // Pointer on the world canvas -> world pointer only.
  input.consumeAction('attack');
  canvas.dispatchEvent(new Event('pointerdown'));
  assert.equal(worldPointers, 1);
  assert.equal(input.consumeAction('attack'), false);
});

test('dispose removes listeners', () => {
  const { keys, input, actions } = setup();
  actions.dispose();
  keys.dispatchEvent(key('keydown', 'KeyJ'));
  assert.equal(input.consumeAction('attack'), false);
});

test('blocking world input zeroes movement, drops world pointers and gameplay actions', () => {
  const canvas = new EventTarget();
  const input = new InputManager({ worldElement: canvas, uiActions: ['toggleInventory'] });
  input.addMoveSource({ getAxis: () => ({ x: 1, y: 0 }) });
  let worldPointers = 0;
  input.onWorldPointer(() => worldPointers++);
  const pointer = () => {
    const e = new Event('pointerdown');
    Object.defineProperty(e, 'target', { value: canvas });
    return e;
  };

  input.triggerAction('attack'); // pressed in the same frame the panel opens
  input.setWorldBlocked('inventory', true);
  assert.equal(input.isWorldBlocked(), true);
  assert.deepEqual(input.getMoveAxis(), { x: 0, y: 0 });
  assert.equal(input.consumeAction('attack'), false);
  input.triggerAction('attack');
  assert.equal(input.consumeAction('attack'), false);
  canvas.dispatchEvent(pointer());
  assert.equal(worldPointers, 0);
  input.triggerAction('toggleInventory'); // UI actions still pass
  assert.equal(input.consumeAction('toggleInventory'), true);

  input.setWorldBlocked('inventory', false);
  assert.deepEqual(input.getMoveAxis(), { x: 1, y: 0 });
  input.triggerAction('attack');
  assert.equal(input.consumeAction('attack'), true);
  canvas.dispatchEvent(pointer());
  assert.equal(worldPointers, 1);
});
