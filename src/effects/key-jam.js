// Key Jam: every letter key plays a sound and puts on a little show. The keyboard's top row is ten notes going up,
// the middle row is low notes, bells and chords, and the bottom row is drums, so tapping about makes something like
// a tune. Space changes the set: other notes, another voice, the colours moved round. The stage is a keyboard too:
// its three bands are the three rows of keys, each shared out among its letters, to click or to tap on a phone.
import { onGameKeys } from '../games/controls.js';
import { play, SETS, wake } from './synth.js';

/** The letter keys, in the keyboard's own rows. */
export const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
export const KEYS = ROWS.join('');

/** What each key does, in the order of KEYS: the sound it plays (synth.js), which note where that matters, and its show. */
export const PARTS = [
  ['note', 0, 'burst'], ['note', 1, 'ring'], ['note', 2, 'pop'], ['note', 3, 'spin'], ['note', 4, 'pie'],
  ['note', 5, 'rays'], ['note', 6, 'split'], ['note', 7, 'burst'], ['note', 8, 'ring'], ['note', 9, 'pop'],
  ['bass', 0, 'wash'], ['bass', 3, 'wash'], ['bass', 4, 'corner'], ['high', 5, 'hop'], ['high', 7, 'wave'],
  ['high', 9, 'zigzag'], ['chord', 0, 'tiles'], ['chord', 3, 'bars'], ['run', 0, 'rise'],
  ['kick', 0, 'pop'], ['snare', 0, 'rays'], ['hat', 0, 'burst'], ['clap', 0, 'split'], ['tom', 0, 'ring'], ['open', 0, 'spin'], ['zap', 0, 'wash'],
];

/**
 * Which key a click or a tap lands on: the stage is cut into the keyboard's three rows, each shared out among its keys.
 * @param {number} x @param {number} y @param {number} width @param {number} height
 */
export function keyAt(x, y, width, height) {
  const pick = (share, count) => Math.min(count - 1, Math.max(0, Math.floor(share * count)));
  const row = ROWS[pick(y / height, ROWS.length)];
  return row[pick(x / width, row.length)];
}

/** The middle of a key's patch of the stage. @param {number} index its place in KEYS */
function spot(index, width, height) {
  let row = 0;
  let along = index;
  while (along >= ROWS[row].length) along -= ROWS[row++].length;
  return { x: ((along + 0.5) / ROWS[row].length) * width, y: ((row + 0.5) / ROWS.length) * height };
}

// How a show moves, for progress p from 0 to 1.
/** Fast, then settling. */
const fast = (p) => 1 - (1 - p) ** 3;
/** Slow, fast, slow. */
const smooth = (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2);
/** The part of the show between `from` and `to`, as its own 0 to 1. */
const part = (p, from, to) => Math.min(1, Math.max(0, (p - from) / (to - from)));
/** Out and back again. */
const there = (p) => Math.sin(Math.min(1, Math.max(0, p)) * Math.PI);
const dot = (c, x, y, r) => {
  if (r <= 0) return;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
};

/**
 * The shows: how many seconds each lasts, and how to draw it at progress p (0 to 1). `s` is where and how: x, y
 * (the key's spot), w, h (the stage), size (a length that suits the stage), a and b (two colours), rand (sixteen
 * numbers thrown when the key was pressed), turn (0 to 3, for a direction) and paint (a colour and a strength to
 * a canvas colour).
 */
