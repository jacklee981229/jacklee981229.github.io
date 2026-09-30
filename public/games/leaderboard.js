// The games' leaderboard, for any game on this site. It lives in this browser (localStorage), so each visitor sees
// the players on their own device. The player's name is asked once and kept for every game; each name keeps only
// its best game. The ranking rules are plain functions, tested by tests/leaderboard.test.js.

/** How many places the board shows. */
export const SHOWN = 10;
/** The longest name, in characters. */
export const NAME_MAX = 20;
// One name for every game on the site.
const NAME = 'lb-name';

/** @typedef {{ name: string, score: number, time: number }} Entry  A finished game; time is in milliseconds. */

const store = {
  get: (key) => { try { return localStorage.getItem(key); } catch { return null; } },
  set: (key, value) => { try { localStorage.setItem(key, value); } catch { /* private browsing: nothing is kept */ } },
};

/** Higher scores first; the same score goes to the faster time. @param {Entry} a @param {Entry} b */
export const byRank = (a, b) => b.score - a.score || a.time - b.time;

const sameName = (a, b) => a.toLowerCase() === b.toLowerCase();

/** A name as the board shows it: spaces tidied, at most NAME_MAX characters; "" when nothing is left. @param {string} text */
export const cleanName = (text) => [...text.trim().replace(/\s+/g, ' ')].slice(0, NAME_MAX).join('').trim();

/**
 * The board after a finished game. A new name joins; a name already there (in any letter case) changes only when
 * this game is better. Returns the sorted board, the player's place on it (1 is first) and whether it changed.
 * @param {Entry[]} board @param {Entry} entry
 */
export function addScore(board, entry) {
  const old = board.find((e) => sameName(e.name, entry.name));
  const improved = !old || byRank(entry, old) < 0;
  const next = improved ? [...board.filter((e) => e !== old), entry].sort(byRank) : board;
  return { board: next, place: next.findIndex((e) => sameName(e.name, entry.name)) + 1, improved };
}

/** A saved board, keeping only proper entries, one per name. @param {string | null} json @returns {Entry[]} */
export function readBoard(json) {
  let list;
  try {
    list = JSON.parse(json ?? '[]');
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];
  let board = [];
  for (const e of list) {
    const ok = typeof e?.name === 'string' && e.name !== '' && cleanName(e.name) === e.name && [e.score, e.time].every((n) => Number.isFinite(n) && n >= 0);
    if (ok) board = addScore(board, { name: e.name, score: e.score, time: e.time }).board;
  }
  return board;
}

/** "01:23.45" (hundredths of a second, cut off like a stopwatch), or "1:02:03.45" from an hour on. @param {number} ms */
export function formatTime(ms) {
  const t = Math.max(0, Math.floor(ms));
  const two = (n) => String(n).padStart(2, '0');
  const clock = `${two(Math.floor(t / 60000) % 60)}:${two(Math.floor(t / 1000) % 60)}.${two(Math.floor((t % 1000) / 10))}`;
  return t >= 3600000 ? `${Math.floor(t / 3600000)}:${clock}` : clock;
}

const make = (tag, className = '', text = '') => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
};
let forms = 0;

/** A form asking for the player's name. `done` gets the tidied name; `cancel`, when given, adds a Cancel button. */
function nameForm(value, done, cancel) {
  const form = make('form', 'lb-form');
  const input = make('input');
  Object.assign(input, { id: `lb-name-${++forms}`, value, maxLength: NAME_MAX, autocomplete: 'nickname', required: true });
  const label = make('label', '', 'Your name for the leaderboard');
  label.htmlFor = input.id;
  const row = make('div', 'lb-row');
  row.append(input, make('button', 'button', 'Save'));
  if (cancel) {
    const no = make('button', 'button', 'Cancel');
    no.type = 'button';
    no.addEventListener('click', cancel);
    form.addEventListener('keydown', (e) => { if (e.key === 'Escape') cancel(); });
    row.append(no);
  }
  form.append(label, row);
  input.addEventListener('input', () => input.setCustomValidity(''));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = cleanName(input.value);
    if (name) return done(name);
    input.setCustomValidity('Type a name first.');
    input.reportValidity();
  });
  return form;
}

