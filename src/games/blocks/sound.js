// Blocks' sounds and music, made from the games' sound kit (../sound.js) as they're wanted. Two sets, one for each of
// the games' looks: New colours plays retro chip sounds over a chiptune, Old green soft ones over a lo-fi tune;
// switching looks mid-game switches them too. Whether sound and music are on is kept in this browser.
import { held, hiss, hz, kit, voice } from '../sound.js';

export { wake } from '../sound.js';

const KEPT = { sound: 'blocks-sound', music: 'blocks-music' };
// The music sits under the sounds; levels speed it up a little each, to a limit.
const MUSIC_LEVEL = 0.55;
const SPEED_UP = 0.03;
const MAX_SPEED_UP = 0.3;
// A beat of the danger heartbeat, in milliseconds; while it beats, the music steps back to this share of its level.
const HEARTBEAT_MS = 850;
const DANGER_DIP = 0.5;

const kept = (part) => {
  try { return localStorage.getItem(KEPT[part]) !== 'off'; } catch { return true; }
};
/** Whether the sounds and the music are on. */
export const on = { sound: kept('sound'), music: kept('music') };

const look = () => (document.documentElement.dataset.gameLook === 'old' ? 'soft' : 'retro');

const chip = (k, at, note, peak = 0.1, decay = 0.1, duty = 0.25) => voice(k, at, { duty, f: hz(note), peak, attack: 0.002, decay, lowpass: 6000 });
// A bell's ring comes from a second tone that isn't a neat multiple of the first.
const bell = (k, at, note, peak = 0.16, decay = 0.45) => {
  voice(k, at, { f: hz(note), peak, decay });
  voice(k, at, { f: hz(note) * 2.76, peak: peak * 0.3, decay: decay * 0.5 });
};
const marimba = (k, at, note, peak = 0.2, decay = 0.3) => {
  voice(k, at, { wave: 'triangle', f: hz(note), peak, decay });
  voice(k, at, { f: hz(note) * 4, peak: peak * 0.15, decay: decay * 0.3 });
};
// An electric piano: a soft tone with a little of its octave, ringing on after the key lets go.
const keys = (k, at, note, peak, length) => {
  held(k, at, { f: hz(note), peak, length, attack: 0.012, sustain: 0.55, release: 0.45 });
  held(k, at, { f: hz(note) * 2, peak: peak * 0.18, length: length * 0.5, attack: 0.008, sustain: 0.3, release: 0.25 });
};

