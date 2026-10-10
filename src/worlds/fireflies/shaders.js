// The GPU programs for Jack's Firefly River (src/worlds/fireflies.js), in GLSL ES 3.00. The fireflies' rules are
// src/lib/fireflies/sync.js's, the same numbers written into these programs, so the tests' CPU copy keeps the GPU
// honest. The picture is built in light's own units: the sky, the three rows of trees relit by the fireflies, the
// fireflies themselves and the lanterns' glow into one bright picture, which the last pass mirrors into the river,
// gives its bloom and mist, and brings down to the screen's range; the lanterns' paper goes on after that, in its
// note's own colour.
import { CENTRE, FALL, FASTEST, FEATHER, RISE, SLOWEST } from '../../lib/fireflies/sync.js';

/** A number as GLSL wants it: always with a decimal point. @param {number} x */
const f = (x) => (Number.isInteger(x) ? x.toFixed(1) : String(x));

const HEAD = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
`;

/** The flash, the firefly's response and the hash every program shares. */
const COMMON = `
#define TAU 6.283185307
#define PI 3.141592654
const float RISE = ${f(RISE)};
const float FALL = ${f(FALL)};
const float CENTRE = ${f(CENTRE)};
const float SLOWEST = ${f(SLOWEST)};
const float FASTEST = ${f(FASTEST)};
const float FEATHER = ${f(FEATHER)};
float flash(float theta, float pace) {
  float since = theta / pace;
  float until = (1.0 - theta) / pace;
  float fall = since < FALL ? 0.5 + 0.5 * cos(PI * since / FALL) : 0.0;
  float rise = until < RISE ? 0.5 - 0.5 * cos(PI * (1.0 - until / RISE)) : 0.0;
  return max(fall, rise);
}
float hash(uint x) {
  x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16;
  return float(x) / 4294967296.0;
}
// When each firefly wakes, two to six seconds into the river's opening, so they come out one by one.
float awakeAt(int i, float story) {
  float at = 2.0 + 4.0 * hash(uint(i) * 3u + 1u);
  return smoothstep(at, at + 0.6, story);
}
`;

/** One triangle over the whole target, for passes that work on every pixel or cell. */
export const COVER = `${HEAD}
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/** Each firefly's flash into its cell of the light's picture: its light in red, and one in alpha, to count them. */
export const SPLAT_VERTEX = `${HEAD}${COMMON}
uniform sampler2D state, home;
uniform int width;
uniform vec2 grid;
uniform float story;
out vec4 light;
void main() {
  int i = gl_VertexID;
  ivec2 p = ivec2(i % width, i / width);
  vec4 s = texelFetch(state, p, 0);
  vec4 m = texelFetch(home, p, 0);
  float awake = awakeAt(i, story);
  vec2 cell = min(floor(m.xy * grid), grid - 1.0) + 0.5;
  gl_Position = vec4(cell / grid * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = 1.0;
  light = vec4(flash(s.x, s.y) * awake * (1.0 - s.z), 0.0, 0.0, awake);
}`;

export const PASS_FRAGMENT = `${HEAD}
in vec4 light;
out vec4 color;
void main() { color = light; }`;

/** The lanterns', taps' and the torch's glows into the light's picture, each a gaussian of its own reach. */
export const LIGHTS_VERTEX = `${HEAD}
uniform vec4 lights[16];
uniform vec4 channels[16];
uniform vec2 grid;
out vec4 mask;
out vec3 glow;
void main() {
  vec4 l = lights[gl_VertexID];
  gl_Position = vec4(l.xy * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = l.w > 0.0 ? ceil(l.z * 5.0) * 2.0 + 1.0 : 0.0;
  mask = channels[gl_VertexID] * l.w / (6.283185307 * l.z * l.z);
  glow = vec3(l.xy * grid, l.z);
}`;

