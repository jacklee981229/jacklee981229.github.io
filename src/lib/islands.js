// Jack's Writing Islands (/lab/writing-islands/): the posts as islands, for its page to raise and weather
// (src/islands/). Each topic with posts is an island, and each post a ridge on it, built from the post's own parts in
// order: headings as peaks, paragraphs as hills, lists as terraces, code as flat-topped buttes of hard rock, and pictures
// as hollows that fill as lakes. Worked out while the site is built, from what islands-file.js reads (the posts and their
// visits); the maps the land rises from are drawn from that in the browser, by the same code here.
// The land is a square grid, the same size on every device, so every device grows the same islands: its parts are
// sized in that grid's cells, big enough for the rain to carve (a ridge has room for six parts, a lake for water).
import { isoDay } from './dates.js';

/** The land's cells along each side, on every device. */
export const GRID = 384;
const CELL = 1 / GRID;

/** A ridge's length in cells, from the shortest post's to the longest's: a short one still has room for its parts. */
const RIDGE_MIN = 44;
const RIDGE_MAX = 80;
/** The parts a ridge is shaped from: few and large, so each is big enough to keep its shape in the rain. */
export const PARTS = 6;
/** A list's terraces: a step for every two items, up to this many, each tall enough to outlast the rain. */
const STEPS_MAX = 3;

/** What each kind of part is: how hard its rock is (code stands, prose wears away). */
export const KINDS = {
  heading: { hard: 0.8 },
  paragraph: { hard: 0.15 },
  list: { hard: 0.6 },
  code: { hard: 0.9 },
  picture: { hard: 0.2 },
};
/** The ground a ridge stands on: the island's base and the ridge's low spine. */
const SOFT = 0.3;

/** Heights, as shares of the land's width: the sea's floor, the shallows round the islands before they rise, the
 *  islands' low base, and the ridges' low spine. */
const SEA_FLOOR = -0.05;
const SHOALS = -0.02;
const BASE_TOP = 0.014;
const SPINE = 0.012;

// ---- Reading a post's parts

const FENCE = /^\s*(`{3,}|~{3,})/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*)$/;
const HTML_HEADING = /<h([1-6])\b[^>]*>(.*?)(?:<\/h[1-6]>|$)/i;
const ITEM = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/;
const PICTURE = /!\[[^\]]*\]\([^)]*\)|<img\b[^>]*>/gi;
const ONLY_PICTURE = /^\s*(?:!\[[^\]]*\]\([^)]*\)|<img\b[^>]*>)\s*$/i;

/** The words a reader sees in a line of Markdown: a link's words but not its address, no pictures, tags or marks. @param {string} text */
export function wordsIn(text) {
  const plain = text
    .replace(PICTURE, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`~|]/g, ' ');
  return plain.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

/**
 * @typedef {{ type: 'heading', level: number, words: number } | { type: 'paragraph', words: number }
 *   | { type: 'list', items: number, words: number } | { type: 'code', lines: number } | { type: 'picture' }} Block
 */

/**
 * A post's Markdown (without its front matter) read into its parts, in order: headings (Markdown's # or HTML's <h1> to
 * <h6>, with their level), paragraphs (with their words), lists (with their items and words), fenced code (with its
 * lines) and pictures (Markdown's ![]() or HTML's <img>). A list runs on over blank lines, until something else starts.
 * @param {string} markdown @returns {Block[]}
 */
export function scanBlocks(markdown) {
  /** @type {Block[]} */
  const blocks = [];
  /** @type {{ fence: string, lines: number } | null} */
  let code = null;
  /** The paragraph or list being read, which the next line may carry on. @type {any} */
  let open = null;
  const pictures = (/** @type {string} */ line) => {
    const n = line.match(PICTURE)?.length ?? 0;
    for (let i = 0; i < n; i++) blocks.push({ type: 'picture' });
    if (n) open = null;
  };
  for (const line of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    if (code) {
      if (FENCE.test(line) && line.trim().startsWith(code.fence)) {
        blocks.push({ type: 'code', lines: code.lines });
        code = null;
      } else code.lines++;
      continue;
    }
    const fence = FENCE.exec(line);
    if (fence) {
      open = null;
      code = { fence: fence[1], lines: 0 };
      continue;
    }
    const heading = HEADING.exec(line);
    const html = heading ? null : HTML_HEADING.exec(line);
    if (heading || html) {
      open = null;
      blocks.push(heading
        ? { type: 'heading', level: heading[1].length, words: wordsIn(heading[2]) }
        : { type: 'heading', level: Number(html?.[1]), words: wordsIn(html?.[2] ?? '') });
      pictures(line);
      continue;
    }
    const item = ITEM.exec(line);
    if (item) {
      if (open?.type !== 'list') {
        open = { type: 'list', items: 0, words: 0 };
        blocks.push(open);
      }
      open.items++;
      open.words += wordsIn(item[1]);
      pictures(line);
      continue;
    }
    if (!line.trim()) {
      if (open?.type === 'paragraph') open = null;
      continue;
    }
    if (ONLY_PICTURE.test(line)) {
      pictures(line);
      continue;
    }
    if (open?.type !== 'paragraph') {
      open = { type: 'paragraph', words: 0 };
      blocks.push(open);
    }
    open.words += wordsIn(line);
    if (line.match(PICTURE)) {
      // A picture inside the text: it takes its place there, and the words after it carry on the paragraph.
      const carry = open;
      pictures(line);
      open = carry;
    }
  }
  // A fence never closed: the rest of the post was code.
  if (code) blocks.push({ type: 'code', lines: code.lines });
  return blocks;
}

