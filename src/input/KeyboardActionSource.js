// Maps key presses to discrete actions (e.g. Space / J -> 'attack').
// A press fires once on keydown; auto-repeat from holding the key is ignored,
// so holding a key never re-triggers the action every frame.
export class KeyboardActionSource {
  // bindings: { [KeyboardEvent.code]: actionName }
  constructor(input, bindings, target = window) {
    this.input = input;
    this.bindings = bindings;
    this.target = target;

    this.onKeyDown = (e) => {
      const action = this.bindings[e.code];
      if (!action || isTypingTarget(e.target)) return;
      e.preventDefault(); // e.g. Space must not scroll or click a focused control
      if (e.repeat) return;
      this.input.triggerAction(action);
    };
    target.addEventListener('keydown', this.onKeyDown);
  }

  dispose() {
    this.target.removeEventListener('keydown', this.onKeyDown);
  }
}

function isTypingTarget(el) {
  return (
    typeof HTMLElement !== 'undefined' &&
    el instanceof HTMLElement &&
    (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
  );
}
