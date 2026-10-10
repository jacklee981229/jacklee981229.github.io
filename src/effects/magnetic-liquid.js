// Magnetic Liquid: a puddle of black magnetic liquid in a white dish, with the pointer as a magnet under it. The
// puddle runs after the magnet and heaps up over it, and the surface there breaks into a crown of sharp spikes that
// re-tiles as the magnet moves: new spikes sprout ahead and sink behind. Nothing is animated by hand. The puddle is
// shallow water and the spikes are the Swift–Hohenberg equation, both solved on the GPU each frame at a fixed number
// of steps a second (the shaders, and why, are in magnetic-liquid/shaders.js; the dish and the camera in scene.js; the
// magnet's field and strengths in src/lib/magnet.js). Holding the button or a finger turns the magnet up: taller,
// sharper spikes and a wider crown; a lifted finger turns it off and the crown slumps into ripples. Nobody touching,
// the magnet wanders round the dish by itself. Its colours are the --magnet-* tokens, for the light theme's white
// studio, the dark theme's two coloured gels, and the night sky's aurora.
import { bind, caps, drawInto, governor, pingPong, program, stepper, target, tokens } from './gl.js';
import { fftPlan } from '../lib/fft-plan.js';
import { easeStrength, FINGER_LIFT, keepInside, LIFTED, REST, strengthGoal, wander } from '../lib/magnet.js';
import { camera, dishMesh, onLiquid, SPAN } from './magnetic-liquid/scene.js';
import * as glsl from './magnetic-liquid/shaders.js';
import stillLight from '../assets/effects/magnetic-liquid-light.webp?url';
import stillDark from '../assets/effects/magnetic-liquid-dark.webp?url';
import stillNight from '../assets/effects/magnetic-liquid-night.webp?url';

export const options = { context: 'webgl2', antialias: true, depth: true };

/** The --magnet-* tokens (tokens.css). */
const NAMES = ['backdrop', 'shade', 'wall', 'softbox', 'dish', 'liquid', 'gel-1', 'gel-2', 'sky-top', 'sky-low', 'aurora-1', 'aurora-2', 'aurora-3', 'aurora-4', 'glint'];
/** Simulation steps a second: the spikes', and the puddle's (shallow water wants shorter steps to stay steady). */
const SPIKE_RATE = 120;
const FLOW_RATE = 300;
/** The spikes' equation: its step (in its own time), the quadratic term that makes hexagons, the part of the step
 * taken implicitly to keep it steady, and the noise the pattern grows from. */
const SPIKE_STEP = 0.8;
const QUAD = 1.3;
const STEADY = 1;
const NOISE = 1e-3;
/** The spikes' spacing across the dish (12 across) as the frequency the equation favours, per simulation cell index. */
const WAVE = (Math.sqrt(3) * (1 / 6)) / (2 * SPAN);
/** The puddle: how fast its waves run (gravity, in the dish's units), how much of its motion it keeps each second,
 * how hard the magnet pulls at strength 1, and how much of the liquid the spikes rise and sink by goes back to it. */
const GRAVITY = 20;
const KEEP = 0.55;
const PULL = 0.03;
const GIVE = 0.7;
const VISCOSITY = 0.08;
/** The magnet glides after where it's put, as a weight on a spring would (per second), and eases into its wander. */
const GLIDE = 7;
const WANDER_EASE = 0.9;
/** After this many seconds with nobody touching, it draws only 30 frames a second. */
const IDLE_AFTER = 60;
/** The canvas never holds more pixels than this, however big the screen: full screen on a big monitor would cost far
 * more than it shows. */
const MOST_PIXELS = 4e6;

/** The quality ladder, best first: render scale, mesh size, reflection steps. The simulation's size never changes, so
 * the pattern keeps its character. */
const LADDER = [[1, 512, 12], [0.85, 512, 12], [0.7, 512, 12], [0.55, 512, 12], [0.55, 384, 12], [0.55, 256, 12], [0.55, 256, 6], [0.55, 256, 0]];
const PHONE_LADDER = [[0.7, 256, 12], [0.55, 256, 12], [0.55, 256, 6], [0.45, 256, 0]];

