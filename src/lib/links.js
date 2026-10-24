// Links to other sites open in a new tab, so readers keep their place on the blog.

/** The attributes an outside link gets. "new-tab" is the hidden note in Base.astro that screen readers read out. */
export const NEW_TAB = Object.freeze({ target: '_blank', rel: 'noopener', 'aria-describedby': 'new-tab' });

/**
 * A fresh copy of NEW_TAB, to spread onto a link (`{...newTab()}`). Astro writes the component's scope class into the
 * object it spreads, so a shared object picked up every page's classes; frozen, it now stops the build instead.
 */
export const newTab = () => ({ ...NEW_TAB });

/**
 * True for an http(s) link to another site. Relative links, #anchors, mailto: and links to the blog's own address stay put.
 * @param {string} href
 * @param {string} site the blog's own address, e.g. https://jacklee981229.github.io
 */
export function isExternal(href, site) {
  if (!/^https?:\/\//i.test(href)) return false;
  try {
    return new URL(href).host !== new URL(site).host;
  } catch {
    return false;
  }
}

/**
 * Rehype plugin: gives every outside link in a post the NEW_TAB attributes.
 * @param {{ site: string }} options
 */
export function rehypeExternalLinks({ site }) {
  /** @param {any} node */
  const visit = (node) => {
    if (node.type === 'element' && node.tagName === 'a' && isExternal(String(node.properties?.href ?? ''), site)) {
      Object.assign(node.properties, { target: NEW_TAB.target, rel: [NEW_TAB.rel], ariaDescribedBy: NEW_TAB['aria-describedby'] });
    }
    node.children?.forEach(visit);
  };
  return visit;
}
