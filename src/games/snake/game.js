// Snake (贪吃蛇) on the "Jack's Snake" post: draws the board and plays the rules from rules.js, with a clock, and the
// games' leaderboard (../leaderboard.js) for finished games. Bot plays the game for you (./bot.js); a game it played
// in is marked, stays the bot's to the end, and never reaches the leaderboard or Best.
// Old-school movement, like the snake games on old phones: each step, every part of the snake jumps straight to its
// next cell, with no gliding in between. Steps are timed by animation frames, not a timer.
import { bringIntoView, onGameKeys, onSwipe } from '../controls.js';
import { formatTime, leaderboard } from '../leaderboard.js';
import { ICONS } from '../../lib/icons.js';
import { botMove } from './bot.js';
import { newGame, SIZE, step, stepMs, turn } from './rules.js';

const KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down', A: 'left', D: 'right', W: 'up', S: 'down' };
const MODE = 'snake-walls';
// Each mode keeps its own best score and leaderboard: going through walls is easier, so the scores don't compare.
const MODES = {
  solid: { best: 'snake-best', board: 'snake', name: 'With walls' },
  open: { best: 'snake-pass-best', board: 'snake-pass', name: 'No walls' },
};

// A button's icon and name. When the row above the board is short of room, the names hide (snake.css) and the icon
// is what shows; the name stays for screen readers and as the tooltip.
const face = (icon, label) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[icon]}</svg><span class="snk-label-text">${label}</span>`;

/** Which side of cell `a` cell `b` sits on, through an open wall too, or null when they aren't next to each other. */
const side = (a, b) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (!dy && (Math.abs(dx) === 1 || Math.abs(dx) === SIZE - 1)) return (dx === 1 || dx === 1 - SIZE) ? 'right' : 'left';
  if (!dx && (Math.abs(dy) === 1 || Math.abs(dy) === SIZE - 1)) return (dy === 1 || dy === 1 - SIZE) ? 'down' : 'up';
  return null;
};
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
/** The body's fade spreads over at least this many parts, so a short snake stays nearly solid. */
const FADE_SPAN = 40;

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
          <button type="button" class="button" data-bot aria-pressed="false" title="Bot">${face('bot', 'Bot')}</button>
          <button type="button" class="button" data-new title="New game">${face('restart', 'New game')}</button>
        </div>
      </div>
      <div class="snk-board" tabindex="0" role="application" aria-label="Snake board" aria-describedby="snk-help">
        <div class="snk-field" aria-hidden="true" data-field><div class="snk-grid">${'<i></i>'.repeat(SIZE * SIZE)}</div></div>
        <p class="snk-hint" data-hint>Press an arrow key or swipe to start</p>
        <div class="snk-message" data-message hidden><p data-message-text></p><div data-extra hidden></div><div class="snk-actions" data-actions></div></div>
      </div>
      <p class="snk-help" id="snk-help">Turn with the arrow keys (or W, A, S and D). Space pauses. Bot plays for you; a game it plays in stays off the leaderboard.</p>
    </div>
    <section data-leaderboard></section>
    <p class="visually-hidden" aria-live="polite" data-status></p>`;

  const $ = (sel) => root.querySelector(sel);
  const board = $('.snk-board');
  const field = $('[data-field]');
  const message = $('[data-message]');
  const hint = $('[data-hint]');
  const walls = $('[data-wrap]');
  const botButton = $('[data-bot]');
  let wrap = store.get(MODE) === 'open';
  walls.checked = wrap;
  const mode = () => MODES[wrap ? 'open' : 'solid'];
  let scores = leaderboard($('[data-leaderboard]'), mode().board, mode().name);
  const food = document.createElement('div');
  food.className = 'snk-food';
  // The body is drawn on a canvas (drawBody); the head is an element, as it turns its eyes and shakes on a crash.
  const body = document.createElement('canvas');
  body.className = 'snk-body';
  const head = document.createElement('div');
  head.className = 'snk-part is-head';
  head.innerHTML = '<span class="snk-eyes"><i></i><i></i></span>';
  field.append(food, body, head);
  const cells = [...field.querySelectorAll('.snk-grid i')];
  let game = newGame(Math.random, wrap);
  let best = Number(store.get(mode().best)) || 0;
  let playing = false;
  let paused = false;
  let time = 0;
  let owed = 0;
  let last = 0;
  let frame = 0;
  let ending = 0;
  // Steps since the snake last ate: the bot takes a risk after circling too long (bot.js).
  let hungry = 0;

  // The walls only change between games, so nobody opens them mid-game to slip through one. Bot shows Stop while
  // the bot plays.
  const showControls = () => {
    walls.disabled = playing || paused;
    const botOn = playing && Boolean(game.bot);
    botButton.innerHTML = botOn ? face('stop', 'Stop') : face('bot', 'Bot');
    botButton.title = botOn ? 'Stop' : 'Bot';
    botButton.setAttribute('aria-pressed', String(botOn));
  };

  const place = (el, cell) => {
    el.style.setProperty('--x', cell.x);
    el.style.setProperty('--y', cell.y);
  };
  // The body as one strip, fading from the head to the tail (--body-from to --body-to), so a long snake's way and its
  // tail can be read. Each piece sits on whole pixels and meets the next edge to edge: see-through pieces that
  // overlap, or that end part way into a pixel, show a line where they meet. The cells under the snake hide their
  // grid, which would show through the body as lines.
  const drawBody = () => {
    const size = Math.round(field.clientWidth * devicePixelRatio);
    if (body.width !== size) body.width = body.height = size;
    const ctx = body.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    const c = size / SIZE;
    const at = (v) => Math.round(v * c);
    const style = getComputedStyle(body);
    const from = Number(style.getPropertyValue('--body-from'));
    const to = Number(style.getPropertyValue('--body-to'));
    const s = game.snake;
    const shade = (i) => from - ((from - to) * (i - 1)) / Math.max(s.length - 2, FADE_SPAN);
    const r = 0.3 * 0.86 * c;
    // The strip from a part's edge out to its cell's edge on side `d`.
    const toEdge = (p, d) => {
      const x0 = at(p.x + (d === 'right' ? 0.93 : d === 'left' ? 0 : 0.07));
      const y0 = at(p.y + (d === 'down' ? 0.93 : d === 'up' ? 0 : 0.07));
      const x1 = at(p.x + (d === 'right' ? 1 : d === 'left' ? 0.07 : 0.93));
      const y1 = at(p.y + (d === 'down' ? 1 : d === 'up' ? 0.07 : 0.93));
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    };
    ctx.fillStyle = style.color;
    for (let i = s.length - 1; i >= 1; i--) {
      const p = s[i];
      const ahead = s[i - 1];
      // A side joined to the next part has square corners, so the two meet flat; through an open wall too, so the
      // strip runs into the wall rather than ending in what looks like another tail.
      const joins = [side(p, ahead), i < s.length - 1 ? side(p, s[i + 1]) : null];
      const square = (a, b) => (joins.includes(a) || joins.includes(b) ? 0 : r);
      ctx.globalAlpha = shade(i);
      ctx.beginPath();
      ctx.roundRect(at(p.x + 0.07), at(p.y + 0.07), at(p.x + 0.93) - at(p.x + 0.07), at(p.y + 0.93) - at(p.y + 0.07), [square('up', 'left'), square('up', 'right'), square('down', 'right'), square('down', 'left')]);
      ctx.fill();
      // The gap between this part and the one ahead, in their average shade: a strip out to each cell's edge, where
      // the two meet (or each meets its wall). Into the head's cell too: the head's back is square (data-back), so it
      // sits flat on the strip.
      const d = side(p, ahead);
      if (!d) continue;
      ctx.globalAlpha = (shade(i) + shade(Math.max(1, i - 1))) / 2;
      toEdge(p, d);
      toEdge(ahead, OPPOSITE[d]);
    }
    ctx.globalAlpha = 1;
    const under = new Set(s.map((p) => p.y * SIZE + p.x));
    cells.forEach((cell, i) => cell.classList.toggle('is-under', under.has(i)));
  };
  const draw = () => {
    place(head, game.snake[0]);
    head.dataset.dir = game.dir;
    head.dataset.back = side(game.snake[0], game.snake[1]) ?? '';
    drawBody();
    food.hidden = !game.food;
    if (game.food) place(food, game.food);
  };
  const showScore = () => {
    $('[data-score]').textContent = game.score;
    // A game the bot played in (game.bot) never sets Best.
    if (game.score > best && !game.bot) {
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
    showControls();
    last = performance.now();
    frame = requestAnimationFrame(loop);
  };
  // A game the bot played in ends without the leaderboard's name box.
  const end = (words) => say(words, [['Play again', restart]], game.bot ? undefined : scores.finish(game.score, time, toActions));

  const advance = () => {
    // The bot turns through the game's own turn(), as the keys do.
    if (game.bot) game = turn(game, botMove(game, hungry));
    const r = step(game);
    game = r.game;
    hungry = r.event === 'ate' ? 0 : hungry + 1;
    if (r.event === 'crashed') {
      playing = false;
      showControls();
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
      showControls();
      end('You filled the board!');
    }
  };

  const control = (dir) => {
    // A game the bot plays in stays the bot's: the keys don't take it back.
    if (game.bot || (!message.hidden && !paused)) return;
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
    showControls();
    cancelAnimationFrame(frame);
    say('Paused.', [['Continue', resume]]);
  };
  const resume = () => {
    if (!paused) return;
    paused = false;
    message.hidden = true;
    run();
    if (game.bot) $('[data-status]').textContent = 'The bot is playing.';
  };
  const restart = () => {
    cancelAnimationFrame(frame);
    // A crash's "Game over." still on its way would land on the new game.
    clearTimeout(ending);
    playing = false;
    paused = false;
    showControls();
    time = 0;
    owed = 0;
    hungry = 0;
    game = newGame(Math.random, wrap);
    board.classList.remove('is-crashed');
    message.hidden = true;
    hint.hidden = false;
    draw();
    showScore();
    showTime();
    board.focus();
  };

  // Bot: from the next step on, the bot turns the snake, at the game's own pace; a game not yet started starts, a
  // paused one carries on. Stop pauses the game, and Continue (or Bot) lets the bot carry on.
  const startBot = () => {
    if (game.over || (!message.hidden && !paused)) return;
    // Turns you asked for and the snake hasn't taken yet are dropped: the bot plans from where the snake heads now.
    game = { ...game, bot: true, queue: [] };
    if (paused) resume();
    else if (!playing) {
      hint.hidden = true;
      bringIntoView($('.snk-top'), board);
      run();
    }
    showControls();
    $('[data-status]').textContent = 'The bot is playing.';
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
  botButton.addEventListener('click', () => {
    if (!(playing && game.bot)) return startBot();
    pause();
    $('[data-status]').textContent = 'The bot stopped. Paused.';
  });
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
  // The body is drawn again when the board changes size, and when the theme or the game look changes its colours.
  new ResizeObserver(drawBody).observe(field);
  new MutationObserver(drawBody).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-game-look', 'data-sky'] });

  draw();
  showScore();
  showControls();
}
