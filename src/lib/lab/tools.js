// The Lab's tools, games and effects. The Lab home, each tool's page and the sitemap all read this list.

/** The groups on the Lab home, in order. */
export const GROUPS = [
  { id: 'text', name: 'Text' },
  { id: 'preview', name: 'Preview' },
  { id: 'image', name: 'Images' },
  { id: 'misc', name: 'Misc' },
];

/**
 * Each tool: its address (/lab/<slug>/), name, one-line description, group and icon; `ready` once its page is built,
 * `soon` until then; and the example its card shows (what goes in, what comes out). Effects has none: its card shows
 * one effect's drawing, a different one each day; nor has Jack's Build Log, whose card shows a drawing of its clock
 * (src/components/BuildLogCover.astro). `words` are more words the palette finds it by. `hidden` keeps a finished one
 * off every list (the Lab, the palette, Random, the sitemap): only its address reaches it, marked noindex.
 * @type {{ slug: string, name: string, description: string, group: string, icon: string, status: 'ready' | 'soon', example?: readonly string[], words?: readonly string[], hidden?: boolean }[]}
 */
export const TOOLS = [
  { slug: 'count-words', name: 'Count Words', description: 'Words, characters, lines and reading time, as you type.', group: 'text', icon: 'hash', status: 'ready', example: ['Paste any text', '248 words, 1,402 characters'] },
  { slug: 'compare-text', name: 'Compare Text', description: 'See what changed between two versions.', group: 'text', icon: 'compare', status: 'ready', example: ['- the old line', '+ the new line'] },
  { slug: 'encode-url', name: 'Encode URL', description: 'Make text safe for a web address, or read it back.', group: 'text', icon: 'link', status: 'ready', example: ['a b&c', 'a%20b%26c'] },
  { slug: 'convert-timestamp', name: 'Convert Timestamp', description: 'Unix time to a readable date, and back.', group: 'text', icon: 'clock', status: 'ready', example: ['1727600000', '29 Sep 2024, 16:53:20'] },
  { slug: 'markdown-preview', name: 'Markdown Preview', description: 'See your Markdown as a formatted page, as you type.', group: 'preview', icon: 'markdown', status: 'ready', example: ['# Notes, **done**', 'A heading, with bold'] },
  { slug: 'json-preview', name: 'JSON Preview', description: 'Tidy JSON you can read, fold and check.', group: 'preview', icon: 'braces', status: 'ready', example: ['{"name":"Jack","lab":true}', 'Tidy, coloured, foldable'] },
  { slug: 'convert-image', name: 'Convert Image', description: 'Change a picture to JPG, PNG, WebP or PDF.', group: 'image', icon: 'image', status: 'ready', example: ['photo.jpg', 'photo.png, .webp or .pdf'] },
  { slug: 'image-editor', name: 'Image Editor', description: 'Crop, resize, flip and compress a picture.', group: 'image', icon: 'crop', status: 'ready', example: ['4032 × 3024, 3.2 MB', '1200 × 900, 240 KB'] },
  { slug: 'qr-code', name: 'QR Code Generator', description: 'Turn a link or message into a QR code.', group: 'image', icon: 'qr', status: 'ready', example: ['jacklee981229.github.io', 'A QR code, ready to scan'] },
  { slug: 'exact-time', name: "Jack's Exact Time", description: 'Check your clock, and the time around the world.', group: 'misc', icon: 'watch', status: 'ready', example: ['Your clock', 'Exact, 0.09 s ahead'] },
  { slug: 'effects', name: 'Effects', description: 'Toys to look at and play with, one after another.', group: 'misc', icon: 'pointer', status: 'ready' },
  { slug: 'build-log', name: "Jack's Build Log", description: "This site's history, replayed on a clock or a ring.", group: 'misc', icon: 'branch', status: 'ready', words: ['build log', 'commits', 'git', 'history', 'numbers', 'stats'] },
  { slug: 'writing-islands', name: "Jack's Writing Islands", description: "This site's posts as islands, carved by years of rain.", group: 'misc', icon: 'mountain', status: 'ready', words: ['islands', 'posts', 'erosion', 'landscape', 'rain'], hidden: true },
];

/**
 * Posts shown under Mini Games! on the Lab home, each played at /lab/game/<post folder>/. Their titles, descriptions
 * and covers come from the posts themselves.
 */
export const EXPERIMENTS = ['2048', 'catch-the-cat', 'snake', 'blocks'];

