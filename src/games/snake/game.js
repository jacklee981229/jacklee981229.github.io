// Snake (贪吃蛇) on the "Jack's Snake" post: draws the board and plays the rules from rules.js, with a clock, and the
// games' leaderboard (../leaderboard.js) for finished games.
// Old-school movement, like the snake games on old phones: each step, every part of the snake jumps straight to its
// next cell, with no gliding in between. Steps are timed by animation frames, not a timer.
import { bringIntoView, onGameKeys, onSwipe } from '../controls.js';
import { formatTime, leaderboard } from '../leaderboard.js';
import { newGame, SIZE, step, stepMs, turn } from './rules.js';

const KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down', A: 'left', D: 'right', W: 'up', S: 'down' };
const MODE = 'snake-walls';
// Each mode keeps its own best score and leaderboard: going through walls is easier, so the scores don't compare.
const MODES = {
  solid: { best: 'snake-best', board: 'snake', name: 'With walls' },
  open: { best: 'snake-pass-best', board: 'snake-pass', name: 'No walls' },
};

const store = {
  get: (key) => { try { return localStorage.getItem(key); } catch { return null; } },
  set: (key, value) => { try { localStorage.setItem(key, value); } catch { /* private browsing: the best score just isn't kept */ } },
};

const root = document.querySelector('[data-snake]');
if (root) play(root);

