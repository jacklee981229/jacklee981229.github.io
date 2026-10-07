// The Travel Map as a globe, drawn in the browser: a drag turns it (so do the arrow keys), a flick keeps it turning
// for a moment, and it turns slowly by itself; a few seconds after it was last turned by hand, it turns back to where
// it started and carries on by itself from there. It colours the same places as the flat map, in the same colours. A place under the mouse (or tapped) rises out of the globe like a picture made of light, with
// its name over it. The globe can open out into the flat map and close up again. It only works while it's on screen.
import { geoCircle, geoClipAntimeridian, geoClipCircle, geoContains, geoGraticule10, geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import world from 'world-atlas/countries-110m.json';
import { WIDTH, flatProjection, inView, openingOut } from './map.js';

/** Degrees a second it turns by itself. */
const SPIN = 6;
/** Seconds after it was last turned by hand before it turns back to where it started, seconds that takes, and
    seconds it then takes to get up to SPIN. */
const RESUME = 5;
const RETURN = 1.2;
const SPIN_UP = 2;
/** Degrees one press of an arrow key turns it. */
const KEY_STEP = 10;
/** How far it tips towards a pole: any further and the world would roll upside down. */
const MAX_TILT = 80;
/** How much of a flick's speed is left after a second of turning on its own. */
const COAST = 0.04;
/** Slower than this (degrees a second), a flick is over. */
const REST = 2;
/** More pixels than this per CSS pixel costs speed without looking any sharper. */
const MAX_DENSITY = 2;
/** Seconds a place takes to rise out of the globe, or to settle back into it. */
const RISE = 0.22;
/** How much of a risen place's colour stays behind on the globe, marking where it came from. */
const MARK = 0.3;
/** Pixels between the thin lines across a risen place. */
const SCAN = 3;
/** A press that moves less than this many pixels is a tap, not a drag. */
const TAP = 6;
/** Seconds the globe takes to open out into the flat map, or to close up again. */
const OPEN = 1.2;
/** A colour no place has: if a canvas still holds it after being given a place's colour, it couldn't read that colour. */
const UNREAD = '#010203';

/**
 * Starts the globe in `root`, which takes the keyboard's focus and holds five canvases, bottom to top (the world's
 * lines; the visited places' glow and the places themselves; the same two again for a place that has risen) and
 * the risen place's name tag. The page's styles make the glow and the places breathe, the risen ones harder.
 * @param {HTMLElement} root
 * @param {{ shapes: { name: string, said: string, like: Element }[], facing: [number, number], sheet: () => DOMRect, flat?: boolean }} places
 *   the countries to colour (the map's own name for each, the name to show, and an element whose text colour is its
 *   colour: its picture on the flat map); the spot the globe starts facing, as [longitude, latitude]; where on the
 *   page the flat map lies, for the globe to open out onto; and whether to start opened out flat
 * @returns {{ open: (to: 0 | 1) => Promise<void>, refresh: () => void }} `open(1)` opens the globe out into the flat
 *   map and `open(0)` closes it up again, each settling when it's done; `refresh()` measures and draws afresh at
 *   once, for when the page has only just put the globe back on show
 */
export function runGlobe(root, places) {
  const [lines, glow, lit, hotGlow, hotLit] = /** @type {CanvasRenderingContext2D[]} */ ([...root.querySelectorAll('canvas')].map((canvas) => canvas.getContext('2d')));
  const tag = /** @type {HTMLElement} */ (root.querySelector('[data-tag]'));
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const countries = feature(world, world.objects.countries).features;
  // `rise` runs from 0 (on the globe's surface) to 1 (fully risen).
  const visited = places.shapes.map(({ name, said, like }) => ({ shape: countries.find((c) => c.properties.name === name), said, like, color: '', rise: 0 }));
  const borders = mesh(world, world.objects.countries);
  const grid = geoGraticule10();
  const projection = openingOut(0);
  const pathOn = new Map([lines, glow, lit, hotGlow, hotLit].map((ctx) => [ctx, geoPath(projection, ctx)]));
  /** Starts a path round a shape on a canvas, ready to fill or to draw the line of. */
  const trace = (/** @type {CanvasRenderingContext2D} */ ctx, /** @type {object} */ shape) => {
    ctx.beginPath();
    pathOn.get(ctx)(shape);
  };

  // The spot facing the viewer, and how fast it's moving, in degrees and degrees a second.
  let [lon, lat] = places.facing;
  let speed = { lon: 0, lat: 0 };
  // How flat it is: 0 the globe, 1 the flat map, between the two while it opens out or closes up.
  let flatness = places.flat ? 1 : 0;
  /** @type {{ from: number, to: number, began: number, done: () => void } | null} */
  let opening = null;
  // The canvases cover the globe (with room round it for a risen place) and the flat map it opens out into. Their
  // size in CSS pixels, and where the globe's own corner is in them.
  let wide = 1;
  let tall = 1;
  let corner = { x: 0, y: 0 };
  // The globe in the canvases' pixels: its middle, its radius, the width of its box. And the flat map: the scale and
  // the middle its projection needs to land on the page's own flat map.
  let ball = { x: 0, y: 0, r: 1, box: 1 };
  let sheet = { x: 0, y: 0, scale: 1 };
  // How much bigger a risen place is drawn, and the pixels between the ball and the edge of the globe's own box:
  // both set in the page's styles.
  let lift = 1;
  let room = 0;
  // When it was last turned by hand (on the page's clock), whether it has been since it last turned by itself, and
  // the timer that wakes it to go back. Then, while it goes back, where from and since when; and when it last started
  // turning by itself, for the speed-up.
  let handled = -Infinity;
  let wandered = false;
  let resume = 0;
  /** @type {{ lon: number, lat: number, began: number } | null} */
  let returning = null;
  let spunUp = -Infinity;
  let dragging = false;
  let onScreen = false;
  // The place under the mouse, or tapped: the one that rises. And where the mouse is while it's over the globe.
  let over = -1;
  /** @type {{ x: number, y: number } | null} */
  let mouse = null;
  let colors = { paper: '', surface: '', ink: '', muted: '', rule: '', visited: '' };

  const tilt = (/** @type {number} */ degrees) => Math.max(-MAX_TILT, Math.min(MAX_TILT, degrees));
  lat = tilt(lat);
  // Where it started, to go back to.
  const home = { lon, lat };

  const readColors = () => {
    const style = getComputedStyle(root);
    const of = (/** @type {string} */ name) => style.getPropertyValue(name).trim();
    colors = { paper: of('--paper'), surface: of('--surface'), ink: of('--ink'), muted: of('--muted'), rule: of('--rule'), visited: of('--visited-near') };
    lift = parseFloat(of('--lift-scale')) || 1;
    room = parseFloat(of('--room')) || 0;
    for (const place of visited) {
      // Each place's colour is whatever the flat map gives it. An old browser may hand the page's styles a colour
      // its canvas can't read; the place then takes the plain first colour.
      const color = getComputedStyle(place.like).color;
      lit.fillStyle = UNREAD;
      lit.fillStyle = color;
      place.color = lit.fillStyle === UNREAD ? colors.visited : color;
    }
  };

  /** Sizes the canvases and finds the globe and the flat map in them. False while the globe isn't on show. */
  const measure = () => {
    const box = root.getBoundingClientRect();
    if (!box.width) return false;
    const flat = places.sheet();
    // Room past the globe's edge for a place that has risen there.
    const bleed = box.width * 0.06;
    const left = Math.floor(Math.min(box.left - bleed, flat.left));
    const top = Math.floor(Math.min(box.top - bleed, flat.top));
    wide = Math.ceil(Math.max(box.right + bleed, flat.right)) - left;
    tall = Math.ceil(Math.max(box.bottom + bleed, flat.bottom)) - top;
    corner = { x: box.left - left, y: box.top - top };
    const density = Math.min(devicePixelRatio || 1, MAX_DENSITY);
    for (const ctx of pathOn.keys()) {
      Object.assign(ctx.canvas.style, { left: `${-corner.x}px`, top: `${-corner.y}px`, width: `${wide}px`, height: `${tall}px` });
      ctx.canvas.width = Math.round(wide * density);
      ctx.canvas.height = Math.round(tall * density);
      ctx.setTransform(density, 0, 0, density, 0, 0);
      ctx.lineJoin = 'round';
    }
    ball = { x: corner.x + box.width / 2, y: corner.y + box.height / 2, r: box.width / 2 - room, box: box.width };
    const unit = flat.width / WIDTH;
    const laid = flatProjection();
    sheet = { x: flat.left - left + laid.translate()[0] * unit, y: flat.top - top + laid.translate()[1] * unit, scale: laid.scale() * unit };
    return true;
  };

  /**
   * Sets how the earth is laid out for how flat it is now, and gives back the outline of it all to draw. Opening
   * out, it also turns the short way round to the flat map's own middle (0 degrees east, 0 north), widens what's in
   * view from the near half of the earth to all of it, and cuts the far side down its back, where the flat map's
   * two edges part.
   */
  const lay = () => {
    openingOut(flatness);
    const round = 1 - flatness;
    const centre = [flatness ? (((((lon + 180) % 360) + 360) % 360) - 180) * round : lon, lat * round];
    projection
      .scale(ball.r + (sheet.scale - ball.r) * flatness)
      .translate([ball.x + (sheet.x - ball.x) * flatness, ball.y + (sheet.y - ball.y) * flatness])
      .rotate([-centre[0], -centre[1]]);
    const reach = inView(flatness);
    if (reach >= Math.PI) {
      projection.preclip(geoClipAntimeridian);
      return { type: 'Sphere' };
    }
    const near = geoClipCircle(reach);
    if (!flatness) {
      projection.preclip(near);
      return { type: 'Sphere' };
    }
    projection.preclip((/** @type {object} */ stream) => geoClipAntimeridian(near(stream)));
    // A hair inside the edge of what's in view, so the cut and the outline never quarrel over the same points.
    return geoCircle().center(centre).radius((reach * 180) / Math.PI - 0.05).precision(2)();
  };

  /** A point in the canvases' own pixels. */
  const spotOf = (/** @type {PointerEvent} */ e) => {
    const box = root.getBoundingClientRect();
    return { x: e.clientX - box.left + corner.x, y: e.clientY - box.top + corner.y };
  };
  /** Which visited place is at a point on the globe: where it lies on the surface, risen or not, so rising can't move it out from under the pointer. */
  const placeAt = (/** @type {{ x: number, y: number }} */ spot) => {
    const there = projection.invert?.([spot.x, spot.y]);
    if (!there || !Number.isFinite(there[0]) || !Number.isFinite(there[1])) return -1;
    return visited.findIndex((place) => geoContains(place.shape, there));
  };

  const draw = () => {
    const outline = lay();
    lines.clearRect(0, 0, wide, tall);

    // The ball itself, lit from the upper left; the flat map has no such filling, so it fades as the ball opens out.
    const light = lines.createRadialGradient(corner.x + ball.box * 0.35, corner.y + ball.box * 0.3, 0, corner.x + ball.box * 0.35, corner.y + ball.box * 0.3, ball.box * 0.75);
    light.addColorStop(0, colors.surface);
    light.addColorStop(1, colors.paper);
    trace(lines, outline);
    lines.fillStyle = light;
    lines.globalAlpha = 1 - flatness;
    lines.fill();
    lines.globalAlpha = 1;
    lines.strokeStyle = colors.rule;
    lines.lineWidth = 1;
    lines.stroke();

    trace(lines, grid);
    lines.lineWidth = 0.5;
    lines.stroke();

    trace(lines, borders);
    lines.strokeStyle = colors.muted;
    lines.lineWidth = 0.6;
    lines.globalAlpha = 0.75;
    lines.stroke();
    lines.globalAlpha = 1;

    for (const ctx of [glow, lit, hotGlow, hotLit]) ctx.clearRect(0, 0, wide, tall);
    const surface = projection.scale();
    /** @type {{ said: string, color: string, risen: number, left: number, top: number } | null} */
    let named = null;
    for (const place of visited) {
      // Quick to leave the surface, gentle to arrive. Nothing is risen while the globe is opened out.
      const risen = flatness ? 0 : 1 - (1 - place.rise) ** 3;
      // On the surface: the whole place while it rests there, a faint mark of it once it has risen.
      glow.globalAlpha = 1 - risen;
      trace(glow, place.shape);
      glow.fillStyle = place.color;
      glow.fill();
      lit.globalAlpha = 1 - (1 - MARK) * risen;
      trace(lit, place.shape);
      lit.fillStyle = place.color;
      lit.fill();
      // The thin line that keeps neighbours apart.
      lit.strokeStyle = colors.paper;
      lit.lineWidth = 0.5;
      lit.stroke();
      if (risen === 0) continue;

      // Risen: drawn on a slightly bigger globe, so it stands out from the surface, away from the globe's middle.
      projection.scale(surface * (1 + (lift - 1) * risen));
      trace(hotGlow, place.shape);
      hotGlow.fillStyle = place.color;
      hotGlow.fill();
      trace(hotLit, place.shape);
      hotLit.fillStyle = place.color;
      hotLit.fill();
      const [[left, top], [right, bottom]] = pathOn.get(hotLit).bounds(place.shape);
      if (Number.isFinite(left)) {
        // Thin lines across it, and a bright edge.
        hotLit.save();
        hotLit.clip();
        hotLit.fillStyle = colors.paper;
        hotLit.globalAlpha = 0.22 * risen;
        for (let y = Math.floor(top / SCAN) * SCAN; y < bottom; y += SCAN) hotLit.fillRect(left, y, right - left, 1);
        hotLit.restore();
        trace(hotLit, place.shape);
        hotLit.strokeStyle = colors.ink;
        hotLit.globalAlpha = 0.6 * risen;
        hotLit.lineWidth = 0.9;
        hotLit.stroke();
        hotLit.globalAlpha = 1;
        // The name goes over the place that has risen furthest.
        if (!named || risen > named.risen) named = { said: place.said, color: place.color, risen, left: (left + right) / 2 - corner.x, top: top - corner.y };
      }
      projection.scale(surface);
    }
    glow.globalAlpha = lit.globalAlpha = 1;

    if (named) {
      if (tag.textContent !== named.said) tag.textContent = named.said;
      tag.style.setProperty('--colour', named.color);
      tag.style.left = `${named.left}px`;
      tag.style.top = `${named.top}px`;
    }
    tag.style.opacity = String(named?.risen ?? 0);
  };

  let handle = 0;
  let last = 0;
  // It turns by itself until it's turned by hand; RESUME seconds after the last turn by hand, it goes back to where it
  // started and turns by itself from there. Either way it holds still while a place is risen, so its name can be read.
  const spinning = () => !still && !dragging && !wandered && !returning && over < 0;
  const homeward = () => !still && !dragging && wandered && !returning && over < 0 && performance.now() - handled >= RESUME * 1000;
  const settled = () => visited.every((place, i) => place.rise === (i === over ? 1 : 0));
  // Opened out flat, nothing moves: the page's own flat map is what's on show then.
  const moving = () => !!opening || (!flatness && (spinning() || homeward() || !!returning || !settled() || (!dragging && (speed.lon !== 0 || speed.lat !== 0))));
  /** @param {number} now */
  const loop = (now) => {
    handle = 0;
    // After a hitch (or a background tab), one long step would fling it round: cap it.
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    if (opening) {
      const part = Math.max(0, Math.min(1, (now - opening.began) / (OPEN * 1000)));
      // A gentle start and a gentle stop.
      flatness = opening.from + (opening.to - opening.from) * (part < 0.5 ? 4 * part ** 3 : 1 - (2 - 2 * part) ** 3 / 2);
      if (part === 1) {
        const { to, done } = opening;
        flatness = to;
        opening = null;
        draw();
        done();
        return run();
      }
    } else if (returning) {
      const part = Math.min(1, (now - returning.began) / (RETURN * 1000));
      const eased = part < 0.5 ? 4 * part ** 3 : 1 - (2 - 2 * part) ** 3 / 2;
      // The shorter way round.
      lon = returning.lon + ((((home.lon - returning.lon) % 360) + 540) % 360 - 180) * eased;
      lat = returning.lat + (home.lat - returning.lat) * eased;
      if (part === 1) {
        returning = null;
        spunUp = now;
      }
    } else if (homeward()) {
      wandered = false;
      speed = { lon: 0, lat: 0 };
      returning = { lon, lat, began: now };
    } else if (spinning()) lon -= SPIN * Math.min(1, (now - spunUp) / (SPIN_UP * 1000)) * dt;
    else if (!dragging) {
      lon += speed.lon * dt;
      lat = tilt(lat + speed.lat * dt);
      const left = COAST ** dt;
      speed = { lon: speed.lon * left, lat: speed.lat * left };
      if (Math.hypot(speed.lon, speed.lat) < REST) speed = { lon: 0, lat: 0 };
    }
    visited.forEach((place, i) => {
      place.rise = i === over ? Math.min(1, place.rise + dt / RISE) : Math.max(0, place.rise - dt / RISE);
    });
    draw();
    // As the globe turns, a place may come in under a resting mouse, or leave from under it.
    if (mouse && !dragging && !flatness) over = placeAt(mouse);
    run();
  };
  // Keeps the loop going only while something is changing and the globe can be seen. Opening out always runs: the
  // page is waiting for it.
  const run = () => {
    if (handle || (!onScreen && !opening)) return;
    if (!moving()) {
      last = 0;
      return;
    }
    if (!last) last = performance.now();
    handle = requestAnimationFrame(loop);
  };
  const rest = () => {
    cancelAnimationFrame(handle);
    handle = 0;
    last = 0;
  };
  /** Makes a place (or none: -1) the one that rises. */
  const raise = (/** @type {number} */ index) => {
    if (index === over) return;
    over = index;
    if (!still) return run();
    // Less motion asked for: it's up, or back, at once.
    visited.forEach((place, i) => { place.rise = i === over ? 1 : 0; });
    draw();
  };

  /** Stops it turning by itself, or going back: it goes back RESUME seconds from now, unless it's turned again first. */
  const turnedByHand = () => {
    handled = performance.now();
    wandered = true;
    returning = null;
    clearTimeout(resume);
    resume = window.setTimeout(run, RESUME * 1000);
  };

  // A drag moves the surface with the pointer: a point at the middle of the globe stays under it. Nothing answers
  // the pointer or the keys while the globe is opened out, or on its way.
  let at = { x: 0, y: 0, time: 0 };
  let pressed = { x: 0, y: 0 };
  root.addEventListener('pointerdown', (e) => {
    if (flatness) return;
    turnedByHand();
    dragging = true;
    speed = { lon: 0, lat: 0 };
    at = { x: e.clientX, y: e.clientY, time: e.timeStamp };
    pressed = { x: e.clientX, y: e.clientY };
    root.setPointerCapture(e.pointerId);
  });
  root.addEventListener('pointermove', (e) => {
    if (flatness) return;
    if (!dragging) {
      // Only a mouse hovers.
      if (e.pointerType !== 'mouse') return;
      mouse = spotOf(e);
      return raise(placeAt(mouse));
    }
    const perPixel = 180 / Math.PI / projection.scale();
    const turned = { lon: -(e.clientX - at.x) * perPixel, lat: (e.clientY - at.y) * perPixel };
    const dt = (e.timeStamp - at.time) / 1000;
    // The speed of the last few moves, evened out, is what a flick lets go with.
    if (dt > 0) speed = { lon: speed.lon * 0.6 + (turned.lon / dt) * 0.4, lat: speed.lat * 0.6 + (turned.lat / dt) * 0.4 };
    lon += turned.lon;
    lat = tilt(lat + turned.lat);
    at = { x: e.clientX, y: e.clientY, time: e.timeStamp };
    draw();
  });
  const release = (/** @type {PointerEvent} */ e) => {
    if (!dragging) return;
    dragging = false;
    if (flatness) return;
    turnedByHand();
    // Held still before letting go, or less motion asked for: it stays where it was left.
    if (still || e.timeStamp - at.time > 100) speed = { lon: 0, lat: 0 };
    const there = placeAt(spotOf(e));
    if (e.pointerType === 'mouse') {
      mouse = spotOf(e);
      raise(there);
    } else if (Math.hypot(e.clientX - pressed.x, e.clientY - pressed.y) <= TAP) {
      // A finger has no hovering: a tap on a place raises it, and a tap on it again, or anywhere else, lets it settle.
      raise(there === over ? -1 : there);
    }
    last = 0;
    run();
  };
  root.addEventListener('pointerup', release);
  root.addEventListener('pointercancel', release);
  root.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'mouse' || dragging) return;
    mouse = null;
    raise(-1);
  });

  // The arrow keys look further that way: left is west, up is north.
  root.addEventListener('keydown', (e) => {
    const turn = { ArrowLeft: [-KEY_STEP, 0], ArrowRight: [KEY_STEP, 0], ArrowUp: [0, KEY_STEP], ArrowDown: [0, -KEY_STEP] }[e.key];
    if (!turn || flatness) return;
    e.preventDefault();
    turnedByHand();
    speed = { lon: 0, lat: 0 };
    lon += turn[0];
    lat = tilt(lat + turn[1]);
    draw();
    if (mouse) raise(placeAt(mouse));
  });

  const refresh = () => {
    if (measure()) draw();
  };
  new ResizeObserver(refresh).observe(root);
  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    if (onScreen) run();
    else if (!opening) rest();
  }).observe(root);
  // The site's theme button changes these: the theme, and the night sky (which keeps the dark theme, in its own colours).
  new MutationObserver(() => {
    readColors();
    draw();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-sky'] });

  readColors();
  refresh();
  // The page's own bare ball, there until now, makes way.
  root.dataset.live = '';

  return {
    open(to) {
      return new Promise((done) => {
        // Whatever was going on stops: nothing is risen, held or coasting while the globe opens out or closes up.
        opening?.done();
        mouse = null;
        over = -1;
        dragging = false;
        // On its way back: it carries on going back once it's a globe again.
        if (returning) wandered = true;
        returning = null;
        speed = { lon: 0, lat: 0 };
        for (const place of visited) place.rise = 0;
        if (still || flatness === to) {
          // Less motion asked for, or already there: it's done at once.
          flatness = to;
          opening = null;
          draw();
          run();
          return done();
        }
        opening = { from: flatness, to, began: performance.now(), done };
        run();
      });
    },
    refresh,
  };
}