export const LIGHTS_FRAGMENT = `${HEAD}
in vec4 mask;
in vec3 glow;
out vec4 color;
void main() {
  vec2 d = gl_FragCoord.xy - glow.xy;
  color = mask * exp(-dot(d, d) / (2.0 * glow.z * glow.z));
}`;

/** One direction of a gaussian blur of the light's picture, with nothing beyond its edges. */
export const BLUR_FRAGMENT = `${HEAD}
uniform sampler2D src;
uniform ivec2 dir;
uniform int radius;
uniform float weights[24];
out vec4 color;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  ivec2 size = textureSize(src, 0);
  vec4 sum = vec4(0.0);
  for (int k = -radius; k <= radius; k++) {
    ivec2 q = p + dir * k;
    if (q.x < 0 || q.y < 0 || q.x >= size.x || q.y >= size.y) continue;
    sum += texelFetch(src, q, 0) * weights[k < 0 ? -k : k];
  }
  color = sum;
}`;

/** One step of every firefly's clock (sync.js's stepBank), and the torch's dark round it. */
export const UPDATE_FRAGMENT = `${HEAD}${COMMON}
uniform sampler2D state, home, field;
uniform int width, loners;
uniform vec2 grid;
uniform float h, phase, pull, story, own, halo, tall;
uniform float couple, learn, forget, drive, keep, follow, followKeep;
uniform vec4 beat;
uniform float beatWeight;
uniform float torchGain;
out vec4 next;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  int i = p.y * width + p.x;
  vec4 s = texelFetch(state, p, 0);
  vec4 m = texelFetch(home, p, 0);
  float theta = s.x, pace = s.y, dark = s.z, since = s.w;
  vec4 f = texelFetch(field, ivec2(min(floor(m.xy * grid), grid - 1.0)), 0);
  float awake = awakeAt(i, story);
  float b = flash(theta, pace) * awake * (1.0 - dark);
  bool alone = i >= loners;
  float seen = alone ? 0.0 : max(0.0, f.r + f.b - b * own) / (max(0.0, f.a - awake * own) + halo);
  float z = -sin(TAU * (theta - CENTRE));
  float reached = beatWeight > 0.0 ? beatWeight * smoothstep(0.0, 1.0, clamp((beat.w - length(vec2(m.x - beat.y, (m.y - beat.z) * tall))) / FEATHER, 0.0, 1.0)) : 0.0;
  float behindTrue = sin(TAU * (phase - theta));
  float behindTapped = sin(TAU * (beat.x - theta));
  float dr = alone ? 0.0 : (1.0 - reached) * pull * drive * behindTrue + reached * follow * behindTapped;
  float kp = alone ? 0.0 : (1.0 - reached) * pull * keep * behindTrue + reached * followKeep * behindTapped;
  float speed = max(0.0, pace / max(0.35, 1.0 - couple * seen * z) + dr);
  float ahead = theta + h * speed;
  since += h;
  if (ahead >= 1.0) {
    if (since < 1.0 / FASTEST) ahead = 0.99999;
    else { ahead -= 1.0; since = 0.0; }
  }
  pace = clamp(pace + h * ((m.z - pace) / forget + learn * seen * z * speed / pace + kp), SLOWEST, FASTEST);
  // The torch's light goes into green: the fireflies under it go dark quickly, and come back over a second or two.
  float torch = clamp(f.g * torchGain, 0.0, 1.0);
  dark += (torch - dark) * (1.0 - exp(-h / (torch > dark ? 0.12 : 0.6)));
  next = vec4(ahead, pace, dark, since);
}`;

/** Every clock moved on by the same share of a turn: after a gap, so the bank picks up from true time. */
export const SHIFT_FRAGMENT = `${HEAD}
uniform sampler2D state;
uniform float shift, gap;
out vec4 next;
void main() {
  vec4 s = texelFetch(state, ivec2(gl_FragCoord.xy), 0);
  next = vec4(fract(s.x + shift), s.y, s.z, s.w + gap);
}`;

