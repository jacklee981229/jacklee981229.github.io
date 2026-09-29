// Catch the Cat on the "Play Catch the Cat!" post: draws the dots and the cat, and plays the rules from rules.js.
// Smoothness: the cat glides between dots with a GPU-friendly transform, a blocked dot pops, and each turn only
// changes a class or two, so nothing is redrawn from scratch.
import { block, colOf, newGame, rowOf, SIZE } from './rules.js';

const BEST = 'ctc-best';
// Board geometry in dot widths: rows overlap by the height of a hexagon's row.
const ROW = Math.sqrt(3) / 2;
// Big enough for a 24px tap target on a phone.
const RADIUS = 0.44;
const WIDTH = SIZE + 0.5;
const HEIGHT = (SIZE - 1) * ROW + 1;
// A cat sitting, drawn around its dot's centre, a little bigger than the dot like the original's.
const CAT = `<g transform="scale(1.2)">
  <path class="ctc-cat-body" d="M-.2 -.05 -.25 -.38 -.05 -.22ZM.2 -.05 .25 -.38 .05 -.22Z"/>
  <circle class="ctc-cat-body" cy="-.1" r=".2"/>
  <ellipse class="ctc-cat-body" cy=".2" rx=".21" ry=".18"/>
  <path class="ctc-cat-tail" d="M.16 .32C.36 .32 .4 .12 .3 .03"/>
  <circle class="ctc-cat-eye" cx="-.075" cy="-.12" r=".035"/>
  <circle class="ctc-cat-eye" cx=".075" cy="-.12" r=".035"/></g>`;

const store = {
  get: (key) => { try { return localStorage.getItem(key); } catch { return null; } },
  set: (key, value) => { try { localStorage.setItem(key, value); } catch { /* private browsing: the best score just isn't kept */ } },
};
const xy = (i) => [0.5 + colOf(i) + (rowOf(i) % 2) * 0.5, 0.5 + rowOf(i) * ROW];
const where = (i) => `row ${rowOf(i) + 1}, column ${colOf(i) + 1}`;

const root = document.querySelector('[data-catch-the-cat]');
if (root) play(root);

function play(root) {
  const moveMs = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180;
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
      <svg viewBox="0 0 ${WIDTH} ${HEIGHT}" tabindex="0" role="application" aria-label="Catch the Cat board" aria-describedby="ctc-help">
        <g>${dots}</g>
        <circle class="ctc-cursor" r="${RADIUS + 0.06}" data-cursor/>
        <g class="ctc-cat" data-cat>${CAT}</g>
      </svg>
      <div class="ctc-message" data-message hidden><p data-message-text></p><div class="ctc-actions" data-actions></div></div>
    </div>
    <p class="ctc-help" id="ctc-help">Click a dot to block it, or use the arrow keys and Enter. Trap the cat before it reaches the edge.</p>
    <p class="visually-hidden" aria-live="polite" data-status></p>`;

  const $ = (sel) => root.querySelector(sel);
  const svg = $('svg');
  const cat = $('[data-cat]');
  const cursorEl = $('[data-cursor]');
  const message = $('[data-message]');
  const status = $('[data-status]');
  const dotEls = [...root.querySelectorAll('.ctc-dot')];
  let game = newGame();
  /** @type {typeof game[]} */
  let history = [];
  let best = Number(store.get(BEST)) || 0;
  let cursor = game.cat;
  let timers = [];

  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const stopTimers = () => { timers.forEach(clearTimeout); timers = []; };
  const placeCat = ([x, y]) => { cat.style.transform = `translate(${x}px, ${y}px)`; };
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
    cat.classList.remove('is-gone');
    placeCat(xy(game.cat));
    showNumbers();
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
    status.textContent = words;
    message.querySelector('button').focus();
  };
  const undo = () => {
    if (!history.length) return;
    stopTimers();
    game = history.pop();
    message.hidden = true;
    draw();
    svg.focus();
  };
  const restart = () => {
    stopTimers();
    game = newGame();
    history = [];
    cursor = game.cat;
    message.hidden = true;
    draw();
    placeCursor();
    svg.focus();
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
      later(() => say(`You trapped the cat in ${game.moves} move${game.moves === 1 ? '' : 's'}!`, [['New game', restart]]), moveMs);
      return;
    }
    placeCat(xy(r.catTo));
    if (game.over === 'lost') {
      // Once on the edge, the cat keeps going the same way and slips off the board.
      const [fx, fy] = xy(before.cat);
      const [tx, ty] = xy(r.catTo);
      later(() => {
        placeCat([2 * tx - fx, 2 * ty - fy]);
        cat.classList.add('is-gone');
      }, moveMs);
      later(() => say('The cat got away.', [['Undo', undo], ['Try again', restart]]), moveMs * 2);
      return;
    }
    status.textContent = `Blocked ${where(i)}. The cat moved to ${where(r.catTo)}.`;
  };

  svg.addEventListener('click', (e) => {
    const dot = e.target.closest('.ctc-dot');
    if (!dot) return;
    cursor = Number(dot.dataset.i);
    placeCursor();
    turn(cursor);
  });
  // Keyboard: the arrow keys move a ring around the board, Enter or Space blocks the dot inside it.
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
