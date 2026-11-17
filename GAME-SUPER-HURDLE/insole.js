// insole.js — play with ORPHE INSOLE instead of ORPHE CORE.
//
// ORPHE INSOLE sits under the foot and has the same IMU fields as CORE
// (converted_acc, euler) plus six pressure channels. This module makes it
// drive the game exactly the way the CORE sensor script in index.html does:
// same thresholds, same cooldowns, same window.devices / window.gameJump() /
// window.setAccelPressed() surface. The CORE script itself is not touched.
//
// INSOLE uses the same two SDK files as CORE (orphe-core-insole.js + orphe-core-insole-toolkit.js
// in index.html): the toolkit provides `insoles` and buildInsoleToolkit(). Switching device in the
// connection dock still reloads the page, so only one of the two toolkits is ever on screen.
//
// One real difference: the sensor frames. INSOLE is X = right, Y = toe, Z = up,
// so lifting the toes is a rotation about X, which the SDK reports as `roll`
// (CORE reports it as a negative `pitch`). The adapter turns it into the CORE
// convention: toe up = negative pitch. (The SDK computes the INSOLE Euler angles
// with the same quaternion layout, normalisation and formula as ORPHE-INSOLE.js v1.4.0,
// so the axes and signs are unchanged.)

/** 'core' | 'insole': the stored choice, or ?device=insole / ?device=core for a one-off. */
export const DEVICE = (() => {
  let device = 'core';
  try { if (localStorage.getItem('hurdle.device') === 'insole') device = 'insole'; } catch { /* storage unavailable */ }
  const m = /[?&]device=(core|insole)\b/.exec(window.location.search);
  return m ? m[1] : device;
})();

const wantsSimulator = () => /[?&]insoleSim=1\b/.test(window.location.search);

const JUMP_COOLDOWN_MS = 700;   // same values as the CORE sensor script
const ACCEL_COOLDOWN_MS = 100;
const TOE_KEY = 'hurdle.insoleToe';

/**
 * Swap the CORE connection UI for the INSOLE toolkit and wire INSOLE input into the game.
 * Returns null (and leaves the CORE UI alone) if the SDK toolkit did not load.
 */
export function setupInsole() {
  if (typeof window.buildInsoleToolkit !== 'function' || !Array.isArray(window.insoles)) {
    console.error('[HURDLE] orphe-core-insole-toolkit.js did not load; staying on ORPHE CORE.');
    return null;
  }
  const simulator = wantsSimulator();

  // Both toolkits use the same element ids (switch_ble0, ui0, settings_modal0, ...),
  // so the CORE one has to leave the page before the INSOLE one is built.
  for (const id of [0, 1]) document.getElementById(`core_toolkit${id}`)?.remove();
  for (const id of [0, 1]) {
    window.buildInsoleToolkit(document.getElementById(`toolkit_placeholder${id + 1}`), `0${id + 1}`, id, {
      streamingMode: 4,          // acc + gyro + pressure + quaternion at 100 Hz (Euler needs the quaternion)
      autoReconnect: true,
      ...(simulator ? { simulator: true } : {}),   // createInsoleSimulator() replaces insoles[id]
    });
  }
  const devices = window.insoles;   // read after the build: the simulator option swaps the slots

  // ---- which way is "toe up"?
  // Expected: +roll. If a unit reports the opposite, gravity tells us: with the foot held
  // still and tilted, the accelerometer's tilt atan2(y, z) is positive when the toe is up,
  // whatever the quaternion convention is. 'auto' follows that evidence.
  const cal = { mode: 'auto', sign: 1, evidence: 0, tilt: [null, null], gyro: [0, 0] };
  try { const m = localStorage.getItem(TOE_KEY); if (m === 'normal' || m === 'invert') cal.mode = m; } catch { /* storage unavailable */ }
  const sign = () => (cal.mode === 'normal' ? 1 : cal.mode === 'invert' ? -1 : cal.sign);
  /** CORE-convention pitch for an INSOLE Euler sample: toe up is negative. */
  const zero = [0, 0];   // resting pitch found during the countdown (set by the game), per insole
  const gamePitch = (dev, e) => -sign() * e.roll - (zero[dev] || 0);

  let lastJumpTime = 0;
  let lastAccelTime = 0;
  for (const insole of devices) {
    const id = insole.id;   // on() listeners have no `this`; take the id up front
    insole.on('converted_gyro', (g) => {
      cal.gyro[id] = Math.hypot(g.x, g.y, g.z);
    });
    insole.on('converted_acc', (acc) => {
      window.devices[id].acc = acc;
      const mag = Math.hypot(acc.x, acc.y, acc.z);
      // only trust the tilt when the foot is still (about 1 G and hardly rotating)
      cal.tilt[id] = mag > 0.93 && mag < 1.07 && cal.gyro[id] < 40 ? Math.atan2(acc.y, acc.z) : null;

      // either foot moving hard enough = accelerate (mirrors the CORE sensor script)
      let maxAccel = 0;
      for (let i = 0; i < 2; i++) {
        const a = window.devices[i].acc;
        maxAccel = Math.max(maxAccel, Math.hypot(a.x, a.y, a.z));
      }
      if (window.setAccelPressed) {
        const now = performance.now();
        const shouldAccel = maxAccel > window.accThresholdAccel;
        if (shouldAccel && (now - lastAccelTime) > ACCEL_COOLDOWN_MS) {
          window.setAccelPressed(true);
          lastAccelTime = now;
        } else if (!shouldAccel) {
          window.setAccelPressed(false);
        }
      }
    });
    insole.on('euler', (euler) => {
      if (cal.mode === 'auto') {
        const tilt = cal.tilt[id];
        if (tilt != null && Math.abs(tilt) > 0.1 && Math.abs(euler.roll) > 0.1) {
          cal.evidence = Math.max(-200, Math.min(200, cal.evidence + Math.sign(tilt * euler.roll)));
          if (cal.evidence <= -25) cal.sign = -1; else if (cal.evidence >= 25) cal.sign = 1;
        }
      }
      const pitch = gamePitch(id, euler);
      window.devices[id].eulers = { pitch, roll: euler.pitch, yaw: euler.yaw };
      const now = performance.now();
      // toe up past the threshold = jump (mirrors the CORE sensor script). A trigger the game's
      // jump guard ignored (no hurdle coming up) does not start the cooldown, so it cannot
      // swallow the real take-off that follows.
      if (pitch < -window.pitchThresholdJump && (now - lastJumpTime) > JUMP_COOLDOWN_MS) {
        if (window.gameJump && window.gameJump() !== false) lastJumpTime = now;
      }
    });
    insole.on('press', (press) => {
      window.devices[id].press = press.values;
    });
  }

  return {
    devices, simulator, gamePitch,
    get toeMode() { return cal.mode; },
    setPitchZero(id, value) { zero[id] = Number.isFinite(value) ? value : 0; },
    setToeMode(mode) {
      cal.mode = mode === 'normal' || mode === 'invert' ? mode : 'auto';
      try { localStorage.setItem(TOE_KEY, cal.mode); } catch { /* ignore */ }
    },
    /** Short status line for the settings drawer. */
    toeState() {
      const dir = sign() > 0 ? '標準' : '反転';
      if (cal.mode !== 'auto') return dir;
      return Math.abs(cal.evidence) >= 25 ? `${dir}（判定済み）` : `${dir}（未判定）`;
    },
  };
}
