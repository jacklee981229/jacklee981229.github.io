// Magnetic Liquid's dish and camera (src/effects/magnetic-liquid.js), in the dish's own units: the inside of its rim
// is 1 from the middle, y is up and z comes towards the viewer. The liquid's simulation covers SPAN across, a little
// more than the dish, so the walls are inside it.

/** The simulated square, across, centred on the dish. */
export const SPAN = 2.2;
/** How high the liquid lies with nobody moving it: a puddle about 0.6 of the way out to the wall. */
export const LEVEL = 0.024;
/** The table the dish stands on, just under its floor. */
export const GROUND = -0.035;
/** Where the floor starts to curve up into the wall, how steep the floor's own dip is, and how high the wall rises. */
const WALL_FROM = 0.78;
const DIP = 0.05;
const WALL = 0.15;
/** The rim: a rounded lip on top of the wall, and the outside of the wall down to the foot. */
const LIP = 0.042;
const FOOT = 1.075;

/** The dish's floor and inner wall, the same in the shaders (BOWL_GLSL) and the dish's mesh. @param {number} r */
export function bowl(r) {
  const w = Math.min(1, Math.max(0, (r - WALL_FROM) / (1 - WALL_FROM)));
  return DIP * r * r + WALL * w * w * w;
}

export const BOWL_GLSL = `
float bowl(float r) {
  float w = clamp((r - ${WALL_FROM.toFixed(6)}) / ${(1 - WALL_FROM).toFixed(6)}, 0.0, 1.0);
  return ${DIP.toFixed(6)} * r * r + ${WALL.toFixed(6)} * w * w * w;
}
const float WALL_TOP = ${bowl(1).toFixed(6)};
const float SPAN = ${SPAN.toFixed(6)};
const float GROUND = ${GROUND.toFixed(6)};
const float LEVEL = ${LEVEL.toFixed(6)};`;

/**
 * The dish's cross-section, from the middle out over the rim and down the outside to the foot: [r, y] points with
 * the way each faces, [nr, ny]. Spun round, it makes the dish.
 * @returns {{ r: number, y: number, nr: number, ny: number }[]}
 */
export function profile() {
  /** @type {number[][]} */
  const points = [];
  // The floor, closer together where it curves up into the wall.
  for (let i = 0; i <= 28; i++) {
    const r = 1 - (1 - i / 28) ** 1.6;
    points.push([r, bowl(r)]);
  }
  // Over the lip, a half round from the inside to the outside.
  const top = bowl(1);
  for (let i = 1; i <= 12; i++) {
    const a = Math.PI - (i / 12) * Math.PI;
    points.push([1 + LIP + LIP * Math.cos(a), top + LIP * Math.sin(a) * 0.9]);
  }
  // Down the outside, leaning in a little, then rounding under onto the table.
  const outside = 1 + 2 * LIP;
  for (let i = 1; i <= 10; i++) {
    const t = i / 10;
    points.push([outside + (FOOT + 0.02 - outside) * t * t, top + (GROUND + 0.012 - top) * t]);
  }
  points.push([FOOT, GROUND + 0.002]);
  points.push([FOOT - 0.03, GROUND]);
  return points.map(([r, y], i) => {
    const [r0, y0] = points[Math.max(0, i - 1)];
    const [r1, y1] = points[Math.min(points.length - 1, i + 1)];
    const len = Math.hypot(r1 - r0, y1 - y0) || 1;
    // Facing out of the porcelain: up on the floor, outwards down the outside.
    return { r, y, nr: -(y1 - y0) / len, ny: (r1 - r0) / len };
  });
}

/**
 * The dish as triangles: positions and the way each faces, spun round in `around` steps.
 * @param {number} around @returns {{ data: Float32Array, count: number }}
 */
export function dishMesh(around = 64) {
  const ring = profile();
  /** @type {number[]} */
  const data = [];
  const vertex = (p, a) => data.push(p.r * Math.cos(a), p.y, p.r * Math.sin(a), p.nr * Math.cos(a), p.ny, p.nr * Math.sin(a));
  for (let k = 0; k < around; k++) {
    const a0 = (k / around) * Math.PI * 2;
    const a1 = ((k + 1) / around) * Math.PI * 2;
    for (let i = 0; i + 1 < ring.length; i++) {
      const [p, q] = [ring[i], ring[i + 1]];
      vertex(p, a0);
      vertex(q, a0);
      vertex(q, a1);
      vertex(p, a0);
      vertex(q, a1);
      vertex(p, a1);
    }
  }
  return { data: new Float32Array(data), count: data.length / 6 };
}

/** @typedef {Float32Array} Mat4 column by column, as WebGL takes them */

/** @param {Mat4} a @param {Mat4} b @returns {Mat4} a × b */
export function multiply(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let sum = 0;
    for (let k = 0; k < 4; k++) sum += a[k * 4 + r] * b[c * 4 + k];
    out[c * 4 + r] = sum;
  }
  return out;
}

