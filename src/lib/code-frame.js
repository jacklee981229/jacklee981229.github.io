// Build-time helpers for code blocks in posts.

/**
 * Shiki transformer: ```js title="app.js" puts the file name on the <pre>, where the code frame shows it.
 * @type {import('shiki').ShikiTransformer}
 */
export const codeTitleFromMeta = {
  name: 'code-title-from-meta',
  pre(node) {
    const title = (this.options.meta?.__raw ?? '').match(/title="([^"]*)"/)?.[1];
    if (title) node.properties['data-title'] = title;
  },
};

const el = (tagName, properties, children = []) => ({ type: 'element', tagName, properties, children });
const text = (value) => ({ type: 'text', value });

/**
 * Rehype plugin: wraps each highlighted code block in a frame with its file name (or language) and a Copy button,
 * so the frame is in the HTML from the start and nothing jumps when the page's script runs.
 */
export function rehypeCodeFrame() {
  /** @param {any} node */
  const visit = (node) => {
    if (!node.children) return;
    node.children = node.children.map((/** @type {any} */ child) => {
      if (child.type === 'element' && child.tagName === 'pre' && child.properties?.dataLanguage !== undefined) return frame(child);
      visit(child);
      return child;
    });
  };
  return visit;
}

/** @param {any} pre */
function frame(pre) {
  const language = String(pre.properties.dataLanguage);
  const title = pre.properties.dataTitle ?? pre.properties['data-title'];
  const label = title ? String(title) : language === 'plaintext' ? 'text' : language;
  const copyIcon = el('svg', { className: ['icon'], viewBox: '0 0 24 24', ariaHidden: 'true', focusable: 'false' }, [
    el('rect', { x: 9, y: 9, width: 11, height: 11, rx: 2 }),
    el('path', { d: 'M5 15V5a2 2 0 0 1 2-2h10' }),
  ]);
  return el('figure', { className: ['code'] }, [
    el('figcaption', { className: ['code-bar'] }, [
      el('span', { className: ['code-lang'] }, [text(label)]),
      el('button', { type: 'button', className: ['code-copy'], dataCopyCode: '' }, [copyIcon, el('span', { dataLabel: '' }, [text('Copy')])]),
    ]),
    pre,
  ]);
}