/** A post's parts counted up. @param {Block[]} blocks */
export function measure(blocks) {
  const m = { headings: 0, paragraphs: 0, lists: 0, items: 0, codeBlocks: 0, codeLines: 0, pictures: 0, words: 0 };
  for (const b of blocks) {
    if (b.type === 'heading') m.headings++;
    else if (b.type === 'paragraph') m.paragraphs++;
    else if (b.type === 'list') {
      m.lists++;
      m.items += b.items;
    } else if (b.type === 'code') {
      m.codeBlocks++;
      m.codeLines += b.lines;
    } else m.pictures++;
    if ('words' in b) m.words += b.words;
  }
  return m;
}

// ---- A post as a ridge

const clamp = (/** @type {number} */ x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
const smooth = (/** @type {number} */ e0, /** @type {number} */ e1, /** @type {number} */ x) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
/** Numbers kept short in the page's data: a ten-thousandth of the land's width is a fortieth of a cell. */
const short = (/** @type {number} */ x, places = 4) => Math.round(x * 10 ** places) / 10 ** places;

/** How much of its ridge a part takes, as the ridge's length counts the post: its words, a little more for a heading,
 *  a code block's lines dampened (a long listing isn't a long read), and a set share for a picture. @param {Block} b */
function weightOf(b) {
  if (b.type === 'heading') return 10 + b.words;
  if (b.type === 'paragraph') return b.words;
  if (b.type === 'list') return b.words + 3 * b.items;
  if (b.type === 'code') return 3 * b.lines ** 0.7;
  return 40;
}

/** The sizes that get the shortest and the longest ridge: one short code block, and the longest posts today. */
const SIZE_SHORT = 9;
const SIZE_LONG = 30;
/** A ridge's length in cells, as long as the post: √(words + 3 × code lines^0.7 + 40 × pictures). @param {ReturnType<typeof measure>} m */
export function ridgeCells(m) {
  const size = Math.sqrt(m.words + 3 * m.codeLines ** 0.7 + 40 * m.pictures);
  return clamp(RIDGE_MIN + ((RIDGE_MAX - RIDGE_MIN) * (size - SIZE_SHORT)) / (SIZE_LONG - SIZE_SHORT), RIDGE_MIN, RIDGE_MAX);
}

/**
 * @typedef {{ type: 'heading' | 'paragraph' | 'list' | 'code', from: number, to: number, size: number }} Part
 * `from` and `to` are shares of the ridge (0 at its start); `size` is in the part's own units: a heading's level (the
 * biggest one in it), a paragraph's words, a list's items, a code block's lines.
 */

/**
 * A post's parts along its ridge. The post is cut into PARTS equal shares (as weightOf counts it); each share takes the
 * shape of the kind of part that fills most of it, and shares filled most by the same part of the post make one (a single
 * long code block is a single butte). Each picture is a hollow of its own, where it comes in the post.
 * @param {Block[]} blocks @returns {{ parts: Part[], pictures: number[] }}
 */
export function partsOf(blocks) {
  const weights = blocks.map(weightOf);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let at = 0;
  const spans = blocks.map((b, i) => {
    const from = at / total;
    at += weights[i];
    return { b, i, from, to: at / total };
  });
  const pictures = spans.filter((s) => s.b.type === 'picture').map((s) => short((s.from + s.to) / 2, 3));
  /** @type {(Part & { block: number })[]} */
  const parts = [];
  for (let k = 0; k < PARTS; k++) {
    const lo = k / PARTS;
    const hi = (k + 1) / PARTS;
    /** @type {Record<string, number>} */
    const byKind = {};
    let main = -1;
    let mainShare = 0;
    for (const s of spans) {
      const share = Math.min(hi, s.to) - Math.max(lo, s.from);
      if (share <= 0 || s.b.type === 'picture') continue;
      byKind[s.b.type] = (byKind[s.b.type] ?? 0) + share;
      if (share > mainShare) {
        mainShare = share;
        main = s.i;
      }
    }
    // A share that's only pictures stays the ridge's low spine.
    const kinds = Object.entries(byKind).sort((a, b) => b[1] - a[1]);
    if (!kinds.length) continue;
    const type = /** @type {Part['type']} */ (kinds[0][0]);
    // The part of the post filling most of the share, among those of its kind.
    let block = main;
    if (blocks[main].type !== type) {
      let best = 0;
      for (const s of spans) {
        const share = Math.min(hi, s.to) - Math.max(lo, s.from);
        if (s.b.type === type && share > best) {
          best = share;
          block = s.i;
        }
      }
    }
    // Its size, in its kind's units: each block of the kind counted for the share of it that falls here.
    let size = type === 'heading' ? 6 : 0;
    for (const s of spans) {
      const share = Math.min(hi, s.to) - Math.max(lo, s.from);
      if (share <= 0 || s.b.type !== type) continue;
      const part = share / Math.max(1e-9, s.to - s.from);
      const b = s.b;
      if (b.type === 'heading') size = Math.min(size, b.level);
      else if (b.type === 'paragraph' || b.type === 'list') size += (b.type === 'list' ? b.items : b.words) * part;
      else if (b.type === 'code') size += b.lines * part;
    }
    const last = parts[parts.length - 1];
    if (last && last.block === block && last.to === lo) {
      last.to = hi;
      last.size = type === 'heading' ? Math.min(last.size, size) : last.size + size;
    } else parts.push({ type, from: lo, to: hi, size, block });
  }
  return { parts: parts.map(({ type, from, to, size }) => ({ type, from: short(from, 3), to: short(to, 3), size: short(size, 2) })), pictures };
}

// ---- Noise that's the same everywhere: the land's small irregularities, from integer hashing alone

/** A number from 0 to 1 for a corner of the noise's grid. @param {number} x @param {number} y @param {number} seed */
function hash(x, y, seed) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** Smooth noise from −1 to 1. @param {number} x @param {number} y @param {number} seed */
function noise(x, y, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const u = x - xi;
  const v = y - yi;
  const su = u * u * (3 - 2 * u);
  const sv = v * v * (3 - 2 * v);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return (a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv) * 2 - 1;
}
/** Noise at a few scales, the larger ones stronger. @param {number} x @param {number} y @param {number} seed */
function fbm(x, y, seed, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * f, y * f, seed + i * 31);
    f *= 2.03;
    amp *= 0.5;
  }
  return sum;
}
/** A post's own seed, from its address. @param {string} id */
const seedOf = (id) => [...id].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261) >>> 0;

