// 2048 on the "Jack's 2048" post: draws the board and plays the rules from rules.js, with a clock, Undo for the
// move just made, and the games' leaderboard (../leaderboard.js) for finished games. Bot plays the game for you
// (./bot.js); a game it played in is marked, and never reaches the leaderboard or Best. Its sounds come from
// sound.js, turned on and off by the Sound button or M.
// Smoothness: each tile is one element moved by a GPU-friendly transform; joins pop and new tiles appear once
// the slide ends; a key pressed mid-slide finishes the current step at once, so input never waits for animation.
import { bringIntoView, onGameKeys, onSwipe } from '../controls.js';
import { formatTime, leaderboard } from '../leaderboard.js';
import { ICONS } from '../../lib/icons.js';
import { botMove } from './bot.js';
import { move, newGame, SIZE, undo } from './rules.js';
import * as sound from './sound.js';

const KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down', A: 'left', D: 'right', W: 'up', S: 'down' };
const SAVED = 'g2048-game';
const BEST = 'g2048-best';
// The saved game's time in milliseconds; empty until its first move.
const TIME = 'g2048-time';
// The bot's pace: about five moves a second, so each slide can be seen.
const BOT_MS = 200;

// A button's icon and name. When the row above the board is short of room, the names hide (2048.css) and the icon
// is what shows; the name stays for screen readers and as the tooltip.
const face = (icon, label) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[icon]}</svg><span class="g2048-label-text">${label}</span>`;

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
        <div class="g2048-buttons">
          <button type="button" class="button" data-bot aria-pressed="false" title="Bot">${face('bot', 'Bot')}</button>
          <button type="button" class="button" data-undo title="Undo" disabled>${face('undo', 'Undo')}</button>
          <button type="button" class="button" data-new title="New game">${face('restart', 'New game')}</button>
          <button type="button" class="button" data-sound></button>
        </div>
      </div>
      <div class="g2048-board" tabindex="0" role="application" aria-label="2048 board" aria-describedby="g2048-help">
        <div class="g2048-cells" aria-hidden="true">${'<div></div>'.repeat(SIZE * SIZE)}</div>
        <div class="g2048-tiles" aria-hidden="true" data-tiles></div>
        <div class="g2048-message" data-message hidden><p data-message-text></p><div data-extra hidden></div><div class="g2048-actions" data-actions></div></div>
      </div>
      <p class="g2048-help" id="g2048-help">Use the arrow keys (or W, A, S and D), or swipe on the board. Z undoes one move, M mutes. Bot plays for you; a game it plays in stays off the leaderboard.</p>
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
  const undoButton = $('[data-undo]');
  const botButton = $('[data-bot]');
  const soundButton = $('[data-sound]');
  const scores = leaderboard($('[data-leaderboard]'), '2048');
  /** @type {Map<number, HTMLElement>} */
  const tiles = new Map();
  const saved = restore();
  let game = saved ?? newGame();
  // A game the bot played in (game.bot) never sets Best.
  let best = Math.max(Number(store.get(BEST)) || 0, game.bot ? 0 : game.score);
  let pending = null;

  // The clock runs from a game's first move until no moves are left, and shows the milliseconds as they go. It
  // waits while "You made 2048!" is up, until the game is carried on.
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
    const ok = (g) => g && Array.isArray(g.tiles) && g.tiles.every((t) => [t.x, t.y].every((n) => Number.isInteger(n) && n >= 0 && n < SIZE) && t.value >= 2);
    try {
      const g = JSON.parse(store.get(SAVED) ?? 'null');
      // The move kept for Undo is checked like the game itself; one that isn't right is dropped.
      return ok(g) ? { ...g, back: ok(g.back) ? { ...g.back, back: null } : null } : null;
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
    if (game.score > best && !game.bot) {
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
  // Undo takes back one move, so there's something to undo only straight after a move.
  const showUndo = () => { undoButton.disabled = !game.back; };
  const keepGoing = () => {
    // 2048 made with the board's last move: there's nothing to carry on with.
    if (game.over) return ended();
    message.hidden = true;
    run();
    board.focus();
  };
  const restart = () => {
    stopBot();
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
    showUndo();
    board.focus();
  };
  // Once a name is typed into a message, the focus goes on to the message's first button.
  const toActions = () => $('[data-actions] button').focus();
  // A game the bot played in ends without the leaderboard's name box.
  const onBoard = () => (game.bot ? undefined : scores.finish(game.score, elapsed(), toActions));
  const ended = () => {
    sound.play('over');
    say('No more moves.', [['Try again', restart]], onBoard());
  };

  // The end of a move (joins, the new tile, messages) waits for the slide, unless another move needs it now.
  const finishNow = () => {
    if (!pending) return;
    clearTimeout(pending.timer);
    const { finish } = pending;
    pending = null;
    finish();
  };

  const step = (direction, byBot = false) => {
    if (!message.hidden) return;
    // A board partly off the screen comes fully into view as you play, with its scores. Not for the bot's moves:
    // the page is yours to scroll while it plays.
    if (!byBot) bringIntoView($('.g2048-top'), board);
    finishNow();
    const r = move(game, direction);
    if (!r.moved) return;
    sound.play('slide');
    const wonNow = r.game.won && !game.won;
    game = r.game;
    store.set(SAVED, JSON.stringify(game));
    run();
    // The clock stops when no moves are left, and waits at "You made 2048!" until Keep going.
    if (game.over || wonNow) halt();
    saveTime();
    for (const s of r.slid) {
      const el = tiles.get(s.id);
      if (el) place(el, s);
    }
    showScore(r.gained);
    showUndo();
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
      // on, the final score replaces it when it's higher. One sound as the slide ends: the notes for 2048 or for the
      // end, in place of a pop, or the pop of the biggest tile the move made.
      if (wonNow) {
        sound.play('win');
        say('You made 2048!', [['Keep going', keepGoing], ['New game', restart]], onBoard());
      } else if (game.over) ended();
      else if (r.merged.length) sound.play('join', Math.max(...r.merged.map((t) => t.value)));
    };
    if (slideMs) pending = { timer: setTimeout(finishNow, slideMs), finish };
    else finish();
  };

  // Undo: the move just made is taken back, once (rules.js). Tiles still on the board slide back to where they
  // were, the ones a join used up return, and what the move made (its joins, its new tile) goes. The clock doesn't
  // go back; it carries on, also when the move had ended the game or made 2048.
  const takeBack = () => {
    if (!game.back) return;
    // A move still sliding is dropped where it is: its joins, new tile and message never show.
    if (pending) clearTimeout(pending.timer);
    pending = null;
    // The focus can't stay on what's going: a button of the message, or Undo itself as it switches off.
    const refocus = message.contains(document.activeElement) || document.activeElement === undoButton;
    // Undo doesn't clear the bot's mark: only a new game does.
    game = game.bot ? { ...undo(game), bot: true } : undo(game);
    store.set(SAVED, JSON.stringify(game));
    message.hidden = true;
    const kept = new Set(game.tiles.map((t) => t.id));
    for (const [id, el] of tiles) {
      if (kept.has(id)) continue;
      el.remove();
      tiles.delete(id);
    }
    for (const t of game.tiles) {
      const el = tiles.get(t.id);
      if (el) place(el, t);
      else make(t);
    }
    showScore(0);
    showUndo();
    run();
    $('[data-status]').textContent = `Move taken back. Score ${game.score.toLocaleString('en-US')}.`;
    if (refocus) board.focus();
  };

  // The bot: one move every BOT_MS, through the same step as the keys. It stops when a message comes up (2048 or
  // no more moves), when it finds no move, and when you stop it, take over or start a new game.
  let botTimer = 0;
  const botOn = () => botTimer !== 0;
  const showBot = () => {
    botButton.innerHTML = botOn() ? face('stop', 'Stop') : face('bot', 'Bot');
    botButton.title = botOn() ? 'Stop' : 'Bot';
    botButton.setAttribute('aria-pressed', String(botOn()));
  };
  const botTurn = () => {
    finishNow();
    const direction = message.hidden && !game.over ? botMove(game) : null;
    if (!direction) return stopBot();
    step(direction, true);
    botTimer = setTimeout(botTurn, BOT_MS);
  };
  const startBot = () => {
    if (botOn() || !message.hidden || game.over) return;
    sound.wake();
    // The mark goes on before the bot's first move, so Undo keeps it, and is saved with the game.
    game = { ...game, bot: true };
    store.set(SAVED, JSON.stringify(game));
    bringIntoView($('.g2048-top'), board);
    botTimer = setTimeout(botTurn, 0);
    showBot();
    $('[data-status]').textContent = 'The bot is playing.';
  };
  function stopBot() {
    if (!botOn()) return;
    clearTimeout(botTimer);
    botTimer = 0;
    showBot();
    if (message.hidden) $('[data-status]').textContent = 'The bot stopped.';
  }

  // The Sound button, its icon alone (2048.css): its speaker is crossed out while sound is off, and it says which when
  // pointed at.
  const showSound = () => {
    soundButton.innerHTML = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[sound.on ? 'sound' : 'sound-off']}</svg><span class="visually-hidden">Sound</span>`;
    soundButton.title = `Sound ${sound.on ? 'on' : 'off'}`;
    soundButton.setAttribute('aria-pressed', String(sound.on));
  };
  const toggleSound = () => {
    sound.wake();
    sound.setOn(!sound.on);
    showSound();
    $('[data-status]').textContent = `Sound ${sound.on ? 'on' : 'off'}.`;
  };

  // Keys and swipes (../controls.js); a message over the board, where a name may be typed, keeps them. A move or
  // Z while the bot plays takes the game back from it. A move also gets the sound going: a browser allows sound only
  // once its visitor has done something.
  onGameKeys(board, {
    down: (e) => {
      if (e.key === 'm' || e.key === 'M') {
        toggleSound();
        return true;
      }
      if (e.key === 'z' || e.key === 'Z') {
        stopBot();
        takeBack();
        return true;
      }
      const direction = KEYS[e.key];
      if (!direction || !message.hidden) return false;
      sound.wake();
      stopBot();
      step(direction);
      return true;
    },
  });
  onSwipe(board, { swipe: (direction) => { sound.wake(); stopBot(); step(direction); }, ignore: () => !message.hidden });
  $('[data-new]').addEventListener('click', restart);
  undoButton.addEventListener('click', () => { stopBot(); takeBack(); });
  botButton.addEventListener('click', () => (botOn() ? stopBot() : startBot()));
  soundButton.addEventListener('click', toggleSound);

  // Leaving the page stops the clock and saves its time. Coming back with the Back button starts it again; a
  // background tab is still open, so its time goes on counting and is only saved in case the tab gets closed.
  addEventListener('pagehide', () => {
    stopBot();
    pausedByLeaving = since !== null;
    halt();
    saveTime();
  });
  addEventListener('pageshow', (e) => {
    if (e.persisted && pausedByLeaving) run();
  });
  document.addEventListener('visibilitychange', () => {
    // Leaving the tab stops the bot too: it shouldn't play on where nobody watches.
    if (document.visibilityState === 'hidden') {
      stopBot();
      saveTime();
    }
  });

  drawAll('new');
  showScore(0);
  showTime();
  showUndo();
  showSound();
  if (game.over) ended();
  // A game left at "You made 2048!" still waits: its clock starts again with the next move.
  else if (started && !(game.won && game.back && !game.back.won)) run();
}
