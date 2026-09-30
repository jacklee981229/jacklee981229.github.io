// Catch the Cat on the "Jack's Catch the Cat" post: draws the dots and the cat, and plays the rules from rules.js.
// Smoothness: the cat moves by a GPU-friendly transform and its poses swap by CSS, a blocked dot pops, and each
// turn only changes a few classes, so nothing is redrawn from scratch.
import { block, colOf, newGame, rowOf, SIZE } from './rules.js';

const BEST = 'ctc-best';
// Board geometry in dot widths: rows overlap by the height of a hexagon's row.
const ROW = Math.sqrt(3) / 2;
// Big enough for a 24px tap target on a phone.
const RADIUS = 0.44;
const WIDTH = SIZE + 0.5;
const HEIGHT = (SIZE - 1) * ROW + 1;

// The cat, side on and facing left like the original's sprites, in dot widths around its dot's centre and scaled a
// little bigger than the dot like the original's. It has four poses (sitting, two walking frames and a leap);
// catch-the-cat.css shows one at a time.
const walk = (frame, legs) => `<g class="ctc-pose ctc-${frame}">
    <ellipse class="ctc-ink" cx=".02" cy=".08" rx=".27" ry=".14"/>
    <circle class="ctc-ink" cx="-.27" cy="-.08" r=".14"/>
    <path class="ctc-ink" d="M-.38 -.12-.37 -.3-.28 -.21ZM-.23 -.2-.16 -.32-.14 -.13Z"/>
    <path class="ctc-line" d="M.26 .02C.4 -.02.42 -.18.35 -.26"/>
    <path class="ctc-line" d="${legs}"/>
    <circle class="ctc-eye" cx="-.32" cy="-.09" r=".024"/>
  </g>`;
const CAT = `<g transform="scale(1.2)"><g data-face><g class="ctc-hop">
  <g class="ctc-pose ctc-sit">
    <path class="ctc-ink" d="M-.05 .36C-.3 .36-.3 .02-.18 -.08-.1 -.14.08 -.12.16 .02.26 .18.24 .36.05 .36Z"/>
    <path class="ctc-line ctc-tail" d="M.14 .34C.4 .36.42 .12.33 .03"/>
    <g class="ctc-head">
      <circle class="ctc-ink" cx="-.2" cy="-.2" r=".15"/>
      <path class="ctc-ink ctc-ears" d="M-.33 -.24-.32 -.43-.21 -.33ZM-.16 -.34-.08 -.46-.06 -.26Z"/>
      <circle class="ctc-eye" cx="-.26" cy="-.21" r=".026"/>
    </g>
  </g>
  ${walk('step-a', 'M-.16 .16-.24 .36M-.1 .17-.06 .36M.14 .16.08 .36M.2 .15.28 .36')}
  ${walk('step-b', 'M-.16 .16-.1 .36M-.1 .17-.18 .36M.14 .16.22 .36M.2 .15.12 .36')}
  <g class="ctc-pose ctc-leap">
    <ellipse class="ctc-ink" cy=".04" rx=".32" ry=".12"/>
    <circle class="ctc-ink" cx="-.32" cy="-.1" r=".13"/>
    <path class="ctc-ink" d="M-.42 -.14-.42 -.31-.33 -.22ZM-.28 -.21-.22 -.33-.2 -.15Z"/>
    <path class="ctc-line" d="M.3 0 .52 -.1"/>
    <path class="ctc-line" d="M-.22 .1-.46 .2M-.16 .12-.38 .26M.2 .08.44 .2M.24 .06.5 .12"/>
    <circle class="ctc-eye" cx="-.37" cy="-.11" r=".022"/>
  </g>
</g></g></g>`;

const store = {
  get: (key) => { try { return localStorage.getItem(key); } catch { return null; } },
  set: (key, value) => { try { localStorage.setItem(key, value); } catch { /* private browsing: the best score just isn't kept */ } },
};
const xy = (i) => [0.5 + colOf(i) + (rowOf(i) % 2) * 0.5, 0.5 + rowOf(i) * ROW];
const where = (i) => `row ${rowOf(i) + 1}, column ${colOf(i) + 1}`;