export const SHOWS = {
  // Dots thrown out from the key's spot.
  burst: [0.8, (c, p, s) => {
    for (let i = 0; i < 14; i++) {
      const angle = s.rand[i] * Math.PI * 2;
      const far = fast(p) * s.size * (0.6 + s.rand[(i + 5) % 16] * 1.1);
      c.fillStyle = s.paint(i % 2 ? s.a : s.b, 1 - p * p);
      dot(c, s.x + Math.cos(angle) * far, s.y + Math.sin(angle) * far, (1 - p) * (5 + s.rand[(i + 9) % 16] * 12));
    }
  }],
  // A ring that spreads and thins.
  ring: [0.8, (c, p, s) => {
    c.strokeStyle = s.paint(s.a, 1 - p * p);
    c.lineWidth = (1 - p) * 28 + 1;
    c.beginPath();
    c.arc(s.x, s.y, fast(p) * s.size * 1.6, 0, Math.PI * 2);
    c.stroke();
  }],
  // A disc that swells and shrinks away.
  pop: [0.55, (c, p, s) => {
    c.fillStyle = s.paint(s.a);
    dot(c, s.x, s.y, there(p) ** 0.5 * s.size * 0.7);
  }],
  // A triangle, square or pentagon that spins as it grows.
  spin: [0.9, (c, p, s) => {
    const sides = 3 + (s.turn % 3);
    const reach = fast(p) * s.size * 1.2;
    c.strokeStyle = s.paint(s.a, 1 - p * p);
    c.lineWidth = (1 - p) * 14 + 1;
    c.lineJoin = 'round';
    c.beginPath();
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2 + p * 4 * (s.turn % 2 ? 1 : -1);
      c.lineTo(s.x + Math.cos(angle) * reach, s.y + Math.sin(angle) * reach);
    }
    c.closePath();
    c.stroke();
  }],
  // A disc that fills round like a clock's hand, then empties the same way.
  pie: [0.8, (c, p, s) => {
    const top = -Math.PI / 2;
    c.fillStyle = s.paint(s.a);
    c.beginPath();
    c.moveTo(s.x, s.y);
    c.arc(s.x, s.y, s.size * 0.7, top + smooth(part(p, 0.4, 1)) * Math.PI * 2, top + smooth(part(p, 0, 0.6)) * Math.PI * 2);
    c.fill();
  }],
  // Lines shot out all round.
  rays: [0.7, (c, p, s) => {
    c.strokeStyle = s.paint(s.a, 1 - p * p);
    c.lineWidth = (1 - p) * 8 + 1;
    c.lineCap = 'round';
    c.beginPath();
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12 + s.rand[0]) * Math.PI * 2;
      c.moveTo(s.x + Math.cos(angle) * fast(p) * s.size * 0.5, s.y + Math.sin(angle) * fast(p) * s.size * 0.5);
      c.lineTo(s.x + Math.cos(angle) * fast(p) * s.size * 1.5, s.y + Math.sin(angle) * fast(p) * s.size * 1.5);
    }
    c.stroke();
  }],
  // A square that breaks into four, each off to its own corner.
  split: [0.7, (c, p, s) => {
    const side = s.size * 0.45 * (1 - p * 0.5);
    const away = fast(p) * s.size * 0.9 + side / 2;
    c.fillStyle = s.paint(s.a, 1 - p * p);
    for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) c.fillRect(s.x + dx * away - side / 2, s.y + dy * away - side / 2, side, side);
  }],
  // A band of colour that crosses the whole stage: its front edge sets off first, its back edge follows.
  wash: [0.75, (c, p, s) => {
    const down = s.turn % 2 === 1;
    const length = down ? s.h : s.w;
    let from = smooth(part(p, 0.35, 1)) * length;
    let to = smooth(part(p, 0, 0.65)) * length;
    if (s.turn > 1) [from, to] = [length - to, length - from];
    c.fillStyle = s.paint(s.a, 0.92);
    if (down) c.fillRect(0, from, s.w, to - from);
    else c.fillRect(from, 0, to - from, s.h);
  }],
  // A quarter disc opening out of one of the bottom corners.
  corner: [0.8, (c, p, s) => {
    c.fillStyle = s.paint(s.a, 1 - p * p);
    dot(c, s.turn % 2 ? s.w : 0, s.h, fast(p) * Math.max(s.w, s.h) * 0.6);
  }],
  // A row of dots across the stage, hopping one after another.
  hop: [0.9, (c, p, s) => {
    for (let i = 0; i < 9; i++) {
      c.fillStyle = s.paint(i % 2 ? s.a : s.b);
      dot(c, ((i + 0.5) / 9) * s.w, s.y - there(part(p, i * 0.07, i * 0.07 + 0.4)) * s.size * 0.6, there(p) ** 0.3 * 11);
    }
  }],
  // A wavy line across the stage that runs along as it flattens out.
  wave: [1, (c, p, s) => {
    c.strokeStyle = s.paint(s.a, 1 - p ** 3);
    c.lineWidth = 7;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    for (let x = 0; x <= s.w + 12; x += 12) c.lineTo(x, s.y + Math.sin(x * 0.025 + p * 14) * s.size * 0.45 * (1 - p));
    c.stroke();
  }],
  // A zigzag that runs across the stage: only the stretch between its back and front edges shows.
  zigzag: [0.8, (c, p, s) => {
    const from = smooth(part(p, 0.35, 1)) * s.w;
    const to = smooth(part(p, 0, 0.65)) * s.w;
    c.beginPath();
    c.rect(from, 0, to - from, s.h);
    c.clip();
    c.strokeStyle = s.paint(s.a);
    c.lineWidth = 9;
    c.lineJoin = 'round';
    c.beginPath();
    for (let i = 0; i <= 16; i++) c.lineTo((i / 16) * s.w, s.y + (i % 2 ? -1 : 1) * s.size * 0.28);
    c.stroke();
  }],
  // Tiles all over the stage, lit one after another in a slanting sweep.
  tiles: [0.9, (c, p, s) => {
    const across = 8;
    const down = 3;
    for (let j = 0; j < down; j++) {
      for (let i = 0; i < across; i++) {
        const lit = there(part(p, (i + j) * 0.06, (i + j) * 0.06 + 0.45));
        if (!lit) continue;
        c.fillStyle = s.paint((i + j) % 2 ? s.a : s.b, lit * 0.9);
        c.fillRect((i / across) * s.w + 4, (j / down) * s.h + 4, s.w / across - 8, s.h / down - 8);
      }
    }
  }],
  // Bars along the bottom, jumping up one after another.
  bars: [0.9, (c, p, s) => {
    for (let i = 0; i < 9; i++) {
      const tall = there(part(p, i * 0.05, i * 0.05 + 0.5)) * s.h * (0.35 + s.rand[i] * 0.6);
      c.fillStyle = s.paint(i % 2 ? s.a : s.b);
      c.fillRect(((i + 0.2) / 9) * s.w, s.h - tall, (0.6 / 9) * s.w, tall);
    }
  }],
  // Bubbles rising from the bottom to the top.
  rise: [1.1, (c, p, s) => {
    for (let i = 0; i < 10; i++) {
      c.fillStyle = s.paint(i % 2 ? s.a : s.b, 1 - p ** 3);
      dot(c, s.rand[i] * s.w, s.h + 40 - fast(part(p, s.rand[i + 5] * 0.3, 1)) * (s.h + 80), 10 + s.rand[(i + 3) % 16] * 22);
    }
  }],
};
/** The shows that cover much of the stage are drawn first, under the rest. */
const BEHIND = new Set(['wash', 'corner', 'tiles', 'bars']);
/** No more shows at once than this: the oldest goes. */
const MOST = 40;

