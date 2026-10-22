// A box whose content scrolls fades out at an edge with more beyond it, and the fade shrinks to nothing as that end is
// reached, so the first and last lines show whole (the mask itself is in global.css). Not for a box with a shadow
// of its own: the mask would cut the shadow off.

/** How far, in pixels, a scrolled edge fades at most. */
export const FADE = 24;

/** One end's fade: under a pixel left counts as the end, as a box scrolled to its end on a 150% screen stops a
    fraction short. */
const fadeFor = (/** @type {number} */ left, /** @type {number} */ most) => (left < 1 ? 0 : Math.min(most, left));

/**
 * The fade at each end: as far as the content runs on past it, up to `most`.
 * @param {number} before how far the content runs past the start (scrolled away)
 * @param {number} after how far it runs past the end
 * @returns {[number, number]}
 */
export const fadeSizes = (before, after, most = FADE) => [fadeFor(before, most), fadeFor(after, most)];

/**
 * Fades `el`'s edges along `axis` as it scrolls, its size changes or its content does.
 * @param {HTMLElement} el
 * @param {'x' | 'y'} axis
 */
export function edgeFade(el, axis) {
  el.dataset.fadeAxis = axis;
  const update = () => {
    const [a, b] = axis === 'x'
      ? fadeSizes(el.scrollLeft, el.scrollWidth - el.clientWidth - el.scrollLeft)
      : fadeSizes(el.scrollTop, el.scrollHeight - el.clientHeight - el.scrollTop);
    el.style.setProperty('--fade-a', `${a}px`);
    el.style.setProperty('--fade-b', `${b}px`);
    // Masked only while something fades: a mask also clips what reaches past the box, such as a focus ring.
    el.toggleAttribute('data-fading', a > 0 || b > 0);
  };
  el.addEventListener('scroll', update, { passive: true });
  new ResizeObserver(update).observe(el);
  new MutationObserver(update).observe(el, { childList: true, subtree: true, characterData: true });
  update();
}

/** Every box on the page that fades: those marked data-edge-fade ("x" or "y"), and the tables and code in posts. */
export function edgeFades() {
  document.querySelectorAll('[data-edge-fade]').forEach((el) => edgeFade(/** @type {HTMLElement} */ (el), /** @type {HTMLElement} */ (el).dataset.edgeFade === 'x' ? 'x' : 'y'));
  document.querySelectorAll('.prose table, .prose .astro-code').forEach((el) => edgeFade(/** @type {HTMLElement} */ (el), 'x'));
}
