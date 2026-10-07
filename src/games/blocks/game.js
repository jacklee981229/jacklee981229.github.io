// Blocks on the "Jack's Blocks" post, a falling-blocks game: draws the well and plays the
// rules from rules.js, with a clock, and the games' leaderboard (../leaderboard.js) for finished games. Its sounds and
// music come from sound.js, turned on and off by two buttons under New game, or both at once with M.
// Smoothness: the well is a grid whose cells change class only where something moved; the game is timed by
// animation frames; a held key (or a held button on a phone) repeats after a short wait, like a real console.
import { ICONS } from '../../lib/icons.js';
import { bringIntoView, onGameKeys } from '../controls.js';
import { formatTime, leaderboard } from '../leaderboard.js';
import { cells, drop, dropMs, ghost, HEIGHT, HIDDEN, hardDrop, hold, inDanger, levelOf, lock, move, newGame, rotate, settleSounds, WIDTH } from './rules.js';
import * as sound from './sound.js';

const BEST = 'blocks-best';
// A move key kept pressed repeats after this wait, then this often; a pressed down key drops a row this often.
const WAIT_MS = 170;
const REPEAT_MS = 50;
const SOFT_MS = 40;
// A landed piece can still be moved or turned for this long before it sets; moving restarts the wait, a few times.
const LOCK_MS = 500;
const LOCK_RESETS = 15;
// Full rows flash for this long before the rows above come down.
const CLEAR_MS = 180;
const KEYS = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down', ArrowUp: 'turn', ' ': 'drop', Shift: 'hold',
  a: 'left', d: 'right', s: 'down', w: 'turn', A: 'left', D: 'right', S: 'down', W: 'turn', x: 'turn', X: 'turn', z: 'back', Z: 'back', c: 'hold', C: 'hold', r: 'hold', R: 'hold',
};
const REPEATING = new Set(['left', 'right', 'down']);
// The phone buttons, in two rows: Hold, Turn, Drop above; Left, Down, Right below, like a game pad.
const PAD = [['hold', 'Hold'], ['turn', 'Turn'], ['drop', 'Drop'], ['left', 'Left'], ['down', 'Down'], ['right', 'Right']];

const store = {
  get: (key) => { try { return localStorage.getItem(key); } catch { return null; } },
  set: (key, value) => { try { localStorage.setItem(key, value); } catch { /* private browsing: the best score just isn't kept */ } },
};

const root = document.querySelector('[data-blocks]');
if (root) play(root);

