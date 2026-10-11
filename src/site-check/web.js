// Jack's Site Check, drawn on the effects' stage (src/effects/stage.js), which runs it only while it's on screen and not
// paused: this site crawled live (src/lib/site-check.js), as a spider on an irregular orb web leaning back about 30°.
// The spider lowers itself onto the hub, then walks the threads (never straight across) from page to page as the crawl
// reads them; each page is a little knot of silk on a crossing, found pages faint, read ones in their part's colour.
// Every new link runs along the threads as light: to another page of the site, out along an anchor line for an outside
// one (it leaves a bead there), and a broken one snaps the thread into its crossing. Landings and snaps send a wave
// through the silk; a band of light sweeps over it; its shadow falls on the wall behind. Around it the numbers: the page
// being read as source, the three routes, the parts, the link stream and the rest. In the page's colours (its --c1
// onward, site-check.astro), glowing in the dark, drawn plainly by day.
import { crawl, partOfPage } from '../lib/site-check.js';

/** The card's own units: a landscape screen as wide as the page, or a tall one on a phone. */
const WIDE = { w: 1136, h: 640 };
const TALL = { w: 440, h: 550 };
const PARTS = ['home', 'writing', 'lab', 'collection', 'travel', 'about'];
/** Seconds the spider takes to lower itself onto the hub before the first page. */
const INTRO = 1;
/** The web: spokes, rings of capture thread (the last is the frame), and its size in its own plane. */
const K = 15;
const M = 14;
const RX = 265;
const RY = 176;
/** How far the web leans back (radians, about 30°) and turns to the left, and how far the eye is. */
const PITCH = 0.52;
const YAW = -0.22;
const EYE = 620;
/** Once the check is done: seconds before the first watching wave, and between them. */
const MONITOR_FROM = 2.5;
const MONITOR_EVERY = 5;
/** Seconds the spider rests between its slow strolls once the check is done. */
const STROLL_REST = 5;
/** The wall behind the web, as far behind its middle as this. */
const WALL = 170;
const TAU = Math.PI * 2;
const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
const ease = (u) => (1 - Math.cos(Math.PI * clamp(u))) / 2;

/** Numbers that look random but are the same on every visit. @param {number} seed */
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The web in its own plane (x right, y down, its middle at 0, 0): irregular spokes, capture threads sagging towards
 * the hub between them, a few torn, the frame and the anchor lines out to where it holds on, and dew strung along it.
 * Its crossings are where pages sit, and its threads the only ways along it.
 */
function makeWeb() {
  const rand = seeded(20261011);
  const spokeAng = [];
  for (let s = 0; s < K; s++) spokeAng.push(((s + (rand() - 0.5) * 0.75) / K) * TAU - Math.PI / 2);
  spokeAng.sort((a, b) => a - b);
  const frameR = (a) => 1 / Math.sqrt((Math.cos(a) / RX) ** 2 + (Math.sin(a) / RY) ** 2);
  const spokeLen = spokeAng.map((a) => frameR(a) * (0.78 + rand() * 0.22));
  const frac = (j) => 0.07 + 0.93 * ((j - 1) / (M - 1)) ** 1.3;
  const nodes = [{ x: 0, y: 0, j: 0, s: 0 }];
  const id = (j, s) => 1 + (j - 1) * K + (((s % K) + K) % K);
  for (let j = 1; j <= M; j++) for (let s = 0; s < K; s++) {
    const f = j === M ? 1 : frac(j) * (1 + (rand() - 0.5) * 0.09);
    nodes.push({ x: Math.cos(spokeAng[s]) * spokeLen[s] * f, y: Math.sin(spokeAng[s]) * spokeLen[s] * f, j, s });
  }
  const anchor = nodes.length;
  for (let s = 0; s < K; s++) {
    const a = spokeAng[s] + (rand() - 0.5) * 0.3;
    const L = spokeLen[s] + 30 + rand() * 50;
    nodes.push({ x: Math.cos(a) * L, y: Math.sin(a) * L, j: M + 1, s });
  }
  /** @type {{ i: number, a: number, b: number, kind: string, pts: { x: number, y: number }[], len: number }[]} */
  const edges = [];
  /** @type {typeof edges[]} */
  const adj = nodes.map(() => []);
  const addEdge = (a, b, kind, sag) => {
    const A = nodes[a];
    const B = nodes[b];
    const n = kind === 'spoke' || kind === 'anchor' ? 3 : 7;
    const mx = ((A.x + B.x) / 2) * (1 - sag);
    const my = ((A.y + B.y) / 2) * (1 - sag);
    const pts = [];
    for (let k = 0; k <= n; k++) {
      const u = k / n;
      pts.push({ x: (1 - u) ** 2 * A.x + 2 * (1 - u) * u * mx + u * u * B.x, y: (1 - u) ** 2 * A.y + 2 * (1 - u) * u * my + u * u * B.y });
    }
    let len = 0;
    for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
    const e = { i: edges.length, a, b, kind, pts, len };
    edges.push(e);
    adj[a].push(e);
    adj[b].push(e);
  };
  for (let s = 0; s < K; s++) {
    addEdge(0, id(1, s), 'spoke', 0);
    for (let j = 1; j < M; j++) addEdge(id(j, s), id(j + 1, s), 'spoke', 0);
    addEdge(id(M, s), anchor + s, 'anchor', 0);
  }
  for (let j = 1; j <= M; j++) for (let s = 0; s < K; s++) {
    if (j > 6 && j < M && rand() < 0.06) continue; // a few torn threads
    addEdge(id(j, s), id(j, s + 1), j === M ? 'frame' : 'ring', j === M ? 0.025 : 0.045 + rand() * 0.06);
  }
  const dew = [];
  for (const e of edges) {
    if (e.kind !== 'ring') continue;
    const n = Math.floor(e.len / 7);
    for (let k = 1; k < n; k++) {
      const u = (k + (rand() - 0.5) * 0.6) / n;
      const x = u * (e.pts.length - 1);
      const q = Math.min(e.pts.length - 2, Math.floor(x));
      const w = x - q;
      dew.push({ x: e.pts[q].x + (e.pts[q + 1].x - e.pts[q].x) * w, y: e.pts[q].y + (e.pts[q + 1].y - e.pts[q].y) * w, s: 0.6 + rand() * 0.7, e: e.i });
    }
  }
  // The crossings pages can land on, in an order that looks random: not the hub's tight middle, not the frame.
  const free = [];
  for (let j = 3; j < M; j++) for (let s = 0; s < K; s++) free.push(id(j, s));
  for (let k = free.length - 1; k > 0; k--) {
    const r = Math.floor(rand() * (k + 1));
    [free[k], free[r]] = [free[r], free[k]];
  }
  return { nodes, edges, adj, anchor, spokeAng, dew, id, free };
}

/**
 * Starts the check and its drawing on the stage. `onDone` hears the totals once the crawl has read every page.
 * @param {import('../effects/stage.js').Stage} stage
 * @param {HTMLElement} root holds the card's tokens
 * @param {(summary: { pages: number, links: number, broken: string[], outside: number }) => void} [onDone]
 */
