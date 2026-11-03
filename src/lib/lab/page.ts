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
 * the Copy buttons, the glide that shows the tall boxes whole when you go to type, and a tool's files. `reset`
 * forgets the page's own choices (CSV's search and sort) when a file opens or you start over, before the new text
 * is shown.
 */
export function setupPreview(show: (text: string, view: HTMLElement) => void, { reset = () => {} } = {}) {
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
  wireFiles(input, view, run, reset);
  return { input, view, run };
}

/**
 * A Preview tool that opens files (PreviewTool.astro's `files`): the drop box on arrival, Or paste text, Open file,
 * a file dropped on the box or the text, the three modes and Start over.
 */
function wireFiles(input: HTMLTextAreaElement, view: HTMLElement, run: () => void, reset: () => void) {
  const start = document.querySelector<HTMLElement>('[data-start]');
  const work = document.querySelector<HTMLElement>('[data-work]');
  if (!start || !work) return;
  const file = document.querySelector<HTMLInputElement>('[data-file]')!;
  const dropFile = document.querySelector<HTMLInputElement>('[data-drop-file]')!;
  const modes = [...document.querySelectorAll<HTMLInputElement>('input[name="preview-mode"]')];

  // shortcut: a file is read as UTF-8 only, so one saved in another encoding (Excel's plain "CSV", not "CSV UTF-8";
  // PowerShell 5.1's `>`, which writes UTF-16) shows garbled; read the encoding from the bytes if people bring such
  // files.
  async function open(picked: File | undefined) {
    if (!picked) return;
    input.value = await picked.text();
    reset();
    run();
    // A file opens on its preview alone, as big as it gets.
    setMode('preview');
    showWork();
    view.scrollTop = 0;
    announce(`Opened ${picked.name}`);
  }
  function setMode(mode: 'both' | 'text' | 'preview') {
    modes.find((choice) => choice.value === mode)!.checked = true;
    work!.dataset.mode = mode;
  }
  for (const choice of modes) {
    choice.addEventListener('change', () => { work.dataset.mode = choice.value; });
  }
  /** The drop box makes way for the work, and the page glides to show it whole. */
  function showWork() {
    if (!work!.hidden) return;
    start!.hidden = true;
    work!.hidden = false;
    bringIntoView(document.querySelector<HTMLElement>('[data-bar]')!, document.querySelector<HTMLElement>('.panes')!);
  }
  // Start over: the box emptied and the drop box back, from any mode.
  document.querySelector('[data-restart]')!.addEventListener('click', () => {
    input.value = '';
    reset();
    run();
    work.hidden = true;
    start.hidden = false;
    dropFile.focus();
  });
  // The browser may restore text typed before a reload: then the two sides show at once.
  if (input.value.trim()) {
    start.hidden = true;
    work.hidden = false;
    // The mode switch may come back restored too, without a change event.
    work.dataset.mode = modes.find((choice) => choice.checked)?.value ?? 'both';
  }

  document.querySelector('[data-paste]')!.addEventListener('click', () => {
    // Typing wants to see its preview at the same time.
    setMode('both');
    showWork();
    input.focus();
  });
  document.querySelector('[data-open]')!.addEventListener('click', () => file.click());
  for (const picker of [file, dropFile]) {
    picker.addEventListener('change', () => {
      open(picker.files?.[0]);
      picker.value = '';
    });
  }
  // Dragged over: the drop box lights up, and a drop opens the file instead of the browser showing it in the tab.
  const drop = document.querySelector<HTMLElement>('[data-drop]')!;
  for (const type of ['dragenter', 'dragover']) drop.addEventListener(type, (e) => {
    e.preventDefault();
    drop.classList.add('is-over');
  });
  for (const type of ['dragleave', 'drop']) drop.addEventListener(type, () => drop.classList.remove('is-over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    open(e.dataTransfer?.files[0]);
  });
  // A file dropped on either side opens there, instead of the browser showing it in the tab and losing the page;
  // dropped text still drops into the text.
  for (const box of [input, view]) {
    for (const type of ['dragenter', 'dragover']) box.addEventListener(type, (e) => {
      if (!(e as DragEvent).dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      box.classList.add('is-over');
    });
    for (const type of ['dragleave', 'drop']) box.addEventListener(type, () => box.classList.remove('is-over'));
    box.addEventListener('drop', (e) => {
      if (!e.dataTransfer?.files.length) return;
      e.preventDefault();
      open(e.dataTransfer.files[0]);
    });
  }
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