/**
 * Draws a game's leaderboard into `box`, an empty element under the game; `game` is a short id (the board is saved
 * as lb-<game>). Returns `finish(score, time, onSaved)` for when a game ends: it saves the score under the kept
 * name, or asks for a name the first time, and returns an element for the game's end message. When the name has
 * to be asked, `onSaved` runs once it's saved, so the game can move the focus on.
 */
export function leaderboard(box, game) {
  const key = `lb-${game}`;
  let board = readBoard(store.get(key));
  // Whoever saved last, to pick out their row.
  let latest = '';
  box.classList.add('lb', 'lb-board');
  box.setAttribute('aria-labelledby', `lb-title-${game}`);
  box.innerHTML = `
    <div class="lb-head">
      <h2 class="lb-title" id="lb-title-${game}">Leaderboard</h2>
      <p class="lb-where">Kept in this browser.</p>
    </div>
    <table class="lb-table">
      <thead><tr><th scope="col">#</th><th scope="col">Name</th><th scope="col">Score</th><th scope="col">Time</th></tr></thead>
      <tbody></tbody>
    </table>
    <p class="lb-empty">No scores yet. Finish a game to get on the board.</p>
    <div class="lb-me"></div>`;
  const table = box.querySelector('table');
  const empty = box.querySelector('.lb-empty');
  const me = box.querySelector('.lb-me');
  const keptName = () => cleanName(store.get(NAME) ?? '');

  // "Playing as Jack", and a way to change the name (for a typo, or someone else on the same device).
  const drawMe = () => {
    const name = keptName();
    if (!name) return me.replaceChildren();
    const line = make('p');
    const change = make('button', 'button', 'Change name');
    change.type = 'button';
    change.addEventListener('click', () => {
      const back = () => { drawMe(); me.querySelector('button').focus(); };
      me.replaceChildren(nameForm(name, (next) => { store.set(NAME, next); back(); }, back));
      me.querySelector('input').focus();
    });
    line.append('Playing as ', make('strong', '', name), '. ', change);
    me.replaceChildren(line);
  };
  const draw = () => {
    table.tBodies[0].replaceChildren(...board.slice(0, SHOWN).map((e, i) => {
      const row = make('tr', sameName(e.name, latest) ? 'is-latest' : '');
      for (const text of [i + 1, e.name, e.score.toLocaleString('en-US'), formatTime(e.time)]) row.append(make('td', '', String(text)));
      return row;
    }));
    table.hidden = !board.length;
    empty.hidden = board.length > 0;
    drawMe();
  };

  const save = (name, score, time) => {
    store.set(NAME, name);
    const r = addScore(board, { name, score, time });
    if (r.improved) store.set(key, JSON.stringify(r.board));
    board = r.board;
    latest = name;
    draw();
    if (r.improved) return `Saved for ${name}: number ${r.place} on the leaderboard.`;
    return `${name}'s best is still ${board[r.place - 1].score.toLocaleString('en-US')}.`;
  };

  const finish = (score, time, onSaved) => {
    const panel = make('div', 'lb lb-end');
    const said = make('p', 'lb-saved');
    said.setAttribute('role', 'status');
    panel.append(said);
    const name = keptName();
    if (name) {
      said.textContent = save(name, score, time);
      // Already filled in when the game shows it, so the game reads it out with its own message.
      panel.dataset.said = said.textContent;
    } else {
      const form = nameForm('', (typed) => {
        form.remove();
        said.textContent = save(typed, score, time);
        onSaved?.();
      });
      panel.prepend(form);
    }
    return panel;
  };

  draw();
  return { finish };
}
