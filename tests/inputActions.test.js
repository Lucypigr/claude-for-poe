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