// The sounds of each set. Rows take how many rows (n) and the combo step (c): each step lifts the chime two semitones.
const SOUNDS = {
  retro: {
    move: (k, t) => voice(k, t, { duty: 0.125, f: 1200, to: 950, peak: 0.05, attack: 0.002, decay: 0.025, lowpass: 5000 }),
    turn: (k, t) => { chip(k, t, 76, 0.08, 0.035); chip(k, t + 0.03, 83, 0.08, 0.045); },
    drop: (k, t) => {
      hiss(k, t, { type: 'lowpass', f: 2200, to: 300, q: 0.7, peak: 0.4, decay: 0.09 });
      voice(k, t, { duty: 0.5, f: 150, to: 55, peak: 0.16, decay: 0.13, lowpass: 2000 });
    },
    set: (k, t) => {
      voice(k, t, { wave: 'triangle', f: 220, to: 180, peak: 0.22, decay: 0.06 });
      hiss(k, t, { type: 'highpass', f: 4000, peak: 0.05, decay: 0.02 });
    },
    hold: (k, t) => { chip(k, t, 79, 0.07, 0.04); chip(k, t + 0.04, 74, 0.07, 0.04); chip(k, t + 0.08, 79, 0.07, 0.06); },
    rows: (k, t, n, c) => {
      const base = 72 + 2 * c;
      [0, 4, 7, 12].slice(0, n + 1).forEach((step, i) => chip(k, t + i * 0.055, base + step, 0.09, 0.14));
      voice(k, t, { wave: 'triangle', f: hz(base - 12), peak: 0.12, decay: 0.22 });
    },
    four: (k, t) => {
      [72, 76, 79, 84, 88, 91, 96].forEach((note, i) => chip(k, t + i * 0.045, note, 0.08, 0.09));
      const ring = t + 0.34;
      [84, 88, 91].forEach((note) => chip(k, ring, note, 0.06, 0.6, 0.125));
      voice(k, ring, { wave: 'triangle', f: hz(60), peak: 0.16, decay: 0.6 });
      hiss(k, ring, { type: 'highpass', f: 6000, peak: 0.07, decay: 0.45 });
    },
    level: (k, t) => { [67, 72, 76, 79].forEach((note, i) => chip(k, t + i * 0.075, note, 0.08, 0.07)); chip(k, t + 0.3, 84, 0.09, 0.32); },
    over: (k, t) => {
      [79, 78, 77, 76].forEach((note, i) => chip(k, t + i * 0.18, note, 0.08, 0.16, 0.5));
      voice(k, t + 0.72, { duty: 0.5, f: hz(60), to: hz(48), peak: 0.1, decay: 0.7, lowpass: 3000 });
    },
    // Two knocks pitched well above the kick drum, so the music's drums can't hide them, and laptop speakers, which
    // lose the deep part of a sound, still play them.
    beat: (k, t) => {
      const knock = (at, note, peak) => {
        voice(k, at, { duty: 0.5, f: hz(note), to: hz(note - 7), slide: 0.08, peak, attack: 0.003, decay: 0.09, lowpass: 1400 });
        hiss(k, at, { f: 1800, q: 1.2, peak: peak * 0.5, decay: 0.012 });
      };
      knock(t, 50, 0.26);
      knock(t + 0.16, 47, 0.19);
    },
  },
  soft: {
    move: (k, t) => { hiss(k, t, { f: 3000, q: 5, peak: 0.16, decay: 0.022 }); voice(k, t, { f: 1600, peak: 0.025, decay: 0.02 }); },
    turn: (k, t) => { voice(k, t, { f: 880, to: 1320, slide: 0.05, peak: 0.1, decay: 0.07 }); voice(k, t, { wave: 'triangle', f: 440, peak: 0.05, decay: 0.05 }); },
    drop: (k, t) => { voice(k, t, { f: 170, to: 55, peak: 0.6, decay: 0.18 }); hiss(k, t, { type: 'lowpass', f: 900, peak: 0.22, decay: 0.05 }); },
    set: (k, t) => { voice(k, t, { wave: 'triangle', f: 700, to: 620, peak: 0.16, decay: 0.06 }); voice(k, t, { f: 1400, peak: 0.04, decay: 0.04 }); },
    hold: (k, t) => { hiss(k, t, { f: 600, to: 2600, q: 2, peak: 0.2, decay: 0.15 }); voice(k, t, { f: 520, to: 780, peak: 0.05, decay: 0.14 }); },
    rows: (k, t, n, c) => {
      const base = 79 + 2 * c;
      [0, 4, 7].slice(0, n).forEach((step, i) => bell(k, t + i * 0.045, base + step, 0.14, 0.32));
      bell(k, t + n * 0.045, base + 12 + (n > 1 ? 4 : 0), 0.06, 0.25);
    },
    four: (k, t) => {
      [84, 88, 91, 96, 100].forEach((note, i) => bell(k, t + i * 0.06, note, 0.13, 0.6));
      voice(k, t, { f: 130, peak: 0.18, decay: 0.7 });
      for (let i = 0; i < 8; i++) voice(k, t + 0.3 + i * 0.07, { f: hz(96 + [0, 4, 7, 12][i % 4]), peak: 0.03, decay: 0.15 });
    },
    level: (k, t) => { [72, 76, 79, 84, 88].forEach((note, i) => marimba(k, t + i * 0.07, note, 0.16, 0.3)); },
    over: (k, t) => {
      [79, 76, 72].forEach((note, i) => bell(k, t + i * 0.22, note, 0.13, 0.55));
      voice(k, t + 0.7, { f: 65, to: 45, peak: 0.45, decay: 0.75 });
    },
    // Like the retro beat: two soft knocks above the kick drum, each with an octave and a tick for small speakers.
    beat: (k, t) => {
      const knock = (at, note, peak) => {
        voice(k, at, { f: hz(note), to: hz(note - 5), slide: 0.1, peak, attack: 0.006, decay: 0.16, lowpass: 900 });
        voice(k, at, { wave: 'triangle', f: hz(note + 12), to: hz(note + 7), peak: peak * 0.35, attack: 0.004, decay: 0.06 });
        hiss(k, at, { type: 'lowpass', f: 1200, peak: peak * 0.3, decay: 0.02 });
      };
      knock(t, 48, 0.4);
      knock(t + 0.18, 45, 0.3);
    },
  },
};

