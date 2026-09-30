// Input the games on this site share: keys that work wherever the page was clicked, and swipes on the board.

/**
 * Key presses for a game, taken wherever the page was clicked (a click on the post focuses its main area, so a game
 * can't wait for its own focus), like the original 2048. Left alone while the visitor types (the search, a name
 * box), while a dialog is open, or with the board scrolled out of sight, where they scroll the page instead.
 * `down` returns true for a key the game used, so the page doesn't also scroll; `up`, if given, hears every release.
 * @param {Element} board
 * @param {{ down: (e: KeyboardEvent) => boolean, up?: (e: KeyboardEvent) => void }} handlers
 */
export function onGameKeys(board, { down, up }) {
  let onScreen = true;
  new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; }).observe(board);
  document.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || !onScreen) return;
    if (e.target.closest('input, textarea, select, [contenteditable]') || document.querySelector('dialog[open]')) return;
    if (down(e)) e.preventDefault();
  });
  if (up) document.addEventListener('keyup', up);
}

/**
 * Scrolls just enough to show a game whole, from the top of `first` to the bottom of `last` (say, its scores and its
 * board), when part of it is off the screen. Smooth unless less motion is asked for.
 * @param {Element} first @param {Element} last
 */
export function bringIntoView(first, last) {
  const room = 16;
  const top = first.getBoundingClientRect().top;
  const bottom = last.getBoundingClientRect().bottom;
  let by = Math.min(Math.max(0, bottom + room - innerHeight), top - room);
  if (top < room) by = top - room;
  if (by) scrollBy({ top: by, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}

// A swipe shorter than this is a tap, not a move.
const SWIPE_PX = 24;

/**
 * Swipes (and mouse drags) on the board, as 'left', 'right', 'up' or 'down'; `tap` hears a touch too short to be a
 * swipe. The board's CSS needs touch-action: none, so the page doesn't scroll under the finger. `ignore` says when
 * to leave the pointer alone (for example while a message with buttons is over the board).
 * @param {HTMLElement} board
 * @param {{ swipe: (direction: 'left' | 'right' | 'up' | 'down') => void, tap?: () => void, ignore?: () => boolean }} handlers
 */
export function onSwipe(board, { swipe, tap, ignore = () => false }) {
  let start = null;
  board.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary || ignore()) return;
    start = { x: e.clientX, y: e.clientY };
    board.setPointerCapture(e.pointerId);
  });
  board.addEventListener('pointerup', (e) => {
    if (!start || !e.isPrimary) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return tap?.();
    swipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });
  board.addEventListener('pointercancel', () => { start = null; });
}