function play(root) {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.style.setProperty('--size', SIZE);
  root.innerHTML = `
    <div class="snk-play">
      <div class="snk-top">
        <div class="snk-scores">
          <p class="snk-score"><span class="snk-label">Score</span><strong data-score>0</strong></p>
          <p class="snk-score"><span class="snk-label">Best</span><strong data-best>0</strong></p>
          <p class="snk-score snk-time"><span class="snk-label">Time</span><strong data-time>00:00.00</strong></p>
        </div>
        <div class="snk-controls">
          <label class="snk-mode"><input type="checkbox" data-wrap>No walls</label>
          <button type="button" class="button" data-new>New game</button>
        </div>
      </div>
      <div class="snk-board" tabindex="0" role="application" aria-label="Snake board" aria-describedby="snk-help">
        <div class="snk-field" aria-hidden="true" data-field><div class="snk-grid">${'<i></i>'.repeat(SIZE * SIZE)}</div></div>
        <p class="snk-hint" data-hint>Press an arrow key or swipe to start</p>
        <div class="snk-message" data-message hidden><p data-message-text></p><div data-extra hidden></div><div class="snk-actions" data-actions></div></div>
      </div>
      <p class="snk-help" id="snk-help">Turn with the arrow keys (or W, A, S and D). Space pauses.</p>
    </div>
    <section data-leaderboard></section>
    <p class="visually-hidden" aria-live="polite" data-status></p>`;

  const $ = (sel) => root.querySelector(sel);
  const board = $('.snk-board');
  const field = $('[data-field]');
  const message = $('[data-message]');
  const hint = $('[data-hint]');
  const walls = $('[data-wrap]');
  let wrap = store.get(MODE) === 'open';
  walls.checked = wrap;
  const mode = () => MODES[wrap ? 'open' : 'solid'];
  let scores = leaderboard($('[data-leaderboard]'), mode().board, mode().name);
  const food = document.createElement('div');
  food.className = 'snk-food';
  field.append(food);
  /** One element per cell of the snake, head first; the head's element stays the head. @type {HTMLElement[]} */
  const parts = [];
  let game = newGame(Math.random, wrap);
  let best = Number(store.get(mode().best)) || 0;
  let playing = false;
  let paused = false;
  let time = 0;
  let owed = 0;
  let last = 0;
  let frame = 0;
  let ending = 0;

  // The walls only change between games, so nobody opens them mid-game to slip through one.
  const lockWalls = () => { walls.disabled = playing || paused; };

  const place = (el, cell) => {
    el.style.setProperty('--x', cell.x);
    el.style.setProperty('--y', cell.y);
  };
  // Each part takes the cell of the part ahead; a longer snake gets a new part at its tail.
  const draw = () => {
    game.snake.forEach((cell, i) => {
      if (!parts[i]) {
        const part = document.createElement('div');
        part.className = i ? 'snk-part' : 'snk-part is-head';
        if (!i) part.innerHTML = '<span class="snk-eyes"><i></i><i></i></span>';
        field.append(part);
        parts.push(part);
      }
      place(parts[i], cell);
    });
    parts[0].dataset.dir = game.dir;
    food.hidden = !game.food;
    if (game.food) place(food, game.food);
  };
  const showScore = () => {
    $('[data-score]').textContent = game.score;
    if (game.score > best) {
      best = game.score;
      store.set(mode().best, String(best));
    }
    $('[data-best]').textContent = best;
  };
  const showTime = () => { $('[data-time]').textContent = formatTime(time); };

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
  const toActions = () => $('[data-actions] button').focus();

  const loop = (now) => {
    const dt = Math.min(now - last, 250);
    last = now;
    time += dt;
    owed += dt;
    const ms = stepMs(game.score);
    // One step a frame at most: after a long frame the snake loses that time rather than jumping cells.
    if (owed >= ms) {
      owed = Math.min(owed - ms, ms);
      advance();
    }
    if (playing) {
      showTime();
      frame = requestAnimationFrame(loop);
    }
  };
  const run = () => {
    playing = true;
    lockWalls();
    last = performance.now();
    frame = requestAnimationFrame(loop);
  };
  const end = (words) => say(words, [['Play again', restart]], scores.finish(game.score, time, toActions));

  const advance = () => {
    const r = step(game);
    game = r.game;
    if (r.event === 'crashed') {
      playing = false;
      lockWalls();
      showTime();
      board.classList.add('is-crashed');
      ending = setTimeout(() => end('Game over.'), still ? 0 : 450);
      return;
    }
    draw();
    if (r.event === 'ate' || r.event === 'filled') {
      showScore();
      food.classList.remove('is-new');
      void food.offsetWidth;
      food.classList.add('is-new');
    }
    if (r.event === 'filled') {
      playing = false;
      lockWalls();
      end('You filled the board!');
    }
  };

  const control = (dir) => {
    if (!message.hidden && !paused) return;
    if (paused) resume();
    game = turn(game, dir);
    if (!playing) {
      hint.hidden = true;
      bringIntoView($('.snk-top'), board);
      run();
    }
  };
  const pause = () => {
    if (!playing) return;
    playing = false;
    paused = true;
    lockWalls();
    cancelAnimationFrame(frame);
    say('Paused.', [['Continue', resume]]);
  };
  const resume = () => {
    if (!paused) return;
    paused = false;
    message.hidden = true;
    run();
  };
  const restart = () => {
    cancelAnimationFrame(frame);
    // A crash's "Game over." still on its way would land on the new game.
    clearTimeout(ending);
    playing = false;
    paused = false;
    lockWalls();
    time = 0;
    owed = 0;
    game = newGame(Math.random, wrap);
    board.classList.remove('is-crashed');
    message.hidden = true;
    hint.hidden = false;
    // The old snake's parts go: it may have been longer than the new one.
    parts.splice(0).forEach((part) => part.remove());
    draw();
    showScore();
    showTime();
    board.focus();
  };

  onGameKeys(board, {
    down: (e) => {
      const dir = KEYS[e.key];
      if (dir) {
        control(dir);
        return true;
      }
      if (e.key === ' ' || e.key === 'p' || e.key === 'P') {
        if (playing) pause();
        else if (paused) resume();
        else return false;
        return true;
      }
      return false;
    },
  });
  onSwipe(board, { swipe: control, ignore: () => !message.hidden });
  $('[data-new]').addEventListener('click', restart);
  // Changing the walls starts a fresh game, with that mode's own best score and leaderboard.
  walls.addEventListener('change', () => {
    wrap = walls.checked;
    store.set(MODE, wrap ? 'open' : 'solid');
    scores = leaderboard($('[data-leaderboard]'), mode().board, mode().name);
    best = Number(store.get(mode().best)) || 0;
    restart();
  });
  // A game in play pauses when the page is left or another window takes the keys.
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  addEventListener('blur', pause);

  draw();
  showScore();
}
