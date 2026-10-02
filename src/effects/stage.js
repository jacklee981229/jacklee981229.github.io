// What every effect shares: a canvas that fills its stage, the pointer (a mouse, a finger, or a slow drift of its
// own while nobody moves it), the site's colours in the theme being shown, and a loop that only runs while it's
// worth it: the stage on screen, the tab in front, and not paused.

/** Seconds without the pointer moving before the stage starts drifting on its own. */
const IDLE_AFTER = 2.5;
/** More pixels than this per CSS pixel costs speed without looking any sharper. */
const MAX_DENSITY = 2;

/**
 * @typedef {[number, number, number]} Rgb
 * @typedef {{
 *   ctx: CanvasRenderingContext2D, width: number, height: number, time: number,
 *   pointer: { x: number, y: number, vx: number, vy: number, down: boolean, pressed: boolean },
 *   colors: { paper: Rgb, ink: Rgb, muted: Rgb, rule: Rgb, lanes: Rgb[] },
 *   rgba: (color: Rgb, alpha?: number) => string,
 *   playing: boolean,
 * }} Stage
 * `pointer.pressed` is true for the one frame after a click or a tap. Sizes are in CSS pixels. `playing` is false
 * while the stage is paused, off screen or in a hidden tab: an effect that makes sound keeps quiet then.
 * @typedef {{ frame: (dt: number) => void, resize?: () => void }} Piece
 */

/**
 * Starts an effect on its stage. `root` holds the canvas and the Pause button; `create` builds the effect from the
 * stage and returns what draws one frame.
 * @param {HTMLElement} root @param {(stage: Stage) => Piece} create
 */
export function runStage(root, create) {
  const canvas = /** @type {HTMLCanvasElement} */ (root.querySelector('canvas'));
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  const toggle = root.querySelector('[data-stage-toggle]');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The browser turns any colour it's given into one fixed form, which is the easy way to get its red, green, blue.
  const taster = /** @type {CanvasRenderingContext2D} */ (document.createElement('canvas').getContext('2d'));
  /** @param {string} css @returns {Rgb} */
  const rgbOf = (css) => {
    taster.fillStyle = '#000';
    taster.fillStyle = css.trim();
    const set = String(taster.fillStyle);
    if (set[0] === '#') return [parseInt(set.slice(1, 3), 16), parseInt(set.slice(3, 5), 16), parseInt(set.slice(5, 7), 16)];
    const [r, g, b] = (set.match(/[\d.]+/g) ?? []).map(Number);
    return [r || 0, g || 0, b || 0];
  };

  /** @type {Stage} */
  const stage = {
    ctx,
    width: 1,
    height: 1,
    time: 0,
    pointer: { x: 0, y: 0, vx: 0, vy: 0, down: false, pressed: false },
    colors: { paper: [255, 255, 255], ink: [0, 0, 0], muted: [120, 120, 120], rule: [200, 200, 200], lanes: [] },
    rgba: ([r, g, b], alpha = 1) => `rgba(${r}, ${g}, ${b}, ${alpha})`,
    playing: false,
  };

  // The colours come from the page's own tokens (the stage's --c1, --c2... are the topic colours), read again
  // whenever the theme changes.
  const readColors = () => {
    const style = getComputedStyle(root);
    const lanes = [];
    for (let i = 1; style.getPropertyValue(`--c${i}`).trim(); i++) lanes.push(rgbOf(style.getPropertyValue(`--c${i}`)));
    stage.colors = { paper: rgbOf(style.getPropertyValue('--paper')), ink: rgbOf(style.getPropertyValue('--ink')), muted: rgbOf(style.getPropertyValue('--muted')), rule: rgbOf(style.getPropertyValue('--rule')), lanes };
  };

  const measure = () => {
    const box = root.getBoundingClientRect();
    const density = Math.min(devicePixelRatio || 1, MAX_DENSITY);
    stage.width = Math.max(1, Math.round(box.width));
    stage.height = Math.max(1, Math.round(box.height));
    canvas.width = Math.round(stage.width * density);
    canvas.height = Math.round(stage.height * density);
    ctx.setTransform(density, 0, 0, density, 0, 0);
  };

  readColors();
  measure();
  const p = stage.pointer;
  p.x = stage.width / 2;
  p.y = stage.height / 2;
  // Where the real pointer last was, and when it last moved (before the stage's time began, so it starts drifting).
  let real = { x: p.x, y: p.y };
  let movedAt = -IDLE_AFTER;
  const piece = create(stage);

  /** @param {PointerEvent} e */
  const follow = (e) => {
    const box = canvas.getBoundingClientRect();
    real = { x: e.clientX - box.left, y: e.clientY - box.top };
    movedAt = stage.time;
  };
  canvas.addEventListener('pointermove', follow);
  canvas.addEventListener('pointerdown', (e) => {
    follow(e);
    // Straight to the finger: a tap far from the drifting point shouldn't have to wait for it to travel there.
    p.x = real.x;
    p.y = real.y;
    p.down = true;
    p.pressed = true;
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) canvas.addEventListener(type, () => { p.down = false; });

  /** @param {number} dt */
  const step = (dt) => {
    stage.time += dt;
    const t = stage.time;
    const wasX = p.x;
    const wasY = p.y;
    if (t - movedAt < IDLE_AFTER) {
      p.x = real.x;
      p.y = real.y;
    } else {
      // Nobody's moving it: wander in a slow, never-repeating figure, easing over from wherever it was left.
      const tx = stage.width * (0.5 + 0.34 * Math.sin(t * 0.53) * Math.cos(t * 0.19));
      const ty = stage.height * (0.5 + 0.3 * Math.sin(t * 0.81 + 1.1));
      const ease = Math.min(1, dt * 2.2);
      p.x += (tx - p.x) * ease;
      p.y += (ty - p.y) * ease;
    }
    if (dt > 0) {
      p.vx = (p.x - wasX) / dt;
      p.vy = (p.y - wasY) / dt;
    }
    piece.frame(dt);
    p.pressed = false;
  };

  let wanted = !still;
  let onScreen = true;
  let running = false;
  let last = 0;
  let handle = 0;
  /** @param {number} now */
  const loop = (now) => {
    // After a hitch (or a background tab), one long step would fling everything: cap it.
    step(Math.min(0.05, (now - last) / 1000));
    last = now;
    if (running) handle = requestAnimationFrame(loop);
  };
  const sync = () => {
    const should = wanted && onScreen && !document.hidden;
    if (should && !running) {
      running = true;
      last = performance.now();
      handle = requestAnimationFrame(loop);
    } else if (!should && running) {
      running = false;
      cancelAnimationFrame(handle);
    }
    stage.playing = running;
    if (toggle) toggle.textContent = wanted ? 'Pause' : 'Play';
  };
  // A paused stage still needs a picture after its size or colours change.
  const redraw = () => { if (!running) step(0); };

  new ResizeObserver(() => {
    measure();
    piece.resize?.();
    redraw();
  }).observe(root);
  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    sync();
  }).observe(root);
  document.addEventListener('visibilitychange', sync);
  const recolor = () => {
    readColors();
    redraw();
  };
  // The site's theme button changes this attribute.
  new MutationObserver(recolor).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  toggle?.addEventListener('click', () => {
    wanted = !wanted;
    sync();
  });

  // With "reduce motion" on, nothing moves until Play is pressed: two seconds of it are worked out unseen, so the
  // still picture shows the effect mid-flow rather than an empty stage.
  if (still) for (let i = 0; i < 120; i++) step(1 / 60);
  sync();
}