/** @param {Mat4} m @returns {Mat4} */
export function invert(m) {
  const inv = new Float32Array(16);
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m;
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const det = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
  inv[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  inv[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  inv[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  inv[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  inv[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  inv[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  inv[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  inv[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  inv[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  inv[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  inv[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  inv[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  inv[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  inv[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  inv[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  inv[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
  return inv;
}

/** @param {number[]} m4 @param {number[]} p @returns {number[]} the point through m, divided through */
const project = (m4, [x, y, z]) => {
  const w = m4[3] * x + m4[7] * y + m4[11] * z + m4[15];
  return [(m4[0] * x + m4[4] * y + m4[8] * z + m4[12]) / w, (m4[1] * x + m4[5] * y + m4[9] * z + m4[13]) / w];
};

/**
 * The camera: high in front of the dish, looking down at it from ELEVATION degrees, near enough that the dish fills
 * the stage with a margin all round (on a phone, where the stage is narrow, it fills the width).
 * @param {number} aspect the stage's width over its height
 * @returns {{ viewProj: Mat4, inverse: Mat4, eye: number[] }}
 */
export function camera(aspect) {
  const ELEVATION = (50 * Math.PI) / 180;
  const FOV = (24 * Math.PI) / 180;
  const t = 1 / Math.tan(FOV / 2);
  const target = [0, 0.04, 0];
  // What must stay in sight: the rim, the foot, and room above the back of the rim for the crown's spikes.
  const keep = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    keep.push([1.1 * Math.cos(a), bowl(1) + LIP, 1.1 * Math.sin(a)], [FOOT * Math.cos(a), GROUND, FOOT * Math.sin(a)]);
  }
  keep.push([0, 0.42, -0.55]);
  const build = (distance, sx = 0, sy = 0) => {
    const eye = [target[0], target[1] + distance * Math.sin(ELEVATION), target[2] + distance * Math.cos(ELEVATION)];
    const f = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]];
    const fl = Math.hypot(...f);
    const fw = f.map((v) => v / fl);
    // Right = forward × up, then the true up = right × forward.
    const right = [-fw[2], 0, fw[0]].map((v, _, a) => v / Math.hypot(a[0], a[2]));
    const up = [right[1] * fw[2] - right[2] * fw[1], right[2] * fw[0] - right[0] * fw[2], right[0] * fw[1] - right[1] * fw[0]];
    const view = new Float32Array([
      right[0], up[0], -fw[0], 0,
      right[1], up[1], -fw[1], 0,
      right[2], up[2], -fw[2], 0,
      -(right[0] * eye[0] + right[1] * eye[1] + right[2] * eye[2]),
      -(up[0] * eye[0] + up[1] * eye[1] + up[2] * eye[2]),
      fw[0] * eye[0] + fw[1] * eye[1] + fw[2] * eye[2], 1,
    ]);
    const near = Math.max(0.1, distance - 3);
    const far = distance + 30;
    const proj = new Float32Array([
      t / aspect, 0, 0, 0,
      0, t, 0, 0,
      // Shifted across the stage by (sx, sy), as the dish's outline isn't centred on the point looked at.
      sx, sy, (far + near) / (near - far), -1,
      0, 0, (2 * far * near) / (near - far), 0,
    ]);
    return { viewProj: multiply(proj, view), eye };
  };
  const bounds = (m) => {
    let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
    for (const p of keep) {
      const [x, y] = project(Array.from(m), p);
      [x0, x1, y0, y1] = [Math.min(x0, x), Math.max(x1, x), Math.min(y0, y), Math.max(y1, y)];
    }
    return { x0, x1, y0, y1 };
  };
  // Narrow stages keep less margin at the sides, so the dish can fill a phone's width.
  const room = { x: aspect < 1 ? 0.95 : 0.84, y: aspect < 1 ? 0.8 : 0.84 };
  let lo = 1;
  let hi = 60;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const b = bounds(build(mid).viewProj);
    if (b.x1 - b.x0 <= 2 * room.x && b.y1 - b.y0 <= 2 * room.y) hi = mid;
    else lo = mid;
  }
  const b = bounds(build(hi).viewProj);
  const done = build(hi, (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
  return { ...done, inverse: invert(done.viewProj) };
}

/**
 * Where a point on the stage (as a share across and down, 0 to 1) lands on the liquid's level, in the dish's (x, z);
 * null if it looks over the horizon.
 * @param {Mat4} inverse @param {number} sx @param {number} sy @returns {[number, number] | null}
 */
export function onLiquid(inverse, sx, sy) {
  const nx = sx * 2 - 1;
  const ny = 1 - sy * 2;
  const at = (z) => {
    const m = inverse;
    const w = m[3] * nx + m[7] * ny + m[11] * z + m[15];
    return [(m[0] * nx + m[4] * ny + m[8] * z + m[12]) / w, (m[1] * nx + m[5] * ny + m[9] * z + m[13]) / w, (m[2] * nx + m[6] * ny + m[10] * z + m[14]) / w];
  };
  const a = at(-1);
  const b = at(1);
  const dy = b[1] - a[1];
  if (Math.abs(dy) < 1e-9) return null;
  const k = (LEVEL - a[1]) / dy;
  if (k < 0) return null;
  return [a[0] + (b[0] - a[0]) * k, a[2] + (b[2] - a[2]) * k];
}
