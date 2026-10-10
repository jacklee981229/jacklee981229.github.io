// The lanterns of Jack's Firefly River as real buttons over the canvas, one for each guestbook note on the wall, and
// the small dialog each opens over the river: the note as the wall's own paper card (paperNote, as the Guestbook page
// shows it), whose words go in as text, never as HTML. Escape, the close button or a tap outside closes it, and focus
// goes back to its lantern.
import '../../styles/guestbook.css';
import './notes.css';
import { paperNote } from '../../lib/guestbook-view.js';
import { ICONS } from '../../lib/icons.js';
import { logoSvg } from '../../lib/logo.js';

/** @typedef {import('../../lib/fireflies/lanterns.js').Lantern} Lantern */

/**
 * The lanterns' buttons and their dialog, inside the stage `root`. `heed(i, on)` is told when a lantern is pointed at,
 * focused or open, so the river can light it up.
 * @param {HTMLElement} root @param {(i: number, on: boolean) => void} heed
 */
export function noteLanterns(root, heed) {
  const layer = document.createElement('div');
  layer.className = 'river-lanterns';
  root.querySelector('canvas')?.after(layer);
  // Jack's face beside his replies, as on the wall: the site's own logo, not a visitor's words.
  const face = logoSvg('river', 'width="22" height="22" aria-hidden="true"');
  /** @type {Lantern[]} */
  let lanterns = [];
  /** @type {HTMLButtonElement[]} */
  let buttons = [];
  /** @type {HTMLDialogElement | null} */
  let dialog = null;
  let openAt = -1;

  const close = () => {
    if (!dialog?.open) return;
    dialog.close();
    const back = buttons[openAt];
    heed(openAt, false);
    openAt = -1;
    back?.focus({ preventScroll: true });
  };
  /** @param {KeyboardEvent} e */
  const onKey = (e) => {
    if (e.key !== 'Escape' || !dialog?.open) return;
    e.preventDefault();
    close();
  };
  /** A press anywhere outside the open card closes it (a press on the river is taken by the river's own handler). @param {PointerEvent} e */
  const onPress = (e) => {
    if (!dialog?.open || !(e.target instanceof Node) || dialog.contains(e.target) || buttons.includes(/** @type {HTMLButtonElement} */ (e.target))) return;
    if (e.target === root.querySelector('canvas')) return;
    close();
  };
  document.addEventListener('keydown', onKey);
  document.addEventListener('pointerdown', onPress, true);

  /** @param {number} i */
  const open = (i) => {
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.className = 'river-note';
      root.append(dialog);
    }
    if (openAt >= 0) heed(openAt, false);
    openAt = i;
    const note = lanterns[i].note;
    const shut = document.createElement('button');
    shut.type = 'button';
    shut.className = 'river-note-close';
    shut.setAttribute('aria-label', 'Close the note');
    shut.innerHTML = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS.close}</svg>`;
    shut.addEventListener('click', close);
    dialog.replaceChildren(paperNote(note, face), shut);
    dialog.setAttribute('aria-label', `A note from ${note.name}`);
    if (!dialog.open) dialog.show();
    heed(i, true);
    shut.focus({ preventScroll: true });
  };

  return {
    /** Puts a button over each lantern, for these lanterns (after the notes come, or the stage changes size). @param {Lantern[]} next */
    set(next) {
      const was = openAt >= 0 ? lanterns[openAt]?.note.id : null;
      lanterns = next;
      while (buttons.length > lanterns.length) buttons.pop()?.remove();
      lanterns.forEach((l, i) => {
        let b = buttons[i];
        if (!b) {
          b = document.createElement('button');
          b.type = 'button';
          b.className = 'river-lantern';
          b.addEventListener('click', () => (openAt === i && dialog?.open ? close() : open(i)));
          for (const [type, on] of /** @type {const} */ ([['pointerenter', true], ['pointerleave', false], ['focus', true], ['blur', false]])) {
            b.addEventListener(type, () => { if (openAt !== i) heed(i, on); });
          }
          layer.append(b);
          buttons.push(b);
        }
        b.setAttribute('aria-label', `A note from ${l.note.name}`);
        b.style.setProperty('--x', `${l.x}px`);
        b.style.setProperty('--y', `${l.y}px`);
        b.style.setProperty('--size', `${l.button}px`);
        b.style.setProperty('--note', `var(--note-${l.colour})`);
      });
      // A note left open stays open if its lantern is still there.
      if (was !== null) {
        const still = lanterns.findIndex((l) => l.note.id === was);
        if (still < 0) close();
        else openAt = still;
      }
    },
    /** Whether a note is open: a press on the river then only closes it. */
    get open() { return Boolean(dialog?.open); },
    close,
    /** Shows the buttons as small lanterns of their own, for when the river can't be drawn here. @param {boolean} on */
    plain(on) { layer.classList.toggle('plain', on); },
    stop() {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPress, true);
      layer.remove();
      dialog?.remove();
    },
  };
}
