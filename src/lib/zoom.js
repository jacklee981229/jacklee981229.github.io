// Zooming a picture where you point (the posts' lightbox): the picture is scaled by `s` and moved by (x, y) inside a
// window of its own size, w × h. The values are the 细节实验页's (designer skill, references/ui-details.md, entry 9).

export const ZOOM_MAX = 6;

/** How much one wheel step zooms: a mouse wheel's steps are big, a touchpad pinch (a wheel with Ctrl) small ones. */
export const wheelFactor = (deltaY, pinch = false) => Math.exp(-deltaY * (pinch ? 0.01 : 0.0022));

/**
 * The view kept inside the window: at s× the picture is s·w wide, so it may move between w − s·w and 0.
 * @param {{ s: number, x: number, y: number }} v @param {number} w @param {number} h
 */
export function clampView({ s, x, y }, w, h) {
  return { s, x: Math.min(0, Math.max(w - s * w, x)), y: Math.min(0, Math.max(h - s * h, y)) };
}

/**
 * The view zoomed to `next` (kept between 1× and 6×) with the point (px, py) of the window staying where it is.
 * @param {{ s: number, x: number, y: number }} v @param {number} px @param {number} py @param {number} next
 * @param {number} w @param {number} h
 */
export function zoomAt(v, px, py, next, w, h) {
  const s = Math.min(ZOOM_MAX, Math.max(1, next));
  return clampView({ s, x: px - ((px - v.x) * s) / v.s, y: py - ((py - v.y) * s) / v.s }, w, h);
}
