// Keyboard and mouse input. Keys are tracked by code, so WASD and the arrow keys
// both drive; actions are edge-triggered (pressed once per key-down).
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_ENTER_CAR = 8;
export const ACTION_PUNCH = 16;

const CONFIRM_CODES = new Set(['Enter', 'Space', 'NumpadEnter']);
const PAUSE_CODES = new Set(['KeyP', 'Escape']);
const MUTE_CODES = new Set(['KeyM']);
const ENTER_CAR_CODES = new Set(['KeyE']);
const PUNCH_CODES = new Set(['KeyF']);

export function createInput(canvas) {
  const down = new Set();
  const pressed = new Set();
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mousePressed = false;

  function keyDown(event) {
    if (event.repeat) return;
    down.add(event.code);
    pressed.add(event.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
  }
  function keyUp(event) {
    down.delete(event.code);
  }
  function mouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = ((event.clientX - rect.left) / rect.width) * canvas.width;
    mouseY = ((event.clientY - rect.top) / rect.height) * canvas.height;
  }
  function mouseDownHandler(event) {
    mouseDown = true;
    mousePressed = true;
    mouseMove(event);
  }
  function mouseUpHandler() {
    mouseDown = false;
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  canvas.addEventListener('mousemove', mouseMove);
  canvas.addEventListener('mousedown', mouseDownHandler);
  window.addEventListener('mouseup', mouseUpHandler);

  function has(code) {
    return down.has(code);
  }
  function wasPressed(code) {
    return pressed.has(code);
  }

  // Steering and throttle from WASD or the arrow keys, each in -1..1.
  function drive() {
    const up = has('KeyW') || has('ArrowUp');
    const downKey = has('KeyS') || has('ArrowDown');
    const left = has('KeyA') || has('ArrowLeft');
    const right = has('KeyD') || has('ArrowRight');
    return {
      throttle: (up ? 1 : 0) - (downKey ? 1 : 0),
      steer: (left ? -1 : 0) + (right ? 1 : 0),
      handbrake: has('Space'),
      run: has('ShiftLeft') || has('ShiftRight'),
    };
  }

  function walk() {
    const up = has('KeyW') || has('ArrowUp');
    const downKey = has('KeyS') || has('ArrowDown');
    const left = has('KeyA') || has('ArrowLeft');
    const right = has('KeyD') || has('ArrowRight');
    const x = (right ? 1 : 0) - (left ? 1 : 0);
    const y = (downKey ? 1 : 0) - (up ? 1 : 0);
    const len = Math.hypot(x, y) || 1;
    return { x: x / len, y: y / len, moving: x !== 0 || y !== 0, run: has('ShiftLeft') || has('ShiftRight') };
  }

  function takeActions() {
    let actions = 0;
    for (const code of pressed) {
      if (CONFIRM_CODES.has(code)) actions |= ACTION_CONFIRM;
      if (PAUSE_CODES.has(code)) actions |= ACTION_PAUSE;
      if (MUTE_CODES.has(code)) actions |= ACTION_MUTE;
      if (ENTER_CAR_CODES.has(code)) actions |= ACTION_ENTER_CAR;
      if (PUNCH_CODES.has(code)) actions |= ACTION_PUNCH;
    }
    if (mousePressed) actions |= ACTION_CONFIRM;
    pressed.clear();
    mousePressed = false;
    return actions;
  }

  function shootPressed() {
    return mouseDown;
  }

  function mouse() {
    return { x: mouseX, y: mouseY, down: mouseDown };
  }

  return { has, wasPressed, drive, walk, takeActions, shootPressed, mouse };
}
