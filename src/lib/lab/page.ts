// Browser code the Lab's tool pages share: copy buttons, and wiring the text tools' frame (TextConverter.astro) and
// the Preview tools' frame (PreviewTool.astro).
import { bringIntoView } from '../../games/controls.js';
import { ICONS } from '../icons.js';
import { spring } from '../spring.js';
import { clampSplit, settleSplit, splitAt, SPLIT_STEP } from '../split.js';

/** Says `text` to screen readers, through the page's hidden announcer. */
export function announce(text: string) {
  const box = document.querySelector<HTMLElement>('[data-announcer]');
  if (!box) return;
  box.textContent = '';
  setTimeout(() => { box.textContent = text; }, 30);
}

const valueOf = (el: HTMLElement | null) => (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement ? el.value : el?.textContent ?? '');
// Shown on a copy button once its text is copied (global.css pops it in).
const TICK = `<svg class="icon copied-tick" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS.check}</svg>`;

/**
 * Every `[data-copy]` button copies the value or text of the element whose id it names. A page that adds buttons
 * later calls it again; buttons already wired are left as they are.
 */
export function wireCopyButtons() {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-copy]:not([data-copy-wired])')) {
    button.dataset.copyWired = '';
    const label = button.querySelector<HTMLElement>('[data-label]') ?? button;
    const original = label.textContent ?? '';
    let timer = 0;
    button.addEventListener('click', async () => {
      const source = document.getElementById(button.dataset.copy ?? '');
      const text = valueOf(source);
      if (!text) {
        label.textContent = 'Nothing to copy';
      } else {
        try {
          await navigator.clipboard.writeText(text);
          label.textContent = 'Copied';
          button.dataset.copied = '';
          if (!button.querySelector(':scope > .copied-tick')) button.insertAdjacentHTML('afterbegin', TICK);
        } catch {
          // The clipboard can be blocked; with the text selected, Ctrl+C still works.
          if (source instanceof HTMLTextAreaElement || source instanceof HTMLInputElement) source.select();
          else if (source) getSelection()?.selectAllChildren(source);
          label.textContent = 'Selected: press Ctrl+C';
        }
      }
      announce(label.textContent ?? '');
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        label.textContent = original;
        delete button.dataset.copied;
        button.querySelector(':scope > .copied-tick')?.remove();
      }, 2000);
    });
  }
}

/** Longer than this, a text is shown a moment after typing stops instead of on every frame. */
const LONG_TEXT = 200_000;

/**
 * Brings the Preview tools' frame (PreviewTool.astro) to life. `show` draws what the text makes into the preview
 * box; it runs as you type, at most once a frame (a very long text waits until typing pauses). Also wires Clear,
 * the Copy buttons, and the glide that shows the tall boxes whole when you go to type.
 */
export function setupPreview(show: (text: string, view: HTMLElement) => void) {
  const input = document.querySelector<HTMLTextAreaElement>('[data-in]')!;
  const view = document.querySelector<HTMLElement>('[data-view]')!;
  const clear = document.querySelector<HTMLElement>('[data-clear]')!;
  let queued = false;
  let timer = 0;
  const run = () => {
    queued = false;
    show(input.value, view);
  };
  input.addEventListener('input', () => {
    if (input.value.length > LONG_TEXT) {
      clearTimeout(timer);
      timer = window.setTimeout(run, 250);
    } else if (!queued) {
      queued = true;
      requestAnimationFrame(run);
    }
  });
  clear.addEventListener('click', () => {
    input.value = '';
    run();
    input.focus();
  });
  // The tall boxes can start below the screen's edge: once you go to type, the page glides to show them whole.
  input.addEventListener('focus', () => bringIntoView(document.querySelector<HTMLElement>('label[for="pane-in"]')!, clear));
  wireCopyButtons();
  wireSplit();
  // The browser may restore text typed before a reload.
  run();
  return { input, view, run };
}

/**
 * The line between the Preview tools' two sides (PreviewTool.astro): held by the pointer however fast it moves,
 * settling on the middle when let go near it, back to the middle on a double-click; the arrow keys move it too.
 */
function wireSplit() {
  const line = document.querySelector<HTMLElement>('[data-split]');
  const panes = line?.closest<HTMLElement>('.panes');
  if (!line || !panes) return;
  let share = 0.5;
  let stopGlide = () => {};
  const set = (p: number) => {
    share = clampSplit(p);
    panes.style.setProperty('--split', String(share));
    line.setAttribute('aria-valuenow', String(Math.round(share * 100)));
  };
  const glideTo = (p: number) => {
    stopGlide();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return set(p);
    const from = share;
    stopGlide = spring(0, 1, (k) => set(from + (p - from) * k));
  };
  const measure = () => {
    const box = panes.getBoundingClientRect();
    const gap = line.getBoundingClientRect().width;
    return { left: box.left, room: box.width - gap, gap };
  };
  line.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    stopGlide();
    line.setPointerCapture(e.pointerId);
    line.classList.add('is-dragging');
    document.documentElement.classList.add('is-col-resizing');
    const { left, room, gap } = measure();
    const move = (ev: PointerEvent) => set(splitAt(ev.clientX, left, room, gap));
    const up = () => {
      line.removeEventListener('pointermove', move);
      line.classList.remove('is-dragging');
      document.documentElement.classList.remove('is-col-resizing');
      const rest = settleSplit(share, room);
      if (rest !== share) glideTo(rest);
    };
    line.addEventListener('pointermove', move);
    line.addEventListener('pointerup', up, { once: true });
    line.addEventListener('pointercancel', up, { once: true });
  });
  line.addEventListener('dblclick', () => glideTo(0.5));
  line.addEventListener('keydown', (e) => {
    const to = { ArrowLeft: share - SPLIT_STEP, ArrowRight: share + SPLIT_STEP, Home: 0, End: 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    stopGlide();
    set(to);
  });
}

export type Converted = { text: string; note?: string };

/**
 * Makes the result follow the text and the choices above it, and wires Clear and Copy.
 * `convert` turns the text into the result, reading the page's own choices.
 */
export function setupConverter(convert: (text: string) => Converted) {
  const input = document.querySelector<HTMLTextAreaElement>('[data-in]')!;
  const output = document.querySelector<HTMLTextAreaElement>('[data-out]')!;
  const note = document.querySelector<HTMLElement>('[data-note]')!;
  let queued = false;
  const run = () => {
    queued = false;
    const result = convert(input.value);
    output.value = result.text;
    // Setting the same words again would make screen readers repeat them on every key press.
    if (note.textContent !== (result.note ?? '')) note.textContent = result.note ?? '';
  };
  // Converting a long text on every key press can lag, so convert at most once per frame.
  input.addEventListener('input', () => {
    if (!queued) requestAnimationFrame(run);
    queued = true;
  });
  document.querySelector('[data-controls]')!.addEventListener('change', run);
  document.querySelector('[data-clear]')!.addEventListener('click', () => {
    input.value = '';
    run();
    input.focus();
  });
  wireCopyButtons();
  // The browser may restore the text and choices from before a reload.
  run();
  return { input, output, run };
}