// ---- The islands: where each topic's island lies, and each post's ridge on it. Positions are shares of the land's
// width, x to the right and z towards the camera's usual place, so the back of the land is z = 0.

/** Coasts keep this far from the land's edge, so the shallows round them stay on the land's grid. */
const EDGE = 0.07;
/** Sea between two islands' coasts, at the least. */
const GAP = 0.045;
/** Land beyond a ridge's foot before the coast, and the shallows beyond the coast before the deep sea. */
const COAST = 0.024;
const SHELF = 0.07;
/** A hollow's lake: its radius and depth, and the shelf it's dug into, which holds its water on a slope. */
const LAKE = 5.5 * CELL;
const LAKE_DEPTH = 0.009;
const LAKE_SHELF = 2.1;
/** A lake's brim stands at least this far above the sea when it's dug. */
const LAKE_ABOVE = 0.02;
/** Days a ridge takes to rise from its start to its end, so it heaves up the way the post was written. */
const SWEEP = 8;

/** A ridge's half width: a longer ridge stands a little wider. @param {number} cells */
const halfWidth = (cells) => (11 + 0.08 * cells) * CELL;

/** How tall a part stands (shares of the land's width), how wide across its ridge (shares of the ridge's half
 *  width), and a list's terraces. @param {Part} part */
function shapeOf(part) {
  if (part.type === 'heading') return { height: [0.06, 0.055, 0.05, 0.046, 0.043, 0.04][Math.max(1, Math.min(6, part.size)) - 1], across: 0.85, steps: 0 };
  if (part.type === 'paragraph') return { height: Math.min(0.034, 0.013 + 0.0013 * Math.sqrt(part.size)), across: 1.05, steps: 0 };
  if (part.type === 'list') {
    // Few tall steps rather than many low ones: a step lower than a few cells would be worn smooth.
    const steps = Math.max(2, Math.min(STEPS_MAX, Math.round(part.size / 2)));
    return { height: 0.03 + 0.002 * steps, across: 1.15, steps };
  }
  return { height: 0.018 + 0.0042 * Math.log(1 + part.size), across: 0.9, steps: 0 };
}

/**
 * @typedef {{ id: string, title: string, date: Date, topic: string, featured?: boolean, body: string, url: string }} PostIn
 * @typedef {{ id: string, name: string, legacy?: string }} TopicIn
 */

/** A quadratic curve's point at t. @param {number[]} p [x0, z0, x1, z1, x2, z2] @param {number} t */
const along = (p, t) => {
  const a = (1 - t) * (1 - t);
  const b = 2 * (1 - t) * t;
  const c = t * t;
  return [a * p[0] + b * p[2] + c * p[4], a * p[1] + b * p[3] + c * p[5]];
};

/**
 * Each post's ridge on its island, around the island's middle: a single post's along the island, two side by side
 * and a little apart, more of them out from the middle like spokes, the first at the back and the rest round clockwise
 * in the order they were written. A ridge runs from the post's start to its end, left to right where it can, with a
 * small bend of its own.
 * @param {{ cells: number, seed: number }[]} ridges in the order written @param {number} turn which way the island's
 * ridges lean, so neighbours differ @returns {number[][]} each ridge's curve, [x0, z0, x1, z1, x2, z2]
 */