/** The sky: the theme's two colours from the top down to the far bank, a glow along it, stars, and the aurora under
 *  the night sky. */
export const SKY_FRAGMENT = `${HEAD}
uniform vec3 top, low, glow, star;
uniform vec3 aurora[5];
uniform float glowing, stars, auroras, zenith, horizon, time, pixel;
uniform vec2 view;
out vec4 color;
float hash2(vec2 p) {
  uvec2 q = uvec2(ivec2(p) + 4096);
  uint x = q.x * 1597334677u ^ q.y * 3812015801u;
  x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16;
  return float(x) / 4294967296.0;
}
float noise(vec2 p) {
  vec2 i = floor(p), u = fract(p);
  u = u * u * (3.0 - 2.0 * u);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), u.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), u.x), u.y);
}
void main() {
  vec2 s = gl_FragCoord.xy / view;
  float up = clamp((s.y - horizon) / (1.0 - horizon), 0.0, 1.0);
  vec3 c = mix(low, top, pow(up, 0.75)) * mix(1.0, zenith, smoothstep(0.3, 1.0, up));
  c += glow * glowing * exp(-pow(up / 0.16, 2.0));
  // Stars, one at most in each cell of 26 CSS pixels, faint near the trees.
  vec2 px = gl_FragCoord.xy / pixel;
  vec2 cell = floor(px / 26.0);
  float pick = hash2(cell);
  if (stars > 0.0 && pick < 0.32 * stars) {
    vec2 at = (cell + 0.2 + 0.6 * vec2(hash2(cell + 17.0), hash2(cell + 39.0))) * 26.0;
    float d = length(px - at);
    float twinkle = 0.75 + 0.25 * sin(time * (0.6 + 1.7 * hash2(cell + 5.0)) + pick * 40.0);
    float size = 0.45 + 0.6 * hash2(cell + 77.0);
    c += star * exp(-d * d / (size * size)) * (0.25 + 0.75 * hash2(cell + 3.0)) * twinkle * smoothstep(0.02, 0.2, up) * stars;
  }
  // The aurora: curtains along a band high up, folding slowly, green at their foot and violet higher up.
  if (auroras > 0.0) {
    float x = s.x * view.x / view.y;
    float foot = 0.64 + 0.08 * sin(x * 1.3 + time * 0.03) + 0.05 * sin(x * 3.7 - time * 0.05) + 0.025 * sin(x * 9.0 + time * 0.1);
    float above = up - foot;
    float rays = noise(vec2(x * 26.0 + noise(vec2(x * 3.0, time * 0.05)) * 3.0, time * 0.08));
    rays = 0.35 + 0.65 * rays * rays;
    // Brightest along its wavy foot, fading up into rays and softly down, the curtains hanging well clear of the trees;
    // in some stretches and not others, as real ones come and go along the sky.
    float stretch = smoothstep(0.25, 0.65, noise(vec2(x * 0.9 + time * 0.012, 11.0)));
    float curtain = smoothstep(-0.12, 0.015, above) * exp(-max(above, 0.0) / 0.22) * rays * (0.15 + 0.85 * stretch);
    float sway = noise(vec2(x * 1.3 + time * 0.02, 3.0));
    vec3 hue = mix(mix(aurora[0], aurora[1], sway), mix(aurora[2], aurora[3], sway), smoothstep(0.0, 0.32, above));
    hue = mix(hue, aurora[4], 0.25 * (1.0 - sway));
    c += hue * curtain * 0.2 * auroras;
  }
  color = vec4(c, 1.0);
}`;

/** A row of trees over the band of the picture it covers, moved by the boat's bob. */
export const BAND_VERTEX = `${HEAD}
uniform vec4 band;
out vec2 uv;
out vec2 share;
void main() {
  vec2 p = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  uv = p;
  share = mix(band.xy, band.zw, p);
  gl_Position = vec4(share * 2.0 - 1.0, 0.0, 1.0);
}`;

