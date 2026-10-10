// What the WebGL2 pieces share (on stage.js with options.context 'webgl2'): shaders that compile without making the
// page wait, float textures to draw into, checked for real rather than trusted from the extension list, the site's
// token colours in light's own units, and two clocks: a fixed number of simulation steps a second whatever the
// screen's rate, and a governor that lowers a piece's quality when frames come late.

/** A vertex shader for one triangle over the whole canvas, made from gl_VertexID alone, so no buffers are needed. */
export const FULL_VERTEX = `#version 300 es
out vec2 uv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  uv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/**
 * @typedef {{ program: WebGLProgram, ready: () => boolean, use: () => Program, at: (name: string) => WebGLUniformLocation | null }} Program
 */

/**
 * Compiles and links a program. Where the browser can (KHR_parallel_shader_compile) the driver does it in the
 * background, and `ready()` says when it's done without waiting: asking for the link status before then would make the
 * page wait for it, which in Safari can be most of a second. A program that fails throws with the driver's message.
 * @param {WebGL2RenderingContext} gl @param {string} vertex @param {string} fragment @returns {Program}
 */
export function program(gl, vertex, fragment) {
  const shader = (type, source) => {
    const s = /** @type {WebGLShader} */ (gl.createShader(type));
    gl.shaderSource(s, source);
    gl.compileShader(s);
    return s;
  };
  const vs = shader(gl.VERTEX_SHADER, vertex);
  const fs = shader(gl.FRAGMENT_SHADER, fragment);
  const p = /** @type {WebGLProgram} */ (gl.createProgram());
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  const parallel = gl.getExtension('KHR_parallel_shader_compile');
  const uniforms = new Map();
  let done = false;
  const check = () => {
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = [vs, fs].map((s) => gl.getShaderInfoLog(s)).filter(Boolean).join('\n') || gl.getProgramInfoLog(p);
      throw new Error(`A shader didn't compile: ${log}`);
    }
    done = true;
  };
  /** @type {Program} */
  const handle = {
    program: p,
    ready: () => {
      if (done) return true;
      if (parallel && !gl.getProgramParameter(p, parallel.COMPLETION_STATUS_KHR)) return false;
      check();
      return true;
    },
    use: () => {
      if (!done) check();
      gl.useProgram(p);
      return handle;
    },
    at: (name) => {
      if (!uniforms.has(name)) uniforms.set(name, gl.getUniformLocation(p, name));
      return uniforms.get(name);
    },
  };
  return handle;
}

/** @param {WebGL2RenderingContext} gl @returns {Record<string, [number, number, number]>} */
const formats = (gl) => ({
  rgba32f: [gl.RGBA32F, gl.RGBA, gl.FLOAT],
  rg32f: [gl.RG32F, gl.RG, gl.FLOAT],
  r32f: [gl.R32F, gl.RED, gl.FLOAT],
  rgba16f: [gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT],
  rg16f: [gl.RG16F, gl.RG, gl.HALF_FLOAT],
  r16f: [gl.R16F, gl.RED, gl.HALF_FLOAT],
  rgba8: [gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE],
});

/**
 * @typedef {{ texture: WebGLTexture, framebuffer: WebGLFramebuffer, width: number, height: number, dispose: () => void }} Target
 */

/**
 * A texture to draw into, `format` one of rgba32f, rg32f, r32f, rgba16f, rg16f, r16f or rgba8. Linear filtering of a
 * 32-bit float texture isn't on every iPhone: read those with texelFetch.
 * @param {WebGL2RenderingContext} gl @param {number} width @param {number} height @param {string} [format]
 * @param {{ filter?: 'nearest' | 'linear', wrap?: 'clamp' | 'repeat' }} [options] @returns {Target}
 */
