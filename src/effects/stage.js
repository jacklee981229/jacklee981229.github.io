// What every effect shares: a canvas that fills its stage, the pointer (a mouse, a finger, or a slow drift of its
// own while nobody moves it), the site's colours in the theme being shown, and a loop that only runs while it's
// worth it: the stage on screen, the tab in front, and not paused. A piece draws with the 2D canvas, or asks for
// WebGL2 (its helpers in gl.js).

/** Seconds without the pointer moving before the stage starts drifting on its own. */
const IDLE_AFTER = 2.5;
/** More pixels than this per CSS pixel costs speed without looking any sharper. */
const MAX_DENSITY = 2;

/**
 * @typedef {[number, number, number]} Rgb
 * @typedef {{
 *   ctx: CanvasRenderingContext2D, gl: WebGL2RenderingContext | null, width: number, height: number, time: number,
 *   density: number, scale: number, still: boolean,
 *   pointer: { x: number, y: number, vx: number, vy: number, down: boolean, pressed: boolean },
 *   colors: { paper: Rgb, ink: Rgb, muted: Rgb, rule: Rgb, lanes: Rgb[] },
 *   rgba: (color: Rgb, alpha?: number) => string,
 *   playing: boolean,
 *   setScale: (scale: number) => void,
 *   redraw: () => void,
 *   showStill: (src: string | null, alt?: string) => void,
 * }} Stage
 * `pointer.pressed` is true for the one frame after a click or a tap. Sizes are in CSS pixels. `playing` is false
 * while the stage is paused, off screen or in a hidden tab: an effect that makes sound keeps quiet then.
 * A WebGL2 piece (options.context 'webgl2') gets `gl` and no `ctx`, unless the browser has no WebGL2: then `gl` is null
 * and `ctx` is the 2D context, for whatever the piece shows instead. Its canvas is `density` × `scale` pixels to a CSS
 * pixel: `setScale` lowers that to draw fewer pixels on a slow device, and takes effect at once. `still` is true when
 * less motion is asked for: a WebGL2 piece then makes its own still picture (the stage doesn't run it unseen first, as
 * shaders take a while to be ready), and calls `redraw` to have it drawn once. `showStill` lays a picture over the
 * canvas, or takes it away with null: for a piece that can't run here.
 * @typedef {{ frame: (dt: number) => void, resize?: () => void, stop?: () => void, restore?: () => void }} Piece
 * `stop`, for an effect that listens beyond its canvas (Key Jam's keys), lets go of that when the stage stops.
 * `restore`, for a WebGL2 piece, makes its GL things again after the browser gave back a context it took away.
 * @typedef {{ context?: '2d' | 'webgl2', antialias?: boolean, depth?: boolean }} StageOptions
 */

/**
 * Starts an effect on its stage. `root` holds the canvas and the Pause button; `create` builds the effect from the
 * stage and returns what draws one frame. Returns what stops it for good, so the Effects page can start another on the
 * same stage (give that one a fresh canvas: this one's own listeners stay on it).
 * @param {HTMLElement} root @param {(stage: Stage) => Piece} create @param {StageOptions} [options] @returns {() => void}
 */
