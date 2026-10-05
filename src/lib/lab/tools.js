// The Lab's tools, games and effects. The Lab home, each tool's page and the sitemap all read this list.

/** The groups on the Lab home, in order. */
export const GROUPS = [
  { id: 'text', name: 'Text' },
  { id: 'preview', name: 'Preview' },
  { id: 'image', name: 'Images' },
];

/**
 * Each tool: its address (/lab/<slug>/), name, one-line description, group and icon; `ready` once its page is built,
 * `soon` until then; and the example its card shows (what goes in, what comes out).
 */
export const TOOLS = [
  { slug: 'count-words', name: 'Count Words', description: 'Words, characters, lines and reading time, as you type.', group: 'text', icon: 'hash', status: 'ready', example: ['Paste any text', '248 words, 1,402 characters'] },
  { slug: 'change-case', name: 'Change Case', description: 'UPPERCASE, lowercase, Title Case and more.', group: 'text', icon: 'case', status: 'ready', example: ['hello world', 'Hello World'] },
  { slug: 'clean-text', name: 'Clean Text', description: 'Tidy messy copied text: spaces, empty lines, line breaks.', group: 'text', icon: 'eraser', status: 'ready', example: ['too   many    spaces', 'too many spaces'] },
  { slug: 'compare-text', name: 'Compare Text', description: 'See what changed between two versions.', group: 'text', icon: 'compare', status: 'soon', example: ['- the old line', '+ the new line'] },
  { slug: 'encode-url', name: 'Encode URL', description: 'Make text safe for a web address, or read it back.', group: 'text', icon: 'link', status: 'ready', example: ['a b&c', 'a%20b%26c'] },
  { slug: 'convert-timestamp', name: 'Convert Timestamp', description: 'Unix time to a readable date, and back.', group: 'text', icon: 'clock', status: 'ready', example: ['1727600000', '29 Sep 2024, 16:53:20'] },
  { slug: 'markdown-preview', name: 'Markdown Preview', description: 'See your Markdown as a formatted page, as you type.', group: 'preview', icon: 'markdown', status: 'ready', example: ['# Notes, **done**', 'A heading, with bold'] },
  { slug: 'json-preview', name: 'JSON Preview', description: 'Tidy JSON you can read, fold and check.', group: 'preview', icon: 'braces', status: 'ready', example: ['{"name":"Jack","lab":true}', 'Tidy, coloured, foldable'] },
  { slug: 'jpg-to-png', name: 'JPG to PNG', description: 'Convert a photo to PNG in your browser.', group: 'image', icon: 'image', status: 'soon', example: ['photo.jpg', 'photo.png'] },
  { slug: 'resize-image', name: 'Resize Image', description: "Change an image's size, keeping its shape.", group: 'image', icon: 'resize', status: 'soon', example: ['4032 × 3024', '1200 × 900'] },
  { slug: 'compress-image', name: 'Compress Image', description: 'Make an image file smaller.', group: 'image', icon: 'compress', status: 'soon', example: ['3.2 MB', '480 KB'] },
  { slug: 'qr-code', name: 'Make a QR Code', description: 'Turn a link or message into a QR code.', group: 'image', icon: 'qr', status: 'soon', example: ['jacklee981229.github.io', 'A QR code, ready to scan'] },
];

/**
 * Posts shown under Mini Games! on the Lab home, each played at /lab/game/<post folder>/. Their titles, descriptions
 * and covers come from the posts themselves.
 */
export const EXPERIMENTS = ['2048', 'catch-the-cat', 'snake', 'blocks'];

/**
 * Effects: things with no use at all, to look at and play with. Most follow the mouse; Key Jam answers the keyboard,
 * with sounds. Each has its page at /lab/effect/<slug>/, its code in src/effects/<slug>.js and its card's picture in
 * src/components/EffectCover.astro. `hint` says what to do there.
 */
