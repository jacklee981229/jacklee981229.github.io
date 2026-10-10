// Browser code the Lab's tool pages share: copy buttons, and wiring the text tools' frame (TextConverter.astro) and
// the Preview tools' frame (PreviewTool.astro).
import { bringIntoView } from '../../games/controls.js';

/** Says `text` to screen readers, through the page's hidden announcer. */
export function announce(text: string) {
  const box = document.querySelector<HTMLElement>('[data-announcer]');
  if (!box) return;
  box.textContent = '';
  setTimeout(() => { box.textContent = text; }, 30);
}

const valueOf = (el: HTMLElement | null) => (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement ? el.value : el?.textContent ?? '');

/** Every `[data-copy]` button copies the value or text of the element whose id it names. */
export function wireCopyButtons() {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-copy]')) {
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
  // The browser may restore text typed before a reload.
  run();
  return { input, view, run };
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