/** A row of trees: its silhouette in the theme's colour, hazier the further it is, and its leaves lit by the
 *  fireflies' light round them, which shows a tree's crown each time it flashes. */
export const TREES_FRAGMENT = `${HEAD}
uniform sampler2D tex, field;
uniform vec3 tree, haze, fly, warm;
uniform float hazing, lighting;
in vec2 uv;
in vec2 share;
out vec4 color;
void main() {
  vec4 t = texture(tex, uv);
  if (t.a < 0.003) discard;
  vec4 l = texture(field, share) * lighting;
  vec3 base = mix(tree, haze, hazing) * t.a;
  // Only light that's gathered (a tree flashing together, a lantern, a tap) shows on the leaves: squared, the scattered
  // light of a bank out of step stays faint.
  vec3 lit = (fly * l.r * min(l.r, 2.0) + warm * (l.g * 0.6 + l.b * 0.25)) * (t.r * 0.85 + t.a * 0.15);
  color = vec4(base + lit, t.a);
}`;

/** The fireflies of one row as glowing points, each as bright as its flash at the moment the frame will be seen. */
export const FLIES_VERTEX = `${HEAD}${COMMON}
uniform sampler2D state, home;
uniform int width, first;
uniform float story, ahead, time, pixel, most, drift;
uniform vec2 view, bob;
out float bright;
void main() {
  int i = gl_VertexID + first;
  ivec2 p = ivec2(i % width, i / width);
  vec4 s = texelFetch(state, p, 0);
  vec4 m = texelFetch(home, p, 0);
  // Seen sharper than the flash they see each other by: a firefly's light is there and gone, and a bank out of step
  // reads as a sparse fizz rather than a haze.
  float b = pow(flash(fract(s.x + s.y * ahead), s.y), 1.7) * awakeAt(i, story) * (1.0 - s.z);
  bright = b;
  if (b < 0.004) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  // A slight wander of a pixel or two each, which keeps them from reading as stars.
  float r1 = hash(uint(i) * 7u + 3u), r2 = hash(uint(i) * 7u + 4u);
  vec2 wander = vec2(sin(time * (0.5 + r1) + r2 * TAU), cos(time * (0.4 + r2) + r1 * TAU)) * drift * pixel / view;
  gl_Position = vec4((m.xy + bob + wander) * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = clamp(m.w * pixel * 2.0 * 2.6, 3.0, most);
}`;

export const FLIES_FRAGMENT = `${HEAD}
uniform vec3 fly, core;
uniform float gain;
in float bright;
out vec4 color;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r = dot(q, q);
  if (r > 1.0) discard;
  float heart = exp(-r * 16.0);
  float halo = exp(-r * 5.0) * 0.1;
  vec3 c = mix(fly, core, heart * bright * bright) * (heart + halo) * bright * gain;
  color = vec4(c, 0.0);
}`;

/** A lantern's quad: from the top of its string to the foot of its tassel, wide enough for its glow, swaying a little
 *  on its string from the pole's tip. Shared by its glow in the picture and its paper on the screen. */
export const LANTERN_VERTEX = `${HEAD}
uniform vec4 lanterns[9];
uniform vec4 tips[9];
uniform vec2 view;
uniform float pixel, spread;
out vec2 local;
flat out int which;
void main() {
  which = gl_InstanceID;
  vec4 l = lanterns[gl_InstanceID];
  vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2.0 - 1.0;
  // Lantern units: the paper's height is 1, its middle at the origin, y up.
  float top = (tips[gl_InstanceID].y - l.y) / l.z;
  vec2 lo = vec2(-spread, -0.95 - spread * 0.5);
  vec2 hi = vec2(spread, max(top, 0.6) + 0.05);
  local = mix(lo, hi, corner * 0.5 + 0.5);
  float c = cos(l.w), s = sin(l.w);
  vec2 hang = vec2(0.0, top);
  vec2 turned = hang + mat2(c, s, -s, c) * (local - hang);
  vec2 px = l.xy * view + turned * l.z * view.y;
  gl_Position = vec4(px / view * 2.0 - 1.0, 0.0, 1.0);
}`;

