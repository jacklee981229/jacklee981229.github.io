// Jack's Writing Islands, drawn (the piece is islands.js): the sky, the sea out to the horizon, the land from the
// weather's grid (erosion.js) with its lakes and streams, the rain, and the shadows of the clouds it falls from. The
// land's light (its slope, the shadows the low sun or moon casts across it, and how shut in each hollow is) is baked
// into a small picture every frame or two while the land changes, and once when it stops; the land reads it as it's
// drawn. Every colour comes from the piece's --isle-* tokens (tokens.css), in light's own units, mixed by the piece when
// the theme changes; the shaders only light them.
import { FULL_VERTEX, bind, drawInto, fullScreen, program, target } from '../effects/gl.js';

/** The land is drawn this many times taller than the weather keeps it, as a model's heights are, to read from afar. */
export const LIFT = 1.2;
/** The sea floor beyond the grid. */
const DEEP = '-0.05';

const HEADER = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
`;

// The sky, shared by the sky itself and by all that mirrors it (the sea, the lakes): a gradient from the horizon up, the
// sun's or moon's glow, by night the stars and the moon's disc, and under the night sky the aurora's curtains.
const SKY = `
uniform vec3 skyTop;
uniform vec3 skyLow;
uniform vec3 light;      // the sun's or moon's colour, at its strength
uniform vec3 lightDir;   // towards it
uniform float night;     // 0 by day, 1 by night
uniform float aurora;    // 1 under the night sky
uniform vec3 auroraColours[5];
uniform vec3 star;
uniform float time;
// Stars show in the sky itself, not in what mirrors it: on rippled water they'd only be specks.
float starry = 1.0;
float hash12(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
vec3 curtains(vec3 d) {
  vec3 sum = vec3(0.0);
  if (d.y <= 0.0) return sum;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    // Each curtain hangs from a sheet high over the land, folding as it drifts, brightest at its lower hem.
    vec2 p = d.xz / (d.y + 0.08) * (0.55 + fi * 0.09) + vec2(fi * 1.9, fi * 0.7);
    float fold = p.x * 0.7 + sin(p.y * 0.9 + time * 0.04 + fi * 1.3) * 0.8 + noise2(vec2(p.y * 0.5 + fi, time * 0.025)) * 1.4;
    float band = exp(-pow(fract(fold * 0.21 + fi * 0.37) - 0.5, 2.0) * 90.0);
    float rays = 0.6 + 0.4 * noise2(vec2(fold * 6.0, time * 0.15 + fi));
    float hem = (0.4 + 0.6 * smoothstep(0.0, 0.06, d.y)) * (1.0 - smoothstep(0.45, 0.97, d.y)) * (0.55 + 2.0 * (1.0 - smoothstep(0.03, 0.25, d.y)));
    sum += auroraColours[i] * band * rays * hem;
  }
  return sum * 0.5;
}
vec3 skyAt(vec3 d) {
  float up = clamp(d.y, 0.0, 1.0);
  vec3 c = mix(skyLow, skyTop, pow(up, 0.6));
  float toward = max(dot(d, lightDir), 0.0);
  c += light * (pow(toward, 5.0) * 0.08 + pow(toward, 48.0) * 0.18) * (1.0 - 0.6 * night);
  c += light * smoothstep(0.99965, 0.99985, toward) * night * 1.6;
  if (night > 0.0 && d.y > 0.0) {
    vec2 q = d.xz / (d.y + 0.35) * 70.0;
    vec2 cell = floor(q);
    float h = hash12(cell);
    float spot = 1.0 - smoothstep(0.08, 0.32, length(fract(q) - 0.5 - (vec2(hash12(cell + 3.1), hash12(cell + 7.7)) - 0.5) * 0.5));
    float twinkle = 0.65 + 0.35 * sin(time * (0.8 + h * 2.0) + h * 40.0);
    c += star * step(0.985, h) * spot * twinkle * night * starry * smoothstep(0.04, 0.25, d.y) * (0.45 + 0.55 * aurora);
  }
  if (aurora > 0.0) c += curtains(d) * aurora;
  return c;
}
`;

// What everything ends with: light's units into the screen's, softly rolling off the brightest, with a speck of noise
// against bands in the gradients.
const FINISH = `
vec3 finish(vec3 c) {
  c = c / (1.0 + c * 0.1);
  c = pow(max(c, 0.0), vec3(1.0 / 2.2));
  return c + (hash12(gl_FragCoord.xy + fract(time * 7.0) * 31.0) - 0.5) / 255.0;
}
`;

const SKY_SHADER = `${HEADER}${SKY}${FINISH}
uniform mat4 unproject;
uniform vec3 eye;
in vec2 uv;
out vec4 colour;
void main() {
  vec4 far = unproject * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
  vec3 d = normalize(far.xyz / far.w - eye);
  // Below the horizon, past the sea's end: the far sea, all mirrored sky (by day softened into the haze; by night it
  // mirrors the aurora right to the horizon).
  vec3 c = d.y >= 0.0 ? skyAt(d) : mix(skyAt(vec3(d.x, -d.y, d.z)), skyLow, 0.5 * (1.0 - aurora));
  colour = vec4(finish(c), 1.0);
}`;

// The ground's and the water's colours, the clouds' shadows and the air, shared by the land and the sea.
const MATERIALS = `
uniform vec3 sea;
uniform vec3 deep;
uniform vec3 shallow;
uniform vec3 sand;
uniform vec3 forest;
uniform vec3 rock;
uniform vec3 mist;
uniform vec3 foam;
uniform vec3 eye;
uniform vec3 mistAt;     // the misty island's middle (x, z) and its reach
uniform float misty;     // how much mist has settled
uniform vec3 storms[3];  // where the storms are (x, z, radius)
uniform float rain;      // how hard it rains
uniform float cloudy;    // the fair-weather clouds drifting over by day
vec3 ambientFor(vec3 n) {
  vec3 up = mix(skyLow, skyTop, 0.35);
  vec3 bounce = mix(sand, skyLow, 0.6) * 0.3;
  // By night the moonlit sky lights the land a little from everywhere, so its shapes still read beside the moon's path.
  return mix(bounce, up, 0.5 + 0.5 * n.y) + light * 0.05 * night;
}
// How much sunlight gets through the clouds here: dark under the storms, dappled under fair-weather clouds.
float cloudLight(vec2 p) {
  float shade = 0.0;
  for (int i = 0; i < 3; i++) {
    vec2 d = (p - storms[i].xy) / storms[i].z;
    shade += exp(-2.2 * dot(d, d));
  }
  float fair = smoothstep(0.55, 0.85, noise2(p * 3.2 + vec2(time * 0.012, time * 0.005)) * 0.7 + noise2(p * 7.0 - vec2(time * 0.01, 0.0)) * 0.3);
  return 1.0 - clamp(shade * rain * 0.55 + fair * cloudy * 0.45, 0.0, 0.75);
}
vec3 aired(vec3 c, vec3 p) {
  // The air: far things fade a little towards the horizon's colour.
  float far = length(p - eye);
  vec3 c2 = mix(c, skyLow, clamp(1.0 - exp(-max(0.0, far - 1.8) / 14.0), 0.0, 1.0) * (1.0 - 0.8 * aurora));
  // The legacy island's mist: low in its hollows, thinning upwards, drifting.
  float reach = 1.0 - smoothstep(mistAt.z * 0.5, mistAt.z * 1.05, length(p.xz - mistAt.xy));
  float low = exp(-max(p.y - 0.004, 0.0) / 0.012);
  vec2 wind = vec2(time * 0.012, time * 0.006);
  float wisps = smoothstep(0.45, 0.85, noise2(p.xz * 14.0 + wind) * 0.65 + noise2(p.xz * 37.0 - wind * 1.7) * 0.35);
  // Seen up close there's little air between the eye and the land, so little mist.
  float through = smoothstep(0.45, 1.3, far);
  return mix(c2, mist, clamp(misty * reach * low * wisps * through, 0.0, 1.0) * 0.38);
}
`;

const SEA_VERTEX = `${HEADER}
uniform mat4 viewProj;
out vec3 world;
void main() {
  vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2.0 - 1.0;
  world = vec3(0.5 + corner.x * 30.0, 0.0, 0.5 + corner.y * 30.0);
  gl_Position = viewProj * vec4(world, 1.0);
}`;

const SEA_FRAGMENT = `${HEADER}${SKY}${MATERIALS}${FINISH}
uniform sampler2D state;
uniform int size;
uniform float swell;     // how much the sea moves
in vec3 world;
out vec4 colour;
float bedAt(vec2 xz) {
  vec2 q = xz * float(size) - 0.5;
  if (q.x < -1.0 || q.y < -1.0 || q.x > float(size) || q.y > float(size)) return ${DEEP};
  ivec2 i = ivec2(floor(q));
  vec2 t = fract(q);
  ivec2 hi = ivec2(size - 1);
  float a = texelFetch(state, clamp(i, ivec2(0), hi), 0).x;
  float b = texelFetch(state, clamp(i + ivec2(1, 0), ivec2(0), hi), 0).x;
  float c = texelFetch(state, clamp(i + ivec2(0, 1), ivec2(0), hi), 0).x;
  float d = texelFetch(state, clamp(i + ivec2(1, 1), ivec2(0), hi), 0).x;
  float edge = smoothstep(0.0, 0.05, min(min(xz.x, xz.y), min(1.0 - xz.x, 1.0 - xz.y)));
  return mix(${DEEP}, mix(mix(a, b, t.x), mix(c, d, t.x), t.y), edge);
}
// The swell: a few long waves, which bend what the sea mirrors, and finer ripples on them, which only break up the
// sun's or moon's glitter; both fade out with distance, where they'd only flicker.
vec3 swellAt(vec2 p, float far) {
  vec2 g = vec2(0.0);
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 dir = vec2(cos(fi * 2.1 + 0.4), sin(fi * 2.1 + 0.4));
    float k = 40.0 + fi * 37.0;
    g += dir * cos(dot(p, dir) * k + time * (0.55 + fi * 0.35)) * 0.11 / (1.0 + fi * 0.6);
  }
  g *= swell * (1.0 - smoothstep(1.2, 9.0, far)) * 0.16;
  return normalize(vec3(-g.x, 1.0, -g.y));
}
vec3 ripplesOn(vec3 n, vec2 p, float far) {
  vec2 q = p * 300.0 + vec2(time * 0.35, -time * 0.21);
  float r = noise2(q);
  vec2 g = vec2(noise2(q + vec2(0.6, 0.0)) - r, noise2(q + vec2(0.0, 0.6)) - r) * 0.08 * swell * (1.0 - smoothstep(0.8, 4.0, far));
  return normalize(n - vec3(g.x, 0.0, g.y));
}
void main() {
  starry = 0.0;
  vec2 xz = world.xz;
  float far = length(world - eye);
  float depth = max(0.0, -bedAt(xz));
  vec3 n = swellAt(xz, far);
  vec3 v = normalize(eye - world);
  // Under the night sky the still, dark sea is a mirror even looking straight down, so the aurora shows in it from
  // every angle.
  float fresnel = max(0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0), 0.24 * aurora);
  vec3 r = reflect(-v, n);
  r.y = abs(r.y);
  vec3 mirrored = skyAt(r);
  vec3 rr = reflect(-v, ripplesOn(n, xz, far));
  float lit = cloudLight(xz);
  vec3 fill = light * max(lightDir.y, 0.0) * lit + ambientFor(vec3(0.0, 1.0, 0.0));
  // Under the water: the sand of the shallows showing through, red light lost first; further out only the water's
  // own colour, bluer and darker with depth.
  vec3 through = exp(-depth * vec3(260.0, 95.0, 60.0));
  vec3 own = mix(shallow, sea, smoothstep(0.004, 0.02, depth));
  own = mix(own, deep, smoothstep(0.02, 0.06, depth) * 0.35);
  vec3 body = (sand * through * through * 0.55 + own * (1.0 - through * through) * 0.3) * fill;
  vec3 c = mix(body, mirrored, fresnel);
  // The sun's or moon's glitter on the swell.
  float glint = pow(max(dot(rr, lightDir), 0.0), mix(700.0, 220.0, night));
  c += light * glint * lit * mix(2.2, 3.0, night) * (0.3 + 0.7 * swell);
  // Foam where the water meets the land, breaking in slow lines.
  float shore = 1.0 - smoothstep(0.0, 0.0028, depth);
  float lines = smoothstep(0.55, 0.9, sin(depth * 2600.0 - time * 1.4 + noise2(xz * 120.0) * 4.0) * 0.5 + 0.5);
  float froth = shore * (0.25 + 0.75 * lines) * smoothstep(0.0, 0.0004, depth) * (0.6 + 0.4 * noise2(xz * 900.0));
  c = mix(c, foam * fill * 0.85, froth * 0.8);
  colour = vec4(finish(aired(c, world)), 1.0);
}`;

const LAND_VERTEX = `${HEADER}
uniform sampler2D state;
uniform mat4 viewProj;
uniform int size;
uniform int stride;
uniform float lift;
out vec3 world;
out vec2 cellUv;
out float water;
void main() {
  int col = gl_VertexID >> 1;
  int row = gl_InstanceID + (gl_VertexID & 1);
  ivec2 c = min(ivec2(col, row) * stride, ivec2(size - 1));
  vec4 s = texelFetch(state, c, 0);
  // Water on the land lifts its surface; under the sea, the land is drawn at its bed and the sea over it.
  float w = s.x > 0.0 ? s.y : 0.0;
  float y = s.x + (w > 0.0004 ? w : 0.0);
  vec2 xz = (vec2(c) + 0.5) / float(size);
  world = vec3(xz.x, y * lift, xz.y);
  cellUv = xz;
  water = w;
  gl_Position = viewProj * vec4(world, 1.0);
}`;

const LAND_FRAGMENT = `${HEADER}${SKY}${MATERIALS}${FINISH}
uniform sampler2D state;
uniform sampler2D ground;  // hardness, post, lake, island
uniform sampler2D baked;   // the slope (x and z of the normal), sunlight, openness
uniform sampler2D walled;  // where a list's terraces are walled: 1 in its last channel, outside any lake
uniform int size;
uniform float lift;
uniform vec3 tints[8];     // each island's rock, towards its topic's colour
uniform float green[64];   // how far each post's forest reaches
uniform float grown;       // how far the forests have grown, 0 to 1
in vec3 world;
in vec2 cellUv;
in float water;
out vec4 colour;
vec4 stateAt(vec2 xz) {
  vec2 q = xz * float(size) - 0.5;
  ivec2 i = ivec2(floor(q));
  vec2 t = fract(q);
  ivec2 hi = ivec2(size - 1);
  vec4 a = texelFetch(state, clamp(i, ivec2(0), hi), 0);
  vec4 b = texelFetch(state, clamp(i + ivec2(1, 0), ivec2(0), hi), 0);
  vec4 c = texelFetch(state, clamp(i + ivec2(0, 1), ivec2(0), hi), 0);
  vec4 d = texelFetch(state, clamp(i + ivec2(1, 1), ivec2(0), hi), 0);
  return mix(mix(a, b, t.x), mix(c, d, t.x), t.y);
}
void main() {
  starry = 0.0;
  if (world.y < -0.0015) discard;
  vec4 b = texture(baked, cellUv);
  vec2 nxz = b.xy * 2.0 - 1.0;
  vec3 n = normalize(vec3(nxz.x, sqrt(max(0.0, 1.0 - dot(nxz, nxz))), nxz.y));
  float sunlit = b.z;
  float open = b.w;
  vec4 m = texture(ground, cellUv);
  ivec2 cell = clamp(ivec2(cellUv * float(size)), ivec2(0), ivec2(size - 1));
  vec4 mc = texelFetch(ground, cell, 0);
  int island = int(mc.w * 255.0 + 0.5) - 1;
  int post = int(mc.y * 255.0 + 0.5) - 1;
  vec4 s = stateAt(cellUv);
  float h = s.x;
  float steep = 1.0 - n.y;
  float grain = noise2(world.xz * 520.0) * 0.6 + noise2(world.xz * 1300.0) * 0.4;
  float clump = noise2(world.xz * 60.0) * 0.6 + noise2(world.xz * 150.0) * 0.4;

  // Rock: the island's own colour; the hard parts (code) paler, and banded on their cliffs like stacked layers.
  vec3 own = island >= 0 ? tints[min(island, 7)] : rock;
  // Banded only where it's code (a lake's rim is harder still, and plain).
  float hard = smoothstep(0.8, 0.87, m.x) * (1.0 - smoothstep(0.95, 0.99, m.x));
  vec3 stone = own * (0.82 + 0.36 * grain) * (1.0 + 0.25 * hard);
  float bands = 0.5 + 0.5 * sin((h * 300.0 + grain * 0.35) * 6.2832);
  stone *= 1.0 - hard * smoothstep(0.2, 0.5, steep) * 0.2 * bands * (1.0 - smoothstep(0.4, 1.0, fwidth(h * 300.0)));
  // Weathered ground on the gentler slopes, a little warmer and paler than the rock it's made from; and where the
  // water cut, fresh rock, darker.
  vec3 soil = mix(own, sand, 0.18) * (1.08 + 0.2 * grain);
  vec3 c = mix(soil, stone, smoothstep(0.16, 0.38, steep + (grain - 0.5) * 0.1));
  c *= 1.0 - 0.32 * smoothstep(0.0008, 0.005, -s.w);
  // A list's terraces: pale level benches between darker walls, as terraced hillsides look.
  vec4 wall = texelFetch(walled, cell, 0);
  float benches = wall.z == 0.0 && wall.w > 0.0 ? 1.0 : 0.0;
  c = mix(c, mix(soil * 1.25, stone * 0.72, smoothstep(0.2, 0.45, steep)), benches);
  // Sand where the water left what it carried, and on the beaches.
  // Sand on the beaches, and where the streams laid what they carried down by the sea; what they laid further up is
  // the island's own soil, a little paler.
  float beach = (1.0 - smoothstep(0.0005, 0.0016, h)) * (1.0 - smoothstep(0.2, 0.4, steep));
  float laid = smoothstep(0.0015, 0.005, s.w) * (1.0 - smoothstep(0.25, 0.5, steep));
  c = mix(c, soil * 1.08, laid * 0.6);
  c = mix(c, sand * (0.9 + 0.2 * grain), clamp(max(beach, laid * (1.0 - smoothstep(0.002, 0.005, h))), 0.0, 1.0));
  // Forest on a post's gentle slopes, as far as its visits reach: dark canopies in clumps, ragged at their edges, each
  // tree's crown a fleck darker or lighter (blurred to their mean where a fleck would be smaller than a pixel).
  float reach = post >= 0 ? green[min(post, 63)] * grown : 0.0;
  vec2 crowns = world.xz * 2400.0;
  float crown = mix(noise2(crowns), 0.5, smoothstep(0.4, 1.0, length(fwidth(crowns))));
  float edge = clump + (grain - 0.5) * 0.22 + (crown - 0.5) * 0.18;
  float trees = smoothstep(1.0 - reach - 0.1, 1.0 - reach + 0.14, edge) * step(0.001, reach);
  trees *= (1.0 - smoothstep(0.2, 0.36, steep)) * smoothstep(0.0022, 0.005, h) * (1.0 - m.z);
  c = mix(c, mix(forest, soil, 0.22) * (0.42 + 0.36 * crown), trees);
  // Wet ground is darker.
  c *= 1.0 - 0.3 * smoothstep(0.00004, 0.0005, water);

  // Fine relief the grid's too coarse for: rock is rough, worn ground less so, sand and lakes smooth.
  float rough = mix(0.25, 1.0, smoothstep(0.12, 0.4, steep)) * (1.0 - max(beach, laid)) * (1.0 - m.z);
  vec2 q = world.xz * 900.0;
  float b0 = noise2(q) + noise2(q * 2.3) * 0.5;
  vec2 bump = vec2(noise2(q + vec2(0.35, 0.0)) + noise2((q + vec2(0.35, 0.0)) * 2.3) * 0.5 - b0, noise2(q + vec2(0.0, 0.35)) + noise2((q + vec2(0.0, 0.35)) * 2.3) * 0.5 - b0);
  // Fading out where a fleck of it would be smaller than a pixel, which would only shimmer.
  n = normalize(n - vec3(bump.x, 0.0, bump.y) * rough * 0.32 * (1.0 - smoothstep(0.35, 0.9, length(fwidth(q)))));
  vec3 v = normalize(eye - world);
  float clouds = cloudLight(world.xz);
  float sun = max(dot(n, lightDir), 0.0) * sunlit * clouds;
  vec3 lit = c * (light * sun + ambientFor(n) * (0.15 + 0.85 * open * open) * mix(0.6, 1.5, night));

  // Water standing on the land: the lakes and, in the rain, the streams. The deeper, the more of its own colour and
  // the less of the bed; it mirrors the sky as the sea does.
  float wet = smoothstep(0.0003, 0.0014, water);
  if (wet > 0.0) {
    vec3 through = exp(-water * vec3(300.0, 120.0, 65.0));
    vec3 fill = light * max(lightDir.y, 0.0) * clouds + ambientFor(vec3(0.0, 1.0, 0.0));
    vec3 seen = lit * through + mix(shallow, sea, smoothstep(0.002, 0.01, water)) * (1.0 - through) * 0.3 * fill;
    vec3 nw = normalize(vec3((noise2(world.xz * 700.0 + time * 0.25) - 0.5) * 0.05, 1.0, (noise2(world.xz * 700.0 + 7.0 - time * 0.25) - 0.5) * 0.05));
    float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(nw, v), 0.0), 5.0);
    vec3 r = reflect(-v, nw);
    r.y = abs(r.y);
    seen = mix(seen, min(skyAt(r), vec3(mix(4.0, 0.35, night))), fresnel);
    seen += light * pow(max(dot(r, lightDir), 0.0), 600.0) * mix(2.0, 0.6, night) * clouds;
    lit = mix(lit, seen, wet);
  }
  colour = vec4(finish(aired(lit, world)), 1.0);
}`;

/** The light baked at the grid's size: the normal's x and z, sunlight (soft shadows marched towards the low sun or
 *  moon), and how open to the sky each cell is (eight ways, three distances). */
const BAKE = `${HEADER}
uniform sampler2D state;
uniform int size;
uniform float lift;
uniform vec3 lightDir;
out vec4 baked;
float heightAt(vec2 q) {
  q -= 0.5;
  ivec2 i = ivec2(floor(q));
  vec2 t = fract(q);
  ivec2 hi = ivec2(size - 1);
  vec4 a = texelFetch(state, clamp(i, ivec2(0), hi), 0);
  vec4 b = texelFetch(state, clamp(i + ivec2(1, 0), ivec2(0), hi), 0);
  vec4 c = texelFetch(state, clamp(i + ivec2(0, 1), ivec2(0), hi), 0);
  vec4 d = texelFetch(state, clamp(i + ivec2(1, 1), ivec2(0), hi), 0);
  vec4 s = mix(mix(a, b, t.x), mix(c, d, t.x), t.y);
  return max(s.x + (s.x > 0.0 && s.y > 0.0004 ? s.y : 0.0), 0.0) * lift * float(size);
}
void main() {
  vec2 p = gl_FragCoord.xy;
  float h = heightAt(p);
  vec3 n = normalize(vec3(heightAt(p - vec2(1.0, 0.0)) - heightAt(p + vec2(1.0, 0.0)), 2.0, heightAt(p - vec2(0.0, 1.0)) - heightAt(p + vec2(0.0, 1.0))));
  // Towards the light, the ray climbing as it goes, each step a little longer than the last; how close it comes to
  // the land on the way gives the shadow's soft edge.
  vec2 dir = normalize(lightDir.xz);
  float climb = lightDir.y / length(lightDir.xz);
  float lit = 1.0;
  float t = 0.7;
  for (int i = 0; i < 24; i++) {
    float above = h + 0.3 + t * climb - heightAt(p + dir * t);
    lit = min(lit, clamp(above / t * 7.0, 0.0, 1.0));
    t *= 1.2;
  }
  float shut = 0.0;
  for (int k = 0; k < 8; k++) {
    float a = float(k) * 0.785398 + 0.3;
    vec2 d = vec2(cos(a), sin(a));
    shut += clamp((heightAt(p + d * 2.5) - h) / 2.5, 0.0, 1.0) + clamp((heightAt(p + d * 6.0) - h) / 6.0, 0.0, 1.0) + clamp((heightAt(p + d * 13.0) - h) / 13.0, 0.0, 1.0);
  }
  float open = clamp(1.0 - shut / 24.0 * 2.0, 0.0, 1.0);
  baked = vec4(n.xz * 0.5 + 0.5, lit, open);
}`;

/** The rain: streaks falling under the storms, each its own from its number alone. */
const RAIN_VERTEX = `${HEADER}
uniform mat4 viewProj;
uniform vec3 storms[3];
uniform float time;
uniform float amount;
uniform vec2 pixel;
out float fade;
float h1(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
void main() {
  int id = gl_InstanceID;
  float f = float(id);
  vec3 storm = storms[id % 3];
  float a = h1(f * 1.7) * 6.2831;
  float r = sqrt(h1(f * 3.1 + 0.4)) * storm.z;
  vec2 xz = storm.xy + vec2(cos(a), sin(a)) * r;
  float fall = fract(h1(f * 5.3 + 0.9) + time * (1.1 + 0.5 * h1(f)));
  float top = 0.16 * (1.0 - fall);
  vec3 head = vec3(xz.x, top, xz.y);
  vec3 tail = head + vec3(-0.002, 0.014, -0.001);
  vec4 ch = viewProj * vec4(head, 1.0);
  vec4 ct = viewProj * vec4(tail, 1.0);
  vec2 sh = ch.xy / ch.w;
  vec2 st = ct.xy / ct.w;
  vec2 along = st - sh;
  vec2 across = normalize(vec2(-along.y, along.x) + 1e-6) * pixel * 0.8;
  bool end = (gl_VertexID & 1) == 1;
  bool side = gl_VertexID >= 2;
  vec4 c = end ? ct : ch;
  c.xy += (side ? across : -across) * c.w;
  gl_Position = c;
  // Thinner where the storm thins, fading in from the cloud and out as the drop meets the land or the sea.
  fade = amount * exp(-2.2 * (r / storm.z) * (r / storm.z)) * smoothstep(0.0, 0.25, fall) * smoothstep(1.0, 0.85, fall) * (end ? 0.0 : 1.0);
}`;

const RAIN_FRAGMENT = `${HEADER}
uniform vec3 drop;
in float fade;
out vec4 colour;
void main() { colour = vec4(drop, fade * 0.38); }`;

/**
 * The drawing, on `gl` for a grid of `size` cells a side. `bake(state, lightDir)` works out the land's light;
 * `draw(view)` draws a frame onto the canvas. Colours, the light and the weather come in `view.look` (islands.js).
 * @param {WebGL2RenderingContext} gl @param {number} size
 */
export function createTerrain(gl, size) {
  const programs = {
    sky: program(gl, FULL_VERTEX, SKY_SHADER),
    sea: program(gl, SEA_VERTEX, SEA_FRAGMENT),
    land: program(gl, LAND_VERTEX, LAND_FRAGMENT),
    bake: program(gl, FULL_VERTEX, BAKE),
    rain: program(gl, RAIN_VERTEX, RAIN_FRAGMENT),
  };
  const baked = target(gl, size, size, 'rgba8', { filter: 'linear' });
  const empty = /** @type {WebGLVertexArrayObject} */ (gl.createVertexArray());

  /** The sky's uniforms, which the sea and the land mirror too. @param {ReturnType<typeof program>} p @param {any} look */
  const sky = (p, look) => {
    gl.uniform3fv(p.at('skyTop'), look.skyTop);
    gl.uniform3fv(p.at('skyLow'), look.skyLow);
    gl.uniform3fv(p.at('light'), look.light);
    gl.uniform3fv(p.at('lightDir'), look.lightDir);
    gl.uniform1f(p.at('night'), look.night);
    gl.uniform1f(p.at('aurora'), look.aurora);
    gl.uniform3fv(p.at('auroraColours[0]'), look.auroraColours);
    gl.uniform3fv(p.at('star'), look.star);
    gl.uniform1f(p.at('time'), look.time);
    gl.uniform3fv(p.at('eye'), look.eye);
  };
  /** @param {ReturnType<typeof program>} p @param {any} look */
  const materials = (p, look) => {
    for (const name of ['sea', 'deep', 'shallow', 'sand', 'forest', 'rock', 'mist', 'foam']) gl.uniform3fv(p.at(name), look[name]);
    gl.uniform3fv(p.at('mistAt'), look.mistAt);
    gl.uniform1f(p.at('misty'), look.misty);
    gl.uniform3fv(p.at('storms[0]'), look.storms);
    gl.uniform1f(p.at('rain'), look.rain);
    gl.uniform1f(p.at('cloudy'), look.cloudy);
  };

  return {
    ready: () => Object.values(programs).every((p) => p.ready()),
    /** Works out the land's light from the weather's state. @param {WebGLTexture} state @param {number[]} lightDir */
    bake: (state, lightDir) => {
      drawInto(gl, baked);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      const p = programs.bake.use();
      gl.uniform1i(p.at('state'), 0);
      gl.uniform1i(p.at('size'), size);
      gl.uniform1f(p.at('lift'), LIFT);
      gl.uniform3fv(p.at('lightDir'), lightDir);
      bind(gl, 0, state);
      fullScreen(gl);
    },
    /**
     * Draws a frame onto the canvas: the sky, the sea, and (once there is some) the land, and the rain.
     * @param {{ viewProj: Float32Array, unproject: Float32Array, state: WebGLTexture, ground: WebGLTexture, walled: WebGLTexture, stride: number, land: boolean, look: any }} view
     */
    draw: (view) => {
      const { look } = view;
      const ready = (/** @type {keyof typeof programs} */ name) => programs[name].ready();
      drawInto(gl, null);
      gl.disable(gl.BLEND);
      gl.disable(gl.DEPTH_TEST);
      if (!ready('sky') || !ready('sea')) {
        // Until the sky and the sea can be drawn: the sky's colour.
        gl.clearColor(...look.skyLowSrgb, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        return;
      }
      const ps = programs.sky.use();
      sky(ps, look);
      gl.uniformMatrix4fv(ps.at('unproject'), false, view.unproject);
      fullScreen(gl);
      // The sea, then the land over it: the sea floor under the water is hidden by the sea before it's ever shaded.
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LESS);
      gl.depthMask(true);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      bind(gl, 0, view.state);
      const pw = programs.sea.use();
      sky(pw, look);
      materials(pw, look);
      gl.uniformMatrix4fv(pw.at('viewProj'), false, view.viewProj);
      gl.uniform1i(pw.at('state'), 0);
      gl.uniform1i(pw.at('size'), size);
      gl.uniform1f(pw.at('swell'), look.swell);
      gl.bindVertexArray(empty);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (view.land && ready('land')) {
        const pl = programs.land.use();
        sky(pl, look);
        materials(pl, look);
        gl.uniformMatrix4fv(pl.at('viewProj'), false, view.viewProj);
        gl.uniform1i(pl.at('state'), 0);
        gl.uniform1i(pl.at('ground'), 1);
        gl.uniform1i(pl.at('baked'), 2);
        gl.uniform1i(pl.at('walled'), 3);
        gl.uniform1i(pl.at('size'), size);
        gl.uniform1i(pl.at('stride'), view.stride);
        gl.uniform1f(pl.at('lift'), LIFT);
        gl.uniform3fv(pl.at('tints[0]'), look.tints);
        gl.uniform1fv(pl.at('green[0]'), look.green);
        gl.uniform1f(pl.at('grown'), look.grown);
        bind(gl, 1, view.ground);
        bind(gl, 2, baked.texture);
        bind(gl, 3, view.walled);
        const cols = Math.ceil(size / view.stride);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, cols * 2, cols - 1);
      }
      if (look.rain > 0.01 && ready('rain')) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        const pr = programs.rain.use();
        gl.uniformMatrix4fv(pr.at('viewProj'), false, view.viewProj);
        gl.uniform3fv(pr.at('storms[0]'), look.storms);
        gl.uniform1f(pr.at('time'), look.time);
        gl.uniform1f(pr.at('amount'), look.rain);
        gl.uniform2f(pr.at('pixel'), 1 / gl.drawingBufferWidth, 1 / gl.drawingBufferHeight);
        gl.uniform3fv(pr.at('drop'), look.drop);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 600);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
      }
      gl.disable(gl.DEPTH_TEST);
    },
    dispose: () => {
      baked.dispose();
      gl.deleteVertexArray(empty);
    },
  };
}