export function createWeb(stage, root, onDone) {
  const { ctx } = stage;
  const mono = getComputedStyle(root).getPropertyValue('--font-code').trim() || 'monospace';
  const W = makeWeb();
  const routes = new Map();
  /** The way along the threads from one crossing to another: the shortest, never straight across. */
  const route = (a, b) => {
    const key = `${a}:${b}`;
    const known = routes.get(key);
    if (known) return known;
    const dist = W.nodes.map(() => Infinity);
    const via = W.nodes.map(() => null);
    const done = W.nodes.map(() => false);
    dist[a] = 0;
    for (;;) {
      let u = -1;
      for (let k = 0; k < W.nodes.length; k++) if (!done[k] && dist[k] < Infinity && (u < 0 || dist[k] < dist[u])) u = k;
      if (u < 0 || u === b) break;
      done[u] = true;
      for (const e of W.adj[u]) {
        const v = e.a === u ? e.b : e.a;
        if (dist[u] + e.len < dist[v]) {
          dist[v] = dist[u] + e.len;
          via[v] = e;
        }
      }
    }
    const chain = [];
    for (let v = b; v !== a && via[v]; ) {
      const e = via[v];
      chain.unshift({ e, fwd: e.b === v });
      v = e.a === v ? e.b : e.a;
    }
    const pts = [{ x: W.nodes[a].x, y: W.nodes[a].y }];
    const cum = [0];
    const segs = [];
    for (const { e, fwd } of chain) {
      const ep = fwd ? e.pts : [...e.pts].reverse();
      for (let k = 1; k < ep.length; k++) {
        pts.push(ep[k]);
        cum.push(cum[cum.length - 1] + Math.hypot(ep[k].x - ep[k - 1].x, ep[k].y - ep[k - 1].y));
      }
      segs.push(e);
    }
    const r = { pts, cum, len: cum[cum.length - 1], segs };
    routes.set(key, r);
    return r;
  };
  const pointAt = (path, d) => {
    const { pts, cum } = path;
    if (pts.length < 2 || d <= 0) return pts[0];
    if (d >= path.len) return pts[pts.length - 1];
    let lo = 0;
    let hi = cum.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (cum[m] <= d) lo = m;
      else hi = m;
    }
    const u = (d - cum[lo]) / (cum[hi] - cum[lo] || 1);
    return { x: pts[lo].x + (pts[hi].x - pts[lo].x) * u, y: pts[lo].y + (pts[hi].y - pts[lo].y) * u };
  };

  // ---- The check: the crawl's pages as they come, and the replay worked out from them as they arrive. ----
  /** @type {import('../lib/site-check.js').Page[]} */
  let feed = [];
  let crawlDone = false;
  let stopper = new AbortController();
  /** The replay's own clock, in seconds. */
  let T = 0;
  /** @typedef {{ page: any, node: number, part: string, walk: any, walkDur: number, tw: number, t0: number, t1: number, e0: number, e1: number }} Visit */
  /** @type {Visit[]} */
  let visits = [];
  /** @type {any[]} */
  let events = [];
  /** Each address's crossing, each crossing's part, when it was found, and the crossings still free. */
  let nodeOf = new Map();
  let partAt = new Map();
  let foundAt = new Map();
  /** @type {Map<number, { key: string, at: number, edge: number }>} */
  let snapped = new Map();
  let impulses = [];
  let freeLeft = [...W.free];
  let outsideOnSpoke = new Map();
  let unique = 0;
  let endAt = Infinity;

  /** A crossing for an address the first time a link reaches it; broken ones sit high and off to a side, so the
   * snapped thread and its label stay clear. shortcut: past the web's 165 crossings, pages share them. */
  const nodeFor = (key, broken) => {
    const had = nodeOf.get(key);
    if (had !== undefined) return had;
    let at = 0;
    if (broken) {
      const side = snapped.size % 2 ? 1 : -1;
      at = Math.max(0, freeLeft.findIndex((n) => W.nodes[n].y < -45 && W.nodes[n].y > -140 && W.nodes[n].x * side > 70));
    }
    const node = freeLeft.length ? freeLeft.splice(at, 1)[0] : W.free[nodeOf.size % W.free.length];
    nodeOf.set(key, node);
    partAt.set(node, partOfPage(key));
    return node;
  };

  const start = () => {
    stopper.abort();
    stopper = new AbortController();
    const { signal } = stopper;
    feed = [];
    crawlDone = false;
    T = 0;
    visits = [];
    events = [];
    nodeOf = new Map([['/', 0]]);
    partAt = new Map([[0, 'home']]);
    foundAt = new Map([[0, 0]]);
    snapped = new Map();
    impulses = [{ x: 0, y: 0, t: INTRO, amp: 6 }];
    freeLeft = [...W.free];
    outsideOnSpoke = new Map();
    unique = 0;
    endAt = Infinity;
    strolls = [];
    resetSpider();
    const origin = location.origin;
    const ask = async (path, method) => {
      const begun = performance.now();
      try {
        const res = await fetch(path, { method, cache: 'no-cache', signal });
        const html = method === 'GET' && res.ok && (res.headers.get('content-type') ?? '').includes('html') ? await res.text() : null;
        return { status: res.status, ms: Math.round(performance.now() - begun), html };
      } catch {
        return { status: 0, ms: Math.round(performance.now() - begun), html: null };
      }
    };
    const parser = new DOMParser();
    const read = (html) => {
      const doc = parser.parseFromString(html, 'text/html');
      const links = [...doc.querySelectorAll('a[href]')].map((a) => ({ href: a.getAttribute('href') ?? '', text: (a.textContent ?? '').replace(/\s+/g, ' ').trim() || (a.getAttribute('aria-label') ?? '') }));
      return { title: doc.title, links };
    };
    crawl({ origin, ask, read, signal, onPage: (page) => {
      feed.push(page);
      if (!stage.playing) redrawStill();
    } }).then(() => {
      if (signal.aborted) return;
      crawlDone = true;
      // The page's words hear what was found at once, however far the replay has got (or if it isn't playing).
      const all = feed.flatMap((p) => p.links);
      onDone?.({ pages: feed.length, links: all.length, broken: [...new Set(all.filter((l) => l.route === 'broken').map((l) => l.key))], outside: all.filter((l) => l.route === 'you' && !l.repeat).length });
      if (!stage.playing) redrawStill();
    });
  };

  /** Fits the pages that have come in onto the replay, each after the last, or now if the spider has been waiting. */
  const schedule = () => {
    while (visits.length < feed.length) {
      const page = feed[visits.length];
      const prev = visits[visits.length - 1];
      const node = page.path === '/' ? 0 : nodeFor(page.path, false);
      const walk = route(prev ? prev.node : 0, node);
      const walkDur = prev ? clamp(walk.len / 520 + 0.15, 0.4, 1.3) : 0;
      const tw = Math.max(prev ? prev.t1 : INTRO, T);
      let t = tw + walkDur;
      const t0 = t;
      t += 0.1;
      const e0 = events.length;
      const here = W.nodes[node];
      for (const link of page.links) {
        const ev = { t, v: visits.length, link, route: link.route, repeat: link.repeat, ms: link.ms };
        if (!link.repeat) {
          ev.u = unique++;
          const s = node === 0 ? ev.u % K : here.s;
          if (link.kind === 'outside') ev.to = W.anchor + s;
          else if (link.kind === 'file') ev.to = W.id(Math.min(M, Math.max(3, here.j + 2)), s);
          else ev.to = nodeFor(link.key, link.route === 'broken');
          ev.path = route(node, ev.to);
          ev.dur = clamp(ev.path.len / 560, 0.28, 1.1);
          ev.arrive = t + ev.dur;
          if (link.kind === 'page' && !foundAt.has(ev.to)) foundAt.set(ev.to, ev.arrive);
          if (link.kind === 'outside') {
            ev.slot = outsideOnSpoke.get(s) ?? 0;
            outsideOnSpoke.set(s, ev.slot + 1);
          }
          if (link.route === 'broken' && link.kind === 'page' && !snapped.has(ev.to) && ev.path.segs.length) {
            snapped.set(ev.to, { key: link.key, at: ev.arrive, edge: ev.path.segs[ev.path.segs.length - 1].i });
            const n = W.nodes[ev.to];
            impulses.push({ x: n.x, y: n.y, t: ev.arrive, amp: 11, tone: 'broken' });
          }
        }
        events.push(ev);
        t += link.repeat ? 0.006 : 0.075;
      }
      t += 0.08;
      visits.push({ page, node, part: partOfPage(page.path), walk, walkDur, tw, t0, t1: t, e0, e1: events.length });
      if (prev) impulses.push({ x: here.x, y: here.y, t: t0, amp: 4.5, tone: partOfPage(page.path), node });
    }
    if (crawlDone && endAt === Infinity && visits.length === feed.length) {
      endAt = (visits[visits.length - 1]?.t1 ?? T) + 0.3;
      impulses.push({ x: 0, y: 0, t: endAt, amp: 8 });
    }
  };

  /** Where the replay is at its time: links shown so far, the page being read, and the routes' counts. */
  const stateAt = (now) => {
    let lo = 0;
    let hi = events.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (events[m].t <= now) lo = m + 1;
      else hi = m;
    }
    const n = lo;
    let cur = -1;
    for (let k = visits.length - 1; k >= 0; k--) if (visits[k].t0 <= now) { cur = k; break; }
    const counts = { fine: 0, broken: 0, you: 0, repeat: 0 };
    for (let k = 0; k < n; k++) {
      const e = events[k];
      if (e.repeat) counts.repeat++;
      else counts[e.route]++;
    }
    return { now, n, cur, counts, last: n ? events[n - 1] : null, done: now >= endAt };
  };

  // ---- Colours, from the page's tokens (the stage reads --c1 onward into lanes, again when the theme changes). ----
  let pal;
  /** By day the card is light: glows are drawn plainly, as light added to light would wash out to white. */
  let light = false;
  const readPalette = () => {
    const l = stage.colors.lanes;
    const [fine, broken, you, text, soft, faint, line, panel, ground, silk, wall, shadow, shell, shine, glow, haze] = l.slice(PARTS.length);
    pal = { parts: Object.fromEntries(PARTS.map((p, i) => [p, l[i]])), fine, broken, you, text, soft, faint, line, panel, ground, silk, wall, shadow, shell, shine, glow, haze };
    light = (0.2126 * ground[0] + 0.7152 * ground[1] + 0.0722 * ground[2]) / 255 > 0.5;
  };
  const rgba = (rgb, a = 1) => `rgba(${rgb[0] | 0}, ${rgb[1] | 0}, ${rgb[2] | 0}, ${a})`;
  /** A shade of a colour: towards white for k above 0, towards black below. */
  const tint = (rgb, k) => rgb.map((c) => (k > 0 ? c + (255 - c) * k : c * (1 + k)));
  /** A wave's light: a landing's in the colour of the page landed on (its own shade), a snap's red, the hub's (the
   * start, the end and the watching waves) in the glow. */
  const waveColour = (wv) => (wv.tone === 'broken' ? pal.broken : wv.tone ? tint(pal.parts[wv.tone], (light ? -Math.abs(shadeOf(wv.node)) : shadeOf(wv.node)) * 0.45) : pal.glow);
  /** Each page's own shade of its colour, lighter or deeper, the same on every visit. */
  const shadeOf = (node) => (((node * 2654435761) >>> 0) % 1000 / 1000 - 0.5) * 1.1;
  const routeColour = (r) => (r === 'fine' ? pal.fine : r === 'broken' ? pal.broken : pal.you);
  const glowOp = () => (light ? 'source-over' : 'lighter');

  // ---- Layout: the card's units fitted into the stage, and how the web sits in them. ----
  let wide = true;
  let size = WIDE;
  let scale = 1;
  let offX = 0;
  let offY = 0;
  let density = 1;
  let L = layoutOf(true);
  function layoutOf(isWide) {
    return isWide
      ? { cx: 572, cy: 222, k: 1, clip: [268, 44, 610, 360] }
      : { cx: 220, cy: 236, k: 0.68, clip: [6, 92, 428, 288] };
  }
  const fit = () => {
    density = ctx.canvas.width / Math.max(1, stage.width);
    wide = stage.width / Math.max(1, stage.height) >= 1.25;
    size = wide ? WIDE : TALL;
    L = layoutOf(wide);
    scale = Math.min(stage.width / size.w, stage.height / size.h);
    offX = (stage.width - size.w * scale) / 2;
    offY = (stage.height - size.h * scale) / 2;
    resetSpider();
  };

  // ---- 3D: the web leans back about 30°, bowed in a little, breathing in the air; a landing or a snap sends a damped
  // wave through it. The pointer, a mouse's only, turns it a touch, so the depth shows. ----
  const view = { pitch: PITCH, yaw: YAW, tp: PITCH, ty: YAW, cp: 1, sp: 0, cy: 1, sy: 0 };
  let waves = [];
  const proj = (p, t) => {
    const r = Math.min(1.3, Math.hypot(p.x / RX, p.y / RY));
    let z = 26 * (1 - Math.min(1, r) ** 2) + Math.sin(t * 0.8 + p.x * 0.01 + p.y * 0.006) * 5 * r ** 1.5;
    for (const im of waves) {
      const d = Math.hypot(p.x - im.x, p.y - im.y);
      const a = t - im.t - d / 380;
      if (a > 0 && a < 2.4) z += im.amp * Math.exp(-a * 2.2) * Math.sin(a * 16) * Math.exp(-d / 340);
    }
    const x = p.x * L.k;
    const y = p.y * L.k;
    z *= L.k;
    const y1 = y * view.cp + z * view.sp;
    const z1 = -y * view.sp + z * view.cp;
    const x2 = x * view.cy + z1 * view.sy;
    const z2 = -x * view.sy + z1 * view.cy;
    const f = EYE / (EYE + z2);
    return { x: L.cx + x2 * f, y: L.cy + y1 * f, f, z: z2, fog: clamp(0.72 - z2 / 330, 0.35, 1) };
  };
  /** Where a point's shadow falls on the wall: nearer points throw it further. */
  const shade = (q) => ({ x: q.x + (WALL * L.k - q.z) * 0.085, y: q.y + (WALL * L.k - q.z) * 0.12 });
  /** A band of light sweeping slowly across the web. */
  const sweep = (q, t) => {
    const pos = ((t * 70) % 1100) - 350;
    const d = ((q.x - L.cx) * 0.8 + (q.y - L.cy) * 0.6) / L.k - pos;
    return Math.exp(-(d * d) / (2 * 38 * 38));
  };
  const pointer = (/** @type {PointerEvent} */ e) => {
    if (e.pointerType !== 'mouse' || stage.still) return;
    const box = ctx.canvas.getBoundingClientRect();
    view.ty = YAW + ((e.clientX - box.left) / box.width - 0.5) * 0.3;
    view.tp = PITCH + ((e.clientY - box.top) / box.height - 0.5) * 0.16;
  };
  ctx.canvas.addEventListener('pointermove', pointer);
  ctx.canvas.addEventListener('pointerleave', () => {
    view.ty = YAW;
    view.tp = PITCH;
  });

  // ---- Drawing helpers, in the card's units. ----
  const font = (px, w = 400) => `${w} ${px}px ${mono}`;
  const txt = (s, x, y, px, col, o = {}) => {
    ctx.font = font(px, o.w ?? 400);
    ctx.fillStyle = col;
    ctx.textAlign = o.align ?? 'left';
    ctx.textBaseline = o.base ?? 'alphabetic';
    ctx.fillText(s, x, y);
    return ctx.measureText(s).width;
  };
  const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
  const short = (link) => (link.kind === 'outside' ? link.key.replace(/^https?:\/\/(www\.)?/, '') : link.key);
  const clock = (t) => {
    const m = Math.floor(t / 60);
    return `${String(m).padStart(2, '0')}:${(t - m * 60).toFixed(2).padStart(5, '0')}`;
  };
  const round = (x, y, w, h, r) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  };
  const poly = (P) => {
    ctx.moveTo(P[0].x, P[0].y);
    for (let k = 1; k < P.length; k++) ctx.lineTo(P[k].x, P[k].y);
  };
  /** Part of a projected thread, from `from` to `to` of its length (0 to 1, by its points). */
  const partOf = (P, from, to) => {
    const n = P.length - 1;
    const at = (x) => {
      const k = Math.min(n - 1, Math.floor(x));
      const u = x - k;
      return { x: P[k].x + (P[k + 1].x - P[k].x) * u, y: P[k].y + (P[k + 1].y - P[k].y) * u };
    };
    const out = [at(from * n)];
    for (let k = Math.ceil(from * n); k < to * n; k++) out.push(P[k]);
    out.push(at(to * n));
    return out;
  };
  const panel = (x, y, w, h, title, right) => {
    ctx.fillStyle = rgba(pal.panel);
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = rgba(pal.line);
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    if (title) txt(title.toUpperCase(), x + 8, y + 13, 8, rgba(pal.soft), { w: 500 });
    if (right) txt(right.toUpperCase(), x + w - 8, y + 13, 8, rgba(pal.faint), { align: 'right' });
  };
  const chip = (s, x, y, colour, px = 7.5) => {
    ctx.font = font(px, 500);
    const w = ctx.measureText(s).width + 6;
    ctx.fillStyle = rgba(colour);
    ctx.fillRect(x, y - px + 1.5, w, px + 3);
    txt(s, x + 3, y + 1.5, px, rgba(pal.ground), { w: 500 });
    return w;
  };

  // ---- The web. ----
  const STYLE = { spoke: [0.3, 0.9], ring: [0.22, 0.75], frame: [0.42, 1.4], anchor: [0.32, 1.1] };
  const drawWeb = (st, t) => {
    const now = st.now;
    const shiver = new Map();
    const heat = new Map();
    for (let k = 0; k < st.n; k++) {
      const e = events[k];
      if (e.repeat) continue;
      const live = now - e.t;
      for (const seg of e.path.segs) {
        if (now >= e.arrive) heat.set(seg.i, (heat.get(seg.i) ?? 0) + 1);
        if (live < e.dur + 0.4) shiver.set(seg.i, Math.max(shiver.get(seg.i) ?? 0, 1 - Math.max(0, live - e.dur) / 0.4));
      }
    }
    const broke = new Set([...snapped.values()].filter((s) => now >= s.at).map((s) => s.edge));
    const screen = W.edges.map((e) => {
      const amp = shiver.get(e.i) ?? 0;
      const n = e.pts.length - 1;
      return e.pts.map((p, k) => {
        const q = proj(p, t);
        if (amp && k && k < n) {
          const w = Math.sin(now * 46 + e.i) * 1.8 * amp * Math.sin((Math.PI * k) / n);
          const dx = e.pts[n].x - e.pts[0].x;
          const dy = e.pts[n].y - e.pts[0].y;
          const len = Math.hypot(dx, dy) || 1;
          q.x += (-dy / len) * w;
          q.y += (dx / len) * w;
        }
        return q;
      });
    });
    // At the start the web comes up from the hub outwards.
    const reveal = (p) => clamp((now - 0.05) * 1.9 - Math.hypot(p.x / RX, p.y / RY));
    const rv = W.edges.map((e) => (broke.has(e.i) ? 0 : reveal(e.pts[e.pts.length >> 1])));
    // Its shadow on the wall: a wide faint stroke under a narrow one, far cheaper than a blur every frame.
    ctx.save();
    ctx.globalAlpha = Math.min(1, now * 1.2) * (light ? 0.6 : 1);
    ctx.beginPath();
    screen.forEach((P, k) => {
      if (rv[k] > 0.5) poly(P.map(shade));
    });
    ctx.strokeStyle = rgba(pal.shadow, 0.16);
    ctx.lineWidth = 3.2 * L.k;
    ctx.stroke();
    ctx.strokeStyle = rgba(pal.shadow, 0.3);
    ctx.lineWidth = 1.1 * L.k;
    ctx.stroke();
    ctx.restore();
    // The threads, nearer ones thicker and brighter.
    ctx.lineCap = 'round';
    W.edges.forEach((e, k) => {
      if (!rv[k]) return;
      const [a, w] = STYLE[e.kind];
      const P = screen[k];
      const m = P[P.length >> 1];
      ctx.strokeStyle = rgba(pal.silk, a * m.fog * rv[k] * (light ? 1.25 : 1));
      ctx.lineWidth = w * m.f ** 2 * L.k;
      ctx.beginPath();
      poly(P);
      ctx.stroke();
    });
    ctx.globalCompositeOperation = glowOp();
    W.edges.forEach((_, k) => {
      const P = screen[k];
      const b = sweep(P[P.length >> 1], t) * rv[k];
      if (b < 0.04) return;
      ctx.strokeStyle = rgba(light ? pal.silk : pal.text, b * (light ? 0.3 : 0.45) * P[0].fog);
      ctx.lineWidth = 0.9 * P[0].f * L.k;
      ctx.beginPath();
      poly(P);
      ctx.stroke();
    });
    for (const d of W.dew) {
      if (broke.has(d.e)) continue;
      const r0 = reveal(d);
      if (!r0) continue;
      const q = proj(d, t);
      const b = sweep(q, t);
      const s = d.s * q.f ** 2 * L.k;
      ctx.fillStyle = rgba(light ? pal.silk : pal.text, (0.16 + b * 0.75) * q.fog * r0 * (light ? 0.6 : 1));
      ctx.fillRect(q.x - s / 2, q.y - s / 2, s, s);
    }
    // Threads that carried links keep a faint glow.
    for (const [k, h] of heat) {
      if (broke.has(k)) continue;
      ctx.strokeStyle = rgba(pal.fine, Math.min(0.45, 0.08 + h * 0.035) * screen[k][0].fog);
      ctx.lineWidth = 1.1 * screen[k][0].f * L.k;
      ctx.beginPath();
      poly(screen[k]);
      ctx.stroke();
    }
    // Every wave carries light on its front as it runs out through the silk: a landing's, a snap's, the end's, and
    // the watching ones after.
    for (const wv of waves) {
      const age = now - wv.t;
      const R = age * 380;
      const strength = Math.min(1, wv.amp / 8) * Math.exp(-age * 0.9);
      if (strength < 0.03) continue;
      W.edges.forEach((e, k) => {
        if (broke.has(k)) return;
        const m = e.pts[e.pts.length >> 1];
        const d = Math.abs(Math.hypot(m.x - wv.x, m.y - wv.y) - R);
        if (d > 38) return;
        ctx.strokeStyle = rgba(waveColour(wv), (1 - d / 38) * strength * screen[k][0].fog);
        ctx.lineWidth = 2.2 * screen[k][0].f * L.k;
        ctx.beginPath();
        poly(screen[k]);
        ctx.stroke();
      });
    }
    ctx.globalCompositeOperation = 'source-over';
    // The hub's tight knot, and the knobs where the anchor lines hold on.
    ctx.strokeStyle = rgba(pal.silk, 0.32);
    ctx.lineWidth = 0.6;
    for (const r of [4, 8, 12, 16]) {
      ctx.beginPath();
      W.spokeAng.forEach((a, k) => {
        const q = proj({ x: Math.cos(a) * r * (1 + ((k * 7) % 5) * 0.05), y: Math.sin(a) * r }, t);
        if (k) ctx.lineTo(q.x, q.y);
        else ctx.moveTo(q.x, q.y);
      });
      ctx.closePath();
      ctx.stroke();
    }
    for (let s = 0; s < K; s++) {
      const n = W.nodes[W.anchor + s];
      const q = proj(n, t);
      ctx.fillStyle = rgba(pal.silk, 0.5 * q.fog * reveal(n));
      ctx.beginPath();
      ctx.arc(q.x, q.y, 2.2 * q.f * L.k, 0, TAU);
      ctx.fill();
    }
    return screen;
  };

  /** A thread that snapped at a broken link: its two loose ends hang from where they held and sway, reddening. */
  const drawSnaps = (st, t, screen) => {
    for (const [node, s] of snapped) {
      const age = st.now - s.at;
      if (age < 0) continue;
      const P = screen[s.edge];
      const fall = 1 - (1 - clamp(age / 0.6)) ** 3;
      [[P[0], P[1], 0], [P[P.length - 1], P[P.length - 2], 1]].forEach(([fixed, next, side]) => {
        const dx = next.x - fixed.x;
        const dy = next.y - fixed.y;
        const reach = Math.hypot(P[P.length - 1].x - P[0].x, P[P.length - 1].y - P[0].y) * 0.42;
        const len = Math.hypot(dx, dy) || 1;
        const sway = Math.sin(st.now * 1.6 + node + side * 2) * 4 * L.k + Math.exp(-age * 1.5) * Math.sin(age * 9) * 8 * L.k;
        const end = { x: fixed.x + (dx / len) * reach * (1 - fall * 0.5) + sway, y: fixed.y + (dy / len) * reach * (1 - fall) + fall * reach * 0.9 };
        const mid = { x: fixed.x + (dx / len) * reach * 0.55, y: fixed.y + (dy / len) * reach * 0.55 + fall * reach * 0.25 };
        const g = ctx.createLinearGradient(fixed.x, fixed.y, end.x, end.y);
        g.addColorStop(0, rgba(pal.silk, 0.45));
        g.addColorStop(1, rgba(pal.broken, 0.95));
        ctx.strokeStyle = g;
        ctx.lineWidth = 1 * L.k;
        ctx.beginPath();
        ctx.moveTo(fixed.x, fixed.y);
        ctx.quadraticCurveTo(mid.x, mid.y, end.x, end.y);
        ctx.stroke();
        // the frayed tip
        ctx.strokeStyle = rgba(pal.broken, 0.9);
        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(end.x + 3 * L.k, end.y + 2.5 * L.k);
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(end.x - 2.5 * L.k, end.y + 3 * L.k);
        ctx.stroke();
      });
      // Its address beside the break, in red on the panel's colour.
      const q = proj(W.nodes[node], t);
      const label = `404  ${s.key}`;
      ctx.globalAlpha = clamp(age / 0.4);
      ctx.font = font(7.5, 500);
      const w = ctx.measureText(label).width + 10;
      ctx.fillStyle = rgba(pal.panel, 0.92);
      ctx.strokeStyle = rgba(pal.broken, 0.9);
      ctx.lineWidth = 1;
      round(q.x + 8, q.y - 7, w, 14, 3);
      ctx.fill();
      ctx.stroke();
      txt(label, q.x + 13, q.y + 3, 7.5, rgba(pal.broken), { w: 500 });
      ctx.globalAlpha = 1;
    }
  };

  /** A circle lying in the web's plane. */
  const ring = (c, r, t) => {
    ctx.beginPath();
    for (let a = 0; a <= 24; a++) {
      const q = proj({ x: c.x + Math.cos((a / 24) * TAU) * r, y: c.y + Math.sin((a / 24) * TAU) * r }, t);
      if (a) ctx.lineTo(q.x, q.y);
      else ctx.moveTo(q.x, q.y);
    }
    ctx.stroke();
  };

  const drawPulses = (st, t) => {
    const now = st.now;
    ctx.globalCompositeOperation = glowOp();
    for (let k = 0; k < st.n; k++) {
      const e = events[k];
      if (e.repeat) continue;
      const age = now - e.t;
      if (age > e.dur + 0.5) continue;
      const col = routeColour(e.route);
      const ar = now - e.arrive;
      if (ar >= 0 && ar < 0.5) {
        ctx.strokeStyle = rgba(col, 0.75 * (1 - ar / 0.5));
        ctx.lineWidth = 1.2;
        ring(W.nodes[e.to], 4 + ar * 60, t);
      }
      if (age > e.dur + 0.45) continue;
      const len = e.path.len;
      const head = len * (1 - (1 - clamp(age / e.dur)) ** 2);
      const tail0 = Math.max(0, head - 80) + (age > e.dur ? ((age - e.dur) / 0.45) * 80 : 0);
      const fade = age > e.dur ? 1 - (age - e.dur) / 0.45 : 1;
      for (let i = 0; i < 14; i++) {
        const d0 = tail0 + ((head - tail0) * i) / 14;
        const d1 = tail0 + ((head - tail0) * (i + 1)) / 14;
        if (d1 <= d0) continue;
        const p0 = proj(pointAt(e.path, d0), t);
        const p1 = proj(pointAt(e.path, d1), t);
        const w = (i + 1) / 14;
        ctx.strokeStyle = rgba(col, 0.85 * w * fade);
        ctx.lineWidth = (0.6 + 1.8 * w) * p1.f * L.k;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
      if (age <= e.dur) {
        const h = proj(pointAt(e.path, head), t);
        const r = 9 * h.f * L.k;
        const g = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, r);
        g.addColorStop(0, rgba(col, 0.95));
        g.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(h.x, h.y, r, 0, TAU);
        ctx.fill();
      }
    }
    // Links already seen: a quiet ripple on the page being read.
    let shown = 0;
    for (let k = st.n - 1; k >= 0 && shown < 8; k--) {
      const e = events[k];
      if (!e.repeat) continue;
      const age = now - e.t;
      if (age > 0.6) break;
      shown++;
      ctx.strokeStyle = rgba(pal.silk, 0.3 * (1 - age / 0.6));
      ctx.lineWidth = 0.8;
      ring(W.nodes[visits[e.v].node], 5 + age * 30, t);
    }
    ctx.globalCompositeOperation = 'source-over';
  };

  /** Each page: a little knot of silk wound round its crossing, faint while only found, in its part's colour once read,
   * the threads next to it taking the colour too. */
  const drawPages = (st, t, screen) => {
    const now = st.now;
    // outside links collect as beads on the anchor lines
    for (let k = 0; k < st.n; k++) {
      const e = events[k];
      if (e.repeat || e.route !== 'you' || now < e.arrive) continue;
      const an = W.nodes[e.to];
      const tip = W.nodes[W.id(M, an.s)];
      const u = Math.min(0.95, 0.2 + e.slot * 0.13);
      const q = proj({ x: tip.x + (an.x - tip.x) * u, y: tip.y + (an.y - tip.y) * u }, t);
      const r = 1.9 * clamp((now - e.arrive) / 0.25) * q.f * L.k;
      const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r * 3.5);
      g.addColorStop(0, rgba(pal.you, 0.45 * q.fog));
      g.addColorStop(1, rgba(pal.you, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(q.x, q.y, r * 3.5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = rgba(pal.you, 0.9 * q.fog);
      ctx.beginPath();
      ctx.arc(q.x, q.y, r, 0, TAU);
      ctx.fill();
    }
    const readAt = new Map();
    visits.forEach((v) => readAt.set(v.node, v.t0));
    const current = st.cur >= 0 ? visits[st.cur].node : -1;
    for (const [node, at] of foundAt) {
      if (at > now || snapped.has(node) || node === 0) continue;
      // its part's colour, each page in its own slightly lighter or deeper shade of it
      const part = tint(pal.parts[partAt.get(node) ?? 'home'], (light ? -Math.abs(shadeOf(node)) : shadeOf(node)) * 0.45);
      const read = (readAt.get(node) ?? Infinity) <= now;
      const c = W.nodes[node];
      const grow = 1 - (1 - clamp((now - at) / 0.45)) ** 3;
      // a passing wave lights it up as its front goes by
      let lit = 0;
      for (const wv of waves) {
        const d = Math.hypot(c.x - wv.x, c.y - wv.y) - (now - wv.t) * 380;
        lit = Math.max(lit, Math.exp(-(d * d) / (2 * 26 * 26)) * Math.min(1, wv.amp / 6) * Math.exp(-(now - wv.t) * 0.6));
      }
      if (read) {
        // the threads next to it, tinted near the knot
        ctx.globalCompositeOperation = glowOp();
        for (const e of W.adj[node]) {
          const P = screen[e.i];
          ctx.strokeStyle = rgba(part, (0.4 + lit * 0.5) * P[0].fog);
          ctx.lineWidth = 1.1 * P[0].f * L.k;
          ctx.beginPath();
          poly(e.a === node ? partOf(P, 0, 0.45) : partOf(P, 0.55, 1));
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      const turn = node === current ? now * 0.8 : 0;
      for (let loop = 0; loop < 3; loop++) {
        const r = (2.4 + loop * 1.7) * grow;
        ctx.beginPath();
        for (let a = 0; a <= 10; a++) {
          const ang = (a / 10) * TAU + turn + loop * 1.3;
          const wob = 1 + Math.sin(ang * 3 + node + loop) * 0.18;
          const q = proj({ x: c.x + Math.cos(ang) * r * wob, y: c.y + Math.sin(ang) * r * wob }, t);
          if (a) ctx.lineTo(q.x, q.y);
          else ctx.moveTo(q.x, q.y);
        }
        ctx.strokeStyle = read ? rgba(part, 0.95) : rgba(pal.silk, 0.45);
        ctx.lineWidth = (read ? 0.95 : 0.7) * L.k;
        ctx.stroke();
      }
      if (read) {
        // its glow, breathing a little, flaring as a wave passes
        const q = proj(c, t);
        const glowR = (15 + lit * 14 + Math.sin(now * 1.3 + node) * 1.5) * q.f * L.k;
        ctx.globalCompositeOperation = glowOp();
        const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, glowR);
        g.addColorStop(0, rgba(part, (light ? 0.22 : 0.42) + lit * 0.4));
        g.addColorStop(1, rgba(part, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(q.x, q.y, glowR, 0, TAU);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      if (node === current) {
        const k = (now * 0.9) % 1;
        ctx.strokeStyle = rgba(part, 0.45 * (1 - k));
        ctx.lineWidth = 1;
        ring(c, 7 + k * 10, t);
      }
    }
  };

  const drawChips = (st, t) => {
    const now = st.now;
    let shown = 0;
    for (let k = st.n - 1; k >= 0 && shown < 3; k--) {
      const e = events[k];
      if (e.repeat) continue;
      const age = now - e.arrive;
      if (age < 0) continue;
      if (age > 1) break;
      if (e.route === 'broken') continue;
      shown++;
      const q = proj(W.nodes[e.to], t);
      const s = e.link.kind === 'outside' ? clip(short(e.link).split('/')[0], 20) : `${clip(e.link.key, 16)}  ${e.ms} ms`;
      ctx.font = font(7, 500);
      const w = ctx.measureText(s).width + 8;
      const x = q.x + 7 + w > L.clip[0] + L.clip[2] - 30 ? q.x - 7 - w : q.x + 7;
      ctx.globalAlpha = clamp(age / 0.15) * (1 - Math.max(0, age - 0.6) / 0.4);
      ctx.fillStyle = rgba(routeColour(e.route), 0.92);
      round(x, q.y - 14 - age * 6, w, 11, 3);
      ctx.fill();
      txt(s, x + 4, q.y - 6 - age * 6, 7, rgba(pal.ground), { w: 500 });
      ctx.globalAlpha = 1;
    }
  };

  // ---- The spider: it lives in the web's plane, feet planted, stepping in two alternating sets of four. ----
  const LEGS = Array.from({ length: 8 }, (_, i) => {
    const side = i < 4 ? -1 : 1;
    const k = i % 4;
    return { side, k, group: (k + (side < 0 ? 0 : 1)) % 2, hip: { x: 3.2 - k * 2.1, y: side * 2.2 }, ang: [0.6, 1.2, 1.9, 2.55][k], reach: [23, 19, 19, 23][k] };
  });
  const S = { feet: null, steps: [], heading: -Math.PI / 2, restFrom: -Math.PI / 2, lastT: -1, phase: 0 };
  function resetSpider() {
    S.feet = null;
    S.lastT = -1;
  }
  const sprite = document.createElement('canvas');

  const pose = (st) => {
    const now = st.now;
    const walking = visits.find((v) => v.walkDur && now >= v.tw && now < v.t0);
    if (walking) {
      const len = walking.walk.len;
      const u = (now - walking.tw) / walking.walkDur;
      const d = len * ease(u);
      const a = pointAt(walking.walk, d);
      const b = pointAt(walking.walk, Math.min(len, d + 4));
      const c = pointAt(walking.walk, Math.max(0, d - 4));
      return { x: a.x, y: a.y, heading: Math.atan2(b.y - c.y, b.x - c.x), moving: true, toward: walking, speed: (len * Math.PI * Math.sin(Math.PI * u)) / (2 * walking.walkDur) };
    }
    // Done, it doesn't freeze: now and then it strolls, slowly, along the threads to a page nearby.
    const stroll = st.done ? strollAt(now) : null;
    if (stroll?.walking) {
      const s = stroll.walking;
      const len = s.walk.len;
      const u = (now - s.tw) / s.dur;
      const d = len * ease(u);
      const a = pointAt(s.walk, d);
      const b = pointAt(s.walk, Math.min(len, d + 4));
      const c = pointAt(s.walk, Math.max(0, d - 4));
      return { x: a.x, y: a.y, heading: Math.atan2(b.y - c.y, b.x - c.x), moving: true, toward: s.visit, speed: (len * Math.PI * Math.sin(Math.PI * u)) / (2 * s.dur) };
    }
    const at = stroll ? stroll.node : st.cur >= 0 ? visits[st.cur].node : 0;
    return { x: W.nodes[at].x, y: W.nodes[at].y, heading: null, moving: false, cur: stroll ? -1 : st.cur, speed: 0 };
  };
  /** @type {{ walk: any, tw: number, dur: number, to: number, visit: Visit }[]} */
  let strolls = [];
  /** Where the spider is among its strolls: walking one, or resting where the last one ended. Worked out as it goes,
   * the same each time for the same check. */
  const strollAt = (now) => {
    if (!visits.length) return null;
    const rand = seeded(visits.length * 31 + strolls.length * 7 + 3);
    for (;;) {
      const last = strolls[strolls.length - 1];
      const from = last ? last.to : visits[visits.length - 1].node;
      const free = (last ? last.tw + last.dur : endAt + 1) + STROLL_REST * (0.6 + rand() * 0.8);
      if (free > now) break;
      // a page not far off along the threads
      const options = visits.filter((v) => v.node !== from).map((v) => ({ v, walk: route(from, v.node) })).sort((a, b) => a.walk.len - b.walk.len).slice(0, 5);
      const pick = options[Math.floor(rand() * options.length)];
      if (!pick) break;
      strolls.push({ walk: pick.walk, tw: free, dur: pick.walk.len / 40 + 1, to: pick.v.node, visit: pick.v });
    }
    const last = strolls[strolls.length - 1];
    if (last && now < last.tw + last.dur) return { walking: last, node: last.to };
    return { walking: null, node: last ? last.to : visits[visits.length - 1].node };
  };

  const drawSpider = (st, t) => {
    const now = st.now;
    const P = pose(st);
    const sc = 1.15;
    const dt = S.lastT < 0 ? 0 : now - S.lastT;
    S.lastT = now;
    if (P.heading !== null) {
      let dh = P.heading - S.heading;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      S.heading += dt > 0 && dt < 0.2 ? dh * Math.min(1, dt * 14) : dh;
      S.restFrom = S.heading;
    } else if (dt > 0 && dt < 0.2) {
      // standing, it turns a little this way and that, slowly, now and then shifting its feet
      const want = S.restFrom + Math.sin(now * 0.35) * 0.35 + Math.sin(now * 0.13 + 1) * 0.25;
      S.heading += (want - S.heading) * Math.min(1, dt * 1.5);
    }
    const h = S.heading;
    const ch = Math.cos(h);
    const sh = Math.sin(h);
    const world = (b) => ({ x: P.x + (b.x * ch - b.y * sh) * sc, y: P.y + (b.x * sh + b.y * ch) * sc });
    const rest = (leg) => world({ x: leg.hip.x + Math.cos(leg.ang) * leg.reach, y: leg.hip.y + leg.side * Math.sin(leg.ang) * leg.reach });
    // Faster running, longer and quicker strides, so the feet keep up.
    const stepDur = P.speed > 200 ? 0.06 : 0.085;
    const lead = P.moving ? clamp(P.speed * stepDur * 0.9, 6, 22) * sc : 0;
    const limit = (P.moving ? Math.max(8.5, P.speed * stepDur * 1.1) : 2.5) * sc;
    if (!S.feet || dt <= 0 || dt > 0.2 || Math.hypot(S.feet[0].x - P.x, S.feet[0].y - P.y) > 80) {
      S.feet = LEGS.map(rest);
      S.steps = LEGS.map(() => null);
    } else {
      S.phase += dt * (P.moving ? 22 : 0);
      LEGS.forEach((leg, i) => {
        const step = S.steps[i];
        if (step) {
          step.u += dt / stepDur;
          const u = Math.min(1, step.u);
          const e = u * u * (3 - 2 * u);
          S.feet[i] = { x: step.from.x + (step.to.x - step.from.x) * e, y: step.from.y + (step.to.y - step.from.y) * e, lift: Math.sin(Math.PI * u) };
          if (u >= 1) S.steps[i] = null;
          return;
        }
        const want = rest(leg);
        const w = { x: want.x + ch * lead, y: want.y + sh * lead };
        const far = Math.hypot(S.feet[i].x - w.x, S.feet[i].y - w.y);
        const otherBusy = S.steps.some((s2, j) => s2 && LEGS[j].group !== leg.group);
        if (far > limit && (!otherBusy || far > limit * 2)) S.steps[i] = { from: { ...S.feet[i] }, to: { x: w.x + ch * lead * 0.6, y: w.y + sh * lead * 0.6 }, u: 0 };
      });
    }
    // Standing on a page, a front foot taps towards each new link as it goes out.
    const tap = [];
    if (!P.moving && P.cur !== undefined && P.cur >= 0) {
      const v = visits[P.cur];
      for (let k = v.e1 - 1; k >= v.e0; k--) {
        const e = events[k];
        const age = now - e.t;
        if (age < 0 || e.repeat) continue;
        if (age > 0.22) break;
        const leg = e.u % 2 ? 4 : 0;
        const to = pointAt(e.path, 16);
        const dl = Math.hypot(to.x - P.x, to.y - P.y) || 1;
        const reach = 6 * Math.sin((Math.PI * age) / 0.22);
        if (!tap[leg]) tap[leg] = { x: ((to.x - P.x) / dl) * reach, y: ((to.y - P.y) / dl) * reach };
      }
    }
    // Drawn in the web's own plane through the local 3D transform, whole on a little canvas, then laid down at 0.8 so
    // overlapping legs don't darken.
    const q = proj(P, t);
    const qx = proj({ x: P.x + 1, y: P.y }, t);
    const qy = proj({ x: P.x, y: P.y + 1 }, t);
    const J = [(qx.x - q.x) * scale, (qx.y - q.y) * scale, (qy.x - q.x) * scale, (qy.y - q.y) * scale];
    const half = 80 * scale;
    const px = Math.ceil(half * 2 * density);
    if (sprite.width !== px) sprite.width = sprite.height = px;
    const c = /** @type {CanvasRenderingContext2D} */ (sprite.getContext('2d'));
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, px, px);
    c.setTransform(J[0] * density, J[1] * density, J[2] * density, J[3] * density, (half - (J[0] * P.x + J[2] * P.y)) * density, (half - (J[1] * P.x + J[3] * P.y)) * density);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    LEGS.forEach((leg, i) => {
      const H = world(leg.hip);
      const F0 = S.feet[i];
      const lift = F0.lift ?? 0;
      const l1 = leg.reach * 0.54 * sc;
      const l2 = leg.reach * 0.62 * sc;
      let F = tap[i] ? { x: F0.x + tap[i].x, y: F0.y + tap[i].y } : F0;
      const fd = Math.hypot(F.x - H.x, F.y - H.y);
      const maxR = (l1 + l2) * 0.98;
      if (fd > maxR) F = { x: H.x + ((F.x - H.x) / fd) * maxR, y: H.y + ((F.y - H.y) / fd) * maxR }; // a leg never stretches past its length
      const d = Math.min(l1 + l2 - 0.01, Math.max(Math.abs(l1 - l2) + 0.01, Math.hypot(F.x - H.x, F.y - H.y)));
      const base = Math.atan2(F.y - H.y, F.x - H.x);
      const a = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d));
      const k1 = { x: H.x + Math.cos(base + a) * l1, y: H.y + Math.sin(base + a) * l1 };
      const k2 = { x: H.x + Math.cos(base - a) * l1, y: H.y + Math.sin(base - a) * l1 };
      const knee = Math.hypot(k1.x - P.x, k1.y - P.y) > Math.hypot(k2.x - P.x, k2.y - P.y) ? k1 : k2;
      const ox = knee.x - (H.x + F.x) / 2;
      const oy = knee.y - (H.y + F.y) / 2;
      const ol = Math.hypot(ox, oy) || 1;
      const ctl = { x: (knee.x + F.x) / 2 + (ox / ol) * 2.2 * sc, y: (knee.y + F.y) / 2 + (oy / ol) * 2.2 * sc };
      c.strokeStyle = rgba(pal.silk, 0.78);
      c.lineWidth = (2.3 + lift * 0.6) * sc;
      c.beginPath();
      c.moveTo(H.x, H.y);
      c.lineTo(knee.x, knee.y);
      c.stroke();
      c.lineWidth = 1.5 * sc;
      c.beginPath();
      c.moveTo(knee.x, knee.y);
      c.quadraticCurveTo(ctl.x, ctl.y, F.x, F.y);
      c.stroke();
      c.strokeStyle = rgba(pal.silk);
      c.lineWidth = 0.7 * sc;
      c.beginPath();
      c.moveTo(H.x, H.y);
      c.lineTo(knee.x, knee.y);
      c.quadraticCurveTo(ctl.x, ctl.y, F.x, F.y);
      c.stroke();
      c.fillStyle = rgba(pal.silk);
      c.beginPath();
      c.arc(knee.x, knee.y, 1.2 * sc, 0, TAU);
      c.fill();
    });
    // Its body: a glossy shell with a soft rim of light, like a beetle-backed spider.
    c.translate(P.x, P.y);
    c.rotate(h);
    c.scale(sc, sc);
    const bob = Math.sin(S.phase) * 0.6;
    if (!light) {
      c.shadowColor = rgba(pal.fine, 0.85);
      c.shadowBlur = 14 * density * scale;
    }
    c.fillStyle = rgba(pal.shell);
    c.beginPath();
    c.ellipse(-11 + bob, 0, 9.6, 7.2, 0, 0, TAU);
    c.fill();
    c.beginPath();
    c.ellipse(1.8, 0, 5.4, 4.5, 0, 0, TAU);
    c.fill();
    c.shadowColor = 'transparent';
    const ab = c.createRadialGradient(-14 + bob, -3.5, 0.5, -11 + bob, 0, 10);
    ab.addColorStop(0, rgba(pal.shine));
    ab.addColorStop(0.35, rgba(pal.shell, 0.8));
    ab.addColorStop(1, rgba(pal.shell));
    c.fillStyle = ab;
    c.beginPath();
    c.ellipse(-11 + bob, 0, 9.6, 7.2, 0, 0, TAU);
    c.fill();
    c.strokeStyle = rgba(pal.silk, 0.55);
    c.lineWidth = 0.6;
    c.stroke();
    c.strokeStyle = rgba(pal.text, light ? 0.35 : 0.55); // the shine along its back
    c.lineWidth = 0.9;
    c.beginPath();
    c.ellipse(-12 + bob, -1, 6.5, 4.6, 0, Math.PI * 1.08, Math.PI * 1.42);
    c.stroke();
    c.fillStyle = rgba(pal.broken);
    for (const dir of [-1, 1]) {
      c.beginPath();
      c.moveTo(-11 + bob + dir * 3.5, -2.3);
      c.lineTo(-11 + bob, 0);
      c.lineTo(-11 + bob + dir * 3.5, 2.3);
      c.closePath();
      c.fill();
    }
    c.fillStyle = rgba(pal.fine, 0.9);
    for (const [x, y] of [[-6.5, -4.4], [-10.5, -5.3], [-14.8, -4.4], [-6.5, 4.4], [-10.5, 5.3], [-14.8, 4.4]]) {
      c.beginPath();
      c.arc(x + bob, y, 0.65, 0, TAU);
      c.fill();
    }
    const ce = c.createRadialGradient(0.5, -1.8, 0.3, 1.8, 0, 5.5);
    ce.addColorStop(0, rgba(pal.shine));
    ce.addColorStop(1, rgba(pal.shell));
    c.fillStyle = ce;
    c.beginPath();
    c.ellipse(1.8, 0, 5.4, 4.5, 0, 0, TAU);
    c.fill();
    c.strokeStyle = rgba(pal.silk, 0.55);
    c.lineWidth = 0.6;
    c.stroke();
    c.strokeStyle = rgba(pal.silk, 0.85);
    c.lineWidth = 1.3;
    for (const y of [-1, 1]) {
      c.beginPath();
      c.moveTo(6.4, y * 1.5);
      c.quadraticCurveTo(8.6, y * 2.9, 9.8, y * 1.6);
      c.stroke();
    }
    c.fillStyle = rgba(pal.fine);
    for (const [x, y, r] of [[5.6, -1.1, 0.95], [5.6, 1.1, 0.95], [4.6, -2.4, 0.6], [4.6, 2.4, 0.6], [3.6, -1.2, 0.5], [3.6, 1.2, 0.5]]) {
      c.beginPath();
      c.arc(x, y, r, 0, TAU);
      c.fill();
    }
    // At the start it lowers itself onto the hub on a thread of silk, which then fades.
    const u = clamp((now - 0.1) / (INTRO - 0.1));
    const drop = -((1 - u) ** 3) * 230 * L.k;
    const lineA = Math.max(0, 1 - Math.max(0, now - INTRO) / 1.2);
    if (lineA > 0) {
      ctx.strokeStyle = rgba(pal.silk, 0.55 * lineA);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(q.x, L.clip[1]);
      ctx.lineTo(q.x, q.y + drop);
      ctx.stroke();
    }
    // Its shadow on the wall, then the spider itself, in screen pixels.
    const s = shade(q);
    const toUnits = 1 / scale;
    ctx.save();
    ctx.filter = 'brightness(0) blur(2.5px)';
    ctx.globalAlpha = (light ? 0.25 : 0.45) * Math.min(1, u * 1.5);
    ctx.drawImage(sprite, s.x - half * toUnits, s.y - half * toUnits + drop * 0.9, half * 2 * toUnits, half * 2 * toUnits);
    ctx.filter = 'none';
    ctx.globalAlpha = 0.8;
    ctx.drawImage(sprite, q.x - half * toUnits, q.y - half * toUnits + drop, half * 2 * toUnits, half * 2 * toUnits);
    ctx.restore();
    return { x: q.x, y: q.y + drop, toward: P.toward, intro: now < INTRO };
  };

  // ---- The panels round the web. ----
  const QUESTION = { fine: 'page answers?', broken: 'page answers?', you: 'outside the site' };
  const header = (st, compact) => {
    ctx.fillStyle = rgba(pal.text);
    ctx.fillRect(14, 12, 2, 24);
    let x = 22;
    x += txt("JACK'S SPACE / SITE CHECK", x, 23, 11, rgba(pal.text), { w: 500 });
    if (!compact) {
      txt('  // EVERY LINK, ONE FORK', x, 23, 11, rgba(pal.parts.collection), { w: 500 });
      txt('every link becomes one fork  |  the crawler checks the inside, you check the outside', 22, 36, 8, rgba(pal.soft));
    }
    const found = nodeOf.size - snapped.size;
    const items = [['pages', `${Math.max(0, st.cur + 1)}${crawlDone ? '' : ` / ${found}`}`, pal.text], ['links', `${st.n}`, pal.parts.collection], ['fine', `${st.counts.fine}`, pal.fine], ['broken', `${st.counts.broken}`, pal.broken], ['you', `${st.counts.you}`, pal.you]];
    // Left of the Restart, Pause and Full screen buttons over the card's corner; on the tall card, a row of its own.
    items.forEach(([label, value, colour], i) => {
      const xx = compact ? 14 + i * 84 : 560 + i * 62;
      const y = compact ? 58 : 18;
      txt(label, xx, y, 7, rgba(pal.faint));
      txt(value, xx, y + 17, 14, rgba(colour), { w: 500 });
    });
  };

  const sourcePanel = (x, y, w, h, st) => {
    const v = visits[Math.max(0, st.cur)];
    panel(x, y, w, h);
    [pal.broken, pal.you, pal.fine].forEach((col, k) => {
      ctx.fillStyle = rgba(col);
      ctx.beginPath();
      ctx.arc(x + 10 + k * 9, y + 10, 3, 0, TAU);
      ctx.fill();
    });
    if (!v) {
      txt('waiting for the home page…', x + 24, y + 33, 8, rgba(pal.faint));
      return;
    }
    txt(clip(`~${v.page.path}`, Math.floor((w - 90) / 5.2)), x + 42, y + 13, 8, rgba(pal.soft));
    const lh = 13.5;
    const top = y + 30;
    const rows = Math.floor((h - 36) / lh);
    const k = st.cur < 0 ? -1 : st.n - 1 - v.e0;
    const total = v.page.links.length + 1;
    const curLine = k + 1;
    const first = Math.max(0, Math.min(curLine - Math.floor(rows * 0.45), total - rows));
    txt(`ln ${Math.max(1, curLine + 1)}`, x + w - 8, y + 13, 8, rgba(pal.faint), { align: 'right' });
    const maxCh = Math.floor((w - 40) / 5.2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y + 20, w, h - 22);
    ctx.clip();
    for (let r = 0; r < rows && first + r < total; r++) {
      const li = first + r;
      const ly = top + r * lh;
      txt(String(li + 1).padStart(2, ' '), x + 6, ly + 3, 7.5, rgba(pal.faint));
      if (li === 0) {
        txt(clip(`<title>${v.page.title}</title>`, maxCh), x + 24, ly + 3, 8, rgba(pal.soft));
        continue;
      }
      const j = li - 1;
      const e = events[v.e0 + j];
      const link = v.page.links[j];
      let lx = x + 24;
      lx += txt('<a href="', lx, ly + 3, 8, rgba(pal.faint));
      const label = clip(short(link), Math.max(6, maxCh - 18));
      ctx.font = font(8);
      const cw = ctx.measureText(label).width + 6;
      const state = j < k ? 'past' : j === k ? 'now' : 'next';
      const col = e.repeat ? pal.faint : routeColour(e.route);
      if (state !== 'next') {
        ctx.fillStyle = state === 'now' ? rgba(col) : rgba(col, e.repeat ? 0.16 : 0.22);
        ctx.fillRect(lx - 2, ly - 6, cw, 12);
        ctx.strokeStyle = rgba(col);
        ctx.strokeRect(lx - 1.5, ly - 5.5, cw - 1, 11);
      }
      txt(label, lx + 1, ly + 3, 8, state === 'now' ? rgba(pal.ground) : state === 'past' ? rgba(pal.text) : rgba(pal.soft), { w: state === 'now' ? 500 : 400 });
      lx += cw;
      txt(clip(`">${link.text}</a>`, Math.max(4, Math.floor((x + w - lx - 6) / 5.2))), lx, ly + 3, 8, rgba(pal.faint));
    }
    ctx.restore();
  };

  const ROUTES = [
    { key: 'fine', tag: '200 · answers', name: 'fine', foot: 'no action needed' },
    { key: 'broken', tag: '404 · missing', name: 'broken', foot: 'Jack fixes it' },
    { key: 'you', tag: 'outside only', name: 'you', foot: 'check by hand' },
  ];
  const routeBox = (x, y, w, h, r, st) => {
    const col = routeColour(r.key);
    const hot = st.last && !st.last.repeat && st.last.route === r.key && st.now - st.last.t < 0.25;
    ctx.fillStyle = rgba(pal.panel);
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = rgba(col, hot ? 1 : 0.55);
    ctx.lineWidth = hot ? 2 : 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.lineWidth = 1;
    chip(r.tag, x, y + 8, col);
    txt(`→ ${r.name}`, x + 10, y + 30, 10, rgba(pal.text));
    txt(String(st.counts[r.key]), x + w - 10, y + h - 12, 22, rgba(col), { align: 'right', w: 500 });
    if (h > 50) txt(r.foot, x + 10, y + h - 8, 7, rgba(pal.faint));
  };

  const partsPanel = (x, y, w, h, st) => {
    panel(x, y, w, h, 'parts', 'pages read');
    PARTS.forEach((part, k) => {
      const all = [...partAt].filter(([n]) => !snapped.has(n)).filter(([, p]) => p === part).length;
      const read = visits.filter((v, i) => i <= st.cur && v.part === part).length;
      const ly = y + 30 + k * 15;
      txt(part.toUpperCase(), x + 8, ly + 3, 7.5, rgba(pal.parts[part]));
      ctx.fillStyle = rgba(pal.line);
      ctx.fillRect(x + 90, ly - 2, w - 140, 4);
      ctx.fillStyle = rgba(pal.parts[part]);
      ctx.fillRect(x + 90, ly - 2, all ? (read / all) * (w - 140) : 0, 4);
      txt(`${read}/${all}`, x + w - 8, ly + 3, 7.5, rgba(pal.soft), { align: 'right' });
    });
  };

  const stream = (x, y, w, h, st, rows) => {
    panel(x, y, w, h, 'link stream', w > 500 ? 'link  ·  check  ·  answer  ·  route' : '');
    const list = [];
    for (let k = st.n - 1; k >= 0 && list.length < rows; k--) if (!events[k].repeat) list.push(events[k]);
    list.reverse();
    const lh = (h - 22) / rows;
    list.forEach((e, r) => {
      const ly = y + 26 + r * lh;
      const col = routeColour(e.route);
      if (e === st.last) {
        ctx.fillStyle = rgba(col, 0.08);
        ctx.fillRect(x + 1, ly - 8, w - 2, lh);
      }
      txt(clock(e.t), x + 8, ly + 2, 7.5, rgba(pal.faint));
      chip(clip(short(e.link), w > 500 ? 22 : 26), x + 62, ly + 1, col);
      if (w > 500) txt(QUESTION[e.route], x + w * 0.46, ly + 2, 7.5, rgba(pal.text));
      txt(e.route === 'you' ? '—' : e.route === 'broken' ? String(e.link.status || 'no answer') : `${e.ms} ms`, x + w * (w > 500 ? 0.72 : 0.68), ly + 2, 7.5, rgba(col));
      txt(`→ ${e.route}`, x + w - 8, ly + 2, 7.5, rgba(col), { align: 'right' });
    });
  };

  const spark = (x, y, w, h, st) => {
    panel(x, y, w, h, 'answer time · last 40', 'ms');
    const ms = [];
    for (let k = st.n - 1; k >= 0 && ms.length < 40; k--) {
      const e = events[k];
      if (!e.repeat && e.route !== 'you') ms.unshift(e.route === 'broken' ? 900 : e.ms);
    }
    const gx = x + 8;
    const gy = y + 20;
    const gw = w - 16;
    const gh = h - 40;
    if (ms.length > 1) {
      const px = (k) => gx + (k / 39) * gw;
      const py = (v) => gy + gh - Math.min(1, v / 900) * gh;
      ctx.beginPath();
      ms.forEach((v, k) => (k ? ctx.lineTo(px(k), py(v)) : ctx.moveTo(px(k), py(v))));
      ctx.lineTo(px(ms.length - 1), gy + gh);
      ctx.lineTo(px(0), gy + gh);
      ctx.closePath();
      ctx.fillStyle = rgba(pal.broken, 0.14);
      ctx.fill();
      ctx.beginPath();
      ms.forEach((v, k) => (k ? ctx.lineTo(px(k), py(v)) : ctx.moveTo(px(k), py(v))));
      ctx.strokeStyle = rgba(pal.broken);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.lineWidth = 1;
    }
    const ok = ms.filter((v) => v < 900);
    txt(`avg ${ok.length ? Math.round(ok.reduce((a, b) => a + b, 0) / ok.length) : 0} ms`, x + 8, y + h - 7, 8, rgba(pal.text));
  };

  const dots = (x, y, w, h, st, cols) => {
    panel(x, y, w, h, 'pages read', 'one dot = one page');
    const found = [...nodeOf.entries()].filter(([, n]) => !snapped.has(n));
    const sx = (w - 24) / (cols - 1);
    const rows = Math.max(1, Math.ceil(found.length / cols));
    const sy = Math.min(14, (h - 44) / Math.max(1, rows - 1));
    found.forEach(([key, n], k) => {
      const vi = visits.findIndex((v) => v.node === n);
      const read = vi >= 0 && vi <= st.cur;
      const dx = x + 12 + (k % cols) * sx;
      const dy = y + 26 + Math.floor(k / cols) * sy;
      ctx.fillStyle = read ? rgba(pal.parts[partOfPage(key)]) : rgba(pal.line);
      ctx.beginPath();
      ctx.arc(dx, dy, vi === st.cur ? 3.6 : 2.6, 0, TAU);
      ctx.fill();
      if (vi === st.cur) {
        ctx.strokeStyle = rgba(pal.text);
        ctx.beginPath();
        ctx.arc(dx, dy, 6, 0, TAU);
        ctx.stroke();
      }
    });
    txt(`${Math.max(0, st.cur + 1)} / ${found.length}`, x + 8, y + h - 7, 8, rgba(pal.text));
  };

  const legend = (x, y, w, h, st) => {
    panel(x, y, w, h, 'who had to look');
    const n = st.counts.broken;
    [['crawler', `${st.counts.fine} pages answered`, pal.fine], ['broken', `${n} link${n === 1 ? '' : 's'} to fix`, pal.broken], ['you', `${st.counts.you} outside links`, pal.you]].forEach(([a, b, c], k) => {
      const ly = y + 24 + k * ((h - 38) / 3);
      ctx.fillStyle = rgba(c);
      ctx.fillRect(x + 10, ly - 4, 2, (h - 38) / 3 - 5);
      txt(a, x + 18, ly + 3, 8, rgba(c));
      txt(b, x + w * 0.42, ly + 3, 8, rgba(pal.soft));
    });
    txt('the crawler checks · you look where it can\u{2019}t', x + 10, y + h - 7, 7.5, rgba(pal.broken));
  };

  let fps = 60;
  const status = (st) => {
    const where = st.cur < 0 ? 'READY' : st.done ? `DONE  |  ${visits.length} PAGES, ${events.length.toLocaleString('en-US')} LINKS` : `CHECKING ~${visits[st.cur].page.path}`;
    txt(clip(where, 60), 16, size.h - 10, 8, rgba(pal.faint));
    const rate = stage.playing ? `FRAME ${Math.round(fps)} FPS  |  ` : '';
    txt(`${rate}LIVE CRAWL`, size.w - 18, size.h - 10, 8, rgba(pal.faint), { align: 'right' });
  };

  const label = (Q, st) => {
    if (Q.intro) return;
    const v = Q.toward ?? visits[Math.max(0, st.cur)];
    if (!v) return;
    const s = `~${v.page.path}`;
    ctx.font = font(7.5, 500);
    const w = ctx.measureText(s).width + 8;
    ctx.globalAlpha = Q.toward ? 0.55 : 0.9;
    ctx.fillStyle = rgba(Q.toward ? pal.soft : pal.text);
    round(Q.x + 24 * L.k, Q.y + 18 * L.k, w, 12, 3);
    ctx.fill();
    txt(s, Q.x + 24 * L.k + 4, Q.y + 18 * L.k + 9, 7.5, rgba(pal.ground), { w: 500 });
    ctx.globalAlpha = 1;
  };

  // ---- Behind the web: the wall as a field of dots in the same 3D, a slow haze drifting over it, and dust in the
  // air between, catching the light as the band sweeps by. ----
  /** A point at a depth `z` behind the web's plane (no bow, no waves), on screen. */
  const flat = (x, y, z) => {
    const px = x * L.k;
    const py = y * L.k;
    const pz = z * L.k;
    const y1 = py * view.cp + pz * view.sp;
    const z1 = -py * view.sp + pz * view.cp;
    const x2 = px * view.cy + z1 * view.sy;
    const z2 = -px * view.sy + z1 * view.cy;
    const f = EYE / (EYE + z2);
    return { x: L.cx + x2 * f, y: L.cy + y1 * f, f, z: z2 };
  };
  const dust = (() => {
    const rand = seeded(424242);
    return Array.from({ length: 70 }, () => ({ x: (rand() - 0.5) * 760, y: (rand() - 0.5) * 520, z: -80 + rand() * 220, v: 4 + rand() * 8, s: 0.6 + rand() * 1.1, ph: rand() * TAU }));
  })();
  const drawBackdrop = (t) => {
    // the haze: two soft clouds of the glow, drifting slowly
    ctx.globalCompositeOperation = glowOp();
    for (const [i, r] of [[0, 300], [1, 240]]) {
      const c = flat(Math.sin(t * 0.05 + i * 2.4) * 160 - 60 + i * 180, Math.cos(t * 0.04 + i * 1.7) * 70 - 30, WALL);
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r * L.k);
      g.addColorStop(0, rgba(i ? pal.glow : pal.haze, light ? 0.1 : 0.16));
      g.addColorStop(1, rgba(i ? pal.glow : pal.haze, 0));
      ctx.fillStyle = g;
      ctx.fillRect(L.clip[0], L.clip[1], L.clip[2], L.clip[3]);
    }
    ctx.globalCompositeOperation = 'source-over';
    // the wall's dots, fading away from the middle, brighter where the light passes
    for (let x = -480; x <= 480; x += 28) {
      for (let y = -330; y <= 330; y += 28) {
        const q = flat(x, y, WALL);
        const fade = 1 - Math.min(1, Math.hypot(x / 480, y / 330));
        if (fade <= 0) continue;
        const a = (light ? 0.18 : 0.15) * fade + sweep(q, t) * 0.25 * fade;
        const s = 1.1 * q.f * L.k;
        ctx.fillStyle = rgba(pal.silk, a);
        ctx.fillRect(q.x - s / 2, q.y - s / 2, s, s);
      }
    }
    // dust, rising slowly, glinting in the band
    for (const d of dust) {
      const y = ((((d.y - t * d.v) % 520) + 780) % 520) - 260;
      const q = flat(d.x + Math.sin(t * 0.3 + d.ph) * 8, y, d.z);
      const b = sweep(q, t);
      const a = (0.08 + b * 0.6) * (0.6 + 0.4 * Math.sin(t * 1.1 + d.ph));
      ctx.fillStyle = rgba(light ? pal.silk : pal.text, a * (light ? 0.5 : 1));
      ctx.beginPath();
      ctx.arc(q.x, q.y, d.s * q.f * L.k, 0, TAU);
      ctx.fill();
    }
  };

  // ---- One frame. ----
  let lastReal = -1;
  const paint = (st) => {
    const t = st.now;
    const real = performance.now() / 1000;
    const dtReal = lastReal < 0 ? 0 : Math.min(0.1, real - lastReal);
    lastReal = real;
    view.yaw += (view.ty - view.yaw) * Math.min(1, dtReal * 3);
    view.pitch += (view.tp - view.pitch) * Math.min(1, dtReal * 3);
    view.cp = Math.cos(view.pitch);
    view.sp = Math.sin(view.pitch);
    view.cy = Math.cos(view.yaw);
    view.sy = Math.sin(view.yaw);
    waves = impulses.filter((im) => st.now - im.t > 0 && st.now - im.t < 3.4);
    // Done, it goes on watching: a wave from the hub every few seconds, as if it were checking still.
    if (st.now > endAt + MONITOR_FROM) {
      const k = Math.floor((st.now - endAt - MONITOR_FROM) / MONITOR_EVERY);
      for (const j of [k - 1, k]) if (j >= 0) waves.push({ x: 0, y: 0, t: endAt + MONITOR_FROM + j * MONITOR_EVERY, amp: 6 });
    }
    ctx.setTransform(density, 0, 0, density, 0, 0);
    ctx.clearRect(0, 0, stage.width, stage.height);
    ctx.setTransform(density * scale, 0, 0, density * scale, density * offX, density * offY);
    ctx.fillStyle = rgba(pal.ground);
    ctx.fillRect(0, 0, size.w, size.h);
    header(st, !wide);
    const [x0, y0, w0, h0] = L.clip;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, w0, h0);
    ctx.clip();
    // a soft light on the wall behind the web, so its shadow has somewhere to fall
    const g = ctx.createRadialGradient(L.cx - 60 * L.k, L.cy - 40 * L.k, 10, L.cx - 60 * L.k, L.cy - 40 * L.k, 360 * L.k);
    g.addColorStop(0, rgba(pal.wall, light ? 1 : 0.55));
    g.addColorStop(1, rgba(pal.ground, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, w0, h0);
    drawBackdrop(t);
    const screen = drawWeb(st, t);
    drawSnaps(st, t, screen);
    drawPulses(st, t);
    drawPages(st, t, screen);
    const Q = drawSpider(st, t);
    drawChips(st, t);
    label(Q, st);
    // the web fades into the card at its edges instead of being cut off
    for (const [gx0, gy0, gx1, gy1, rx, ry, rw, rh] of [[x0, 0, x0 + 40, 0, x0, y0, 40, h0], [x0 + w0, 0, x0 + w0 - 40, 0, x0 + w0 - 40, y0, 40, h0], [0, y0, 0, y0 + 30, x0, y0, w0, 30], [0, y0 + h0, 0, y0 + h0 - 30, x0, y0 + h0 - 30, w0, 30]]) {
      const f = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
      f.addColorStop(0, rgba(pal.ground));
      f.addColorStop(1, rgba(pal.ground, 0));
      ctx.fillStyle = f;
      ctx.fillRect(rx, ry, rw, rh);
    }
    ctx.restore();
    if (wide) {
      sourcePanel(14, 48, 250, 352, st);
      ROUTES.forEach((r, k) => routeBox(884, 48 + k * 76, 238, 68, r, st));
      partsPanel(884, 278, 238, 122, st);
      stream(14, 408, 700, 208, st, 13);
      spark(720, 408, 198, 100, st);
      dots(924, 408, 198, 100, st, 11);
      legend(720, 514, 402, 102, st);
      status(st);
    } else {
      ROUTES.forEach((r, k) => routeBox(6 + k * 144, 386, 140, 46, r, st));
      stream(6, 438, 428, 106, st, 6);
    }
  };

  const redrawStill = () => {
    // Paused: the web as it stands. Less motion asked for: everything checked so far, as if it had played out (the
    // replay's own clock stays put, so the times in it read as they would have).
    if (!stage.still) {
      paint(stateAt(T));
      return;
    }
    schedule();
    paint(stateAt((endAt < Infinity ? endAt : (visits[visits.length - 1]?.t1 ?? 0)) + 3));
  };

  /** @param {number} dt */
  const frame = (dt) => {
    readPalette();
    if (stage.still) {
      redrawStill();
      return;
    }
    T += dt;
    if (dt > 0) fps += (1 / dt - fps) * 0.05;
    schedule();
    paint(stateAt(T));
  };

  // A font that comes after the first frame needs drawing in.
  document.fonts?.load(`500 16px ${mono}`).then(() => { if (!stage.playing) redrawStill(); }).catch(() => {});

  readPalette();
  fit();
  start();
  return {
    frame,
    resize: fit,
    /** Checks the site again from the start (the page's Restart button). */
    restart: () => {
      start();
      if (!stage.playing) redrawStill();
    },
    stop: () => stopper.abort(),
  };
}
