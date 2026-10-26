// Reading a time from tokens.css in a script. The build's minifier rewrites times in the shortest unit ("800ms"
// becomes ".8s"), so a script must read the unit, never parseFloat alone.

/**
 * A CSS time in milliseconds: "800ms" and ".8s" are both 800; anything else is `fallback`.
 * @param {string} value
 * @param {number} fallback
 */
export function msOf(value, fallback = 0) {
  const parts = value.trim().match(/^(-?[\d.]+)(ms|s)$/);
  return parts ? Number(parts[1]) * (parts[2] === 's' ? 1000 : 1) : fallback;
}

/** The time a `--motion-*` token holds on `el`, in milliseconds. @param {Element} el @param {string} name */
export const motionMs = (el, name, fallback = 0) => msOf(getComputedStyle(el).getPropertyValue(name), fallback);
