// Draws a page's share picture (1200 by 630): its section label, title and description, and the site's name and
// address, in the dark theme's colours, read from src/styles/tokens.css so the two can't drift. satori lays the text
// out as shapes; sharp turns that into a PNG. Used at the end of the build only.
import { readFileSync } from 'node:fs';
import satori from 'satori';
import sharp from 'sharp';

export const WIDTH = 1200;
export const HEIGHT = 630;

/** A block's custom properties in tokens.css, e.g. the dark theme's. @param {string} css @param {string} selector */
export function tokensOf(css, selector) {
  const at = css.indexOf(`${selector} {`);
  if (at < 0) return {};
  const block = css.slice(css.indexOf('{', at), css.indexOf('}', at));
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

/** The colours a picture is drawn in: the dark theme's. @param {string} css */
export const paletteFor = (css) => tokensOf(css, ':root[data-theme="dark"]');

const fontsDir = new URL('../assets/share-fonts/', import.meta.url);
const font = (file) => readFileSync(new URL(file, fontsDir));
let fonts;
const loadFonts = () =>
  (fonts ??= [
    { name: 'Schibsted Grotesk', data: font('schibsted-grotesk-latin-500-normal.woff'), weight: 500, style: 'normal' },
    { name: 'Schibsted Grotesk', data: font('schibsted-grotesk-latin-800-normal.woff'), weight: 800, style: 'normal' },
    { name: 'IBM Plex Mono', data: font('ibm-plex-mono-latin-500-normal.woff'), weight: 500, style: 'normal' },
  ]);

// satori refuses an empty list of children, so a shape with none gets none.
const el = (type, style, children) => ({ type, props: { style, ...(children?.length ? { children } : {}) } });

/**
 * The PNG for one page.
 * @param {{ label: string, title: string, description: string, accent?: string }} page accent is a topic id
 * @param {string} css the text of tokens.css @param {string} host the site's address without https://
 */
export async function sharePicture(page, css, host) {
  const lab = page.label.startsWith('Lab');
  const c = paletteFor(css);
  const accent = (page.accent && c[`lane-${page.accent}`]) || (lab ? c['lane-games'] : c.focus);
  const tree = el('div', { width: WIDTH, height: HEIGHT, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '64px 80px 60px 92px', background: c.paper, color: c.ink, fontFamily: 'Schibsted Grotesk', position: 'relative' }, [
    // A stripe down the left in the section's colour.
    el('div', { position: 'absolute', left: 0, top: 0, bottom: 0, width: 12, background: accent }, []),
    el('div', { display: 'flex', alignItems: 'center', gap: 16, fontFamily: 'IBM Plex Mono', fontSize: 28, color: c.muted }, [
      el('div', { width: 18, height: 18, borderRadius: 9, background: accent }, []),
      el('div', {}, page.label),
    ]),
    el('div', { display: 'flex', flexDirection: 'column', gap: 26 }, [
      el('div', { fontSize: page.title.length > 40 ? 64 : 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.03em', display: 'block', lineClamp: 3 }, page.title),
      ...(page.description ? [el('div', { fontSize: 32, fontWeight: 500, lineHeight: 1.4, color: c.muted, display: 'block', lineClamp: 2 }, page.description)] : []),
    ]),
    el('div', { display: 'flex', alignItems: 'baseline', gap: 18, borderTop: `2px solid ${c.rule}`, paddingTop: 24 }, [
      el('div', { fontSize: 30, fontWeight: 800 }, "Jack's Space"),
      el('div', { fontFamily: 'IBM Plex Mono', fontSize: 24, color: c.muted }, host),
    ]),
  ]);
  const svg = await satori(tree, { width: WIDTH, height: HEIGHT, fonts: loadFonts() });
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}
