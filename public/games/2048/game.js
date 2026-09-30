// 2048 on the "Play 2048!" post: draws the board and plays the rules from rules.js, with a clock, and the games'
// leaderboard (../leaderboard.js) for finished games.
// Smoothness: each tile is one element moved by a GPU-friendly transform; joins pop and new tiles appear once
// the slide ends; a key pressed mid-slide finishes the current step at once, so input never waits for animation.
import { formatTime, leaderboard } from '../leaderboard.js';
import { move, newGame, SIZE } from './rules.js';

const KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down', A: 'left', D: 'right', W: 'up', S: 'down' };
const SAVED = 'g2048-game';
const BEST = 'g2048-best';
// The saved game's time in milliseconds; empty until its first move.
const TIME = 'g2048-time';
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
    <div class="g2048-play">
      <div class="g2048-top">
        <div class="g2048-scores">
          <p class="g2048-score"><span class="g2048-label">Score</span><strong data-score>0</strong></p>
          <p class="g2048-score"><span class="g2048-label">Best</span><strong data-best>0</strong></p>
          <p class="g2048-score g2048-time"><span class="g2048-label">Time</span><strong data-time>00:00.00</strong></p>
        </div>
        <button type="button" class="button" data-new>New game</button>
      </div>
      <div class="g2048-board" tabindex="0" role="application" aria-label="2048 board" aria-describedby="g2048-help">
        <div class="g2048-cells" aria-hidden="true">${'<div></div>'.repeat(SIZE * SIZE)}</div>
        <div class="g2048-tiles" aria-hidden="true" data-tiles></div>
        <div class="g2048-message" data-message hidden><p data-message-text></p><div data-extra hidden></div><div class="g2048-actions" data-actions></div></div>
      </div>
      <p class="g2048-help" id="g2048-help">Use the arrow keys (or W, A, S and D), or swipe on the board. Two tiles with the same number join into one. Reach 2048!</p>
    </div>
    <section data-leaderboard></section>
    <p class="visually-hidden" aria-live="polite" data-status></p>`;

  const $ = (sel) => root.querySelector(sel);
  const board = $('.g2048-board');
  const layer = $('[data-tiles]');
  const message = $('[data-message]');
  const scoreEl = $('[data-score]');
  const bestEl = $('[data-best]');
  const timeEl = $('[data-time]');
  const scores = leaderboard($('[data-leaderboard]'), '2048');
  /** @type {Map<number, HTMLElement>} */
  const tiles = new Map();
  const saved = restore();
  let game = saved ?? newGame();
  let best = Math.max(Number(store.get(BEST)) || 0, game.score);
  let pending = null;

  // The clock runs from a game's first move until no moves are left, and shows the milliseconds as they go.
  // It's saved with the game, so a reload carries on from the same time: time with the page closed doesn't count.
  let started = Boolean(saved && store.get(TIME));
  let base = started ? Number(store.get(TIME)) || 0 : 0;
  let since = null;
  let frame = 0;
  let pausedByLeaving = false;
  const elapsed = () => base + (since === null ? 0 : performance.now() - since);
  const showTime = () => { timeEl.textContent = formatTime(elapsed()); };
  // Only a started game has a time to keep; an empty one waits for its first move.
  const saveTime = () => { if (started) store.set(TIME, String(Math.round(elapsed()))); };
  const tick = () => {
    showTime();
    frame = requestAnimationFrame(tick);
  };
  const run = () => {
    if (since !== null) return;
    started = true;
    since = performance.now();
    frame = requestAnimationFrame(tick);
  };
  const halt = () => {
    if (since === null) return;
    base = elapsed();
    since = null;
    cancelAnimationFrame(frame);
    showTime();
  };

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

  // A message over the board, with its buttons, and `extra` (the leaderboard's part) between them.
  const say = (words, buttons, extra) => {
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
    message.querySelector('input, button').focus();
  };
  const keepGoing = () => {
    message.hidden = true;
    board.focus();
  };
  const restart = () => {
    finishNow();
    game = newGame();
    store.set(SAVED, JSON.stringify(game));
    halt();
    started = false;
    base = 0;
    store.set(TIME, '');
    showTime();
    message.hidden = true;
    drawAll('new');
    showScore(0);
    board.focus();
  };
  // Once a name is typed into a message, the focus goes on to the message's first button.
  const toActions = () => $('[data-actions] button').focus();
  const ended = () => say('No more moves.', [['Try again', restart]], scores.finish(game.score, elapsed(), toActions));

  // A board partly off the screen comes fully into view as you play: just enough to show it, with its scores.
  const showBoard = () => {
    const room = 16;
    const top = $('.g2048-top').getBoundingClientRect().top;
    const bottom = board.getBoundingClientRect().bottom;
    let by = Math.min(Math.max(0, bottom + room - innerHeight), top - room);
    if (top < room) by = top - room;
    if (by) scrollBy({ top: by, behavior: slideMs ? 'smooth' : 'auto' });
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
    showBoard();
    finishNow();
    const before = game;
    const r = move(game, direction);
    if (!r.moved) return;
    game = r.game;
    store.set(SAVED, JSON.stringify(game));
    run();
    if (game.over) halt();
    saveTime();
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
      // Reaching 2048 goes on the leaderboard straight away, so starting a new game from here keeps it; playing
      // on, the final score replaces it when it's higher.
      if (game.won && !before.won) say('You made 2048!', [['Keep going', keepGoing], ['New game', restart]], scores.finish(game.score, elapsed(), toActions));
      else if (game.over) ended();
    };
    if (slideMs) pending = { timer: setTimeout(finishNow, slideMs), finish };
    else finish();
  };

  // Keys play wherever the page was clicked, like the original 2048: not only with the board focused, since a click
  // anywhere on the post focuses the page's main area. They don't while the visitor types (the search, a name box),
  // while a message is over the board, or with the board scrolled out of sight, where they scroll the page instead.
  let onScreen = true;
  new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; }).observe(board);
  document.addEventListener('keydown', (e) => {
    const direction = KEYS[e.key];
    if (!direction || e.altKey || e.ctrlKey || e.metaKey || !message.hidden || !onScreen) return;
    if (e.target.closest('input, textarea, select, [contenteditable]') || document.querySelector('dialog[open]')) return;
    e.preventDefault();
    step(direction);
  });

  // Swipes (and mouse drags) on the board. touch-action: none in the CSS stops the page scrolling under the finger.
  let touch = null;
  board.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary || !message.hidden) return;
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

  // Leaving the page stops the clock and saves its time. Coming back with the Back button starts it again; a
  // background tab is still open, so its time goes on counting and is only saved in case the tab gets closed.
  addEventListener('pagehide', () => {
    pausedByLeaving = since !== null;
    halt();
    saveTime();
  });
  addEventListener('pageshow', (e) => {
    if (e.persisted && pausedByLeaving) run();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveTime();
  });

  drawAll('new');
  showScore(0);
  showTime();
  if (game.over) ended();
  else if (started) run();
}
