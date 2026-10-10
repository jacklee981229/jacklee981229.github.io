// Jack's Writing Islands' weather (the piece is islands.js): rain falling on the land as it rises, running downhill,
// picking up what it can carry where it runs fast and steep and dropping it where it slows, and rock sliding where it's
// steeper than it can stand. The water flows between neighbouring cells through "pipes", as in Mei, Decaudin and Hu's
// fast hydraulic erosion on the GPU (2007), with Jákó and Tóth's limit on what a thin film can carry; hard rock (code)
// gives up less than soft (prose), and stands steeper.
// One step is three passes over the grid, and every fourth step a fourth: the flow out of each cell; the water, its
// speed and the cutting and dropping; the carried sediment moving on with the water, and drying; the sliding rock.
// Heights are shares of the land's width, the sea level 0. The land is a grid of the same size on every device, so the
// same posts grow the same land everywhere (to the rounding of each GPU).
import { FULL_VERTEX, bind, drawInto, fullScreen, pingPong, program, target } from '../effects/gl.js';

/**
 * The weather's settings. Rain and drying are heights per step; `flow` is how readily water runs downhill; `carry`,
 * `cut` and `drop` how much sediment running water can hold, how fast it takes up more and how fast it lets it go;
 * `deep` the depth at which water carries all it can (a thin film carries little); `talus` the steepest slopes soft and
 * hard rock stand at, `slide` how fast rock beyond that slips down, `creep` how fast soft ground evens out, and `fill`
 * how fast a picture's lake fills.
 */
export const WEATHER = {
  rain: 0.0000032,
  storm: 0.000016,
  dry: 0.0000024,
  dryShare: 0.0004,
  flow: 0.24,
  friction: 0.95,
  carry: 6.6,
  cut: 0.1,
  drop: 0.04,
  deep: 0.0012,
  slope: 0.012,
  talusSoft: 0.55,
  talusHard: 2.6,
  slide: 0.11,
  creep: 0.01,
  fill: 0.0001,
};

/** Steps an island's land takes to rise from the sea, and a ridge from its island. */
export const RISE = { island: 140, ridge: 90 };

/** Storms wandering over the islands while it rains, each in a slow loop of its own: its loop's middle and reach
 *  (shares of the land), its radius, and how fast it goes round (radians a step, across and along). */
export const STORMS = [
  [0.48, 0.42, 0.34, 0.2, 0.15, 0.0013, 0.0021, 0.4],
  [0.5, 0.5, 0.3, 0.26, 0.12, 0.0017, 0.0011, 2.1],
  [0.45, 0.47, 0.36, 0.22, 0.17, 0.0009, 0.0016, 4.4],
];

/** Where a storm is at step `k`: [x, z, radius]. @param {number[]} storm @param {number} k */
export function stormAt(storm, k) {
  const [x, z, rx, rz, radius, sx, sz, from] = storm;
  return [x + rx * Math.sin(from + sx * k), z + rz * Math.sin(from * 1.7 + sz * k), radius];
}