/** @param {import('./stage.js').Stage} stage @returns {import('./stage.js').Piece} */
export default function keyJam(stage) {
  const canvas = stage.ctx.canvas;
  const family = getComputedStyle(canvas).fontFamily;
  const finger = matchMedia('(pointer: coarse)').matches;
  /** @type {{ show: string, at: number, index: number, rand: number[], turn: number, a: number, b: number }[]} */
  let shows = [];
  /** When each key was last pressed, for its letter to light up. */
  const lit = new Map();
  let set = 0;
  let played = false;

  const start = (show, index) => {
    const lanes = stage.colors.lanes.length;
    shows.push({ show, at: stage.time, index, rand: Array.from({ length: 16 }, Math.random), turn: index % 4, a: (index + set * 2) % lanes, b: (index + set * 2 + 2) % lanes });
    if (shows.length > MOST) shows.shift();
    played = true;
  };
  /** A key is pressed, or its patch of the stage: its sound and its show. Nothing while the stage is paused. */
  const hit = (index) => {
    if (index < 0 || !stage.playing) return;
    wake();
    const [sound, n, show] = PARTS[index];
    play(sound, n, set);
    start(show, index);
    lit.set(index, stage.time);
  };
  const nextSet = () => {
    if (!stage.playing) return;
    wake();
    set = (set + 1) % SETS.length;
    play('run', 0, set);
    start('wash', 13);
  };

  // Keys work wherever the page was clicked, as in the games; a button in focus keeps Space for itself.
  onGameKeys(canvas, {
    down: (e) => {
      if (e.key === ' ') {
        if (e.target instanceof Element && e.target.closest('button, a')) return false;
        if (!e.repeat) nextSet();
        return true;
      }
      // The key's place on the keyboard, not the letter it types, so other keyboard layouts play the same rows.
      const letter = /^Key[A-Z]$/.test(e.code) ? e.code[3] : e.key.toUpperCase();
      const index = letter.length === 1 ? KEYS.indexOf(letter) : -1;
      if (index < 0) return false;
      if (!e.repeat) hit(index);
      return true;
    },
  });
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    const box = canvas.getBoundingClientRect();
    hit(KEYS.indexOf(keyAt(e.clientX - box.left, e.clientY - box.top, box.width, box.height)));
  });
  // Some browsers only let sound start once the finger has lifted.
  canvas.addEventListener('pointerup', () => { if (played) wake(); });

  return {
    frame() {
      const { ctx, colors, rgba, time, width, height } = stage;
      ctx.clearRect(0, 0, width, height);
      shows = shows.filter((s) => time - s.at < SHOWS[s.show][0]);
      for (const behind of [true, false]) {
        for (const s of shows) {
          if (BEHIND.has(s.show) !== behind) continue;
          const [seconds, draw] = SHOWS[s.show];
          ctx.save();
          draw(ctx, (time - s.at) / seconds, { ...spot(s.index, width, height), w: width, h: height, size: Math.min(width, height) * 0.3, a: colors.lanes[s.a], b: colors.lanes[s.b], rand: s.rand, turn: s.turn, paint: rgba });
          ctx.restore();
        }
      }

      // The keyboard, faintly: which patch of the stage is which key. A key just pressed lights up.
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 ${Math.round(Math.min(26, Math.max(13, width / 28)))}px ${family}`;
      for (let i = 0; i < KEYS.length; i++) {
        const at = spot(i, width, height);
        const glow = Math.max(0, 1 - (time - (lit.get(i) ?? -9)) / 0.5);
        ctx.fillStyle = glow ? rgba(colors.ink, 0.35 + 0.65 * glow) : rgba(colors.muted, played ? 0.32 : 0.22);
        ctx.fillText(KEYS[i], at.x, at.y);
      }
      if (played) return;
      // Until the first key: what to do, between the top two rows of letters.
      ctx.font = `800 ${Math.round(Math.min(38, Math.max(20, width / 24)))}px ${family}`;
      ctx.fillStyle = rgba(colors.ink, 0.9);
      ctx.fillText(!stage.playing ? 'Press Play first' : finger ? 'Tap anywhere' : 'Press any letter key', width / 2, height / 3);
    },
  };
}