/** @param {import('./stage.js').Stage} stage @returns {import('./stage.js').Piece} */
export default function magneticLiquid(stage) {
  const { gl } = stage;
  const root = document.documentElement;
  /** 0 the light theme's white studio, 1 the dark theme's gels, 2 the night sky. */
  const lookNow = () => (root.dataset.sky === 'night' && root.dataset.theme === 'dark' ? 2 : root.dataset.theme === 'dark' ? 1 : 0);
  const stillFor = () => [stillLight, stillDark, stillNight][lookNow()];
  const ALT = 'Black liquid risen into a crown of spikes in a dish.';

  // No WebGL2, or no float textures to simulate in: a photo of it instead, in the theme being shown.
  let fallback = !gl;
  let seenLook = -1;
  const showFallback = () => {
    if (lookNow() === seenLook) return;
    seenLook = lookNow();
    stage.showStill(stillFor(), ALT);
  };
  if (gl && !caps(gl).float32) fallback = true;
  if (fallback || !gl) {
    showFallback();
    return { frame: showFallback };
  }

  const canvas = /** @type {HTMLCanvasElement} */ (gl.canvas);
  // A phone gets the smaller simulation and mesh: the same pattern, coarser.
  const phone = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 768;
  const SIM = phone ? 128 : 256;
  const ladder = phone ? PHONE_LADDER : LADDER;
  const plan = fftPlan(SIM);
  const cell = SPAN / SIM;
  const spacing = 1 / 6 / cell;

  /** @type {Record<string, import('./gl.js').Program>} */
  let progs = {};
  /** @type {any} */
  let t = {};
  let ready = false;
  let dish = { buffer: /** @type {WebGLBuffer | null} */ (null), vao: /** @type {WebGLVertexArrayObject | null} */ (null), count: 0 };
  let empty = /** @type {WebGLVertexArrayObject | null} */ (null);

  let rung = 0;
  let mesh = ladder[0][1];
  let march = ladder[0][2];
  const ladderGovernor = governor(ladder.length, (r) => {
    rung = r;
  });

  const build = () => {
    // A restored context starts with its extensions off: this turns float rendering back on.
    caps(gl);
    const make = (/** @type {string} */ fragment, vertex = glsl.FULL_VERTEX) => program(gl, vertex, fragment);
    progs = {
      rest: make(glsl.REST), flow: make(glsl.FLOW), depth: make(glsl.DEPTH), pack: make(glsl.PACK), fft: make(glsl.FFT), step: make(glsl.STEP),
      peak: make(glsl.PEAK), shape: make(glsl.SHAPE), blur: make(glsl.BLUR), compose: make(glsl.COMPOSE),
      ground: make(glsl.GROUND_FRAGMENT, glsl.GROUND_VERTEX), dish: make(glsl.DISH_FRAGMENT, glsl.DISH_VERTEX), liquid: make(glsl.LIQUID_FRAGMENT, glsl.LIQUID_VERTEX),
    };
    t = {
      depth: pingPong(gl, SIM, SIM, 'r32f'),
      flow: pingPong(gl, SIM, SIM, 'rg32f'),
      wave: pingPong(gl, SIM, SIM, 'rg32f'),
      peakX: target(gl, SIM, SIM, 'r32f'),
      peaks: target(gl, SIM, SIM, 'r32f'),
      shapes: target(gl, SIM, SIM, 'r32f'),
      blurX: target(gl, SIM, SIM, 'rg32f'),
      spikes: pingPong(gl, SIM, SIM, 'rg32f'),
    };
    makeSurface();
    const { data, count } = dishMesh(64);
    dish.buffer = gl.createBuffer();
    dish.vao = gl.createVertexArray();
    gl.bindVertexArray(dish.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, dish.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    gl.bindVertexArray(null);
    dish.count = count;
    empty = gl.createVertexArray();
    ready = false;
  };

  /** The surface at the mesh's size: its height in full float for the mesh, and in half float (with the puddle's
   * thickness) for the reflections' march and the dish's shade round the puddle. */
  const makeSurface = () => {
    t.surface?.texture && gl.deleteTexture(t.surface.texture);
    t.heights?.texture && gl.deleteTexture(t.heights.texture);
    t.surfaceFrame && gl.deleteFramebuffer(t.surfaceFrame);
    const surface = target(gl, mesh, mesh, 'r32f');
    const heights = target(gl, mesh, mesh, 'rg16f', { filter: 'linear' });
    // Both written by the one pass: a framebuffer of their own with the two side by side.
    gl.deleteFramebuffer(surface.framebuffer);
    gl.deleteFramebuffer(heights.framebuffer);
    const frame = /** @type {WebGLFramebuffer} */ (gl.createFramebuffer());
    gl.bindFramebuffer(gl.FRAMEBUFFER, frame);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, surface.texture, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, heights.texture, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    t.surface = surface;
    t.heights = heights;
    t.surfaceFrame = frame;
    t.surfaceSize = mesh;
  };

  // ---- The magnet: where it is, where it's heading, how strong.
  const magnet = { x: -1.3, z: 0.06, vx: 0, vz: 0, tx: wander(0)[0], tz: wander(0)[1], m: REST };
  // The pointer as this piece sees it: its kind, whether it's held, when it last really moved, when a finger lifted, and
  // when anyone last touched it at all (from the start, so the first minute runs at the screen's full rate).
  const input = { touch: false, down: false, movedAt: -Infinity, liftAt: -Infinity, usedAt: 0 };
  /** @param {PointerEvent} e */
  const moved = (e) => {
    input.touch = e.pointerType === 'touch';
    input.movedAt = input.usedAt = stage.time;
  };
  /** @param {PointerEvent} e */
  const pressed = (e) => {
    moved(e);
    input.down = true;
  };
  /** @param {PointerEvent} e */
  const released = (e) => {
    if (input.down && e.pointerType === 'touch') input.liftAt = stage.time;
    input.down = false;
    input.movedAt = input.usedAt = stage.time;
  };
  canvas.addEventListener('pointermove', moved);
  canvas.addEventListener('pointerdown', pressed);
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) canvas.addEventListener(type, /** @type {EventListener} */ (released));

  let view = camera(Math.max(0.1, stage.width / stage.height));
  /** Where the magnet is headed this frame, from the pointer while someone moves it, else its own wander. */
  const steer = (/** @type {number} */ dt) => {
    const now = stage.time;
    const live = input.down || now - input.movedAt < LIFTED;
    if (live) {
      const lift = input.touch ? FINGER_LIFT : 0;
      const hit = onLiquid(view.inverse, stage.pointer.x / stage.width, (stage.pointer.y - lift) / stage.height);
      if (hit) [magnet.tx, magnet.tz] = keepInside(hit[0], hit[1]);
    } else {
      const [wx, wz] = wander(now);
      const ease = Math.min(1, dt * WANDER_EASE);
      magnet.tx += (wx - magnet.tx) * ease;
      magnet.tz += (wz - magnet.tz) * ease;
    }
    // A weight on a spring, just damped enough not to overshoot: in two halves, so a long frame stays steady.
    for (let i = 0; i < 2; i++) {
      const h = dt / 2;
      magnet.vx += (GLIDE * GLIDE * (magnet.tx - magnet.x) - 2 * GLIDE * magnet.vx) * h;
      magnet.vz += (GLIDE * GLIDE * (magnet.tz - magnet.z) - 2 * GLIDE * magnet.vz) * h;
      magnet.x += magnet.vx * h;
      magnet.z += magnet.vz * h;
    }
    magnet.m = easeStrength(magnet.m, strengthGoal({ down: input.down, touch: input.touch, sinceLift: now - input.liftAt }), dt);
  };

  // ---- Colours, read again whenever the theme changes.
  /** @type {Record<string, number[]>} */
  let colour = {};
  let look = 0;
  /** @type {unknown} */
  let seenColors = null;
  const readColours = () => {
    colour = tokens(canvas, 'magnet', NAMES);
    look = lookNow();
    seenColors = stage.colors;
  };

  // ---- The passes.
  // One triangle over the target, from this piece's own empty vertex array: gl.js's fullScreen keeps one per context,
  // which a lost context takes with it, and a restored context can't use.
  const full = () => {
    gl.bindVertexArray(empty);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  /** @param {import('./gl.js').Program} p @param {string} name @param {number} unit @param {WebGLTexture} texture */
  const sampler = (p, name, unit, texture) => {
    bind(gl, unit, texture);
    gl.uniform1i(p.at(name), unit);
  };
  const magnetUniform = (/** @type {import('./gl.js').Program} */ p, /** @type {number} */ w) => gl.uniform4f(p.at('magnet'), magnet.x, magnet.z, magnet.m, w);
  let seed = 1;

  /** Puts the puddle at rest and clears the spikes. */
  const reset = () => {
    drawInto(gl, t.depth.read);
    progs.rest.use();
    gl.uniform1i(progs.rest.at('size'), SIM);
    full();
    for (const pair of [t.flow, t.wave, t.spikes]) {
      for (const which of [pair.read, pair.write]) {
        drawInto(gl, which);
        gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 0]);
      }
    }
    for (const one of [t.peakX, t.peaks, t.shapes, t.blurX]) {
      drawInto(gl, one);
      gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 0]);
    }
  };

  /** One step of the spikes: pack, transform, step in frequency, transform back. */
  const spikeStep = () => {
    let p = progs.pack.use();
    drawInto(gl, t.wave.write);
    sampler(p, 'state', 0, t.wave.read.texture);
    sampler(p, 'depth', 1, t.depth.read.texture);
    magnetUniform(p, seed++ % 100000);
    gl.uniform1f(p.at('quad'), QUAD);
    gl.uniform1f(p.at('steady'), STEADY);
    gl.uniform1f(p.at('noise'), NOISE);
    full();
    t.wave.swap();
    const transform = (/** @type {number} */ sign) => {
      const f = progs.fft.use();
      gl.uniform1f(f.at('direction'), sign);
      gl.uniform1i(f.at('source'), 0);
      for (const axis of [0, 1]) {
        gl.uniform1i(f.at('axis'), axis);
        for (const pass of plan) {
          drawInto(gl, t.wave.write);
          bind(gl, 0, t.wave.read.texture);
          gl.uniform1i(f.at('radix'), pass.radix);
          gl.uniform1i(f.at('span'), pass.span);
          full();
          t.wave.swap();
        }
      }
    };
    transform(-1);
    p = progs.step.use();
    drawInto(gl, t.wave.write);
    sampler(p, 'spectrum', 0, t.wave.read.texture);
    gl.uniform1f(p.at('dt'), SPIKE_STEP);
    gl.uniform1f(p.at('steady'), STEADY);
    gl.uniform1f(p.at('wave'), WAVE);
    full();
    t.wave.swap();
    transform(1);
  };

  /** Each spike's peak, its shape, and the local mean the surface between them sinks by. */
  const shapeSpikes = () => {
    let p = progs.peak.use();
    gl.uniform1i(p.at('reach'), Math.max(1, Math.round(0.4 * spacing)));
    drawInto(gl, t.peakX);
    sampler(p, 'source', 0, t.wave.read.texture);
    gl.uniform2i(p.at('axis'), 1, 0);
    full();
    drawInto(gl, t.peaks);
    sampler(p, 'source', 0, t.peakX.texture);
    gl.uniform2i(p.at('axis'), 0, 1);
    full();
    p = progs.shape.use();
    drawInto(gl, t.shapes);
    sampler(p, 'state', 0, t.wave.read.texture);
    sampler(p, 'peaks', 1, t.peaks.texture);
    full();
    p = progs.blur.use();
    gl.uniform1f(p.at('sigma'), 0.45 * spacing);
    magnetUniform(p, 0);
    sampler(p, 'shapes', 1, t.shapes.texture);
    sampler(p, 'depth', 2, t.depth.read.texture);
    drawInto(gl, t.blurX);
    sampler(p, 'source', 0, t.shapes.texture);
    gl.uniform2i(p.at('axis'), 1, 0);
    gl.uniform1i(p.at('last'), 0);
    full();
    drawInto(gl, t.spikes.write);
    sampler(p, 'source', 0, t.blurX.texture);
    gl.uniform2i(p.at('axis'), 0, 1);
    gl.uniform1i(p.at('last'), 1);
    full();
    t.spikes.swap();
  };

  /** One step of the puddle. `give` is the share of the spikes' change since last frame it takes back this step. */
  const flowStep = (/** @type {number} */ give) => {
    const dt = 1 / FLOW_RATE;
    let p = progs.flow.use();
    drawInto(gl, t.flow.write);
    sampler(p, 'depth', 0, t.depth.read.texture);
    sampler(p, 'flow', 1, t.flow.read.texture);
    gl.uniform4f(p.at('magnet'), magnet.x, magnet.z, PULL * magnet.m * magnet.m, 0);
    gl.uniform1f(p.at('dt'), dt);
    gl.uniform1f(p.at('gravity'), GRAVITY);
    gl.uniform1f(p.at('keep'), Math.pow(KEEP, dt));
    gl.uniform1f(p.at('thick'), VISCOSITY);
    full();
    t.flow.swap();
    p = progs.depth.use();
    drawInto(gl, t.depth.write);
    sampler(p, 'depth', 0, t.depth.read.texture);
    sampler(p, 'flow', 1, t.flow.read.texture);
    sampler(p, 'spikesNow', 2, t.spikes.read.texture);
    sampler(p, 'spikesThen', 3, t.spikes.write.texture);
    gl.uniform1f(p.at('dt'), dt);
    gl.uniform1f(p.at('give'), give);
    // A wave crosses at most 0.55 of a cell a step: shallow water on a staggered grid stays steady up to about 0.7.
    gl.uniform1f(p.at('deepest'), (0.55 * cell * FLOW_RATE) ** 2 / GRAVITY);
    full();
    t.depth.swap();
  };

  const compose = () => {
    if (t.surfaceSize !== mesh) makeSurface();
    const p = progs.compose.use();
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.surfaceFrame);
    gl.viewport(0, 0, mesh, mesh);
    sampler(p, 'state', 0, t.wave.read.texture);
    sampler(p, 'peaks', 1, t.peaks.texture);
    sampler(p, 'spikes', 2, t.spikes.read.texture);
    sampler(p, 'depth', 3, t.depth.read.texture);
    magnetUniform(p, 0);
    gl.uniform1i(p.at('mesh'), mesh);
    full();
  };

  /** The studio's colours, for each program that shades. @param {import('./gl.js').Program} p */
  const studio = (p) => {
    gl.uniform1i(p.at('look'), look);
    const set = (/** @type {string} */ name, /** @type {string} */ token) => gl.uniform3fv(p.at(name), colour[token]);
    set('wall', 'wall');
    set('soft', 'softbox');
    set('gelA', 'gel-1');
    set('gelB', 'gel-2');
    set('ground', 'backdrop');
    set('skyTop', 'sky-top');
    set('skyLow', 'sky-low');
    set('aurora1', 'aurora-1');
    set('aurora2', 'aurora-2');
    set('aurora3', 'aurora-3');
    set('aurora4', 'aurora-4');
    set('glint', 'glint');
    gl.uniform1f(p.at('time'), stage.time);
  };

  /** The card's own colour, back in the screen's units, for clearing to. */
  const clearToBackdrop = () => {
    const [r, g, b] = colour.backdrop.map((v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055));
    gl.clearColor(r, g, b, 1);
  };

  const draw = () => {
    drawInto(gl, null);
    clearToBackdrop();
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    let p = progs.ground.use();
    gl.uniformMatrix4fv(p.at('viewProj'), false, view.viewProj);
    studio(p);
    gl.uniform3fv(p.at('shade'), colour.shade);
    gl.bindVertexArray(empty);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    p = progs.dish.use();
    gl.uniformMatrix4fv(p.at('viewProj'), false, view.viewProj);
    gl.uniform3fv(p.at('eye'), view.eye);
    gl.uniform3fv(p.at('body'), colour.dish);
    studio(p);
    sampler(p, 'heights', 0, t.heights.texture);
    gl.bindVertexArray(dish.vao);
    gl.drawArrays(gl.TRIANGLES, 0, dish.count);
    p = progs.liquid.use();
    gl.uniformMatrix4fv(p.at('viewProj'), false, view.viewProj);
    gl.uniform3fv(p.at('eye'), view.eye);
    gl.uniform3fv(p.at('tint'), colour.liquid);
    gl.uniform3fv(p.at('body'), colour.dish);
    gl.uniform1i(p.at('mesh'), mesh);
    gl.uniform1i(p.at('march'), march);
    studio(p);
    sampler(p, 'surface', 0, t.surface.texture);
    sampler(p, 'heights', 1, t.heights.texture);
    gl.bindVertexArray(empty);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 2 * mesh, mesh - 1);
    gl.bindVertexArray(null);
    gl.disable(gl.DEPTH_TEST);
  };

  /** While the shaders compile: the card's own colour, so nothing flashes. */
  const blank = () => {
    drawInto(gl, null);
    clearToBackdrop();
    gl.clear(gl.COLOR_BUFFER_BIT);
  };

  const spikeSteps = stepper(SPIKE_RATE, 4);
  const flowSteps = stepper(FLOW_RATE, 8);
  /** Runs the simulation on by its own fixed steps for `dt` seconds of the stage's time. */
  const simulate = (/** @type {number} */ dt, spikesNow = spikeSteps(dt), flowNow = flowSteps(dt)) => {
    for (let i = 0; i < spikesNow; i++) spikeStep();
    if (spikesNow > 0) shapeSpikes();
    for (let i = 0; i < flowNow; i++) flowStep(spikesNow > 0 ? GIVE / flowNow : 0);
  };

  /** Ready to draw once every shader has compiled (in the background, where the browser can). */
  const isReady = () => {
    if (ready) return true;
    if (!Object.values(progs).every((p) => p.ready())) return false;
    ready = true;
    reset();
    shapeSpikes();
    return true;
  };

  // ---- Less motion: a still of a crown formed over the middle, worked out unseen over a few frames, then drawn once.
  let own = 0;
  const warmUp = () => {
    let chunks = 0;
    const tick = () => {
      own = 0;
      if (stage.playing) return;
      if (document.hidden || !isReady()) {
        own = requestAnimationFrame(tick);
        return;
      }
      if (!colour.backdrop || seenColors !== stage.colors) readColours();
      if (chunks === 0) Object.assign(magnet, { x: 0, z: 0.05, tx: 0, tz: 0.05, vx: 0, vz: 0, m: 1.15 });
      // A second and a half of the puddle and the spikes each frame, in small enough pieces that no frame is long.
      for (let i = 0; i < 16; i++) spikeStep();
      shapeSpikes();
      for (let i = 0; i < 30; i++) flowStep(0);
      if (++chunks < 12) {
        own = requestAnimationFrame(tick);
        return;
      }
      stage.redraw();
    };
    own = requestAnimationFrame(tick);
  };

  build();
  readColours();
  if (stage.still) warmUp();

  let rungSet = -1;
  let lastDraw = 0;
  let idling = false;
  /** Time not yet simulated, from frames skipped while idling at 30 a second. */
  let owed = 0;
  return {
    frame(dt) {
      if (seenColors !== stage.colors) readColours();
      if (!isReady()) {
        blank();
        return;
      }
      // Quality: the governor's rung, and never more pixels than MOST_PIXELS.
      if (rung !== rungSet) {
        rungSet = rung;
        mesh = ladder[rung][1];
        march = ladder[rung][2];
      }
      const most = Math.sqrt(MOST_PIXELS / Math.max(1, stage.width * stage.height * stage.density * stage.density));
      const scale = Math.min(ladder[rung][0], most);
      if (Math.abs(stage.scale - scale) > 0.01) stage.setScale(scale);
      const now = performance.now();
      if (dt > 0) {
        // A minute with nobody touching: 30 frames a second is plenty for the wander.
        const idle = stage.time - input.usedAt > IDLE_AFTER && !input.down;
        // Told only when it changes: holding starts the governor's count of late and roomy seconds over.
        if (idle !== idling) ladderGovernor.hold((idling = idle));
        owed += dt;
        if (idle && now - lastDraw < 33) return;
        ladderGovernor.tick(now);
        steer(owed);
        simulate(owed);
        owed = 0;
      }
      lastDraw = now;
      compose();
      draw();
    },
    resize() {
      view = camera(Math.max(0.1, stage.width / stage.height));
    },
    restore() {
      build();
      if (stage.still) warmUp();
    },
    stop() {
      cancelAnimationFrame(own);
      canvas.removeEventListener('pointermove', moved);
      canvas.removeEventListener('pointerdown', pressed);
      for (const type of ['pointerup', 'pointercancel', 'pointerleave']) canvas.removeEventListener(type, /** @type {EventListener} */ (released));
    },
  };
}
