// The Lab's tools and experiments. The Lab home, each tool's page and the sitemap all read this list.

/** The groups on the Lab home, in order. */
export const GROUPS = [
  { id: 'text', name: 'Text' },
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
  { slug: 'jpg-to-png', name: 'JPG to PNG', description: 'Convert a photo to PNG in your browser.', group: 'image', icon: 'image', status: 'soon', example: ['photo.jpg', 'photo.png'] },
  { slug: 'resize-image', name: 'Resize Image', description: "Change an image's size, keeping its shape.", group: 'image', icon: 'resize', status: 'soon', example: ['4032 × 3024', '1200 × 900'] },
  { slug: 'compress-image', name: 'Compress Image', description: 'Make an image file smaller.', group: 'image', icon: 'compress', status: 'soon', example: ['3.2 MB', '480 KB'] },
  { slug: 'qr-code', name: 'Make a QR Code', description: 'Turn a link or message into a QR code.', group: 'image', icon: 'qr', status: 'soon', example: ['jacklee981229.github.io', 'A QR code, ready to scan'] },
];

/** Posts shown under Experiments. Their titles, descriptions and covers come from the posts themselves. */
export const EXPERIMENTS = ['game_1', 'game_2'];

/** @param {string} slug */
export const toolUrl = (slug) => `/lab/${slug}/`;

/** @param {string} slug */
export function toolBySlug(slug) {
  const tool = TOOLS.find((t) => t.slug === slug);
  if (!tool) throw new Error(`No Lab tool "${slug}". Add it to src/lib/lab/tools.js.`);
  return tool;
}