function ridgesAround(ridges, turn) {
  const n = ridges.length;
  return ridges.map((r, i) => {
    const length = r.cells * CELL;
    const width = halfWidth(r.cells);
    let x0;
    let z0;
    let angle;
    if (n <= 2) {
      angle = 0.3 * turn;
      const across = n === 1 ? 0 : (i === 0 ? -1 : 1) * width * 1.2;
      const ahead = n === 1 ? 0 : (i === 0 ? -1 : 1) * length * 0.16;
      x0 = -Math.sin(angle) * across + Math.cos(angle) * (ahead - length / 2);
      z0 = Math.cos(angle) * across + Math.sin(angle) * (ahead - length / 2);
    } else {
      angle = -Math.PI / 2 - Math.PI / n + (i * 2 * Math.PI) / n;
      const from = width * 0.3;
      x0 = Math.cos(angle) * from;
      z0 = Math.sin(angle) * from;
    }
    const x2 = x0 + Math.cos(angle) * length;
    const z2 = z0 + Math.sin(angle) * length;
    const bend = (hash(r.seed, 7, 3) - 0.5) * 0.24 * length;
    return [x0, z0, (x0 + x2) / 2 - Math.sin(angle) * bend, (z0 + z2) / 2 + Math.cos(angle) * bend, x2, z2];
  });
}

/**
 * Where the islands lie: the legacy topics' at the back, the others round the front in the topics' order, left to
 * right, then pushed apart until there's sea between every two and each keeps clear of the land's edge. The big
 * legacy island moves least. The same input always comes out the same.
 * @param {{ legacy: boolean, points: number[][] }[]} islands each one's outline as points round its middle, [x, z, radius]
 * @returns {number[][]} each island's middle
 */
function placeIslands(islands) {
  const reach = islands.map((island) => Math.max(...island.points.map(([x, z, r]) => Math.hypot(x, z) + r)));
  const back = islands.map((_, i) => i).filter((i) => islands[i].legacy);
  const front = islands.map((_, i) => i).filter((i) => !islands[i].legacy);
  /** @type {number[][]} */
  const at = islands.map(() => [0.5, 0.5]);
  back.forEach((i, k) => {
    at[i] = [(k + 0.5) / back.length, EDGE + reach[i] * 0.8];
  });
  const middle = back.length ? [0.5, at[back[0]][1]] : [0.5, 0.35];
  const around = back.length ? Math.max(...back.map((i) => reach[i])) : 0;
  front.forEach((i, k) => {
    const angle = ((front.length === 1 ? 90 : 160 - (k * 140) / (front.length - 1)) * Math.PI) / 180;
    const out = around + GAP + reach[i] * 0.7;
    at[i] = [middle[0] + Math.cos(angle) * out, middle[1] + Math.sin(angle) * out * 0.9];
  });
  const keepIn = () => {
    islands.forEach((island, i) => {
      let lo = [Infinity, Infinity];
      let hi = [-Infinity, -Infinity];
      for (const [x, z, r] of island.points) {
        lo = [Math.min(lo[0], at[i][0] + x - r), Math.min(lo[1], at[i][1] + z - r)];
        hi = [Math.max(hi[0], at[i][0] + x + r), Math.max(hi[1], at[i][1] + z + r)];
      }
      for (const k of [0, 1]) {
        if (hi[k] - lo[k] > 1 - 2 * EDGE) at[i][k] += 0.5 - (lo[k] + hi[k]) / 2;
        else if (lo[k] < EDGE) at[i][k] += EDGE - lo[k];
        else if (hi[k] > 1 - EDGE) at[i][k] -= hi[k] - (1 - EDGE);
      }
    });
  };
  keepIn();
  for (let round = 0; round < 300; round++) {
    for (let a = 0; a < islands.length; a++) {
      for (let b = a + 1; b < islands.length; b++) {
        let nearest = Infinity;
        let dx = 0;
        let dz = 0;
        for (const [px, pz, pr] of islands[a].points) {
          for (const [qx, qz, qr] of islands[b].points) {
            const ex = at[b][0] + qx - (at[a][0] + px);
            const ez = at[b][1] + qz - (at[a][1] + pz);
            const d = Math.hypot(ex, ez) - pr - qr;
            if (d < nearest) {
              nearest = d;
              dx = ex;
              dz = ez;
            }
          }
        }
        if (nearest >= GAP) continue;
        const length = Math.hypot(dx, dz) || 1;
        const push = (GAP - nearest) * 0.5;
        const share = islands[a].legacy === islands[b].legacy ? 0.5 : islands[a].legacy ? 0.15 : 0.85;
        at[a][0] -= (dx / length) * push * share;
        at[a][1] -= (dz / length) * push * share;
        at[b][0] += (dx / length) * push * (1 - share);
        at[b][1] += (dz / length) * push * (1 - share);
      }
    }
    keepIn();
  }
  return at;
}