export function runStage(root, create, options = {}) {
  const canvas = /** @type {HTMLCanvasElement} */ (root.querySelector('canvas'));
  // A WebGL2 piece draws on the GPU; its canvas is opaque, as the card's colour is drawn by the piece itself.
  const gl = options.context === 'webgl2'
    ? /** @type {WebGL2RenderingContext | null} */ (canvas.getContext('webgl2', { alpha: false, antialias: options.antialias ?? false, depth: options.depth ?? false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance' }))
    : null;
  const ctx = /** @type {CanvasRenderingContext2D} */ (gl ? null : canvas.getContext('2d'));
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

  let started = false;
  /** @type {Stage} */
  const stage = {
    ctx,
    gl,
    width: 1,
    height: 1,
    time: 0,
    density: 1,
    scale: 1,
    still,
    pointer: { x: 0, y: 0, vx: 0, vy: 0, down: false, pressed: false },
    colors: { paper: [255, 255, 255], ink: [0, 0, 0], muted: [120, 120, 120], rule: [200, 200, 200], lanes: [] },
    rgba: ([r, g, b], alpha = 1) => `rgba(${r}, ${g}, ${b}, ${alpha})`,
    playing: false,
    setScale: (scale) => {
      stage.scale = Math.min(1, Math.max(0.25, scale));
      size();
    },
    // Only once the stage is running: a piece calls it when its own work (shaders, a still) is ready.
    redraw: () => { if (started) redraw(); },
    showStill: (src, alt = '') => {
      root.querySelector('[data-stage-still]')?.remove();
      if (!src) return;
      const picture = document.createElement('img');
      picture.src = src;
      picture.alt = alt;
      picture.dataset.stageStill = '';
      // Over the canvas, under the stage's buttons.
      picture.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none';
      canvas.after(picture);
    },
  };

  // The colours come from the page's own tokens (the stage's --c1, --c2... are the topic colours), read again
  // whenever the theme changes.
  const readColors = () => {
    const style = getComputedStyle(root);
    const lanes = [];
    for (let i = 1; style.getPropertyValue(`--c${i}`).trim(); i++) lanes.push(rgbOf(style.getPropertyValue(`--c${i}`)));
    stage.colors = { paper: rgbOf(style.getPropertyValue('--paper')), ink: rgbOf(style.getPropertyValue('--ink')), muted: rgbOf(style.getPropertyValue('--muted')), rule: rgbOf(style.getPropertyValue('--rule')), lanes };
  };

  /** Sizes the canvas's pixels to the stage: a WebGL2 piece's at its chosen scale too. Resizing clears the canvas. */
  const size = () => {
    const pixels = stage.density * (gl ? stage.scale : 1);
    const width = Math.max(1, Math.round(stage.width * pixels));
    const height = Math.max(1, Math.round(stage.height * pixels));
    // A WebGL2 piece's picture is cleared only when its size really changes.
    if (!gl || canvas.width !== width) canvas.width = width;
    if (!gl || canvas.height !== height) canvas.height = height;
    ctx?.setTransform(stage.density, 0, 0, stage.density, 0, 0);
  };
  const measure = () => {
    const box = root.getBoundingClientRect();
    stage.density = Math.min(devicePixelRatio || 1, MAX_DENSITY);
    stage.width = Math.max(1, Math.round(box.width));
    stage.height = Math.max(1, Math.round(box.height));
    size();
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
    // A button or finger held still sends no moves, but it's still there: it never drifts away while held.
    if (p.down || t - movedAt < IDLE_AFTER) {
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
  /** While the browser has taken a WebGL2 piece's context away (as iPhones do to background tabs). */
  let lost = false;
  /** @param {number} now */
  const loop = (now) => {
    // After a hitch (or a background tab), one long step would fling everything: cap it.
    // The first frame's time stamp can be a little older than the moment the loop started: never a step below zero.
    step(Math.max(0, Math.min(0.05, (now - last) / 1000)));
    last = now;
    if (running) handle = requestAnimationFrame(loop);
  };
  const sync = () => {
    const should = wanted && onScreen && !document.hidden && !lost;
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
  const redraw = () => { if (!running && !lost) step(0); };

  const resized = new ResizeObserver(() => {
    measure();
    piece.resize?.();
    // Resizing cleared a WebGL2 canvas, and the next frame would come too late to hide it: draw now, running or not.
    if (gl && !lost) step(0);
    else redraw();
  });
  resized.observe(root);
  const seen = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    sync();
  });
  seen.observe(root);
  document.addEventListener('visibilitychange', sync);
  const recolor = () => {
    readColors();
    redraw();
  };
  // The site's theme button changes these: the theme, and the night sky (which keeps the dark theme, in its own colours).
  const themed = new MutationObserver(recolor);
  themed.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-sky'] });
  const flip = () => {
    wanted = !wanted;
    sync();
  };
  toggle?.addEventListener('click', flip);

  // The browser may take a WebGL2 piece's context away; it gives it back only if asked (preventDefault). Every GL thing
  // the piece made is gone then, so it makes them again (restore) before it draws on.
  /** @param {Event} e */
  const loseIt = (e) => {
    e.preventDefault();
    lost = true;
    sync();
  };
  const restoreIt = () => {
    lost = false;
    piece.restore?.();
    sync();
    redraw();
  };
  if (gl) {
    canvas.addEventListener('webglcontextlost', loseIt);
    canvas.addEventListener('webglcontextrestored', restoreIt);
  }

  // With "reduce motion" on, nothing moves until Play is pressed: two seconds of it are worked out unseen, so the
  // still picture shows the effect mid-flow rather than an empty stage. A WebGL2 piece makes its own still, once its
  // shaders are ready.
  if (still && !gl) for (let i = 0; i < 120; i++) step(1 / 60);
  sync();
  started = true;

  return () => {
    wanted = false;
    sync();
    resized.disconnect();
    seen.disconnect();
    themed.disconnect();
    document.removeEventListener('visibilitychange', sync);
    toggle?.removeEventListener('click', flip);
    piece.stop?.();
    root.querySelector('[data-stage-still]')?.remove();
    if (gl) {
      // Let go of the context at once: browsers keep only a few, and the Effects page swaps effects often.
      canvas.removeEventListener('webglcontextlost', loseIt);
      canvas.removeEventListener('webglcontextrestored', restoreIt);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  };
}
