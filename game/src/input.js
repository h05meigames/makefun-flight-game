// Keyboard and mouse input. Held keys give steering and throttle; one-shot
// presses (confirm, pause, gear, mission keys) are queued as bit flags and
// taken once by the loop, so a press between two frames is never lost and
// never counted twice. The mouse steers too: pointer position relative to the
// canvas centre banks and pitches the plane, and a click confirms menus.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_GEAR = 4;
export const ACTION_RESTART = 8;

const BANK_LEFT = new Set(['ArrowLeft', 'KeyA']);
const BANK_RIGHT = new Set(['ArrowRight', 'KeyD']);
const PITCH_UP = new Set(['ArrowUp']);
const PITCH_DOWN = new Set(['ArrowDown']);
const THROTTLE_UP = new Set(['KeyW']);
const THROTTLE_DOWN = new Set(['KeyS']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const GEAR = new Set(['KeyG']);
const RESTART = new Set(['KeyR']);
const MISSIONS = new Set(['Digit1', 'Digit2', 'Digit3']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let missionKey = 0;
  // Pointer position in canvas pixels, null until the mouse first moves.
  let pointer = null;
  let pointerActive = false;

  function onKeyDown(event) {
    if (BANK_LEFT.has(event.code) || BANK_RIGHT.has(event.code)
      || PITCH_UP.has(event.code) || PITCH_DOWN.has(event.code)
      || THROTTLE_UP.has(event.code) || THROTTLE_DOWN.has(event.code)) {
      held.add(event.code);
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (GEAR.has(event.code)) {
      if (!event.repeat) actions |= ACTION_GEAR;
    } else if (RESTART.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RESTART;
    } else if (MISSIONS.has(event.code)) {
      missionKey = Number(event.code.slice(-1));
    } else {
      return;
    }
    event.preventDefault();
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function onPointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    pointer = {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
    pointerActive = true;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => held.clear());
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', (event) => {
    onPointerMove(event);
    actions |= ACTION_CONFIRM;
  });

  function hasAny(codes) {
    for (const code of codes) if (held.has(code)) return true;
    return false;
  }

  return {
    /** -1 for left, 1 for right, 0 for neither or both. */
    bankDirection() {
      return (hasAny(BANK_RIGHT) ? 1 : 0) - (hasAny(BANK_LEFT) ? 1 : 0);
    },
    /** -1 for down, 1 for up, 0 for neither or both. */
    pitchDirection() {
      return (hasAny(PITCH_UP) ? 1 : 0) - (hasAny(PITCH_DOWN) ? 1 : 0);
    },
    /** -1 to throttle down, 1 to throttle up, 0 for neither or both. */
    throttleDirection() {
      return (hasAny(THROTTLE_UP) ? 1 : 0) - (hasAny(THROTTLE_DOWN) ? 1 : 0);
    },
    /** Mouse steering: {bank, pitch} in [-1, 1], or null when idle. */
    mouseSteer() {
      if (!pointerActive || !pointer) return null;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const bank = Math.max(-1, Math.min(1, (pointer.x - cx) / (cx * 0.55)));
      const pitch = Math.max(-1, Math.min(1, (cy - pointer.y) / (cy * 0.55)));
      if (Math.abs(bank) < 0.06 && Math.abs(pitch) < 0.06) return null;
      return { bank, pitch };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The mission number key (1-3) pressed since the last call, else 0. */
    takeMissionKey() {
      const taken = missionKey;
      missionKey = 0;
      return taken;
    },
  };
}