/** Whole days and the share of a day from `start` (ms) to `date`. @param {Date} date @param {number} start */
const dayOf = (date, start) => (date.getTime() - start) / 86400000;

/**
 * The islands, worked out from the posts that are listed: one island per topic with posts (the legacy topics' at the
 * back), one ridge per post with its parts, hollows, rise day and greenness, and the counts for the legend. `visits`
 * is each post's address's visits (null when they couldn't be had: then every post is a little green); `today` the
 * build's day in Malaysia, YYYY-MM-DD, where the replay ends.
 * @param {{ posts: PostIn[], topics: TopicIn[], visits: Map<string, number> | null, today: string }} input
 */
export function islandsOf({ posts, topics, visits, today }) {
  const written = [...posts].sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id));
  const first = written[0]?.date ?? new Date(`${today}T00:00:00+08:00`);
  const fromDay = isoDay(first);
  const start = Date.parse(`${fromDay}T00:00:00+08:00`);
  const days = Math.max(1, Math.round((Date.parse(`${today}T00:00:00+08:00`) - start) / 86400000));
  const read = written.map((p) => visits?.get(p.url) ?? 0);
  const most = Math.max(0, ...read);
  const counts = { posts: written.length, islands: 0, headings: 0, paragraphs: 0, items: 0, codeLines: 0, pictures: 0, read: visits ? read.filter((v) => v > 0).length : 0 };

  const shaped = written.map((post, k) => {
    const blocks = scanBlocks(post.body);
    const m = measure(blocks);
    counts.headings += m.headings;
    counts.paragraphs += m.paragraphs;
    counts.items += m.items;
    counts.codeLines += m.codeLines;
    counts.pictures += m.pictures;
    const { parts, pictures } = partsOf(blocks);
    return { post, m, parts, pictures, cells: ridgeCells(m), seed: seedOf(post.id), green: visits ? (most ? Math.log(1 + read[k]) / Math.log(1 + most) : 0) : -1 };
  });

  const withPosts = topics.filter((t) => shaped.some((s) => s.post.topic === t.id));
  counts.islands = withPosts.length;
  const groups = withPosts.map((topic, t) => {
    const members = shaped.filter((s) => s.post.topic === topic.id);
    const curves = ridgesAround(members, t % 2 ? 1 : -1);
    // The island's outline, for keeping islands apart: points along each ridge, as far out as its coast.
    const points = curves.flatMap((curve, i) => Array.from({ length: 9 }, (_, j) => [...along(curve, j / 8), halfWidth(members[i].cells) + COAST]));
    if (members.length > 2) points.push([0, 0, halfWidth(RIDGE_MIN) * 1.6 + COAST]);
    return { topic, members, curves, points, legacy: Boolean(topic.legacy) };
  });
  const middles = placeIslands(groups);

  const islands = groups.map((g, i) => ({
    topic: g.topic.id,
    name: g.topic.name,
    legacy: g.legacy,
    x: short(middles[i][0]),
    z: short(middles[i][1]),
    // The island's base rises a few days before its first post's ridge, so the ridge has land to stand on.
    rise: short(Math.max(0, dayOf(g.members[0].post.date, start) - 3), 3),
    core: g.members.length > 2 ? short(halfWidth(RIDGE_MIN) * 1.6) : 0,
  }));
  const ridges = groups.flatMap((g, i) => g.members.map((s, j) => {
    const curve = g.curves[j].map((v, k) => short(v + middles[i][k % 2]));
    const width = halfWidth(s.cells);
    // Hollows sit on the ridge's flanks, side to side in turn, starting on the side facing the camera.
    const facing = curve[4] >= curve[0] ? 1 : -1;
    return {
      id: s.post.id,
      title: s.post.title,
      url: s.post.url,
      date: isoDay(s.post.date),
      day: short(dayOf(s.post.date, start), 3),
      island: i,
      featured: Boolean(s.post.featured),
      green: short(s.green, 3),
      size: { words: s.m.words, code: s.m.codeLines, pictures: s.m.pictures },
      curve,
      width: short(width),
      cells: short(s.cells, 1),
      parts: s.parts.map((p) => {
        const shape = shapeOf(p);
        return [p.type, p.from, p.to, short(shape.height), shape.across, shape.steps];
      }),
      hollows: s.pictures.map((share, k) => [share, (k % 2 ? -1 : 1) * facing]),
    };
  }));
  return { grid: GRID, from: fromDay, to: today, days, visits: Boolean(visits), islands, ridges, counts };
}

/** @typedef {ReturnType<typeof islandsOf>} Islands */

/** How each kind of part rises along its ridge (`a`: its middle at 0, its ends at ±1) and falls away across it (`b`:
 *  the crest at 0, the foot at 1), as shares of its height: a heading's summit is sharp and its flanks hollow, a
 *  paragraph's hill round all over, a code block's butte flat on top with cliffs all round. A list's terraces are its
 *  flanks cut into steps, benches running the length of it. @type {Record<string, { along: (a: number) => number, across: (b: number) => number }>} */
