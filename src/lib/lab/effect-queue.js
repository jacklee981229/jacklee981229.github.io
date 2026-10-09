// The Effects page's Random: which effect comes next. Each round shows all the others in a new order; the one on show
// waits a round, and the few shown just before it wait until the end of the next, so at least six others play before
// any comes back. Kept apart from the page so the tests can check it.

/** The effects shown last (the one on show among them) that the next round keeps back to its end. */
const RECENT = 6;

/**
 * A list in a new order, every order as likely (Fisher and Yates).
 * @template T @param {readonly T[]} list @param {() => number} [random] @returns {T[]}
 */
export function shuffled(list, random = Math.random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The effects to come after the one on show (null before any: then the first round has them all).
 * @param {readonly string[]} slugs @param {string | null} showing @param {() => number} [random]
 */
export function effectQueue(slugs, showing, random = Math.random) {
  /** The latest shown, oldest first: the last is the one on show. */
  const recent = showing ? [showing] : [];
  /** @type {string[]} */
  let left = [];
  return {
    /** The next effect to show. */
    next() {
      if (!left.length) {
        const current = recent.at(-1);
        const fresh = slugs.filter((slug) => !recent.includes(slug));
        const lately = recent.filter((slug) => slug !== current && slugs.includes(slug));
        left = [...shuffled(fresh, random), ...shuffled(lately, random)];
        // Only one effect at all: it's the only thing to show.
        if (!left.length) left = [...slugs];
      }
      const slug = /** @type {string} */ (left.shift());
      recent.push(slug);
      if (recent.length > RECENT) recent.shift();
      return slug;
    },
  };
}
