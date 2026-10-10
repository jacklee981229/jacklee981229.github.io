// Magnetic Liquid's shaders (src/effects/magnetic-liquid.js), in the order a frame runs them. The puddle is shallow
// water: each cell's depth, and the speed of the liquid through its sides. The spikes are the Swift–Hohenberg
// equation, the pattern-forming equation physicists use for this instability, stepped spectrally: packed with its
// forces into one complex grid, Fourier transformed (fft-plan.js's passes), stepped in frequency, and transformed back.
// Then each spike is shaped into a cone from its own peak, laid on the puddle, and drawn as a mesh in a studio that
// changes with the site's theme. Everything is in the dish's units (scene.js); 32-bit float textures are only ever
// read with texelFetch, as iPhones can't filter them.
import { FIELD_GLSL } from '../../lib/magnet.js';
import { BOWL_GLSL } from './scene.js';
import { FULL_VERTEX } from '../gl.js';

export { FULL_VERTEX };

const HEAD = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
`;

/** The spikes' own numbers: how tall a spike stands for its peak, how much taller a stronger field makes it, and the
 * depths of liquid below which there's too little to rise into spikes. */
const SPIKE_GLSL = `
const float SPIKE = 0.09;
const float TALLER = 0.36;
const float THIN = 0.004;
const float DEEP = 0.012;
const float MENISCUS = 0.006;
const float DRY = 0.003;
// A spike's height from its own peak 'top': straight-sided to a sharp tip (the square root makes the slope at the
// tip finite instead of flat), broad and shallow in the valleys, joining with no crease where the two meet. Only real
// peaks are sharpened: on low, nearly flat ground every little rise would otherwise become a tiny cone.
float spike(float u, float top) {
  if (u <= 0.0 || top <= 1e-4) return 0.5 * u;
  float cone = top * (1.0 - sqrt(max(0.0, 1.0 - u / top)));
  return mix(0.5 * u, cone, smoothstep(0.12, 0.4, top));
}`;

const CELL_GLSL = `
vec2 cellAt(ivec2 c, int n) { return ((vec2(c) + 0.5) / float(n) - 0.5) * SPAN; }
ivec2 inside(ivec2 c, int n) { return clamp(c, ivec2(0), ivec2(n - 1)); }`;

/** The puddle at rest: level, wherever the floor is below its level. */
export const REST = `${HEAD}${BOWL_GLSL}${CELL_GLSL}
uniform int size;
out float depth;
void main() {
  float r = length(cellAt(ivec2(gl_FragCoord.xy), size));
  depth = r < 1.0 ? max(0.0, LEVEL - bowl(r)) : 0.0;
}`;

/**
 * The puddle's flow, one step, on a staggered grid: the speed through each cell's right side (x) and front side (y).
 * It speeds up down the slope of the level between the cells either side, the level being the liquid's surface less
 * the magnet's pull, so the liquid heaps up over the magnet and runs after it. Viscosity evens each side's speed out
 * with its neighbours', which damps short ripples fast and leaves the slow slosh of the whole puddle, as a thick liquid
 * does. Nothing flows through the dish's wall or between two dry cells, and no side carries off more than a quarter
 * of a cell's depth in a step, so no cell is ever drained below empty.
 */
export const FLOW = `${HEAD}${BOWL_GLSL}${FIELD_GLSL}${CELL_GLSL}
uniform sampler2D depth;
uniform sampler2D flow;
uniform vec4 magnet;
uniform float dt;
uniform float gravity;
uniform float keep;
uniform float thick;
out vec2 speed;
int n;
float level(ivec2 c) {
  vec2 p = cellAt(c, n);
  vec2 d = p - magnet.xy;
  return texelFetch(depth, c, 0).r + bowl(length(p)) - magnet.z * fieldShare(dot(d, d));
}
float open(ivec2 c) { return length(cellAt(c, n)) < 1.0 ? 1.0 : 0.0; }
void main() {
  n = textureSize(depth, 0).x;
  ivec2 c = ivec2(gl_FragCoord.xy);
  ivec2 r = inside(c + ivec2(1, 0), n);
  ivec2 l = inside(c - ivec2(1, 0), n);
  ivec2 f = inside(c + ivec2(0, 1), n);
  ivec2 b = inside(c - ivec2(0, 1), n);
  vec2 was = texelFetch(flow, c, 0).rg;
  vec2 around = texelFetch(flow, r, 0).rg + texelFetch(flow, l, 0).rg + texelFetch(flow, f, 0).rg + texelFetch(flow, b, 0).rg;
  was += thick * (around - 4.0 * was);
  float cell = SPAN / float(n);
  float here = level(c);
  vec2 s = was * keep - dt * gravity * vec2(level(r) - here, level(f) - here) / cell;
  float h = texelFetch(depth, c, 0).r;
  s.x *= open(c) * open(r) * step(1e-7, h + texelFetch(depth, r, 0).r);
  s.y *= open(c) * open(f) * step(1e-7, h + texelFetch(depth, f, 0).r);
  float most = 0.25 * cell / dt;
  speed = clamp(s, -most, most);
}`;

/**
 * The puddle's depth, one step on: what crossed each of its four sides, each the side's speed times the depth of the
 * cell it came from (so the same amount leaves one cell as enters the next, and the volume holds exactly), and the
 * liquid the spikes gave back as they sank, so a slumping crown sends out rings of ripples. Waves run faster in deeper
 * liquid: past 'deepest' they'd outrun a step's cell and the grid would ring, so deeper liquid moves as if that deep.
 */
export const DEPTH = `${HEAD}${BOWL_GLSL}${CELL_GLSL}
uniform sampler2D depth;
uniform sampler2D flow;
uniform sampler2D spikesNow;
uniform sampler2D spikesThen;
uniform float dt;
uniform float give;
uniform float deepest;
out float result;
void main() {
  int n = textureSize(depth, 0).x;
  ivec2 c = ivec2(gl_FragCoord.xy);
  ivec2 r = inside(c + ivec2(1, 0), n);
  ivec2 l = inside(c - ivec2(1, 0), n);
  ivec2 f = inside(c + ivec2(0, 1), n);
  ivec2 b = inside(c - ivec2(0, 1), n);
  float h = texelFetch(depth, c, 0).r;
  vec2 own = texelFetch(flow, c, 0).rg;
  float fromLeft = texelFetch(flow, l, 0).r;
  float fromBack = texelFetch(flow, b, 0).g;
  float right = own.x * min(own.x > 0.0 ? h : texelFetch(depth, r, 0).r, deepest);
  float front = own.y * min(own.y > 0.0 ? h : texelFetch(depth, f, 0).r, deepest);
  float left = fromLeft * min(fromLeft > 0.0 ? texelFetch(depth, l, 0).r : h, deepest);
  float back = fromBack * min(fromBack > 0.0 ? texelFetch(depth, b, 0).r : h, deepest);
  h += dt * (left - right + back - front) / (SPAN / float(n));
  // The spikes' change, averaged over the cells round this one: where a cell's spike swaps which peak it belongs to,
  // its shape jumps, and that alone shouldn't kick the puddle.
  float given = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    ivec2 q = inside(c + ivec2(i, j), n);
    given += texelFetch(spikesThen, q, 0).g - texelFetch(spikesNow, q, 0).g;
  }
  h += give * given / 9.0;
  result = max(h, 0.0);
}`;

/**
 * The spikes' step, part one: the height u beside its forces, as one complex number per cell (u + i·N), so one
 * transform does both. N is how far past its onset the liquid is here (the magnet's field, where there's liquid
 * enough) times u, plus the quadratic term that makes the pattern hexagons and the cubic that holds it, plus a part
 * of u that the frequency step takes back (it keeps big steps steady), plus a whisper of noise for it to grow from.
 */
export const PACK = `${HEAD}${BOWL_GLSL}${FIELD_GLSL}${SPIKE_GLSL}${CELL_GLSL}
uniform sampler2D state;
uniform sampler2D depth;
uniform vec4 magnet;
uniform float quad;
uniform float steady;
uniform float noise;
out vec2 packed;
// Noise with no direction in it: each coordinate is mixed in turn, rather than summed first and then mixed.
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float hash(ivec2 c, float seed) {
  return float(pcg(uint(c.x) + pcg(uint(c.y) + pcg(uint(seed))))) / 4294967295.0;
}
void main() {
  int n = textureSize(state, 0).x;
  ivec2 c = ivec2(gl_FragCoord.xy);
  float u = texelFetch(state, c, 0).r;
  vec2 d = cellAt(c, n) - magnet.xy;
  float e = mix(-1.0, onset(fieldShare(dot(d, d)), magnet.z), smoothstep(THIN, DEEP, texelFetch(depth, c, 0).r));
  packed = vec2(u, e * u + quad * u * u - u * u * u + steady * u + noise * (hash(c, magnet.w) - 0.5));
}`;

/**
 * One pass of the Stockham transform (fft-plan.js says which, and checks the same sums on the CPU): each output
 * gathers `radix` inputs a quarter (or half) of the line apart, turned by its twiddles. `axis` 0 runs along rows,
 * 1 down columns; `direction` −1 is forward, +1 back.
 */
export const FFT = `${HEAD}
uniform sampler2D source;
uniform int radix;
uniform int span;
uniform int axis;
uniform float direction;
out vec2 result;
vec2 times(vec2 a, vec2 b) { return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  int n = textureSize(source, 0).x;
  int o = axis == 0 ? c.x : c.y;
  int width = span * radix;
  int first = (o / width) * span + o % span;
  int gap = n / radix;
  // The twiddle's angle kept within half a turn either way, where sine and cosine are most exact.
  float a = direction * 6.283185307179586 * (fract(float(o % width) / float(width) + 0.5) - 0.5);
  vec2 w = vec2(cos(a), sin(a));
  vec2 turn = vec2(1.0, 0.0);
  vec2 sum = vec2(0.0);
  for (int m = 0; m < 4; m++) {
    if (m == radix) break;
    int at = first + m * gap;
    sum += times(texelFetch(source, axis == 0 ? ivec2(at, c.y) : ivec2(c.x, at), 0).rg, turn);
    turn = times(turn, w);
  }
  result = sum;
}`;

/**
 * The spikes' step, part two, in frequency: the height and its forces come apart again by their mirror images
 * (Z(k) and Z(−k)); then the stiff fourth-order term is taken implicitly, so a big step stays steady:
 * U' = (U + dt·N) / (1 + dt·((1 − q²)² + steady)), q the frequency over the spikes' own. Scaled for the way back.
 */
export const STEP = `${HEAD}
uniform sampler2D spectrum;
uniform float dt;
uniform float steady;
uniform float wave;
out vec2 result;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  int n = textureSize(spectrum, 0).x;
  vec2 z = texelFetch(spectrum, c, 0).rg;
  vec2 w = texelFetch(spectrum, (ivec2(n) - c) % n, 0).rg;
  vec2 height = 0.5 * vec2(z.x + w.x, z.y - w.y);
  vec2 push = 0.5 * vec2(z.y + w.y, w.x - z.x);
  vec2 k = vec2(c.x < n / 2 ? c.x : c.x - n, c.y < n / 2 ? c.y : c.y - n) * wave;
  float q = 1.0 - dot(k, k);
  result = (height + dt * push) / ((1.0 + dt * (q * q + steady)) * float(n * n));
}`;

/**
 * Each cell's own spike's peak, along one axis at a time: the most within `reach` cells (less than half the spikes'
 * spacing, so a cell near its own tip never takes a taller neighbour's), each found between cells by the parabola
 * through it and its two neighbours, so the peak isn't cut short by the grid.
 */
export const PEAK = `${HEAD}
uniform sampler2D source;
uniform ivec2 axis;
uniform int reach;
out float peak;
int n;
float at(ivec2 c) { return texelFetch(source, clamp(c, ivec2(0), ivec2(n - 1)), 0).r; }
void main() {
  n = textureSize(source, 0).x;
  ivec2 c = ivec2(gl_FragCoord.xy);
  float best = -1e9;
  for (int i = -12; i <= 12; i++) {
    if (i < -reach || i > reach) continue;
    ivec2 p = c + axis * i;
    float v = at(p);
    float a = at(p - axis);
    float b = at(p + axis);
    float bend = a + b - 2.0 * v;
    best = max(best, v >= a && v >= b && bend < 0.0 ? v - 0.125 * (b - a) * (b - a) / bend : v);
  }
  peak = best;
}`;

/** The spikes' shapes from their peaks, at the simulation's size: what the blur below takes the local mean of. */
export const SHAPE = `${HEAD}${SPIKE_GLSL}
uniform sampler2D state;
uniform sampler2D peaks;
out float shape;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  float u = texelFetch(state, c, 0).r;
  shape = spike(u, max(texelFetch(peaks, c, 0).r, u));
}`;

/**
 * A Gaussian blur along one axis, about a spike's spacing wide: the spikes' local mean, which the surface between
 * them sinks by, so the liquid in a spike comes from round it. The second pass also works out the spikes' rise at
 * the simulation's size (green), for the puddle to take the change from.
 */
export const BLUR = `${HEAD}${BOWL_GLSL}${FIELD_GLSL}${SPIKE_GLSL}${CELL_GLSL}
uniform sampler2D source;
uniform sampler2D shapes;
uniform sampler2D depth;
uniform ivec2 axis;
uniform float sigma;
uniform int last;
uniform vec4 magnet;
out vec2 result;
void main() {
  int n = textureSize(source, 0).x;
  ivec2 c = ivec2(gl_FragCoord.xy);
  int reach = int(ceil(2.5 * sigma));
  float sum = 0.0;
  float weight = 0.0;
  for (int i = -30; i <= 30; i++) {
    if (i < -reach || i > reach) continue;
    float w = exp(-0.5 * float(i * i) / (sigma * sigma));
    sum += w * texelFetch(source, inside(c + axis * i, n), 0).r;
    weight += w;
  }
  float mean = sum / weight;
  float rise = 0.0;
  if (last == 1) {
    vec2 d = cellAt(c, n) - magnet.xy;
    float lift = SPIKE * (1.0 + TALLER * max(0.0, magnet.z * magnet.z * FIELD_GAIN * fieldShare(dot(d, d)) - 1.0));
    rise = lift * smoothstep(THIN, DEEP, texelFetch(depth, c, 0).r) * (texelFetch(shapes, c, 0).r - mean);
  }
  result = vec2(mean, rise);
}`;

/**
 * The surface, at the mesh's size: the puddle's depth (a smooth B-spline, so the mirror shows no seams) rounded up
 * at its edge like a meniscus, plus the spikes, each shaped from its own peak after sharpening the height up to the
 * mesh's size, so the tips stay true points. Dry floor sinks out of sight just under the dish. Its height goes out
 * twice: in full float for the mesh, and in half float (filterable) for the reflections to march over.
 */
export const COMPOSE = `${HEAD}${BOWL_GLSL}${FIELD_GLSL}${SPIKE_GLSL}
uniform sampler2D state;
uniform sampler2D peaks;
uniform sampler2D spikes;
uniform sampler2D depth;
uniform vec4 magnet;
uniform int mesh;
layout(location = 0) out float surface;
layout(location = 1) out vec2 height;
int n;
vec4 catmull(float t) {
  float t2 = t * t;
  float t3 = t2 * t;
  return vec4(-0.5 * t3 + t2 - 0.5 * t, 1.5 * t3 - 2.5 * t2 + 1.0, -1.5 * t3 + 2.0 * t2 + 0.5 * t, 0.5 * t3 - 0.5 * t2);
}
vec4 bspline(float t) {
  float s = 1.0 - t;
  float t2 = t * t;
  return vec4(s * s * s, 3.0 * t2 * t - 6.0 * t2 + 4.0, -3.0 * t2 * t + 3.0 * t2 + 3.0 * t + 1.0, t2 * t) / 6.0;
}
float cubic(sampler2D s, vec2 at, bool soft) {
  vec2 base = floor(at);
  vec2 f = at - base;
  vec4 wx = soft ? bspline(f.x) : catmull(f.x);
  vec4 wy = soft ? bspline(f.y) : catmull(f.y);
  float sum = 0.0;
  for (int j = 0; j < 4; j++) {
    float row = 0.0;
    for (int i = 0; i < 4; i++) row += wx[i] * texelFetch(s, clamp(ivec2(base) + ivec2(i - 1, j - 1), ivec2(0), ivec2(n - 1)), 0).r;
    sum += wy[j] * row;
  }
  return sum;
}
float bilinear(sampler2D s, vec2 at) {
  vec2 base = floor(at);
  vec2 f = at - base;
  ivec2 b = ivec2(base);
  ivec2 top = ivec2(n - 1);
  float a = texelFetch(s, clamp(b, ivec2(0), top), 0).r;
  float x = texelFetch(s, clamp(b + ivec2(1, 0), ivec2(0), top), 0).r;
  float y = texelFetch(s, clamp(b + ivec2(0, 1), ivec2(0), top), 0).r;
  float xy = texelFetch(s, clamp(b + ivec2(1, 1), ivec2(0), top), 0).r;
  return mix(mix(a, x, f.x), mix(y, xy, f.x), f.y);
}
void main() {
  n = textureSize(depth, 0).x;
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec2 p = (vec2(c) / float(mesh - 1) - 0.5) * SPAN;
  vec2 at = (p / SPAN + 0.5) * float(n) - 0.5;
  float h = max(0.0, cubic(depth, at, true));
  float u = cubic(state, at, false);
  float top = max(bilinear(peaks, at), u);
  float mean = bilinear(spikes, at);
  vec2 d = p - magnet.xy;
  float lift = SPIKE * (1.0 + TALLER * max(0.0, magnet.z * magnet.z * FIELD_GAIN * fieldShare(dot(d, d)) - 1.0));
  float thick = sqrt(h * (h + MENISCUS));
  float rise = max(lift * smoothstep(THIN, DEEP, h) * (spike(u, top) - mean), -0.75 * thick);
  float y = bowl(length(p)) + thick + rise - DRY * (1.0 - smoothstep(0.0, 0.0015, h));
  surface = y;
  height = vec2(y, thick);
}`;

/**
 * The studio the liquid and the dish reflect, by the site's theme: a white product shot (a long strip softbox overhead
 * behind the dish, two tall strips at the sides, a soft panel behind the viewer, blue-grey walls under a dark ceiling,
 * so the black liquid stays black between its highlights), a black studio lit by a blue gel and an orange one from
 * either side, or the studio open to the night sky: curtains of aurora behind the dish, their glow low all round,
 * and the stars. Lights are
 * panels in angle. 'blur' spreads them for rougher surfaces and for normals that turn fast across a pixel, the same
 * light spread thinner rather than brighter, so the spikes' tips don't sparkle or turn grey.
 */
const STUDIO_GLSL = `
uniform int look;
uniform vec3 wall;
uniform vec3 soft;
uniform vec3 gelA;
uniform vec3 gelB;
uniform vec3 ground;
uniform vec3 skyTop;
uniform vec3 skyLow;
uniform vec3 aurora1;
uniform vec3 aurora2;
uniform vec3 aurora3;
uniform vec3 aurora4;
uniform vec3 glint;
uniform float time;
// How far the mirrored ray turns across one pixel (radians), set by the caller: a star mirrored in flat liquid is about
// that small.
float footprint = 0.0;
const float PI = 3.14159265;
const float DEG = PI / 180.0;
// How much of a box 'size' wide either side of 0, seen through a blur 'blur' wide either side of 'd'.
float overlap(float d, float size, float blur) {
  return max(0.0, min(d + blur, size) - max(d - blur, -size)) / (2.0 * blur);
}
float panel(float az, float el, vec4 rect, float blur) {
  float b = max(blur, 1e-4);
  return overlap(az - rect.x, rect.z, b) * overlap(el - rect.y, rect.w, b);
}
float hash2(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
// One curtain of aurora: a hem wavering at 'base' (radians) and fading upwards over 'height', from green through to
// violet, gathered into rays that drift and shimmer along it. Mirrored in the liquid the rays are streaks of light, as
// an aurora is on still water. Blurred, the curtain spreads out and dims.
vec3 curtain(float az, float el, float base, float height, float phase, float blur) {
  float hem = base + 0.05 * sin(1.3 * az + 0.11 * time + phase) + 0.015 * sin(4.7 * az - 0.19 * time + 2.0 * phase);
  float x = el - hem;
  if (x < -0.2 || x > 5.0 * height) return vec3(0.0);
  float sigma = sqrt(0.008 * 0.008 + blur * blur);
  float body = (x < 0.0 ? exp(-0.5 * x * x / (sigma * sigma)) : exp(-x / height)) * 0.008 / sigma;
  float fold = 0.5 + 0.5 * sin(70.0 * az + 0.35 * time + phase + 2.2 * sin(9.0 * az - 0.1 * time + phase));
  float rays = 0.04 + 0.96 * fold * fold * fold * fold * (0.65 + 0.35 * sin(23.0 * az - 0.27 * time + phase));
  // Where the mirrored ray sweeps across more than a fold within a pixel, the folds would alias into fringes: fade them.
  rays = mix(0.35, rays, exp(-(blur + footprint) * 30.0));
  float t = clamp(x / (2.0 * height), 0.0, 1.0);
  vec3 colour = t < 0.33 ? mix(aurora1, aurora2, t / 0.33) : t < 0.66 ? mix(aurora2, aurora3, (t - 0.33) / 0.33) : mix(aurora3, aurora4, (t - 0.66) / 0.34);
  return colour * body * rays * (1.0 - smoothstep(45.0 * DEG, 80.0 * DEG, abs(az)));
}
vec3 studio(vec3 r, float blur) {
  float el = asin(clamp(r.y, -1.0, 1.0));
  float az = atan(r.x, -r.z);
  if (look == 0) {
    vec3 c = el < 0.0 ? ground * 0.85 : mix(wall * 0.45, wall * 0.05, smoothstep(8.0 * DEG, 36.0 * DEG, el));
    c += soft * 16.0 * panel(az, el, vec4(0.0, 48.5 * DEG, 38.0 * DEG, 1.1 * DEG), blur);
    // Tall strips standing on the table either side, behind the dish: a spike's steep flanks look down and back at
    // them, so each carries a highlight running down it.
    c += soft * 9.0 * (panel(az, el, vec4(-48.0 * DEG, 0.0, 3.5 * DEG, 32.0 * DEG), blur) + panel(az, el, vec4(48.0 * DEG, 0.0, 3.5 * DEG, 32.0 * DEG), blur));
    // Behind the viewer, wrapping round past either side of the straight-back direction.
    c += soft * 0.8 * panel(abs(az), el, vec4(180.0 * DEG, 14.0 * DEG, 34.0 * DEG, 9.0 * DEG), blur);
    return c;
  }
  if (look == 1) {
    vec3 c = el < 0.0 ? ground * 0.5 : wall * 0.5;
    c += soft * 1.4 * panel(az, el, vec4(0.0, 48.5 * DEG, 38.0 * DEG, 0.8 * DEG), blur);
    // Behind the dish to either side, where a spike's flanks look: each spike is rimmed in the two colours.
    c += gelA * 22.0 * panel(az, el, vec4(-46.0 * DEG, -2.0 * DEG, 12.0 * DEG, 34.0 * DEG), blur);
    c += gelB * 22.0 * panel(az, el, vec4(46.0 * DEG, -2.0 * DEG, 12.0 * DEG, 34.0 * DEG), blur);
    return c;
  }
  vec3 c = el < 0.0 ? ground * 0.5 : mix(skyLow, skyTop, smoothstep(0.0, 60.0 * DEG, el)) * 4.0;
  if (el > 0.0) {
    // A curtain behind the dish whose rays the flat puddle mirrors (it sees 45 to 55 degrees up, straight back), and
    // a fainter one above, so the puddle's front shows the violet of its top.
    c += curtain(az, el, 45.5 * DEG, 4.0 * DEG, 0.0, blur) * 30.0;
    c += curtain(az, el, 53.5 * DEG, 3.0 * DEG, 2.4, blur) * 12.0;
    // And the aurora's soft glow low behind the viewer, which the spikes' front faces mirror, so each reads as a cone.
    float behind = abs(az > 0.0 ? az - PI : az + PI);
    float rise = (el - 14.0 * DEG) / (16.0 * DEG);
    c += mix(aurora2, aurora1, clamp(0.5 - rise, 0.0, 1.0)) * 1.8 * exp(-rise * rise) * (1.0 - smoothstep(35.0 * DEG, 85.0 * DEG, behind));
  }
  // The aurora's glow low on the horizon, all round the back: what the spikes' steep flanks catch.
  if (el > -0.6) {
    float t = (el + 0.6) / 0.75;
    float x = (el - 0.02) / 0.22;
    c += mix(aurora1, aurora2, clamp(t, 0.0, 1.0)) * 2.4 * exp(-x * x) * (1.0 - smoothstep(50.0 * DEG, 95.0 * DEG, abs(az)));
  }
  if (el > 0.0) {
    // Stars: a few in each patch of sky, each a point of light that a blur spreads out and dims.
    vec2 cell = vec2(az * cos(el), el) * 70.0;
    vec2 id = floor(cell);
    float h = hash2(id);
    if (h > 0.955 && el > 6.0 * DEG) {
      vec2 spot = id + 0.2 + 0.6 * vec2(hash2(id + 7.1), hash2(id + 3.7));
      float size = max(0.07, (max(blur - 0.006, 0.0) + 1.5 * footprint) * 70.0);
      float star = smoothstep(size, 0.0, length(cell - spot)) * (0.35 + 0.65 * (h - 0.955) / 0.045);
      // The brightest few stay bright enough to glint on a spike's curved flank, spread out as they are there.
      star *= h > 0.993 ? 10.0 : 1.0;
      c += glint * star * 26.0 * (0.07 * 0.07) / (size * size);
    }
  }
  return c;
}
// Light falling on a surface facing n, for the dish's porcelain and the liquid's own faint colour.
vec3 irradiance(vec3 n) {
  if (look == 0) {
    vec3 key = normalize(vec3(0.0, sin(50.0 * DEG), -cos(50.0 * DEG)));
    vec3 c = soft * 0.48 * max(0.0, dot(n, key)) + mix(ground, wall, 0.5 + 0.5 * n.y) * 0.55;
    c += soft * 0.16 * (max(0.0, dot(n, normalize(vec3(-0.94, 0.4, -0.2)))) + max(0.0, dot(n, normalize(vec3(0.94, 0.4, -0.2)))));
    return c;
  }
  if (look == 1) {
    vec3 c = gelA * 0.75 * max(0.0, dot(n, normalize(vec3(-0.95, 0.3, 0.05)))) + gelB * 0.75 * max(0.0, dot(n, normalize(vec3(0.95, 0.3, 0.05))));
    return c + soft * 0.08 * max(0.0, n.y) + wall * 0.5;
  }
  vec3 glow = (aurora1 + aurora2) * 0.5;
  return glow * 0.5 * max(0.0, dot(n, normalize(vec3(0.0, 0.5, -0.86)))) + mix(skyLow, skyTop, 0.5) * 3.0 + glow * 0.03;
}
float fresnel(float cosine, float f0) { return f0 + (1.0 - f0) * pow(1.0 - cosine, 5.0); }
// Bright highlights roll off rather than clip.
vec3 shoulder(vec3 c) {
  float m = max(c.r, max(c.g, c.b));
  return m > 0.8 ? c * (0.8 + 0.2 * (1.0 - exp(-(m - 0.8) / 0.2))) / m : c;
}
vec4 encode(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  vec3 s = mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  // Interleaved gradient noise: a dither finer than the eye can pick out, so the soft gradients don't band.
  float noise = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  return vec4(s + (noise - 0.5) / 255.0, 1.0);
}`;

/** The table under the dish: the card's own colour, with the dish's soft contact shadow, and the gels' spill. */
export const GROUND_VERTEX = `${HEAD}${BOWL_GLSL}
uniform mat4 viewProj;
out vec3 world;
void main() {
  vec2 corner = vec2(float(gl_VertexID & 1), float((gl_VertexID >> 1) & 1)) * 2.0 - 1.0;
  world = vec3(corner.x * 40.0, GROUND, corner.y * 40.0);
  gl_Position = viewProj * vec4(world, 1.0);
}`;

export const GROUND_FRAGMENT = `${HEAD}${BOWL_GLSL}${STUDIO_GLSL}
uniform vec3 shade;
in vec3 world;
out vec4 colour;
void main() {
  vec2 p = world.xz;
  float r = length(p);
  // Tight under the foot, and a wider, fainter shadow falling forward, away from the light behind.
  float near = exp(-max(0.0, r - 1.06) / 0.035);
  float wide = exp(-max(0.0, length((p - vec2(0.0, 0.09)) * vec2(1.0, 0.92)) - 0.98) / 0.32);
  float dark = clamp(0.5 * near + 0.24 * wide, 0.0, 0.85);
  vec3 c = mix(ground, shade, dark * (look == 0 ? 0.55 : 0.8));
  if (look == 1) {
    c += gelA * 0.05 * exp(-length(p - vec2(-1.7, 0.1)) / 0.9) + gelB * 0.05 * exp(-length(p - vec2(1.7, 0.1)) / 0.9);
  } else if (look == 2) {
    c += (aurora1 + aurora2) * 0.012 * exp(-length(p - vec2(0.0, -1.6)) / 1.2);
  }
  colour = encode(c);
}`;

/** The dish: glazed porcelain, a white or dark body under a clear coat that mirrors the studio. */
export const DISH_VERTEX = `${HEAD}
layout(location = 0) in vec3 position;
layout(location = 1) in vec3 normal;
uniform mat4 viewProj;
out vec3 world;
out vec3 facing;
void main() {
  world = position;
  facing = normal;
  gl_Position = viewProj * vec4(position, 1.0);
}`;

export const DISH_FRAGMENT = `${HEAD}${BOWL_GLSL}${STUDIO_GLSL}
uniform vec3 eye;
uniform vec3 body;
uniform sampler2D heights;
in vec3 world;
in vec3 facing;
out vec4 colour;
void main() {
  vec3 n = normalize(facing);
  vec3 v = normalize(eye - world);
  float r = length(world.xz);
  // Shade gathers where the floor curves up into the wall, and on the floor just round the black puddle.
  float corner = smoothstep(0.62, 0.97, r) * (1.0 - smoothstep(0.97, 1.02, r)) * clamp(1.0 - n.y, 0.0, 1.0);
  vec2 at = world.xz / SPAN + 0.5;
  float wet = 0.0;
  if (r < 1.0) for (int i = 0; i < 6; i++) {
    float a = float(i) * 1.0472;
    wet += texture(heights, at + vec2(cos(a), sin(a)) * 0.02).g;
  }
  float hug = r < 1.0 ? smoothstep(0.0, 0.02, wet / 6.0) : 0.0;
  float ao = (1.0 - 0.45 * corner) * (1.0 - 0.3 * hug);
  vec3 diffuse = body * irradiance(n) * ao;
  float nv = max(dot(n, v), 0.0);
  float blur = 0.09 + length(fwidth(n));
  // Under the night sky the glaze is satin, so the black liquid is what mirrors the sky sharply.
  vec3 coat = studio(reflect(-v, n), look == 2 ? blur * 3.0 + 0.08 : blur) * fresnel(nv, 0.045) * mix(1.0, ao, 0.6);
  colour = encode(shoulder(diffuse + coat));
}`;

/**
 * The liquid: a grid of rows (triangle strips, nearest rows first so the depth test spares the hidden ones), each
 * corner lifted to the surface's height. The way it faces comes from its neighbours' heights. Corners past the dish's
 * wall fold onto it, under the porcelain, out of sight.
 */
export const LIQUID_VERTEX = `${HEAD}${BOWL_GLSL}
uniform sampler2D surface;
uniform mat4 viewProj;
uniform int mesh;
out vec3 world;
out vec3 facing;
void main() {
  int row = mesh - 2 - gl_InstanceID;
  ivec2 c = ivec2(gl_VertexID >> 1, row + (gl_VertexID & 1));
  ivec2 top = ivec2(mesh - 1);
  float y = texelFetch(surface, c, 0).r;
  float right = texelFetch(surface, min(c + ivec2(1, 0), top), 0).r;
  float left = texelFetch(surface, max(c - ivec2(1, 0), ivec2(0)), 0).r;
  float front = texelFetch(surface, min(c + ivec2(0, 1), top), 0).r;
  float back = texelFetch(surface, max(c - ivec2(0, 1), ivec2(0)), 0).r;
  float cell = SPAN / float(mesh - 1);
  facing = vec3((left - right) / (2.0 * cell), 1.0, (back - front) / (2.0 * cell));
  vec2 p = (vec2(c) / float(mesh - 1) - 0.5) * SPAN;
  float r = length(p);
  if (r > 0.995) {
    p *= 0.995 / r;
    y = min(y, bowl(0.995) - 0.01);
  }
  world = vec3(p.x, y, p.y);
  gl_Position = viewProj * vec4(world, 1.0);
}`;

/**
 * The liquid's colour: near-black glass. Almost all of what shows is the studio mirrored in it (Fresnel: faint face
 * on, strong at a glancing angle), with its highlights widened where the surface turns fast across a pixel, so the
 * tips don't sparkle. The mirrored ray marches a few steps over the surface first: a neighbouring spike in its way
 * shows dark, so each spike carries small reflections of the ones around it.
 */
export const LIQUID_FRAGMENT = `${HEAD}${BOWL_GLSL}${STUDIO_GLSL}
uniform vec3 eye;
uniform vec3 tint;
uniform vec3 body;
uniform sampler2D heights;
uniform int march;
uniform int mesh;
in vec3 world;
in vec3 facing;
out vec4 colour;
void main() {
  vec3 n = normalize(facing);
  vec3 v = normalize(eye - world);
  float nv = max(dot(n, v), 0.0);
  vec3 r = reflect(-v, n);
  float spread = length(fwidth(n));
  float blur = 0.006 + 0.5 * spread;
  footprint = length(fwidth(r));
  vec3 mirrored = studio(r, blur);
  // Neighbours in the way of the mirrored ray, or the dish's own wall, which the liquid mirrors in its porcelain.
  float hidden = 0.0;
  vec3 hit = world;
  if (r.y > -0.2) {
    vec3 p = world;
    float stepLength = 0.022;
    for (int i = 0; i < 12; i++) {
      if (i >= march) break;
      p += r * stepLength;
      vec2 at = ((p.xz / SPAN + 0.5) * float(mesh - 1) + 0.5) / float(mesh);
      float under = clamp((texture(heights, at).r - p.y) / 0.012, 0.0, 1.0);
      if (under > hidden) {
        hidden = under;
        hit = p;
      }
      stepLength *= 1.18;
    }
  }
  vec3 neighbour = tint * irradiance(r) * 0.6 + studio(vec3(r.x, abs(r.y), r.z), blur * 4.0) * 0.06;
  vec2 inward = -hit.xz / max(length(hit.xz), 1e-3);
  vec3 porcelain = body * irradiance(normalize(vec3(inward.x, 0.6, inward.y)));
  mirrored = mix(mirrored, mix(neighbour, porcelain, smoothstep(0.94, 0.99, length(hit.xz))), hidden);
  vec3 c = tint * 0.05 * irradiance(n) + mirrored * fresnel(nv, 0.04);
  colour = encode(shoulder(c));
}`;