/** The lantern's shapes, in lantern units: the round paper body with its ribs, the caps, the string and the tassel. */
const LANTERN_SHAPES = `
uniform vec4 lanterns[9];
uniform vec4 tips[9];
in vec2 local;
flat in int which;
float edge(float d) { float w = fwidth(d) * 0.75; return 1.0 - smoothstep(-w, w, d); }
// The paper: a round lantern, a little wider than tall, flattened top and bottom where the caps hold it.
float paperOf(vec2 p) { vec2 q = p / vec2(0.56, 0.5); return (length(q) - 1.0) * 0.5; }
float capsOf(vec2 p) {
  vec2 a = abs(p - vec2(0.0, 0.47)) - vec2(0.2, 0.05);
  vec2 b = abs(p - vec2(0.0, -0.47)) - vec2(0.2, 0.05);
  return min(max(a.x, a.y), max(b.x, b.y));
}
float stringOf(vec2 p, float top) { return p.y > 0.5 && p.y < top ? abs(p.x) - 0.018 : 1.0; }
float tasselOf(vec2 p) {
  float cord = p.y < -0.5 && p.y > -0.72 ? abs(p.x) - 0.018 : 1.0;
  vec2 q = p - vec2(0.0, -0.8);
  float tuft = q.y < 0.08 && q.y > -0.14 ? abs(q.x) - (0.03 + (0.08 - q.y) * 0.25) : 1.0;
  return min(cord, tuft);
}
`;

/** The lantern's glow in the picture: its paper lit from inside, brightest on the beat, and a halo round it. */
export const GLOW_FRAGMENT = `${HEAD}${LANTERN_SHAPES}
uniform vec3 paper[9];
uniform float pulse[9];
out vec4 color;
void main() {
  vec3 tint = paper[which];
  float beat = pulse[which];
  float body = edge(paperOf(local));
  float r = length(local / vec2(1.1, 1.0));
  float halo = exp(-r * r * 3.0) * (0.03 + 0.12 * beat);
  color = vec4(tint * (body * (0.3 + 0.35 * beat) + halo), 0.0);
}`;

/** The lantern's paper on the screen, in its note's own colour (given already in the screen's units, so it shows
 *  exactly as the note's card does), with its ribs and caps, string and tassel in the note's ink. */
export const PAPER_FRAGMENT = `${HEAD}${LANTERN_SHAPES}
uniform vec3 paper[9];
uniform vec3 ink;
out vec4 color;
void main() {
  vec2 p = local;
  float top = (tips[which].y - lanterns[which].y) / lanterns[which].z;
  float body = edge(paperOf(p));
  // The ribs: the paper's folds, curving with its roundness.
  float u = p.x / (0.56 * sqrt(max(0.0, 1.0 - pow(p.y / 0.5, 2.0))) + 1e-3);
  float fold = abs(fract(u * 2.5 + 0.5) - 0.5);
  float rib = (1.0 - smoothstep(0.035, 0.09, fold)) * 0.16;
  // A little darker towards its edge, where the paper turns away.
  float turning = 1.0 - 0.12 * pow(clamp(length(p / vec2(0.56, 0.5)), 0.0, 1.0), 3.0);
  vec3 c = paper[which] * turning * (1.0 - rib);
  float dark = max(edge(capsOf(p)), max(edge(stringOf(p, top)), edge(tasselOf(p))));
  float a = max(body, dark);
  vec3 o = mix(c * body, ink, dark);
  color = vec4(o, a);
}`;