const HEADER = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
`;

// What every pass shares: the grid, reading a cell (the edges repeat, as walls), and this step's rise of the land.
const COMMON = `${HEADER}
uniform sampler2D state;   // bed, water, sediment, and how much has been laid down (below 0, cut away)
uniform sampler2D lift;    // the shallows' rise, the island's land's, the ridge's, and the day the ridge starts
uniform sampler2D ground;  // hardness, post, lake, island (out of 1)
uniform int size;
uniform float step0;       // this step, counted from the replay's start
uniform float perDay;      // steps in a day
uniform float baseRamp;    // steps an island's land takes to rise, and a ridge
uniform float ridgeRamp;
uniform float islandRise[8]; // the step each island's land starts rising
uniform float raining;     // 1 while it rains, 0 once it has stopped
uniform vec3 storms[3];
uniform float rainBase;
uniform float rainStorm;
ivec2 at(ivec2 p) { return clamp(p, ivec2(0), ivec2(size - 1)); }
vec4 cell(ivec2 p) { return texelFetch(state, at(p), 0); }
float ramp(float x) { x = clamp(x, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
// How far the land here has risen by step k, from the sea floor: the shallows first, then the island, then the ridge.
float risen(vec4 l, int island, float k) {
  float own = island > 0 ? islandRise[min(island - 1, 7)] : 0.0;
  return l.x * ramp(k / baseRamp) + l.y * ramp((k - own) / baseRamp) + l.z * ramp((k - l.w * perDay) / ridgeRamp);
}
float rainAt(vec2 p) {
  float r = rainBase;
  for (int i = 0; i < 3; i++) {
    vec2 d = (p - storms[i].xy) / storms[i].z;
    r += rainStorm * exp(-2.5 * dot(d, d));
  }
  return r * raining;
}
`;

/** P1: the water flowing out of each cell to its four neighbours, from how far its surface stands above theirs. */
const FLUX = `${COMMON}
uniform sampler2D flux;    // out to the left, right, back and front
uniform float flow;
uniform float friction;
out vec4 outFlux;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 c = cell(p);
  float d = c.y;
  float surface = c.x + d;
  vec4 cl = cell(p + ivec2(-1, 0));
  vec4 cr = cell(p + ivec2(1, 0));
  vec4 cb = cell(p + ivec2(0, -1));
  vec4 cf = cell(p + ivec2(0, 1));
  vec4 n = vec4(cl.x + cl.y, cr.x + cr.y, cb.x + cb.y, cf.x + cf.y);
  vec4 f = max(vec4(0.0), texelFetch(flux, p, 0) * friction + flow * (surface - n));
  // Nothing flows out over the grid's edge.
  if (p.x == 0) f.x = 0.0;
  if (p.x == size - 1) f.y = 0.0;
  if (p.y == 0) f.z = 0.0;
  if (p.y == size - 1) f.w = 0.0;
  float total = f.x + f.y + f.z + f.w;
  // Never more out than there is.
  if (total > d) f *= d / total;
  outFlux = f;
}`;

/** P2: the water after this step's flows and rain; its speed; what it cuts from the bed or drops on it; and the land's
 *  rise. The sea is a level the water runs into and never fills. */
const WATER = `${COMMON}
uniform sampler2D flux;
uniform sampler2D hollow;  // in a picture's lake: the way to its middle and its radius (cells), and its depth
uniform float fill;
uniform float carry;
uniform float cut;
uniform float drop;
uniform float deep;
uniform float slope;
layout(location = 0) out vec4 outState;
layout(location = 1) out vec2 outSpeed;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 c = cell(p);
  vec4 f = texelFetch(flux, p, 0);
  vec4 fl = texelFetch(flux, at(p + ivec2(-1, 0)), 0);
  vec4 fr = texelFetch(flux, at(p + ivec2(1, 0)), 0);
  vec4 fb = texelFetch(flux, at(p + ivec2(0, -1)), 0);
  vec4 ff = texelFetch(flux, at(p + ivec2(0, 1)), 0);
  float inflow = fl.y + fr.x + fb.w + ff.z;
  float outflow = f.x + f.y + f.z + f.w;
  vec2 here = (vec2(p) + 0.5) / float(size);
  float bed = c.x;
  float d = max(0.0, c.y + inflow - outflow);
  vec4 m = texelFetch(ground, p, 0);
  if (bed > 0.0) d += rainAt(here);
  // Its speed, in cells a step: the water through the cell each way, over its mean depth.
  vec2 v = vec2(fl.y - f.x + f.y - fr.x, fb.w - f.z + f.w - ff.z) * 0.5 / max(0.5 * (c.y + d), 0.00005);
  v = clamp(v, -1.0, 1.0);
  // How steeply the water's surface falls here, as a slope's sine: on land that's the ground's slope, but where a
  // stream runs into a lake or the sea it flattens out, and the water slows and drops what it carries rather than
  // cutting down into the shore.
  vec4 cr = cell(p + ivec2(1, 0));
  vec4 cl = cell(p + ivec2(-1, 0));
  vec4 cf = cell(p + ivec2(0, 1));
  vec4 cb = cell(p + ivec2(0, -1));
  float gx = (cr.x + cr.y - cl.x - cl.y) * 0.5 * float(size);
  float gz = (cf.x + cf.y - cb.x - cb.y) * 0.5 * float(size);
  float g = sqrt(gx * gx + gz * gz);
  float sine = max(g / sqrt(1.0 + g * g), slope);
  float capacity = carry * sine * length(v) * min(d, deep);
  float s = c.z;
  float deposit = c.w;
  // A cell never cuts below its lowest neighbour, nor builds up far over its highest: left to themselves, cutting and
  // dropping feed on each other cell by cell, into pits and spikes.
  float low = min(min(cl.x, cr.x), min(cb.x, cf.x));
  float high = max(max(cl.x, cr.x), max(cb.x, cf.x));
  vec4 h = texelFetch(hollow, p, 0);
  if (capacity > s) {
    // Hard rock gives up little, and a picture's lake and the rock round it nothing, so it stays a lake; a list's
    // walled terraces hold their soil, as terraced fields do.
    float walls = h.z == 0.0 && h.w > 0.0 ? 0.08 : 1.0;
    float taken = min(cut * (capacity - s) * (1.0 - m.x) * walls * (1.0 - smoothstep(0.0, 0.3, m.z)), max(0.0, bed - low) * 0.5);
    bed -= taken;
    s += taken;
    deposit -= taken;
  } else {
    // Nothing settles in a picture's lake, so it stays a lake.
    float left = min(drop * (s - capacity) * (1.0 - smoothstep(0.0, 0.3, m.z)), max(0.0, high - bed) * 0.5 + 0.00002);
    bed += left;
    s -= left;
    deposit += left;
  }
  vec4 l = texelFetch(lift, p, 0);
  int island = int(m.w * 255.0 + 0.5);
  bed += risen(l, island, step0 + 1.0) - risen(l, island, step0);
  // A picture's lake, once its ridge has risen, is kept a lake: dug again as a bowl under the lowest ground just round
  // it as that wears down, and filled to there as if from a spring, whichever way the streams above it were carried
  // off.
  if (h.z > 0.0 && step0 > l.w * perDay + ridgeRamp) {
    vec2 middle = vec2(p) + h.xy;
    float lip = 1e9;
    for (int i = 0; i < 16; i++) {
      float a = float(i) * 0.3927;
      ivec2 q = at(ivec2(floor(middle + vec2(cos(a), sin(a)) * h.z * 1.3)));
      // Only ground that isn't another lake: lakes side by side would otherwise dig each other ever deeper.
      if (texelFetch(hollow, q, 0).z == 0.0) lip = min(lip, cell(q).x);
    }
    if (lip < 1e8) {
      // Never so low its floor would be under the sea.
      lip = max(lip, h.w + 0.001);
      float r = length(h.xy) / h.z;
      bed = min(bed, lip - h.w * pow(max(0.0, 1.0 - r * r), 1.4));
      // Up to just short of the lip, and never over it: what the streams bring beyond that seeps away. A lake that
      // spilled over would cut its lip down, and itself with it, all the way to the sea.
      d = min(lip - 0.0012 - bed, d + fill);
    }
  }
  // Under the sea, the water's surface is the sea's.
  if (bed < 0.0) d = -bed;
  outState = vec4(bed, d, s, deposit);
  outSpeed = v;
}`;

/** P3: the sediment carried on with the water (read from where the water came, between cells by hand, as float
 *  textures can't be blended everywhere), and the water drying. */
const CARRY = `${COMMON}
uniform sampler2D speed;
uniform float dry;
uniform float dryShare;
out vec4 outState;
float sediment(vec2 q) {
  vec2 f = q - 0.5;
  ivec2 i = ivec2(floor(f));
  vec2 t = f - floor(f);
  float a = cell(i).z, b = cell(i + ivec2(1, 0)).z, c = cell(i + ivec2(0, 1)).z, e = cell(i + ivec2(1, 1)).z;
  return mix(mix(a, b, t.x), mix(c, e, t.x), t.y);
}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 c = cell(p);
  vec2 v = texelFetch(speed, p, 0).xy;
  float s = sediment(vec2(p) + 0.5 - v);
  float d = c.y;
  // A picture's lake never dries: it fills, and spills over.
  if (c.x > 0.0 && texelFetch(ground, p, 0).z < 0.01) d = max(0.0, d * (1.0 - dryShare) - dry);
  outState = vec4(c.x, d, s, c.w);
}`;

/** P4: rock steeper than it can stand slides to the lower neighbours. Each pair of cells works out the same slide
 *  from both sides, from the higher one's rock, so nothing is lost or made. And soft ground creeps a little towards its
 *  neighbours' height, as soil does, which keeps the rain from combing it into rills a cell apart. */
const SLIDE = `${COMMON}
uniform sampler2D hollow;  // where a list's terraces are walled: 1 in its last channel, outside any lake
uniform float talusSoft;
uniform float talusHard;
uniform float slide;
uniform float creep;
out vec4 outState;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 c = cell(p);
  vec4 m = texelFetch(ground, p, 0);
  float hard = m.x;
  // A picture's lake is kept by the water pass; nothing slides or creeps into it or out, or its lip would feed it
  // rock for ever.
  if (m.z > 0.01) {
    outState = c;
    return;
  }
  // A list's terraces are walled, so their steps stand as steep as hard rock while the rain still wears them.
  vec4 wall = texelFetch(hollow, p, 0);
  float mine = (wall.z == 0.0 && wall.w > 0.0 ? talusHard : mix(talusSoft, talusHard, hard * hard)) / float(size);
  float change = 0.0;
  const ivec2 around[8] = ivec2[8](ivec2(-1, -1), ivec2(0, -1), ivec2(1, -1), ivec2(-1, 0), ivec2(1, 0), ivec2(-1, 1), ivec2(0, 1), ivec2(1, 1));
  for (int k = 0; k < 8; k++) {
    ivec2 o = around[k];
    ivec2 q = at(p + o);
    if (q == p) continue;
    vec4 mq = texelFetch(ground, q, 0);
    if (mq.z > 0.01) continue;
    float far = length(vec2(o));
    float other = cell(q).x;
    float diff = c.x - other;
    if (diff > 0.0) change -= slide * max(0.0, diff - mine * far) / far;
    else {
      vec4 theirWall = texelFetch(hollow, q, 0);
      float theirs = (theirWall.z == 0.0 && theirWall.w > 0.0 ? talusHard : mix(talusSoft, talusHard, mq.x * mq.x)) / float(size);
      change += slide * max(0.0, -diff - theirs * far) / far;
    }
  }
  float sum = 0.0;
  float count = 0.0;
  for (int k = 1; k < 8; k += 2) {
    ivec2 q = at(p + around[k]);
    if (texelFetch(ground, q, 0).z > 0.01) continue;
    sum += cell(q).x;
    count += 1.0;
  }
  if (c.x > 0.0 && count > 0.0 && !(wall.z == 0.0 && wall.w > 0.0)) change += creep * (1.0 - hard) * (sum / count - c.x);
  outState = vec4(c.x + change, c.yzw);
}`;

/**
 * The weather on a grid of `size` cells a side. `load` takes the maps the land rises from (islands.js's stampMaps)
 * and starts from the flat sea floor; `step(k, raining)` runs step k. `state` is the texture to draw from: bed, water,
 * sediment and deposit per cell.
 * @param {WebGL2RenderingContext} gl @param {number} size
 */
export function createWeather(gl, size) {
  const programs = {
    flux: program(gl, FULL_VERTEX, FLUX),
    water: program(gl, FULL_VERTEX, WATER),
    carry: program(gl, FULL_VERTEX, CARRY),
    slide: program(gl, FULL_VERTEX, SLIDE),
  };
  const state = pingPong(gl, size, size, 'rgba32f');
  // Full floats: a thin film's flows are millionths, where half floats lose their precision (or, on some GPUs, vanish).
  const flux = pingPong(gl, size, size, 'rgba32f');
  // The speed is written beside the state in one pass: the same kind of texture as it, which every GPU that draws
  // into one draws into both.
  const speed = target(gl, size, size, 'rg32f');
  const lift = target(gl, size, size, 'rgba32f');
  const ground = target(gl, size, size, 'rgba8');
  const hollow = target(gl, size, size, 'rgba32f');
  // The water pass writes the state and the speed at once: a framebuffer for each of the two state textures.
  const waterOut = new Map([state.read, state.write].map((t) => {
    const fb = /** @type {WebGLFramebuffer} */ (gl.createFramebuffer());
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.texture, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, speed.texture, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    return [t.texture, fb];
  }));
  const complete = [...waterOut.values()].every((fb) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  });
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  let perDay = 3;
  let islandRise = new Float32Array(8);
  /** Whether the settings that stay the same from step to step are set on the programs yet. */
  let configured = false;
  const storms = new Float32Array(STORMS.length * 3);

  /** Sets, once (and again after each load), what stays the same from step to step: which texture is on which unit,
   *  the grid, the days, and the weather's settings. A step then sets only what changes. */
  const configure = () => {
    for (const p of Object.values(programs)) {
      p.use();
      gl.uniform1i(p.at('state'), 0);
      gl.uniform1i(p.at('lift'), 1);
      gl.uniform1i(p.at('ground'), 2);
      gl.uniform1i(p.at('size'), size);
      gl.uniform1f(p.at('perDay'), perDay);
      gl.uniform1f(p.at('baseRamp'), RISE.island);
      gl.uniform1f(p.at('ridgeRamp'), RISE.ridge);
      gl.uniform1fv(p.at('islandRise[0]'), islandRise);
      gl.uniform1f(p.at('rainBase'), WEATHER.rain);
      gl.uniform1f(p.at('rainStorm'), WEATHER.storm);
    }
    const pf = programs.flux.use();
    gl.uniform1i(pf.at('flux'), 3);
    gl.uniform1f(pf.at('flow'), WEATHER.flow);
    gl.uniform1f(pf.at('friction'), WEATHER.friction);
    const pw = programs.water.use();
    gl.uniform1i(pw.at('flux'), 3);
    gl.uniform1i(pw.at('hollow'), 5);
    for (const name of ['fill', 'carry', 'cut', 'drop', 'deep', 'slope']) gl.uniform1f(pw.at(name), WEATHER[/** @type {keyof typeof WEATHER} */ (name)]);
    gl.uniform1i(programs.carry.use().at('speed'), 4);
    const ps = programs.slide.use();
    gl.uniform1i(ps.at('hollow'), 5);
    for (const name of ['talusSoft', 'talusHard', 'slide', 'creep']) gl.uniform1f(ps.at(name), WEATHER[/** @type {keyof typeof WEATHER} */ (name)]);
    configured = true;
  };

  return {
    /** False where this GPU can't draw the weather's two textures at once: the page shows the islands' photo instead. */
    ok: complete,
    get state() { return state.read.texture; },
    get lift() { return lift.texture; },
    get ground() { return ground.texture; },
    get hollow() { return hollow.texture; },
    ready: () => Object.values(programs).every((p) => p.ready()),
    /**
     * Starts again from the flat sea floor, with these maps to rise from. `stepsPerDay` is how many steps a day is, and
     * `rises` the day each island's land starts rising (islands.js's islands' `rise`).
     * @param {{ lift: Float32Array, ground: Uint8Array, hollow: Float32Array, seaFloor: number }} maps @param {number} stepsPerDay @param {number[]} rises
     */
    load: (maps, stepsPerDay, rises) => {
      configured = false;
      perDay = stepsPerDay;
      islandRise = Float32Array.from({ length: 8 }, (_, i) => (rises[i] ?? 0) * stepsPerDay);
      const seaFloor = maps.seaFloor;
      gl.bindTexture(gl.TEXTURE_2D, lift.texture);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, size, size, gl.RGBA, gl.FLOAT, maps.lift);
      gl.bindTexture(gl.TEXTURE_2D, ground.texture);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, maps.ground);
      gl.bindTexture(gl.TEXTURE_2D, hollow.texture);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, size, size, gl.RGBA, gl.FLOAT, maps.hollow);
      const flat = new Float32Array(size * size * 4);
      for (let i = 0; i < size * size; i++) {
        flat[i * 4] = seaFloor;
        flat[i * 4 + 1] = -seaFloor;
      }
      for (const t of [state.read, state.write]) {
        gl.bindTexture(gl.TEXTURE_2D, t.texture);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, size, size, gl.RGBA, gl.FLOAT, flat);
      }
      for (const t of [flux.read, flux.write]) {
        drawInto(gl, t);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
    },
    /** Runs step `k`: `raining` 1 while it rains, 0 once it has stopped (the water then drains away). @param {number} k @param {number} raining */
    step: (k, raining) => {
      if (!configured) configure();
      gl.disable(gl.BLEND);
      bind(gl, 1, lift.texture);
      bind(gl, 2, ground.texture);
      bind(gl, 5, hollow.texture);
      // P1: the flows out.
      drawInto(gl, flux.write);
      programs.flux.use();
      bind(gl, 0, state.read.texture);
      bind(gl, 3, flux.read.texture);
      fullScreen(gl);
      flux.swap();
      // P2: the water, its speed, the cutting and the dropping, into the state and the speed at once.
      gl.bindFramebuffer(gl.FRAMEBUFFER, /** @type {WebGLFramebuffer} */ (waterOut.get(state.write.texture)));
      gl.viewport(0, 0, size, size);
      const pw = programs.water.use();
      gl.uniform1f(pw.at('step0'), k);
      gl.uniform1f(pw.at('raining'), raining);
      STORMS.forEach((storm, i) => storms.set(stormAt(storm, k), i * 3));
      gl.uniform3fv(pw.at('storms[0]'), storms);
      bind(gl, 3, flux.read.texture);
      fullScreen(gl);
      state.swap();
      // P3: the sediment carried on, and drying.
      drawInto(gl, state.write);
      const pc = programs.carry.use();
      gl.uniform1f(pc.at('dry'), WEATHER.dry * (raining ? 1 : 3));
      gl.uniform1f(pc.at('dryShare'), WEATHER.dryShare * (raining ? 1 : 4));
      bind(gl, 0, state.read.texture);
      bind(gl, 4, speed.texture);
      fullScreen(gl);
      state.swap();
      // P4, every fourth step: the sliding rock.
      if (k % 4 === 3) {
        drawInto(gl, state.write);
        programs.slide.use();
        bind(gl, 0, state.read.texture);
        fullScreen(gl);
        state.swap();
      }
    },
    dispose: () => {
      state.dispose();
      flux.dispose();
      speed.dispose();
      lift.dispose();
      ground.dispose();
      hollow.dispose();
      for (const fb of waterOut.values()) gl.deleteFramebuffer(fb);
    },
  };
}
