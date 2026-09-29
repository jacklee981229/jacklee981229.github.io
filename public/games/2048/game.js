// 2048 on the "Play 2048!" post: draws the board and plays the rules from rules.js.
// Smoothness: each tile is one element moved by a GPU-friendly transform; joins pop and new tiles appear once
// the slide ends; a key pressed mid-slide finishes the current step at once, so input never waits for animation.
import { move, newGame, SIZE } from './rules.js';

const KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down', A: 'left', D: 'right', W: 'up', S: 'down' };
const SAVED = 'g2048-game';
const BEST = 'g2048-best';
// A swipe shorter than this is a tap, not a move.
const SWIPE_PX = 24;

const store = {
  get: (key) => { try { return localStorage.getItem(key); } catch { return null; } },
  set: (key, value) => { try { localStorage.setItem(key, value); } catch { /* private browsing: the game just isn't kept */ } },
};

const root = document.querySelector('[data-game-2048]');
if (root) play(root);

function play(root) {
  const slideMs = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 110;
  root.style.setProperty('--slide', `${slideMs}ms`);
  root.innerHTML = `
    <div class="g2048-top">
      <div class="g2048-scores">
        <p class="g2048-score"><span class="g2048-label">Score</span><strong data-score>0</strong></p>
        <p class="g2048-score"><span class="g2048-label">Best</span><strong data-best>0</strong></p>
      </div>
      <button type="button" class="button" data-new>New game</button>
    </div>
    <div class="g2048-board" tabindex="0" role="application" aria-label="2048 board" aria-describedby="g2048-help">
      <div class="g2048-cells" aria-hidden="true">${'<div></div>'.repeat(SIZE * SIZE)}</div>
      <div class="g2048-tiles" aria-hidden="true" data-tiles></div>
      <div class="g2048-message" data-message hidden><p data-message-text></p><div class="g2048-actions" data-actions></div></div>
    </div>
    <p class="g2048-help" id="g2048-help">Use the arrow keys (or W, A, S and D), or swipe on the board. Two tiles with the same number join into one. Reach 2048!</p>
    <p class="visually-hidden" aria-live="polite" data-status></p>`;

  const $ = (sel) => root.querySelector(sel);
  const board = $('.g2048-board');
  const layer = $('[data-tiles]');
  const message = $('[data-message]');
  const scoreEl = $('[data-score]');
  const bestEl = $('[data-best]');
  /** @type {Map<number, HTMLElement>} */
  const tiles = new Map();
  let game = restore() ?? newGame();
  let best = Math.max(Number(store.get(BEST)) || 0, game.score);
  let pending = null;

  function restore() {
    try {
      const g = JSON.parse(store.get(SAVED) ?? 'null');
      const ok = g && Array.isArray(g.tiles) && g.tiles.every((t) => [t.x, t.y].every((n) => Number.isInteger(n) && n >= 0 && n < SIZE) && t.value >= 2);
      return ok ? g : null;
    } catch {
      return null;
    }
  }

  const place = (el, t) => {
    el.style.setProperty('--x', t.x);
    el.style.setProperty('--y', t.y);
  };
  const make = (t, kind) => {
    const el = document.createElement('div');
    el.className = `g2048-tile v${t.value > 2048 ? 'big' : t.value} d${Math.min(String(t.value).length, 5)}${kind ? ` is-${kind}` : ''}`;
    const face = document.createElement('span');
    face.textContent = t.value;
    el.append(face);
    place(el, t);
    layer.append(el);
    tiles.set(t.id, el);
  };
  const drawAll = (kind) => {
    layer.replaceChildren();
    tiles.clear();
    game.tiles.forEach((t) => make(t, kind));
  };

  const showScore = (gained) => {
    scoreEl.textContent = game.score.toLocaleString('en-US');
    if (game.score > best) {
      best = game.score;
      store.set(BEST, String(best));
    }
    bestEl.textContent = best.toLocaleString('en-US');
    // Reduced motion: no floating "+8", since its fade (which removes it) never runs.
    if (gained && slideMs) {
      const gain = document.createElement('span');
      gain.className = 'g2048-gain';
      gain.textContent = `+${gained}`;
      scoreEl.parentElement.append(gain);
      gain.addEventListener('animationend', () => gain.remove());
    }
  };

  const say = (words, buttons) => {
    $('[data-message-text]').textContent = words;
    $('[data-actions]').replaceChildren(...buttons.map(([label, action]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button';
      button.textContent = label;
      button.addEventListener('click', action);
      return button;
    }));
    message.hidden = false;
    $('[data-status]').textContent = words;
    message.querySelector('button').focus();
  };
  const keepGoing = () => {
    message.hidden = true;
    board.focus();
  };
  const restart = () => {
    finishNow();
    game = newGame();
    store.set(SAVED, JSON.stringify(game));
    message.hidden = true;
    drawAll('new');
    showScore(0);
    board.focus();
  };

  // The end of a move (joins, the new tile, messages) waits for the slide, unless another move needs it now.
  const finishNow = () => {
    if (!pending) return;
    clearTimeout(pending.timer);
    const { finish } = pending;
    pending = null;
    finish();
  };

  const step = (direction) => {
    if (!message.hidden) return;
    finishNow();
    const before = game;
    const r = move(game, direction);
    if (!r.moved) return;
    game = r.game;
    store.set(SAVED, JSON.stringify(game));
    for (const s of r.slid) {
      const el = tiles.get(s.id);
      if (el) place(el, s);
    }
    showScore(r.gained);
    const finish = () => {
      for (const joined of r.merged) {
        for (const id of joined.from) {
          tiles.get(id)?.remove();
          tiles.delete(id);
        }
        make(joined, 'merged');
      }
      if (r.spawned) make(r.spawned, 'new');
      if (game.won && !before.won) say('You made 2048!', [['Keep going', keepGoing], ['New game', restart]]);
      else if (game.over) say('No more moves.', [['Try again', restart]]);
    };
    if (slideMs) pending = { timer: setTimeout(finishNow, slideMs), finish };
    else finish();
  };

  // Keys move the tiles unless the visitor is busy elsewhere: typing in the search, or on another control.
  document.addEventListener('keydown', (e) => {
    const direction = KEYS[e.key];
    if (!direction || e.altKey || e.ctrlKey || e.metaKey) return;
    const active = document.activeElement;
    if ((active && active !== document.body && !board.contains(active)) || document.querySelector('dialog[open]')) return;
    e.preventDefault();
    step(direction);
  });

  // Swipes (and mouse drags) on the board. touch-action: none in the CSS stops the page scrolling under the finger.
  let touch = null;
  board.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary || e.target.closest('button')) return;
    touch = { x: e.clientX, y: e.clientY };
    board.setPointerCapture(e.pointerId);
  });
  board.addEventListener('pointerup', (e) => {
    if (!touch || !e.isPrimary) return;
    const dx = e.clientX - touch.x;
    const dy = e.clientY - touch.y;
    touch = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
    step(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });
  board.addEventListener('pointercancel', () => { touch = null; });
  $('[data-new]').addEventListener('click', restart);

  drawAll('new');
  showScore(0);
  if (game.over) say('No more moves.', [['Try again', restart]]);
}