/** Halving the bright picture for the bloom, taking only what's brighter than the scenery on the first halving. */
export const DOWN_FRAGMENT = `${HEAD}
uniform sampler2D src;
uniform vec2 texel;
uniform float threshold;
out vec4 color;
vec3 bright(vec2 uv) {
  vec3 c = texture(src, uv).rgb;
  if (threshold <= 0.0) return c;
  float m = max(c.r, max(c.g, c.b));
  return c * max(0.0, m - threshold) / max(m, 1e-4);
}
void main() {
  vec2 uv = gl_FragCoord.xy * 2.0 * texel;
  vec3 sum = bright(uv) * 4.0;
  sum += bright(uv + texel * vec2(-1.0, -1.0));
  sum += bright(uv + texel * vec2(1.0, -1.0));
  sum += bright(uv + texel * vec2(-1.0, 1.0));
  sum += bright(uv + texel * vec2(1.0, 1.0));
  color = vec4(sum / 8.0, 1.0);
}`;

/** Doubling it back up, adding each level's own on the way, which spreads the glow wide and soft. */
export const UP_FRAGMENT = `${HEAD}
uniform sampler2D src, own;
uniform vec2 texel;
uniform vec2 view;
uniform float mixing;
out vec4 color;
void main() {
  vec2 uv = gl_FragCoord.xy / view;
  vec3 sum = texture(src, uv + texel * vec2(-2.0, 0.0)).rgb;
  sum += texture(src, uv + texel * vec2(2.0, 0.0)).rgb;
  sum += texture(src, uv + texel * vec2(0.0, -2.0)).rgb;
  sum += texture(src, uv + texel * vec2(0.0, 2.0)).rgb;
  sum += texture(src, uv + texel * vec2(-1.0, -1.0)).rgb * 2.0;
  sum += texture(src, uv + texel * vec2(1.0, -1.0)).rgb * 2.0;
  sum += texture(src, uv + texel * vec2(-1.0, 1.0)).rgb * 2.0;
  sum += texture(src, uv + texel * vec2(1.0, 1.0)).rgb * 2.0;
  color = vec4(sum / 12.0 + texture(own, uv).rgb * mixing, 1.0);
}`;

/** The last pass, to the screen: above the waterline the picture as it is; below, the river, mirroring it on broken
 *  ripples, smeared down and darker where the water faces us; the bloom; the mist on the water, lit by the
 *  fireflies; the glows of taps and the torch, and theirs in the water; then down to the screen's range, only the
 *  brightest light squeezed, and dithered so the dark gradients don't band. */
