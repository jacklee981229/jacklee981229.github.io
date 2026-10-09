// Image Editor: the sums behind the crop box and the new size, kept apart from the page so the tests can check them.
// Boxes are in the picture's own pixels: { x, y, w, h }, x and y from its top left.

/** The crop box's shapes, as width over height; Free has none. */
export const SHAPES = [
  { id: 'free', label: 'Free', ratio: null },
  { id: 'square', label: 'Square', ratio: 1 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
];

/** A crop box can't be made smaller than this many pixels across. */
export const SMALLEST = 16;

/**
 * Where the crop box starts: for a shape, the biggest box of that shape in the middle of the picture; for Free, the
 * middle 80% of it.
 * @param {number | null} ratio @param {number} width @param {number} height
 */
export function startBox(ratio, width, height) {
  if (!ratio) {
    const w = Math.round(width * 0.8);
    const h = Math.round(height * 0.8);
    return { x: Math.round((width - w) / 2), y: Math.round((height - h) / 2), w, h };
  }
  const w = Math.round(Math.min(width, height * ratio));
  const h = Math.round(Math.min(height, w / ratio));
  return { x: Math.round((width - w) / 2), y: Math.round((height - h) / 2), w, h };
}

/**
 * The box moved by dx and dy, kept inside the picture.
 * @param {{ x: number, y: number, w: number, h: number }} box @param {number} dx @param {number} dy
 * @param {number} width @param {number} height
 */
export function moveBox(box, dx, dy, width, height) {
  return { ...box, x: Math.round(Math.min(Math.max(0, box.x + dx), width - box.w)), y: Math.round(Math.min(Math.max(0, box.y + dy), height - box.h)) };
}

/**
 * The box with one corner dragged by dx and dy, the opposite corner staying put: kept inside the picture, no smaller
 * than SMALLEST, and in its shape when it has one.
 * @param {{ x: number, y: number, w: number, h: number }} box @param {'nw' | 'ne' | 'sw' | 'se'} corner
 * @param {number} dx @param {number} dy @param {number | null} ratio @param {number} width @param {number} height
 */
export function dragCorner(box, corner, dx, dy, ratio, width, height) {
  const west = corner[1] === 'w';
  const north = corner[0] === 'n';
  // The corner that stays, and how far the box may reach from it before the picture's edge.
  const ax = west ? box.x + box.w : box.x;
  const ay = north ? box.y + box.h : box.y;
  const roomX = west ? ax : width - ax;
  const roomY = north ? ay : height - ay;
  let w = Math.min(roomX, Math.max(SMALLEST, box.w + (west ? -dx : dx)));
  let h = Math.min(roomY, Math.max(SMALLEST, box.h + (north ? -dy : dy)));
  if (ratio) {
    // Follow whichever way the pointer moved further, then fit the shape inside the room there is.
    if (Math.abs(dx) >= Math.abs(dy)) h = w / ratio;
    else w = h * ratio;
    if (w > roomX) [w, h] = [roomX, roomX / ratio];
    if (h > roomY) [w, h] = [roomY * ratio, roomY];
    if (Math.min(w, h) < SMALLEST) [w, h] = ratio >= 1 ? [SMALLEST * ratio, SMALLEST] : [SMALLEST, SMALLEST / ratio];
  }
  w = Math.round(w);
  h = Math.round(h);
  return { x: west ? ax - w : ax, y: north ? ay - h : ay, w, h };
}

/**
 * A new size that keeps the picture's shape, from the width or the height typed in: whole pixels, at least one.
 * @param {number} width @param {number} height the picture's size now
 * @param {{ w?: number, h?: number }} typed
 */
export function keepShape(width, height, { w, h }) {
  if (w !== undefined) return { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round((w * height) / width)) };
  return { w: Math.max(1, Math.round(((h ?? height) * width) / height)), h: Math.max(1, Math.round(h ?? height)) };
}

/** The saved file's name: `photo-edited.jpg`. @param {string} name @param {string} ext */
export function editedName(name, ext) {
  const dot = name.lastIndexOf('.');
  const base = (dot > 0 ? name.slice(0, dot) : name).trim() || 'picture';
  return `${base}-edited.${ext}`;
}
