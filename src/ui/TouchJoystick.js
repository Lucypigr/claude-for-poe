import { applyDeadzone, clampAxis } from '../input/moveAxis.js';

const BASE_RADIUS = 66; // matches .joystick-base size / 2
const DEADZONE = 0.12;

// Floating virtual stick for touch screens. Touching anywhere inside the zone
// re-centers the stick under the finger. It is an HTML UI element: its pointer
// events stay inside the UI layer and never reach the world canvas. It only
// reports an analog axis to InputManager.
export class TouchJoystick {
  constructor(parent) {
    this.axis = { x: 0, y: 0 };
    this.pointerId = null;
    this.center = { x: 0, y: 0 };

    this.zone = document.createElement('div');
    this.zone.className = 'joystick-zone ui-interactive';
    this.zone.dataset.testid = 'joystick-zone';
    this.zone.setAttribute('aria-label', '移動搖桿');
    this.base = document.createElement('div');
    this.base.className = 'joystick-base';
    this.knob = document.createElement('div');
    this.knob.className = 'joystick-knob';
    this.base.appendChild(this.knob);
    this.zone.appendChild(this.base);
    parent.appendChild(this.zone);

    this.onPointerDown = (e) => {
      e.stopPropagation();
      if (this.pointerId !== null) return;
      e.preventDefault();
      this.pointerId = e.pointerId;
      this.zone.setPointerCapture(e.pointerId);
      this.zone.classList.add('is-active');
      const zoneRect = this.zone.getBoundingClientRect();
      this.center = { x: e.clientX, y: e.clientY };
      this.base.style.left = `${e.clientX - zoneRect.left - BASE_RADIUS}px`;
      this.base.style.top = `${e.clientY - zoneRect.top - BASE_RADIUS}px`;
      this.base.style.bottom = 'auto';
      this.updateKnob(e.clientX, e.clientY);
    };
    this.onPointerMove = (e) => {
      if (e.pointerId !== this.pointerId) return;
      e.preventDefault();
      this.updateKnob(e.clientX, e.clientY);
    };
    this.onPointerEnd = (e) => {
      if (e.pointerId !== this.pointerId) return;
      this.release();
    };
    this.onContextMenu = (e) => e.preventDefault();

    this.zone.addEventListener('pointerdown', this.onPointerDown);
    this.zone.addEventListener('pointermove', this.onPointerMove);
    this.zone.addEventListener('pointerup', this.onPointerEnd);
    this.zone.addEventListener('pointercancel', this.onPointerEnd);
    this.zone.addEventListener('lostpointercapture', this.onPointerEnd);
    this.zone.addEventListener('contextmenu', this.onContextMenu);
  }

  updateKnob(clientX, clientY) {
    const dx = clientX - this.center.x;
    const dy = clientY - this.center.y;
    const knob = clampAxis(dx, dy, BASE_RADIUS);
    this.knob.style.transform = `translate(${knob.x}px, ${knob.y}px)`;
    // Screen Y grows downward; axis Y is "up".
    this.axis = applyDeadzone({ x: knob.x / BASE_RADIUS, y: -knob.y / BASE_RADIUS }, DEADZONE);
  }

  release() {
    this.pointerId = null;
    this.axis = { x: 0, y: 0 };
    this.zone.classList.remove('is-active');
    this.knob.style.transform = '';
    this.base.style.left = '';
    this.base.style.top = '';
    this.base.style.bottom = '';
  }

  getAxis() {
    return this.axis;
  }

  setVisible(visible) {
    this.zone.hidden = !visible;
    if (!visible) this.release();
  }

  dispose() {
    this.zone.removeEventListener('pointerdown', this.onPointerDown);
    this.zone.removeEventListener('pointermove', this.onPointerMove);
    this.zone.removeEventListener('pointerup', this.onPointerEnd);
    this.zone.removeEventListener('pointercancel', this.onPointerEnd);
    this.zone.removeEventListener('lostpointercapture', this.onPointerEnd);
    this.zone.removeEventListener('contextmenu', this.onContextMenu);
    this.zone.remove();
  }
}