export const FINAL_FRAGMENT = `${HEAD}
uniform sampler2D scene, bloom, field;
uniform vec2 view;
uniform float horizon, time, pixel, bloomGain, misty, bob;
uniform vec3 water, mist, fly, warm;
uniform vec4 taps[3];
uniform vec4 torch;
out vec4 color;
float hash2(vec2 p) {
  uvec2 q = uvec2(ivec2(floor(p)) + 8192);
  uint x = q.x * 1597334677u ^ q.y * 3812015801u;
  x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16;
  return float(x) / 4294967296.0;
}
float noise(vec2 p) {
  vec2 i = floor(p), u = fract(p);
  u = u * u * (3.0 - 2.0 * u);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), u.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), u.x), u.y);
}
// A warm glow round a point (shares of the stage), its size in CSS pixels.
vec3 glowAt(vec2 s, vec2 at, float size, float amount) {
  vec2 d = (s - at) * view / pixel;
  return warm * amount * (exp(-dot(d, d) / (size * size)) + 0.25 * exp(-dot(d, d) / (size * size * 6.0)));
}
vec3 glows(vec2 s) {
  vec3 c = vec3(0.0);
  for (int i = 0; i < 3; i++) if (taps[i].w > 0.0) c += glowAt(s, taps[i].xy, taps[i].z, taps[i].w);
  if (torch.w > 0.0) c += glowAt(s, torch.xy, torch.z, torch.w);
  return c;
}
vec3 shoulder(vec3 c) {
  // Below the knee nothing changes, so the tokens' colours reach the screen as they are; above it the brightest light
  // is squeezed smoothly towards white.
  float m = max(c.r, max(c.g, c.b));
  const float knee = 0.62;
  if (m <= knee) return c;
  float squeezed = knee + (1.0 - knee) * (1.0 - exp(-(m - knee) / (1.0 - knee)));
  vec3 hue = c * (squeezed / m);
  return mix(hue, vec3(squeezed), smoothstep(knee, 3.0, m) * 0.45);
}
vec3 encode(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  vec2 s = gl_FragCoord.xy / view;
  float line = horizon + bob;
  vec3 c;
  if (s.y >= line) {
    c = texture(scene, s).rgb + texture(bloom, s).rgb * bloomGain + glows(s);
  } else {
    // How far below the waterline: as a share of the water on the screen, and in CSS pixels. The ripples are long and
    // low, crowding together towards the far bank and growing as they come nearer, so each light breaks into a
    // column of glints under it rather than a scatter.
    float d = (line - s.y) / line;
    float below = (line - s.y) * view.y / pixel;
    float across = s.x * view.x / pixel;
    float band = below / (2.0 + 0.04 * below);
    float n1 = noise(vec2(across / (90.0 + below), band * 0.55 - time * 0.45));
    float n2 = noise(vec2(across / (36.0 + below * 0.5) + 7.0, band * 1.25 - time * 0.8));
    float wave = (n1 - 0.5) + 0.35 * (n2 - 0.5);
    float reach = (1.2 + 0.085 * below) * pixel / view.y;
    vec2 r = vec2(s.x + wave * (0.4 + 0.01 * below) * pixel / view.x, line + (line - s.y) + wave * reach * 2.0);
    // Smeared up and down the water, smoothly, so each light becomes a streak rather than copies of itself.
    float smear = reach * 0.45;
    vec3 seen = texture(scene, r).rgb * 0.2;
    for (int k = 1; k <= 3; k++) {
      float w = k == 1 ? 0.17 : k == 2 ? 0.14 : 0.09;
      seen += (texture(scene, r + vec2(0.0, smear * float(k))).rgb + texture(scene, r - vec2(0.0, smear * float(k))).rgb) * w;
    }
    vec3 shine = texture(bloom, r).rgb;
    // Water reflects most where we look along it, at the far bank, and least straight down near the boat.
    float fresnel = mix(0.82, 0.38, smoothstep(0.0, 1.0, d));
    c = mix(water, seen, fresnel) + shine * bloomGain * fresnel + glows(s) * 0.35 + glows(r) * 0.55 * fresnel;
  }
  // Mist over the water and the bank's foot, drifting, lit by the fireflies' light.
  if (misty > 0.0) {
    // A thin veil lying on the water along the far bank, thickest at the waterline.
    float band = exp(-pow((s.y - line + 0.004) / 0.045, 2.0));
    if (band > 0.01) {
      vec2 m = vec2(s.x * view.x / view.y * 2.4 + time * 0.012, s.y * 18.0);
      float fog = noise(m) * 0.5 + noise(m * 2.1 + vec2(time * 0.02, 0.0)) * 0.3 + noise(m * 4.3) * 0.2;
      fog = smoothstep(0.3, 0.85, fog) * band * misty;
      vec4 l = texture(field, vec2(s.x, max(s.y, line + 0.01)));
      c += fog * (mist + fly * l.r * 0.05 + warm * (l.g + l.b) * 0.05);
    }
  }
  vec3 o = encode(shoulder(c));
  // Interleaved gradient noise, a fraction of one step of the screen's levels.
  float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  color = vec4(o + (ign - 0.5) / 255.0, 1.0);
}`;