export const EFFECTS = [
  { slug: 'dot-grid', name: 'Dot Grid', description: 'A field of dots that leans away from you.', hint: 'Move the mouse, or drag a finger. Click for a ripple.' },
  { slug: 'mouse-trail', name: 'Mouse Trail', description: 'Ribbons that chase the pointer.', hint: 'Move the mouse, or drag a finger.' },
  { slug: 'gravity-trail', name: 'Gravity Trail', description: 'A trail that falls and bounces.', hint: 'Move the mouse, or drag a finger. Click for a burst.' },
  { slug: 'particles', name: 'Particles', description: 'Drifting points that link up near you.', hint: 'Move the mouse, or drag a finger. Click to push them away.' },
  { slug: 'gooey-cursor', name: 'Gooey Cursor', description: 'Blobs that stretch, split and melt together.', hint: 'Move the mouse, or drag a finger.' },
  { slug: 'distortion', name: 'Distortion', description: 'A net that bends and twists around the pointer.', hint: 'Move the mouse, or drag a finger. Click for a wave.' },
  { slug: 'ripples', name: 'Ripples', description: 'Rings that spread wherever the pointer goes.', hint: 'Move the mouse, or drag a finger. Click for a splash.' },
  { slug: 'compass', name: 'Compass', description: 'A field of needles that all point at you.', hint: 'Move the mouse, or drag a finger. Click to spin them.' },
  { slug: 'spotlight', name: 'Spotlight', description: 'A torch in the dark. Somewhere, a cat is hiding.', hint: 'Move the mouse, or drag a finger. Click to light it all up.' },
  { slug: 'sand', name: 'Sand', description: 'Sand that pours from the pointer and piles up.', hint: 'Move the mouse, or drag a finger. Click for a heap.' },
  { slug: 'kaleidoscope', name: 'Kaleidoscope', description: 'What you draw repeats into a pattern.', hint: 'Move the mouse, or drag a finger. Click to change the mirrors.' },
  { slug: 'starfield', name: 'Starfield', description: 'Stars rushing past as you fly.', hint: 'Move the mouse to steer, or drag a finger. Click to speed up.' },
  { slug: 'strings', name: 'Strings', description: 'Strings you can pluck like a harp.', hint: 'Sweep the mouse across them, or a finger. Click to strum them all.' },
  { slug: 'stained-glass', name: 'Stained Glass', description: 'Coloured panes that make room for you.', hint: 'Move the mouse, or drag a finger. Click to shove them.' },
  { slug: 'flock', name: 'Flock', description: 'A shoal of fish that follows you.', hint: 'Move the mouse, or drag a finger. Click to scare them.' },
  { slug: 'orbits', name: 'Orbits', description: 'Little planets circling your pointer.', hint: 'Move the mouse, or drag a finger. Click to fling them out.' },
  { slug: 'garden', name: 'Garden', description: 'Plants that grow and lean your way.', hint: 'Move the mouse to bend them, or drag a finger. Click to plant one.' },
  { slug: 'key-jam', name: 'Key Jam', description: 'Every key plays a sound and a little show.', hint: 'Press letter keys, or tap the stage. Space changes the set. Sound on!' },
];

/**
 * The Little Worlds: things that run by themselves, for watching (D58 in docs/plan/todo/little-worlds-town.md). Each is
 * drawn by src/worlds/<slug>.js on the effects' stage, at /lab/world/<slug>/, and has a picture of itself in
 * src/assets/worlds/<slug>.png for its card and its link previews. `hint` says what there is to see or do, `icon` is
 * its card's and the palette's icon, `words` are more words the palette finds it by, and `controls` are buttons of
 * its own beside Pause (its code finds each by its id).
 */
export const WORLDS = [
  { slug: 'town', name: "Jack's Town", description: 'A little town whose cars drive, park and come and go by themselves.', hint: "Click a car to see where it's going, or add and remove cars.", icon: 'car', words: ['traffic', 'cars'], controls: [{ id: 'add-car', label: 'Add car' }, { id: 'remove-car', label: 'Remove car' }] },
  { slug: 'trains', name: "Jack's Train World", description: 'A little railway whose trains fetch and deliver cargo by themselves.', hint: 'Click a train to follow it, or add and remove trains.', icon: 'train', words: ['railway', 'trains', 'cargo'], controls: [{ id: 'add-train', label: 'Add train' }, { id: 'remove-train', label: 'Remove train' }] },
];

/** @param {string} slug */
export const toolUrl = (slug) => `/lab/${slug}/`;
/** @param {string} slug */
export const effectUrl = (slug) => `/lab/effect/${slug}/`;
/** @param {string} slug */
export const worldUrl = (slug) => `/lab/world/${slug}/`;

/**
 * "Check these too!" under a Lab page: the same kind first, in the Lab's order, then the other kinds; never the page
 * itself, and only tools that are ready.
 * @param {string} current a tool's address, a game's post or an effect's address
 * @returns {{ kind: 'tool' | 'experiment' | 'effect', id: string }[]}
 */
export function moreLabItems(current, count = 4) {
  const tools = TOOLS.filter((t) => t.status === 'ready' && t.slug !== current).map((t) => ({ kind: /** @type {const} */ ('tool'), id: t.slug }));
  const experiments = EXPERIMENTS.filter((id) => id !== current).map((id) => ({ kind: /** @type {const} */ ('experiment'), id }));
  const effects = EFFECTS.filter((e) => e.slug !== current).map((e) => ({ kind: /** @type {const} */ ('effect'), id: e.slug }));
  const order = EFFECTS.some((e) => e.slug === current) ? [effects, experiments, tools] : EXPERIMENTS.includes(current) ? [experiments, tools, effects] : [tools, experiments, effects];
  return order.flat().slice(0, count);
}

/** @param {string} slug */
export function effectBySlug(slug) {
  const item = EFFECTS.find((e) => e.slug === slug);
  if (!item) throw new Error(`No effect "${slug}". Add it to EFFECTS in src/lib/lab/tools.js.`);
  return item;
}

/** @param {string} slug */
export function toolBySlug(slug) {
  const tool = TOOLS.find((t) => t.slug === slug);
  if (!tool) throw new Error(`No Lab tool "${slug}". Add it to src/lib/lab/tools.js.`);
  return tool;
}