/**
 * Effects: things with no use at all, to look at and play with. Most follow the mouse; Key Jam answers the keyboard,
 * with sounds. All play on one page, the Effects tool's (/lab/effects/?e=<slug> opens one), each from its code in
 * src/effects/<slug>.js, with its drawing in src/components/EffectCover.astro for the Effects card. `hint` says what to
 * do. `daily: false` keeps one out of the home page's toy of the day (and the Effects card's drawing of it): Key Jam,
 * which plays sounds from the keyboard, and Magnetic Liquid, the first on the GPU, until it's been tried on phones.
 * @type {{ slug: string, name: string, description: string, hint: string, daily?: boolean }[]}
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
  { slug: 'key-jam', name: 'Key Jam', description: 'Every key plays a sound and a little show.', hint: 'Press letter keys, or tap the stage. Space changes the set. Sound on!', daily: false },
  { slug: 'magnetic-liquid', name: 'Magnetic Liquid', description: 'Black liquid that rises into spikes under a magnet.', hint: 'Move the mouse, or drag a finger. Hold down for taller spikes.', daily: false },
];

/**
 * The Little Worlds: things that run by themselves, for watching. Each is drawn by src/worlds/<slug>.js on the
 * effects' stage, at /lab/world/<slug>/; its card shows a drawing of it (src/components/WorldCover.astro), and its
 * photo, src/assets/worlds/<slug>.png, is its link previews' picture. `hint` says what there is to see or do, `icon`
 * is its card's and the palette's icon, `words` are more words the palette finds it by, `controls` are buttons of
 * its own beside Pause (its code finds each by its id), and `pan` lets it take taps and sideways drags while a finger
 * still scrolls the page up and down. `hidden`, as for a tool, keeps it off every list but its own address.
 * @type {{ slug: string, name: string, description: string, hint: string, icon: string, words: string[], controls?: { id: string, label: string }[], pan?: boolean, hidden?: boolean }[]}
 */
export const WORLDS = [
  { slug: 'town', name: "Jack's Town", description: 'A little town whose cars drive, park and come and go by themselves.', hint: "Click a car to see where it's going, or add and remove cars.", icon: 'car', words: ['traffic', 'cars'], controls: [{ id: 'add-car', label: 'Add car' }, { id: 'remove-car', label: 'Remove car' }] },
  { slug: 'trains', name: "Jack's Train World", description: 'A little railway whose trains fetch and deliver cargo by themselves.', hint: 'Click a train to follow it, or add and remove trains.', icon: 'train', words: ['railway', 'trains', 'cargo'], controls: [{ id: 'add-train', label: 'Add train' }, { id: 'remove-train', label: 'Remove train' }] },
  { slug: 'pond', name: "Jack's Pond", description: 'A clear spring pond whose koi swim by themselves.', hint: 'Just watch. Switch the site to dark for night.', icon: 'fish', words: ['koi', 'fish', 'pond', 'water'] },
  { slug: 'fireflies', name: "Jack's Firefly River", description: 'A mangrove river whose fireflies fall into step by themselves.', hint: 'Tap a steady beat and they learn it. Each lantern is a note.', icon: 'firefly', words: ['fireflies', 'river', 'mangrove', 'night', 'lanterns'], pan: true, hidden: true },
];

/** @param {string} slug */
export const toolUrl = (slug) => `/lab/${slug}/`;
/** An effect on the Effects page. @param {string} slug */
export const effectUrl = (slug) => `/lab/effects/?e=${slug}`;
/** @param {string} slug */
export const worldUrl = (slug) => `/lab/world/${slug}/`;

/** Whether a tool or a world is on the site's lists, rather than kept to its own address. @param {{ hidden?: boolean }} item */
export const isListed = (item) => !item.hidden;

/**
 * "Check these too!" under a Lab page: the same kind first, in the Lab's order, then the other kind; never the page
 * itself, and only tools that are ready and listed (the Effects page counts as a tool).
 * @param {string} current a tool's address or a game's post
 * @returns {{ kind: 'tool' | 'experiment', id: string }[]}
 */
export function moreLabItems(current, count = 4) {
  const tools = TOOLS.filter((t) => t.status === 'ready' && isListed(t) && t.slug !== current).map((t) => ({ kind: /** @type {const} */ ('tool'), id: t.slug }));
  const experiments = EXPERIMENTS.filter((id) => id !== current).map((id) => ({ kind: /** @type {const} */ ('experiment'), id }));
  return (EXPERIMENTS.includes(current) ? [experiments, tools] : [tools, experiments]).flat().slice(0, count);
}

/** @param {string} slug */
export function toolBySlug(slug) {
  const tool = TOOLS.find((t) => t.slug === slug);
  if (!tool) throw new Error(`No Lab tool "${slug}". Add it to src/lib/lab/tools.js.`);
  return tool;
}
