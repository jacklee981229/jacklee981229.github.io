// 2048's sounds, made from the games' sound kit (../sound.js) as they're wanted: a breath of air as tiles slide, a pop
// as they join, and a few soft notes for 2048 and for the end. Kept few and simple, the same with either look, and no
// music. Whether sound is on is kept in this browser.
import { hiss, hz, kit, voice } from '../sound.js';

export { wake } from '../sound.js';

const KEPT = 'g2048-sound';

/** Whether the sounds are on. */
export let on = (() => {
  try { return localStorage.getItem(KEPT) !== 'off'; } catch { return true; }
})();

// Each doubling climbs a step of a five-note scale from G: 4 is G, 8 is A, 16 is B, 32 is D, and on up past 2048.
const LADDER = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26];
const noteOf = (value) => 67 + LADDER[Math.min(LADDER.length - 1, Math.max(0, Math.round(Math.log2(value)) - 2))];
// A soft pluck, like a music box: a round tone with a little of its octave, left to fade.
const pluck = (k, at, note, peak, decay) => {
  voice(k, at, { f: hz(note), peak, attack: 0.005, decay });
  voice(k, at, { f: hz(note) * 2, peak: peak * 0.18, attack: 0.004, decay: decay * 0.45 });
};

const SOUNDS = {
  // It swells gently, so it never clicks, and shifts a hair in pitch each time, so a thousand slides in a game never
  // sound like a machine.
  slide: (k, t) => {
    const v = 1 + (Math.random() - 0.5) * 0.08;
    hiss(k, t, { type: 'lowpass', f: 1000 * v, to: 1800 * v, q: 0, peak: 0.11, attack: 0.025, decay: 0.07 });
  },
  // A bubble's pop: the tone rises into its note as it starts.
  join: (k, t, value) => {
    const note = noteOf(value);
    voice(k, t, { f: hz(note) * 0.75, to: hz(note), slide: 0.025, peak: 0.09, attack: 0.005, decay: 0.13 });
    voice(k, t, { f: hz(note) * 2, peak: 0.014, attack: 0.004, decay: 0.05 });
  },
  win: (k, t) => {
    [79, 83, 86].forEach((note, i) => pluck(k, t + i * 0.1, note, 0.085, 0.3));
    pluck(k, t + 0.3, 91, 0.095, 0.7);
  },
  over: (k, t) => {
    [76, 72].forEach((note, i) => pluck(k, t + i * 0.2, note, 0.085, 0.4));
    pluck(k, t + 0.4, 69, 0.085, 0.6);
  },
};

/**
 * Plays a sound, if sound is on: slide, join (with the biggest tile the move made), win or over.
 * @param {'slide' | 'join' | 'win' | 'over'} name @param {number} [value]
 */
export function play(name, value) {
  if (!kit || !on) return;
  SOUNDS[name](kit, kit.ctx.currentTime + 0.01, value);
}

/** Turns the sounds on or off, and keeps the choice. @param {boolean} value */
export function setOn(value) {
  on = value;
  try { localStorage.setItem(KEPT, value ? 'on' : 'off'); } catch { /* private browsing: the choice just isn't kept */ }
}