const root = document.querySelector('[data-catch-the-cat]');
if (root) play(root);

function play(root) {
  const moveMs = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 280;
  root.style.setProperty('--move', `${moveMs}ms`);
  const dots = [...Array(SIZE * SIZE).keys()].map((i) => {
    const [x, y] = xy(i);
    return `<circle class="ctc-dot" data-i="${i}" cx="${x}" cy="${y}" r="${RADIUS}"/>`;
  }).join('');
  root.innerHTML = `
    <div class="ctc-top">
      <div class="ctc-scores">
        <p class="ctc-score"><span class="ctc-label">Moves</span><strong data-moves>0</strong></p>
        <p class="ctc-score"><span class="ctc-label">Best</span><strong data-best>–</strong></p>
      </div>
      <div class="ctc-buttons"><button type="button" class="button" data-undo>Undo</button><button type="button" class="button" data-new>New game</button></div>
    </div>
    <div class="ctc-board">
      <svg viewBox="0 0 ${WIDTH} ${HEIGHT}" tabindex="0" role="application" aria-label="Catch the Cat board" aria-describedby="ctc-help ctc-keys">
        <g>${dots}</g>
        <circle class="ctc-cursor" r="${RADIUS + 0.06}" data-cursor/>
        <g class="ctc-cat" data-cat>${CAT}</g>
      </svg>
      <div class="ctc-message" data-message hidden><p data-message-text></p><div class="ctc-actions" data-actions></div></div>
    </div>
    <p class="ctc-help" id="ctc-help">Click a dot to block it. Trap the cat before it reaches the edge.</p>
    <p class="visually-hidden" id="ctc-keys">With a keyboard: the arrow keys pick a dot, Enter blocks it.</p>
    <p class="visually-hidden" aria-live="polite" data-status></p>`;

  const $ = (sel) => root.querySelector(sel);
  const svg = $('svg');
  const cat = $('[data-cat]');
  const face = $('[data-face]');
  const cursorEl = $('[data-cursor]');
  const message = $('[data-message]');
  const status = $('[data-status]');
  const dotEls = [...root.querySelectorAll('.ctc-dot')];
  let game = newGame();
  /** @type {typeof game[]} */
  let history = [];
  let best = Number(store.get(BEST)) || 0;
  let cursor = game.cat;
  let facing = 1; // 1: facing left, as drawn; -1: mirrored to face right
  let timers = [];

  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const stopTimers = () => { timers.forEach(clearTimeout); timers = []; };
  const placeCat = ([x, y]) => { cat.style.transform = `translate(${x}px, ${y}px)`; };
  const turnTo = (side) => {
    facing = side;
    face.setAttribute('transform', `scale(${side} 1)`);
  };
  const placeCursor = () => {
    const [x, y] = xy(cursor);
    cursorEl.setAttribute('cx', x);
    cursorEl.setAttribute('cy', y);
  };
  const showNumbers = () => {
    $('[data-moves]').textContent = game.moves;
    $('[data-best]').textContent = best || '–';
  };
  const draw = () => {
    const blocked = new Set(game.blocked);
    dotEls.forEach((dot, i) => dot.classList.toggle('is-blocked', blocked.has(i)));
    cat.classList.remove('is-moving', 'is-running', 'is-caught', 'is-gone');
    placeCat(xy(game.cat));
    showNumbers();
  };

  // One step to the next dot: turn to face it, hop there in stride (leaning on a diagonal), land sitting.
  const hop = (from, to) => {
    turnTo(xy(to)[0] < xy(from)[0] ? 1 : -1);
    cat.style.setProperty('--tilt', `${(rowOf(from) - rowOf(to)) * 16}deg`);
    // Off, seen by the browser, then on again: a click mid-hop starts the next hop from its beginning.
    cat.classList.remove('is-moving');
    cat.getBoundingClientRect();
    cat.classList.add('is-moving');
    placeCat(xy(to));
  };
  cat.addEventListener('animationend', (e) => {
    if (e.animationName === 'ctc-hop') cat.classList.remove('is-moving');
  });

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
    status.textContent = words;
    message.querySelector('button').focus();
  };
  // The keys play only once the board is reached with Tab. A button pressed from the keyboard (a click with no mouse
  // behind it) hands the keys back to the board; after a mouse click, the arrow keys keep scrolling the page.
  const backToBoard = (e) => { if (e.detail === 0) svg.focus(); };
  const undo = (e) => {
    if (!history.length) return;
    stopTimers();
    game = history.pop();
    message.hidden = true;
    draw();
    backToBoard(e);
  };
  const restart = (e) => {
    stopTimers();
    game = newGame();
    history = [];
    cursor = game.cat;
    message.hidden = true;
    turnTo(1);
    draw();
    placeCursor();
    backToBoard(e);
  };

  const turn = (i) => {
    if (!message.hidden) return;
    const before = game;
    const r = block(game, i);
    if (!r.played) return;
    history.push(before);
    game = r.game;
    const dot = dotEls[i];
    dot.classList.add('is-blocked', 'is-new');
    dot.addEventListener('animationend', () => dot.classList.remove('is-new'), { once: true });
    showNumbers();
    if (game.over === 'won') {
      if (!best || game.moves < best) {
        best = game.moves;
        store.set(BEST, String(best));
        showNumbers();
      }
      // Trapped: the cat looks one way, then the other, then hangs its head.
      later(() => turnTo(-facing), moveMs);
      later(() => turnTo(-facing), moveMs * 2);
      later(() => cat.classList.add('is-caught'), moveMs * 3);
      later(() => say(`You trapped the cat in ${game.moves} move${game.moves === 1 ? '' : 's'}!`, [['New game', restart]]), moveMs * 4);
      return;
    }
    hop(before.cat, r.catTo);
    if (game.over === 'lost') {
      // From the edge it gallops on the same way, two more dots, off the board.
      const [fx, fy] = xy(before.cat);
      const [tx, ty] = xy(r.catTo);
      later(() => {
        cat.classList.remove('is-moving');
        cat.classList.add('is-running', 'is-gone');
        placeCat([tx + 2 * (tx - fx), ty + 2 * (ty - fy)]);
      }, moveMs);
      later(() => say('The cat got away.', [['Undo', undo], ['Try again', restart]]), moveMs * 3);
      return;
    }
    status.textContent = `Blocked ${where(i)}. The cat moved to ${where(r.catTo)}.`;
  };

  // A click or tap doesn't select the board, so the keys stay with the page.
  svg.addEventListener('mousedown', (e) => e.preventDefault());
  svg.addEventListener('click', (e) => {
    const dot = e.target.closest('.ctc-dot');
    if (!dot) return;
    cursor = Number(dot.dataset.i);
    placeCursor();
    turn(cursor);
  });
  // Keyboard, once the board has been reached with Tab: the arrow keys move a ring around the board, Enter or Space
  // blocks the dot inside it.
  svg.addEventListener('keydown', (e) => {
    const r = rowOf(cursor);
    const c = colOf(cursor);
    const to = { ArrowLeft: [r, c - 1], ArrowRight: [r, c + 1], ArrowUp: [r - 1, c], ArrowDown: [r + 1, c] }[e.key];
    if (to) {
      e.preventDefault();
      const [y, x] = to;
      if (y < 0 || y >= SIZE || x < 0 || x >= SIZE) return;
      cursor = y * SIZE + x;
      placeCursor();
      status.textContent = `${where(cursor)}: ${cursor === game.cat ? 'the cat' : game.blocked.includes(cursor) ? 'blocked' : 'free'}`;
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      turn(cursor);
    }
  });
  $('[data-undo]').addEventListener('click', undo);
  $('[data-new]').addEventListener('click', restart);

  draw();
  placeCursor();
}