const PROFILES = {
  heading: { along: (a) => (Math.abs(a) < 1.5 ? (1 - Math.abs(a) / 1.5) ** 1.6 : 0), across: (b) => (b < 1 ? (1 - b) ** 1.5 : 0) },
  paragraph: { along: (a) => (Math.abs(a) < 2.5 ? (1 - (a / 2.5) ** 2) ** 2 : 0), across: (b) => (b < 1.15 ? (1 - (b / 1.15) ** 2) ** 2 : 0) },
  list: { along: (a) => 1 - smooth(1.05, 1.45, Math.abs(a)), across: (b) => (b < 1.1 ? (1 - (b / 1.1) ** 2) ** 1.1 : 0) },
  code: {
    along: (a) => 1 - smooth(0.9, 1.12, Math.abs(a)),
    across: (b) => 1 - smooth(0.6, 0.86, b) + 0.14 * (smooth(0.6, 0.86, b) - smooth(0.86, 1.35, b)),
  },
};

/**
 * The maps the land rises from, one value per cell of the grid (row by row, from the back), worked out a little at a
 * time: it yields between pieces of the work, so a page can spread it over a few frames, and returns the maps. `lift`
 * holds, per cell, how far the shallows rise from the sea floor (at the start), how far the island's land rises from
 * them (on the island's `rise` day), how far the ridges rise above that (below it in a hollow), and the day the ridge
 * here starts rising; `ground` how hard the rock is, which post (1 onwards, 0 for none), how much of a lake, and which
 * island (1 onwards), each out of 255. The sea floor is `seaFloor`, under the sea at 0.
 * @param {Islands} data
 * @returns {Generator<void, { lift: Float32Array, ground: Uint8Array, hollow: Float32Array, seaFloor: number }>}
 */