export function target(gl, width, height, format = 'rgba16f', { filter = 'nearest', wrap = 'clamp' } = {}) {
  const [internal] = formats(gl)[format];
  const texture = /** @type {WebGLTexture} */ (gl.createTexture());
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texStorage2D(gl.TEXTURE_2D, 1, internal, width, height);
  const f = filter === 'linear' ? gl.LINEAR : gl.NEAREST;
  const w = wrap === 'repeat' ? gl.REPEAT : gl.CLAMP_TO_EDGE;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, w);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, w);
  const framebuffer = /** @type {WebGLFramebuffer} */ (gl.createFramebuffer());
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return {
    texture,
    framebuffer,
    width,
    height,
    dispose: () => {
      gl.deleteFramebuffer(framebuffer);
      gl.deleteTexture(texture);
    },
  };
}

/**
 * Two targets taken in turn, for a simulation that reads its last state and writes the next.
 * @param {WebGL2RenderingContext} gl @param {number} width @param {number} height @param {string} [format]
 * @param {{ filter?: 'nearest' | 'linear', wrap?: 'clamp' | 'repeat' }} [options]
 */
export function pingPong(gl, width, height, format, options) {
  let a = target(gl, width, height, format, options);
  let b = target(gl, width, height, format, options);
  return {
    get read() { return a; },
    get write() { return b; },
    swap: () => { [a, b] = [b, a]; },
    dispose: () => { a.dispose(); b.dispose(); },
  };
}

/** Draws into a target, or onto the canvas with null, over all of it. @param {WebGL2RenderingContext} gl @param {Target | null} into */
export function drawInto(gl, into) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, into ? into.framebuffer : null);
  gl.viewport(0, 0, into ? into.width : gl.drawingBufferWidth, into ? into.height : gl.drawingBufferHeight);
}

/** Binds a texture to a unit, for a sampler set to that unit. @param {WebGL2RenderingContext} gl @param {number} unit @param {WebGLTexture} texture */
export function bind(gl, unit, texture) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
}

const emptyArrays = new WeakMap();
/** Draws FULL_VERTEX's one triangle with the program in use. @param {WebGL2RenderingContext} gl */
export function fullScreen(gl) {
  let empty = emptyArrays.get(gl);
  // A context that was lost and given back has dropped every object made before, this one too.
  if (!empty || !gl.isVertexArray(empty)) {
    empty = gl.createVertexArray();
    emptyArrays.set(gl, empty);
  }
  gl.bindVertexArray(empty);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

/**
 * What this browser's GPU can draw into, found by trying: a framebuffer of each float format that isn't complete
 * can't be used, whatever the extension list says. Float blending and filtering are what iPhones lack most often.
 * It also turns those extensions on, so a piece calls it again in `restore()`: a context given back starts with them
 * all off.
 * @param {WebGL2RenderingContext} gl
 */
export function caps(gl) {
  const float = Boolean(gl.getExtension('EXT_color_buffer_float'));
  const half = float || Boolean(gl.getExtension('EXT_color_buffer_half_float'));
  const renders = (/** @type {string} */ format) => {
    const t = target(gl, 4, 4, format);
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.framebuffer);
    const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    t.dispose();
    return complete;
  };
  return {
    float32: float && ['rgba32f', 'rg32f', 'r32f'].every(renders),
    float16: half && ['rgba16f', 'rg16f', 'r16f'].every(renders),
    floatBlend: Boolean(gl.getExtension('EXT_float_blend')),
    floatLinear: Boolean(gl.getExtension('OES_texture_float_linear')),
  };
}

/** @type {CanvasRenderingContext2D | null} */
let taster = null;
/**
 * A CSS colour, such as a token's value, as [red, green, blue] from 0 to 255, by painting one pixel with it: any colour
 * CSS knows comes back as plain sRGB.
 * @param {string} css @returns {[number, number, number]}
 */
export function rgbOf(css) {
  if (!taster) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    taster = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d', { willReadFrequently: true }));
  }
  taster.clearRect(0, 0, 1, 1);
  taster.fillStyle = '#808080';
  taster.fillStyle = css.trim() || '#808080';
  taster.fillRect(0, 0, 1, 1);
  const [r, g, b] = taster.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