function play(root) {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.innerHTML = `
    <div class="blk-play">
      <div class="blk-main">
        <div class="blk-board" tabindex="0" role="application" aria-label="Blocks well" aria-describedby="blk-help">
          <div class="blk-grid" aria-hidden="true" data-grid>${'<div class="blk-cell"></div>'.repeat(WIDTH * HEIGHT)}</div>
          <div class="blk-message" data-message hidden><p data-message-text></p><div data-extra hidden></div><div class="blk-actions" data-actions></div></div>
        </div>
        <div class="blk-side">
          <div class="blk-stat blk-next"><span class="blk-label">Next</span><div class="blk-mini" aria-hidden="true" data-next></div></div>
          <div class="blk-stat blk-next" data-hold-box><span class="blk-label">Hold</span><div class="blk-mini" aria-hidden="true" data-hold></div></div>
          <p class="blk-stat"><span class="blk-label">Score</span><strong data-score>0</strong></p>
          <p class="blk-stat"><span class="blk-label">Best</span><strong data-best>0</strong></p>
          <p class="blk-stat"><span class="blk-label">Lines</span><strong data-lines>0</strong></p>
          <p class="blk-stat"><span class="blk-label">Level</span><strong data-level>1</strong></p>
          <p class="blk-stat"><span class="blk-label">Time</span><strong data-time>00:00.00</strong></p>
          <button type="button" class="button" data-new>New game</button>
          <div class="blk-toggles">${['sound', 'music'].map((part) => `<button type="button" class="button" data-toggle="${part}" aria-pressed="true"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"></svg><span class="visually-hidden">${part === 'sound' ? 'Sound' : 'Music'}</span></button>`).join('')}</div>
        </div>
      </div>
      <div class="blk-pad" data-pad>${PAD.map(([act, label]) => `<button type="button" class="button" data-act="${act}">${label}</button>`).join('')}</div>
      <p class="blk-help" id="blk-help">Use the arrow keys (or W, A, S and D): left and right move, up turns, down drops faster. Z turns back, Space drops, C or R holds. P pauses, M mutes.</p>
    </div>
    <section data-leaderboard></section>
    <p class="visually-hidden" aria-live="polite" data-status></p>`;

  const $ = (sel) => root.querySelector(sel);
  const board = $('.blk-board');
  const message = $('[data-message]');
  const pad = $('[data-pad]');
  const cellEls = [...$('[data-grid]').children];
  const scores = leaderboard($('[data-leaderboard]'), 'blocks');
  let game = newGame();
  let best = Number(store.get(BEST)) || 0;
  /** 'ready' (waiting for Start), 'playing', 'paused' or 'over'. */
  let state = 'ready';
  let time = 0;
  let fallen = 0;
  let landed = 0;
  let resets = 0;
  /** Pieces in a row that cleared rows: a combo lifts the row chime (settleSounds in rules.js). */
  let combo = 0;
  /** Full rows flashing before they go: when the flash ends, which rows, and the well with them still in it. */
  let clearing = null;
  /** Keys or buttons kept pressed: how long, and how many moves they've made. */
  let pressed = {};
  let last = 0;
  let frame = 0;
  const shown = Array(WIDTH * HEIGHT).fill(null);

  const canFall = () => drop(game).moved;
  // The well's visible rows, as each cell's classes: set pieces, then the landing shadow, then the falling piece.
  const draw = () => {
    const want = Array(WIDTH * HEIGHT).fill('');
    const at = (x, y) => (y - HIDDEN) * WIDTH + x;
    const well = clearing ? clearing.well : game.well;
    for (let y = HIDDEN; y < HEIGHT + HIDDEN; y++) for (let x = 0; x < WIDTH; x++) if (well[y][x]) want[at(x, y)] = `p-${well[y][x]}`;
    if (clearing) {
      for (const y of clearing.rows) for (let x = 0; x < WIDTH; x++) want[at(x, y)] += ' is-clearing';
    } else if (state !== 'over') {
      for (const { x, y } of cells(ghost(game))) if (y >= HIDDEN && !want[at(x, y)]) want[at(x, y)] = `p-${game.piece.type} is-ghost`;
      for (const { x, y } of cells(game.piece)) if (y >= HIDDEN) want[at(x, y)] = `p-${game.piece.type}`;
    }
    want.forEach((classes, i) => {
      if (classes === shown[i]) return;
      cellEls[i].className = `blk-cell ${classes}`;
      shown[i] = classes;
    });
  };
  // A small picture of a piece (or of nothing), for the Next and Hold boxes.
  const drawMini = (box, type) => {
    if (!type) return box.replaceChildren();
    const piece = cells({ type, turn: 0, x: 0, y: 0 });
    const minX = Math.min(...piece.map((c) => c.x));
    const minY = Math.min(...piece.map((c) => c.y));
    const w = Math.max(...piece.map((c) => c.x)) - minX + 1;
    const h = Math.max(...piece.map((c) => c.y)) - minY + 1;
    box.style.setProperty('--w', w);
    box.replaceChildren(...Array.from({ length: w * h }, (_, i) => {
      const cell = document.createElement('div');
      const on = piece.some((c) => c.x - minX === i % w && c.y - minY === Math.floor(i / w));
      cell.className = on ? `blk-cell p-${type}` : 'blk-cell is-blank';
      return cell;
    }));
  };
  // Next, and Hold, which fades once used until the piece sets.
  const drawNext = () => {
    drawMini($('[data-next]'), game.next);
    drawMini($('[data-hold]'), game.held);
    $('[data-hold-box]').classList.toggle('is-used', !game.canHold);
  };
  const showStats = () => {
    if (game.score > best) {
      best = game.score;
      store.set(BEST, String(best));
    }
    $('[data-score]').textContent = game.score.toLocaleString('en-US');
    $('[data-best]').textContent = best.toLocaleString('en-US');
    $('[data-lines]').textContent = game.lines;
    $('[data-level]').textContent = levelOf(game.lines);
    $('[data-time]').textContent = formatTime(time);
  };

  // A message over the well, with its buttons, and `extra` (the leaderboard's part) between them. The focus goes to
  // its first box or button, except for the first message as the page opens.
  const say = (words, buttons, extra, focus = true) => {
    $('[data-message-text]').textContent = words;
    $('[data-extra]').replaceChildren(...(extra ? [extra] : []));
    $('[data-extra]').hidden = !extra;
    $('[data-actions]').replaceChildren(...buttons.map(([label, action]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button';
      button.textContent = label;
      button.addEventListener('click', action);
      return button;
    }));
    message.hidden = false;
    $('[data-status]').textContent = extra?.dataset.said ? `${words} ${extra.dataset.said}` : words;
    if (focus) message.querySelector('input, button').focus();
  };
  const toActions = () => $('[data-actions] button').focus();

  // After a piece sets: its sounds, then flash any full rows, bring the next piece, or end the game. A hard drop
  // (`dropped`) thuds instead of the click a piece makes setting by itself.
  const settled = (r, dropped = false) => {
    const cue = settleSounds(game.lines, r.game.lines, r.cleared.length, dropped, combo);
    combo = cue.combo;
    for (const [name, rows, step, delay] of cue.sounds) sound.play(name, rows, step, delay);
    sound.setLevel(levelOf(r.game.lines));
    game = r.game;
    landed = 0;
    resets = 0;
    fallen = 0;
    if (r.cleared.length) {
      clearing = { until: performance.now() + (still ? 0 : CLEAR_MS), rows: r.cleared, well: r.merged };
      $('[data-status]').textContent = `Cleared ${r.cleared.length} ${r.cleared.length === 1 ? 'row' : 'rows'}.`;
    }
    drawNext();
    if (game.over) over();
    else sound.danger(inDanger(game.well));
  };
  const over = () => {
    sound.stopMusic();
    sound.danger(false);
    sound.play('over');
    state = 'over';
    pressed = {};
    clearing = null;
    draw();
    showStats();
    say('Game over.', [['Play again', restart]], scores.finish(game.score, time, toActions));
  };
  // A move or turn that worked while the piece is landed gives it a little longer before it sets. True if it worked,
  // so it makes its sound.
  const moved = (next) => {
    if (next === game) return false;
    game = next;
    if (!canFall() && resets < LOCK_RESETS) {
      landed = 0;
      resets++;
    }
    return true;
  };
  const act = (action) => {
    if (state !== 'playing' || clearing) return;
    if (action === 'left' || action === 'right') {
      if (moved(move(game, action === 'left' ? -1 : 1))) sound.play('move');
    } else if (action === 'turn' || action === 'back') {
      if (moved(rotate(game, action === 'turn' ? 1 : -1))) sound.play('turn');
    } else if (action === 'drop') settled(hardDrop(game), true);
    else if (action === 'hold') {
      const next = hold(game);
      if (next === game) return;
      sound.play('hold');
      // A piece coming in from the side starts fresh at the top.
      game = next;
      fallen = 0;
      landed = 0;
      resets = 0;
      drawNext();
      if (game.over) return over();
    } else if (action === 'down') {
      const r = drop(game, true);
      if (r.moved) {
        game = r.game;
        fallen = 0;
      }
    }
    draw();
  };
  const press = (action) => {
    sound.wake();
    if (REPEATING.has(action)) pressed[action] = { t: 0, moves: 1 };
    act(action);
  };
  const release = (action) => { delete pressed[action]; };

  const loop = (now) => {
    const dt = Math.min(now - last, 100);
    last = now;
    if (state !== 'playing') return;
    time += dt;
    if (clearing && now >= clearing.until) clearing = null;
    if (!clearing) {
      for (const side of ['left', 'right']) {
        const key = pressed[side];
        if (!key) continue;
        key.t += dt;
        const due = 1 + (key.t >= WAIT_MS ? 1 + Math.floor((key.t - WAIT_MS) / REPEAT_MS) : 0);
        while (key.moves < due) {
          key.moves++;
          if (moved(move(game, side === 'left' ? -1 : 1))) sound.play('move');
        }
      }
      const every = pressed.down ? Math.min(SOFT_MS, dropMs(levelOf(game.lines))) : dropMs(levelOf(game.lines));
      fallen += dt;
      while (fallen >= every) {
        fallen -= every;
        const r = drop(game, Boolean(pressed.down));
        if (!r.moved) {
          fallen = 0;
          break;
        }
        game = r.game;
        landed = 0;
      }
      if (canFall()) landed = 0;
      else if ((landed += dt) >= LOCK_MS) settled(lock(game));
    }
    if (state !== 'playing') return;
    draw();
    showStats();
    frame = requestAnimationFrame(loop);
  };
  const run = () => {
    state = 'playing';
    message.hidden = true;
    last = performance.now();
    frame = requestAnimationFrame(loop);
  };
  const start = () => {
    bringIntoView(board, getComputedStyle(pad).display === 'none' ? board : pad);
    sound.wake();
    sound.startMusic(levelOf(game.lines));
    sound.danger(inDanger(game.well));
    run();
    board.focus({ preventScroll: true });
  };
  const pause = () => {
    if (state !== 'playing') return;
    state = 'paused';
    pressed = {};
    cancelAnimationFrame(frame);
    sound.holdMusic(false);
    sound.danger(false);
    say('Paused.', [['Continue', resume]]);
  };
  const resume = () => {
    if (state !== 'paused') return;
    sound.wake();
    // Danger first, so music coming back in a high pile comes back dipped under the heartbeat.
    sound.danger(inDanger(game.well));
    sound.holdMusic(true);
    run();
    board.focus({ preventScroll: true });
  };
  const restart = () => {
    cancelAnimationFrame(frame);
    game = newGame();
    time = 0;
    fallen = 0;
    landed = 0;
    resets = 0;
    combo = 0;
    clearing = null;
    pressed = {};
    draw();
    drawNext();
    showStats();
    start();
  };

  // The Sound and Music buttons: each shows its icon crossed out while off, and says so when pointed at.
  const toggles = [...root.querySelectorAll('[data-toggle]')];
  const showToggles = () => {
    for (const button of toggles) {
      const part = button.dataset.toggle;
      const name = part === 'sound' ? 'Sound' : 'Music';
      button.setAttribute('aria-pressed', String(sound.on[part]));
      button.title = `${name} ${sound.on[part] ? 'on' : 'off'}`;
      button.querySelector('svg').innerHTML = ICONS[sound.on[part] ? part : `${part}-off`];
    }
  };
  const setSound = (parts, value) => {
    sound.wake();
    for (const part of parts) sound.setOn(part, value);
    showToggles();
    $('[data-status]').textContent = parts.length > 1 ? `Sound and music ${value ? 'on' : 'off'}.` : `${parts[0] === 'sound' ? 'Sound' : 'Music'} ${value ? 'on' : 'off'}.`;
  };
  for (const button of toggles) button.addEventListener('click', () => setSound([button.dataset.toggle], !sound.on[button.dataset.toggle]));
  // M mutes both, or brings both back once both are off.
  const muteAll = () => setSound(['sound', 'music'], !(sound.on.sound || sound.on.music));

  onGameKeys(board, {
    down: (e) => {
      if (e.key === 'm' || e.key === 'M') {
        muteAll();
        return true;
      }
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (state === 'playing') pause();
        else if (state === 'paused') resume();
        else return false;
        return true;
      }
      const action = KEYS[e.key];
      // Until the game is on, keys do their usual thing (Space or Enter presses the button in the message).
      if (!action || state !== 'playing') return false;
      // A held key repeats at the game's own pace, not the keyboard's.
      if (!e.repeat) press(action);
      return true;
    },
    up: (e) => {
      const action = KEYS[e.key];
      if (action) release(action);
    },
  });
  // The buttons under the well, for phones: held Left, Right and Down repeat like keys.
  for (const button of pad.querySelectorAll('button')) {
    const action = button.dataset.act;
    button.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      button.setPointerCapture(e.pointerId);
      press(action);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, () => release(action));
  }
  $('[data-new]').addEventListener('click', restart);
  // A game in play pauses when the page is left or another window takes the keys.
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  addEventListener('blur', pause);

  draw();
  drawNext();
  showStats();
  showToggles();
  say('Ready?', [['Start', start]], undefined, false);
}