// The tunes, one bar at a time, as "step:note:steps" with sixteen steps to a bar; rests are left out.
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midi = (name) => {
  const [, letter, sign, octave] = name.match(/^([A-G])(#|b)?(\d)$/);
  return 12 * (Number(octave) + 1) + NOTE[letter] + (sign === '#' ? 1 : sign === 'b' ? -1 : 0);
};
const tune = (line) => {
  const at = {};
  for (const part of line.split(' ')) {
    const [step, name, steps] = part.split(':');
    at[step] = [midi(name), Number(steps)];
  }
  return at;
};

// The chiptune, in G major: A, a busier B, then a floating C over running arpeggios.
const CHIP_CHORDS = {
  G: { root: 43, tones: [67, 71, 74, 79] }, D: { root: 38, tones: [66, 69, 74, 78] }, Em: { root: 40, tones: [64, 67, 71, 76] },
  C: { root: 36, tones: [64, 67, 72, 76] }, Am: { root: 45, tones: [64, 69, 72, 76] }, Bm: { root: 47, tones: [66, 71, 74, 78] },
};
const CHIP = [
  ['G', '0:B4:2 2:D5:2 4:G5:2 6:D5:2 8:B5:4 12:A5:2 14:G5:2'], ['D', '0:F#5:4 4:A5:2 6:F#5:2 8:D5:6'],
  ['Em', '0:E5:2 2:G5:2 4:B5:2 6:G5:2 8:E5:4 12:F#5:2 14:G5:2'], ['C', '0:E5:4 4:C5:2 6:D5:2 8:E5:4 12:D5:4'],
  ['G', '0:B4:2 2:D5:2 4:G5:2 6:D5:2 8:B5:2 10:C6:2 12:B5:2 14:A5:2'], ['D', '0:A5:4 4:F#5:2 6:A5:2 8:D6:6'],
  ['C', '0:C6:2 2:B5:2 4:A5:2 6:G5:2 8:E5:4 12:G5:4'], ['D', '0:F#5:4 4:E5:2 6:F#5:2 8:A5:4 12:D5:4'],
  ['Em', '0:G5:2 2:G5:2 4:B5:2 6:G5:2 8:E5:2 10:E5:2 12:G5:4'], ['C', '0:E5:2 2:E5:2 4:G5:2 6:E5:2 8:C5:4 12:E5:4'],
  ['G', '0:D5:2 2:D5:2 4:G5:2 6:B5:2 8:D6:4 12:B5:4'], ['D', '0:A5:4 4:F#5:4 8:D5:4 12:F#5:4'],
  ['Em', '0:G5:2 2:G5:2 4:B5:2 6:G5:2 8:E6:4 12:D6:4'], ['C', '0:C6:4 4:B5:2 6:A5:2 8:G5:4 12:E5:4'],
  ['Am', '0:A5:2 2:C6:2 4:E6:2 6:C6:2 8:A5:2 10:G5:2 12:E5:4'], ['D', '0:F#5:2 2:G5:2 4:A5:4 8:D5:2 10:E5:2 12:F#5:4'],
  ['C', '0:E5:6 6:G5:2 8:C6:8'], ['D', '0:D6:6 6:C6:2 8:A5:8'], ['Bm', '0:B5:6 6:A5:2 8:F#5:8'], ['Em', '0:G5:6 6:F#5:2 8:E5:8'],
  ['C', '0:E5:4 4:G5:4 8:C6:4 12:E6:4'], ['D', '0:D6:4 4:A5:4 8:F#5:4 12:A5:4'],
  ['G', '0:B5:2 2:A5:2 4:G5:2 6:D5:2 8:B4:4 12:D5:4'], ['D', '0:F#5:4 4:A5:4 8:D6:4 12:C6:2 14:A5:2'],
].map(([chord, line]) => ({ ...CHIP_CHORDS[chord], lead: tune(line) }));

// The lo-fi tune, in F: seventh chords falling a step a bar, a bell tune over them, the last bar a breath.
const LOFI_CHORDS = {
  Fmaj7: { root: 41, tones: [53, 57, 60, 64] }, Em7: { root: 40, tones: [52, 55, 59, 62] }, Dm7: { root: 38, tones: [50, 53, 57, 60] },
  Cmaj7: { root: 36, tones: [48, 52, 55, 59] }, Bbmaj7: { root: 46, tones: [50, 53, 57, 62] }, Am7: { root: 45, tones: [52, 55, 60, 64] },
  Gm7: { root: 43, tones: [50, 53, 58, 62] }, C7: { root: 36, tones: [52, 55, 58, 64] },
};
const LOFI = [
  ['Fmaj7', '0:A5:4 4:G5:2 6:F5:4 12:C5:4'], ['Em7', '2:D5:2 4:E5:4 8:G5:6'], ['Dm7', '0:F5:4 4:E5:2 6:D5:4 12:A4:4'], ['Cmaj7', '2:C5:2 4:D5:2 6:E5:8'],
  ['Fmaj7', '0:A5:2 2:C6:2 4:A5:4 8:G5:4 12:F5:4'], ['Em7', '0:G5:6 6:E5:2 8:D5:8'], ['Dm7', '0:F5:4 4:A5:4 8:C6:4 12:A5:4'], ['Cmaj7', '0:G5:8 8:E5:8'],
  ['Bbmaj7', '0:D6:4 4:C6:2 6:A5:4 12:F5:4'], ['Am7', '2:E5:2 4:G5:4 8:C6:6'], ['Gm7', '0:Bb5:4 4:A5:2 6:G5:4 12:D5:4'], ['C7', '0:E5:4 4:G5:4 8:Bb5:8'],
  ['Bbmaj7', '0:A5:2 2:F5:2 4:D5:4 8:F5:4 12:A5:4'], ['Am7', '0:C6:6 6:A5:2 8:G5:8'], ['Gm7', '0:F5:4 4:G5:4 8:A5:4 12:Bb5:4'], ['C7', '0:C6:8'],
].map(([chord, line]) => ({ ...LOFI_CHORDS[chord], lead: tune(line) }));
// The lo-fi tune's off-beat eighths come this much of a step late: its lazy swing.
const SWING = 0.33;

// Each tune plays a sixteenth step at a time, so the speed can change between any two steps.
const MUSIC = {
  retro: {
    bpm: 150,
    bars: CHIP,
    step: (k, bar, s, at, dur) => {
      const b = CHIP[bar];
      const note = b.lead[s];
      if (note) held(k, at, { duty: 0.25, f: hz(note[0]), peak: 0.06, length: note[1] * dur * 0.9, release: 0.03, sustain: 0.8, lowpass: 6000 });
      if (s % 2 === 0) held(k, at, { wave: 'triangle', f: hz(b.root + (s % 4 === 2 ? 12 : 0)), peak: 0.15, length: dur * 1.6, release: 0.02, sustain: 0.9 });
      if (bar >= 16 && bar <= 21) voice(k, at, { duty: 0.125, f: hz(b.tones[s % b.tones.length] + 12), peak: 0.022, attack: 0.002, decay: dur * 0.8, lowpass: 7000 });
      const busy = bar >= 8 && bar < 16;
      if (s === 0 || s === 8 || (busy && s === 10)) voice(k, at, { f: 150, to: 45, peak: 0.45, decay: 0.12 });
      const fill = bar % 8 === 7 && s >= 13;
      if (s === 4 || s === 12 || fill) {
        hiss(k, at, { f: 1800, q: 0.9, peak: fill && s !== 12 ? 0.14 : 0.2, decay: 0.09 });
        voice(k, at, { wave: 'triangle', f: 185, to: 140, peak: 0.1, decay: 0.05 });
      }
      if (s % 2 === 0) hiss(k, at, { type: 'highpass', f: 7000, peak: 0.05, decay: 0.025 });
      else if (busy) hiss(k, at, { type: 'highpass', f: 8000, peak: 0.025, decay: 0.02 });
    },
  },
  soft: {
    bpm: 84,
    bars: LOFI,
    step: (k, bar, s, at, dur) => {
      const b = LOFI[bar];
      const late = s % 4 === 2 ? SWING * dur : 0;
      if (s === 0) b.tones.forEach((n, i) => keys(k, at + i * 0.012, n, 0.055, dur * 8));
      if (s === 10) b.tones.forEach((n, i) => keys(k, at + late + i * 0.01, n, 0.03, dur * 5));
      const note = b.lead[s];
      if (note) bell(k, at + late, note[0], 0.065, Math.min(1.2, note[1] * dur * 1.4));
      if (s === 0 || s === 10) {
        held(k, at, { f: hz(b.root - 12), peak: 0.24, length: dur * (s === 0 ? 6 : 4), attack: 0.01, sustain: 0.7, release: 0.12 });
        held(k, at, { wave: 'triangle', f: hz(b.root), peak: 0.04, length: dur * (s === 0 ? 6 : 4), attack: 0.01, sustain: 0.6, release: 0.1 });
      }
      if (bar === LOFI.length - 1) return;
      if (s === 0 || s === 7 || s === 10) voice(k, at, { f: 110, to: 42, peak: 0.4, decay: 0.16, lowpass: 400 });
      if (s === 4 || s === 12) hiss(k, at, { f: 1400, q: 0.7, peak: 0.1, decay: 0.12 });
      if (s % 2 === 0) hiss(k, at + late, { type: 'highpass', f: 8000, peak: s % 4 === 0 ? 0.03 : 0.018, decay: 0.02 });
    },
  },
};

/**
 * Plays one of the look's sounds, if sound is on: move, turn, drop, set, hold, rows (with how many and the combo
 * step), four, level or over. `delay` is in seconds.
 * @param {string} name @param {number} [rows] @param {number} [step] @param {number} [delay]
 */
export function play(name, rows = 1, step = 0, delay = 0) {
  if (!kit || !on.sound) return;
  SOUNDS[look()][name](kit, kit.ctx.currentTime + 0.01 + delay, rows, step);
}

// The danger heartbeat: wanted while the pile is high, heard while sound is on. The music dips while it beats.
let dangerWanted = false;
let heart = 0;
const syncHeart = () => {
  const should = Boolean(dangerWanted && on.sound && kit);
  if (should === Boolean(heart)) return;
  if (should) {
    const beat = () => SOUNDS[look()].beat(kit, kit.ctx.currentTime + 0.01);
    beat();
    heart = setInterval(beat, HEARTBEAT_MS);
  } else {
    clearInterval(heart);
    heart = 0;
  }
  if (player) player.bus.gain.setTargetAtTime(musicLevel(), kit.ctx.currentTime, 0.15);
};
/** The heartbeat beats while `high` is true. @param {boolean} high */
export function danger(high) {
  dangerWanted = high;
  syncHeart();
}

// The music: wanted while the game plays, heard while music is on. `position` is the next step from the tune's start,
// so a paused tune picks up where it stopped; steps are lined up a moment ahead of the clock, so the beat stays even.
let musicWanted = false;
let position = 0;
let level = 1;
/** @type {{ bus: GainNode, timer: number, style: string } | null} */
let player = null;
const musicLevel = () => MUSIC_LEVEL * (heart ? DANGER_DIP : 1);
const stepLength = (style) => 60 / (MUSIC[style].bpm * (1 + Math.min(MAX_SPEED_UP, SPEED_UP * (level - 1)))) / 4;
function stopPlayer() {
  if (!player) return;
  clearInterval(player.timer);
  // Notes already lined up a moment ahead go quiet with their bus.
  const { bus } = player;
  bus.gain.setTargetAtTime(0, bus.context.currentTime, 0.02);
  setTimeout(() => bus.disconnect(), 300);
  player = null;
}
function syncMusic() {
  stopPlayer();
  if (!musicWanted || !on.music || !kit) return;
  const style = look();
  const song = MUSIC[style];
  const bus = kit.ctx.createGain();
  bus.gain.value = musicLevel();
  bus.connect(kit.out);
  const sub = { ...kit, out: bus };
  let next = kit.ctx.currentTime + 0.05;
  const tick = () => {
    while (next < kit.ctx.currentTime + 0.15) {
      const dur = stepLength(style);
      const i = position % (song.bars.length * 16);
      song.step(sub, Math.floor(i / 16), i % 16, next, dur);
      position++;
      next += dur;
    }
  };
  tick();
  player = { bus, timer: setInterval(tick, 30), style };
}
/** Starts the music from the top, at a level. @param {number} atLevel */
export function startMusic(atLevel) {
  position = 0;
  level = atLevel;
  musicWanted = true;
  syncMusic();
}
/** Pauses the music where it is, or (with `resume`) carries on from there. @param {boolean} resume */
export function holdMusic(resume) {
  musicWanted = resume;
  syncMusic();
}
export function stopMusic() {
  musicWanted = false;
  position = 0;
  syncMusic();
}
/** A new level speeds the music up from its next step. @param {number} n */
export function setLevel(n) {
  level = n;
}

/** Turns the sounds or the music on or off, and keeps the choice. @param {'sound' | 'music'} part @param {boolean} value */
export function setOn(part, value) {
  on[part] = value;
  try { localStorage.setItem(KEPT[part], value ? 'on' : 'off'); } catch { /* private browsing: the choice just isn't kept */ }
  if (part === 'music') syncMusic();
  else syncHeart();
}

// A switch of looks mid-game: the other tune takes over from its start.
new MutationObserver(() => {
  if (!player || player.style === look()) return;
  position = 0;
  syncMusic();
}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-game-look'] });
