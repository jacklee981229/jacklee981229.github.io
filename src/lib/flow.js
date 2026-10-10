// Pages flowing into each other (the @view-transition rule in global.css): a part that leads to a page and that page's
// top share a view-transition name made from the page's address, so the browser grows the one into the other.

/**
 * The name shared by a part that leads to `path` and the top of the page at `path`: "/lab/game/2048/" gives
 * "to-lab-game-2048", "/" gives "to-home". A hash or a query on the address is left out.
 * @param {string} path
 */
export function flowName(path) {
  const page = String(path).split(/[?#]/)[0].replace(/^\/+|\/+$/g, '');
  return `to-${page.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'home'}`;
}

/** The same, as a style attribute. @param {string} path */
export const flowStyle = (path) => `view-transition-name: ${flowName(path)}`;