export function* stampMaps(data) {
  const N = data.grid;
  /** Each cell's distance to the coast (below 0 inland), rounded off where two coasts meet; and to the nearest
   *  island's own coast, and which island that is. */
  const coast = new Float32Array(N * N).fill(1);
  const nearest = new Float32Array(N * N).fill(1);
  const islandAt = new Int16Array(N * N).fill(-1);
  const ridgeH = new Float32Array(N * N);
  const ridgeAt = new Int16Array(N * N).fill(-1);
  const hard = new Float32Array(N * N).fill(SOFT);
  const riseAt = new Float32Array(N * N);
  /** Where a list's terraces are: their walls hold their steps up (erosion.js). */
  const terraced = new Uint8Array(N * N);
  const cellX = (/** @type {number} */ i) => (i + 0.5) / N;
  /** The nearer of two coasts, rounded off where they meet, so neither the land nor the shallows have a crease there. */
  const blend = (/** @type {number} */ a, /** @type {number} */ b) => {
    const k = 0.03;
    const h = clamp(0.5 + (0.5 * (b - a)) / k);
    return b + (a - b) * h - k * h * (1 - h);
  };
  /** Visits every cell in a box, given in shares of the land. @param {number} x0 @param {number} z0 @param {number} x1 @param {number} z1 @param {(cell: number, x: number, z: number) => void} visit */
  const box = (x0, z0, x1, z1, visit) => {
    const i0 = Math.max(0, Math.floor(x0 * N));
    const i1 = Math.min(N - 1, Math.ceil(x1 * N));
    const j0 = Math.max(0, Math.floor(z0 * N));
    const j1 = Math.min(N - 1, Math.ceil(z1 * N));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) visit(j * N + i, cellX(i), cellX(j));
  };

  for (let r = 0; r < data.ridges.length; r++) {
    const ridge = data.ridges[r];
    const { curve, width: W, island } = ridge;
    const seed = seedOf(ridge.id);
    // The curve as a few straight pieces, enough for its gentle bend.
    const STEPS = 16;
    const pts = Array.from({ length: STEPS + 1 }, (_, k) => along(curve, k / STEPS));
    const seg = pts.slice(1).map((p, k) => Math.hypot(p[0] - pts[k][0], p[1] - pts[k][1]));
    const length = seg.reduce((a, b) => a + b, 0);
    const reach = W + COAST + SHELF + 0.045;
    const parts = ridge.parts.map(([type, from, to, height, across, steps]) => ({ type, middle: (from + to) / 2, half: (to - from) / 2, height, across, steps, hard: KINDS[/** @type {keyof typeof KINDS} */ (type)].hard, profile: PROFILES[type] }));
    const xs = pts.map((p) => p[0]);
    const zs = pts.map((p) => p[1]);
    // The curve's chord, and how far the curve bows from it: cells farther than that from the chord can be passed by.
    const [cx0, cz0] = pts[0];
    const chordX = pts[STEPS][0] - cx0;
    const chordZ = pts[STEPS][1] - cz0;
    const chord = Math.hypot(chordX, chordZ) || 1;
    const bow = Math.max(...pts.map(([px, pz]) => Math.abs(chordX * (pz - cz0) - chordZ * (px - cx0)) / chord));
    const i0 = Math.max(0, Math.floor((Math.min(...xs) - reach) * N));
    const i1 = Math.min(N - 1, Math.ceil((Math.max(...xs) + reach) * N));
    const j0 = Math.max(0, Math.floor((Math.min(...zs) - reach) * N));
    const j1 = Math.min(N - 1, Math.ceil((Math.max(...zs) + reach) * N));
    // The work a few rows at a time (in a plain function, which runs far faster than a generator's own loop), so no
    // frame waits long for the rest.
    const rows = (/** @type {number} */ from, /** @type {number} */ to) => {
      for (let j = from; j <= to; j++) {
        for (let i = i0; i <= i1; i++) {
          const cell = j * N + i;
          const x = cellX(i);
          const z = cellX(j);
          const along0 = clamp(((x - cx0) * chordX + (z - cz0) * chordZ) / (chord * chord));
          if (Math.hypot(x - cx0 - chordX * along0, z - cz0 - chordZ * along0) - bow > reach) continue;
          // The nearest point on the curve: how far along it (counting on past its ends), and how far to which side.
          let best = Infinity;
          let s = 0;
          let side = 0;
          let travelled = 0;
          for (let k = 0; k < STEPS; k++) {
            const [ax, az] = pts[k];
            const ex = pts[k + 1][0] - ax;
            const ez = pts[k + 1][1] - az;
            const t = ((x - ax) * ex + (z - az) * ez) / (seg[k] * seg[k] || 1);
            const tc = clamp(t);
            const d = Math.hypot(x - ax - ex * tc, z - az - ez * tc);
            if (d < best) {
              best = d;
              s = (travelled + ((k === 0 && t < 0) || (k === STEPS - 1 && t > 1) ? t : tc) * seg[k]) / length;
              side = ex * (z - az) - ez * (x - ax) < 0 ? -d : d;
            }
            travelled += seg[k];
          }
          if (best - W - COAST < nearest[cell]) {
            nearest[cell] = best - W - COAST;
            islandAt[cell] = island;
          }
          coast[cell] = blend(coast[cell], best - W - COAST);
          if (best > W * 2.2) continue;
          // The crest wanders a little from side to side, and the ridge swells and narrows, as real ones do.
          const u = side - W * 0.22 * noise(s * 7, 1.3, seed);
          const swell = 1 + 0.14 * noise(s * 9, 4.1, seed);
          const ends = smooth(-0.14, 0.05, s) * smooth(1.14, 0.95, s);
          let h = SPINE * ends * PROFILES.paragraph.across(Math.abs(u) / (W * 1.3 * swell));
          let kindHard = SOFT;
          let stepped = false;
          for (const p of parts) {
            const g = p.profile.along((s - p.middle) / p.half);
            if (g <= 0) continue;
            const b = Math.abs(u) / (W * p.across * swell);
            let f;
            if (p.type === 'list') {
              // The hill's height in steps: flat treads with short steep risers between.
              const level = g * PROFILES.list.across(b) * p.steps;
              const step = Math.floor(level);
              f = Math.min(1, (step + smooth(0.82, 1, level - step)) / p.steps) / Math.max(g, 1e-6);
            } else f = p.profile.across(b);
            const v = p.height * g * f * (1 + 0.09 * noise(x * 55, z * 55, seed + 1));
            if (v > h) {
              h = v;
              // A part's own rock makes its upper body; its lower slopes are the soft ground it stands on.
              kindHard = SOFT + (p.hard - SOFT) * smooth(0.12, 0.4, v / p.height);
              stepped = p.type === 'list' && v > p.height * 0.1;
            }
          }
          if (h > ridgeH[cell]) {
            ridgeH[cell] = h;
            ridgeAt[cell] = r;
            hard[cell] = kindHard;
            riseAt[cell] = ridge.day + clamp(s) * SWEEP;
            terraced[cell] = stepped ? 1 : 0;
          }
        }
      }
    };
    for (let j = j0; j <= j1; j += 16) {
      rows(j, Math.min(j1, j + 15));
      yield;
    }
  }

  // The middles of the islands with many posts, where their spokes meet.
  data.islands.forEach((island, i) => {
    if (!island.core) return;
    const reach = island.core + COAST + SHELF + 0.03;
    box(island.x - reach, island.z - reach, island.x + reach, island.z + reach, (cell, x, z) => {
      const d = Math.hypot(x - island.x, z - island.z) - island.core - COAST;
      if (d < nearest[cell]) {
        nearest[cell] = d;
        islandAt[cell] = i;
      }
      coast[cell] = blend(coast[cell], d);
    });
  });

  // The base: land rising gently from each coast, a ragged one, and the shallows falling away to the sea floor; an
  // island of many posts domes up in the middle, where its spokes meet, so its rain runs out to the sea.
  const base = new Float32Array(N * N).fill(SEA_FLOOR);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const cell = j * N + i;
      const isle = islandAt[cell];
      if (isle < 0 || coast[cell] > SHELF + 0.04) continue;
      const x = cellX(i);
      const z = cellX(j);
      const d = coast[cell] + fbm(x * 6, z * 6, 13, 3) * 0.03 + fbm(x * 24, z * 24, 18, 2) * 0.008;
      const island = data.islands[isle];
      const dome = island.core ? 0.022 * Math.max(0, 1 - Math.hypot(x - island.x, z - island.z) / (island.core * 2.2)) ** 2 : 0;
      base[cell] = d < 0
        ? BASE_TOP * smooth(0, -0.05, d) + Math.max(0, -d - 0.02) * 0.05 + dome + 0.0016 * fbm(x * 48, z * 48, 22, 3)
        : SEA_FLOOR * smooth(0, SHELF, d);
    }
    if (j % 64 === 63) yield;
  }

  // The hollows: a shelf cut level into the slope, and a bowl dug into that, so its lake holds water on any slope. Each
  // sits low on its ridge's flank, as high up it as it must to be well clear of the sea. The weather keeps it a lake
  // as the land round it wears down (erosion.js), from where each of its cells lies in it: `hollow` holds, per cell
  // of a lake, the way to the lake's middle (in cells), its radius (in cells) and its depth; elsewhere, 1 where a
  // list's terraces are walled.
  const lake = new Float32Array(N * N);
  const hollow = new Float32Array(N * N * 4);
  const surfaceAt = (/** @type {number} */ x, /** @type {number} */ z) => {
    const cell = Math.min(N - 1, Math.max(0, Math.round(z * N - 0.5))) * N + Math.min(N - 1, Math.max(0, Math.round(x * N - 0.5)));
    return base[cell] + ridgeH[cell];
  };
  data.ridges.forEach((ridge, r) => {
    for (const [share, side] of ridge.hollows) {
      const [cx, cz] = along(ridge.curve, share);
      const [ax, az] = along(ridge.curve, Math.max(0, share - 0.01));
      const [bx, bz] = along(ridge.curve, Math.min(1, share + 0.01));
      const tl = Math.hypot(bx - ax, bz - az) || 1;
      const outer = LAKE * LAKE_SHELF;
      // The lowest ground round a spot: a lake there is cut into the slope down to it, like a cirque, never dammed up
      // above it.
      const lowest = (/** @type {number} */ x, /** @type {number} */ z) => Math.min(...Array.from({ length: 16 }, (_, k) => surfaceAt(x + Math.cos((k * Math.PI) / 8) * outer, z + Math.sin((k * Math.PI) / 8) * outer)));
      let out = 1.02;
      const spot = () => [cx - ((bz - az) / tl) * side * ridge.width * out, cz + ((bx - ax) / tl) * side * ridge.width * out];
      while (out > 0.3 && lowest(spot()[0], spot()[1]) < LAKE_ABOVE) out -= 0.06;
      const [hx, hz] = spot();
      const level = Math.max(lowest(hx, hz), LAKE_ABOVE);
      box(hx - outer, hz - outer, hx + outer, hz + outer, (cell, x, z) => {
        const dist = Math.hypot(x - hx, z - hz);
        if (dist > outer) return;
        const flat = smooth(outer, LAKE * 1.05, dist);
        const surface = base[cell] + ridgeH[cell];
        const bowl = dist < LAKE ? (1 - (dist / LAKE) ** 2) ** 1.4 : 0;
        ridgeH[cell] += (level - surface) * flat - LAKE_DEPTH * bowl;
        ridgeAt[cell] = r;
        riseAt[cell] = ridge.day + share * SWEEP;
        lake[cell] = Math.max(lake[cell], smooth(LAKE * 1.05, LAKE * 0.7, dist));
        if (dist < LAKE * 1.05) hollow.set([(hx - x) * N, (hz - z) * N, LAKE * N, LAKE_DEPTH], cell * 4);
        hard[cell] = dist < LAKE * 0.95 ? KINDS.picture.hard : hard[cell];
      });
    }
  });

  for (let cell = 0; cell < N * N; cell++) if (terraced[cell] && hollow[cell * 4 + 2] === 0) hollow[cell * 4 + 3] = 1;
  yield;
  const lift = new Float32Array(N * N * 4);
  const ground = new Uint8Array(N * N * 4);
  for (let cell = 0; cell < N * N; cell++) {
    if (cell % (N * 96) === N * 96 - 1) yield;
    const isle = islandAt[cell];
    // The shallows all rise at the start, so where two islands' shallows meet the sea floor never has a step in it;
    // each island's land rises from them on its own day.
    const shoal = Math.min(base[cell], SHOALS);
    lift[cell * 4] = shoal - SEA_FLOOR;
    lift[cell * 4 + 1] = base[cell] - shoal;
    lift[cell * 4 + 2] = ridgeH[cell];
    lift[cell * 4 + 3] = ridgeAt[cell] >= 0 ? riseAt[cell] : 0;
    ground[cell * 4] = Math.round(clamp(hard[cell]) * 255);
    ground[cell * 4 + 1] = ridgeAt[cell] + 1;
    ground[cell * 4 + 2] = Math.round(clamp(lake[cell]) * 255);
    ground[cell * 4 + 3] = isle + 1;
  }
  return { lift, ground, hollow, seaFloor: SEA_FLOOR };
}