/** An sRGB colour (0 to 255) in light's own units (0 to 1), for shading: shaders mix and light in these. @param {number[]} rgb */
export const linear = (rgb) => rgb.map((v) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});

/**
 * A piece's own tokens (--{prefix}-{name}, tokens.css) as it finds them on `element`, in light's own units. Read again
 * whenever stage.colors changes, which the stage does on every theme change.
 * @param {Element} element @param {string} prefix @param {string[]} names @returns {Record<string, number[]>}
 */
export function tokens(element, prefix, names) {
  const style = getComputedStyle(element);
  return Object.fromEntries(names.map((n) => [n, linear(rgbOf(style.getPropertyValue(`--${prefix}-${n}`)))]));
}

/**
 * A fixed number of simulation steps for each second of the stage's time, whatever the screen's rate (60, 90 and 120
 * a second all run the same simulation), returning how many to run this frame. A device that can't keep up runs at
 * most `most` and drops the rest, so it runs slower rather than falling further behind each frame.
 * @param {number} perSecond @param {number} most @returns {(dt: number) => number}
 */
export function stepper(perSecond, most) {
  let owed = 0;
  return (dt) => {
    owed += dt * perSecond;
    const n = Math.min(most, Math.floor(owed));
    owed = n === most ? Math.min(owed - n, 1) : owed - n;
    return n;
  };
}

/** Frames further apart than this (in ms) are late: under about 46 a second, whatever the screen's own rate. */
const LATE = (1000 / 60) * 1.3;
/** Frames this close together (in ms) leave room to spare: about 54 a second or more. */
const ROOMY = (1000 / 60) * 1.1;

/**
 * Lowers a piece's quality a rung at a time (rung 0 is the best) while its frames come late, and raises it again once
 * they have room to spare. Late is judged against 60 a second, not the screen's own rate: 60 looks smooth on a 90 or
 * 120 Hz screen too, and a 60 Hz screen never draws faster. A phone saving power at 30 a second drops to the lowest
 * rung, which saves power too. Nothing changes while the piece runs slowly on purpose (`hold`), and a gap of a quarter
 * second or more is a pause, not a slow frame. A rung that was raised and soon proved too much waits twice as long the
 * next time. `tick` takes each drawn frame's time, in ms.
 * @param {number} rungs @param {(rung: number) => void} onChange
 */
export function governor(rungs, onChange) {
  let rung = 0;
  /** @type {number[]} */
  let gaps = [];
  let last = 0;
  let windowStart = 0;
  let lateFor = 0;
  let roomyFor = 0;
  let patience = 5;
  let raisedAt = -Infinity;
  let held = false;
  let seconds = 0;
  const set = (/** @type {number} */ next) => {
    rung = next;
    lateFor = 0;
    roomyFor = 0;
    onChange(rung);
  };
  return {
    get rung() { return rung; },
    /** Safe to call every frame: only a change starts the counting afresh. @param {boolean} on */
    hold: (on) => {
      if (on === held) return;
      held = on;
      lateFor = 0;
      roomyFor = 0;
    },
    /** @param {number} now */
    tick: (now) => {
      const gap = now - last;
      last = now;
      if (gap > 0 && gap < 250) gaps.push(gap);
      if (!windowStart || gap >= 250) windowStart = now;
      if (now - windowStart < 1000 || gaps.length < 10) return;
      windowStart = now;
      seconds++;
      const median = gaps.sort((a, b) => a - b)[gaps.length >> 1];
      gaps = [];
      if (held) return;
      lateFor = median > LATE ? lateFor + 1 : 0;
      roomyFor = median <= ROOMY ? roomyFor + 1 : 0;
      if (lateFor >= 2 && rung < rungs - 1) {
        if (seconds - raisedAt <= 3) patience = Math.min(60, patience * 2);
        set(rung + 1);
      } else if (roomyFor >= patience && rung > 0) {
        raisedAt = seconds;
        set(rung - 1);
      }
    },
  };
}
