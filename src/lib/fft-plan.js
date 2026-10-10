// The fast Fourier transform Magnetic Liquid runs on the GPU (src/effects/magnetic-liquid.js), worked out here once so
// it can be tested: its passes, and the very sums each pass does, run on the CPU with the shader's own index maths. The
// GPU does a Stockham transform, which reads and writes every number in order, with no bit-reversed shuffle at the end:
// passes of four (radix 4), and one pass of two when the size isn't a power of four. A 2D transform is the rows' passes,
// then the columns'.

/**
 * @typedef {{ radix: 2 | 4, span: number }} Pass
 * `span` is how long the transforms finished by the passes before it are: 1 for the first, then 4, 16 and so on.
 */

/**
 * The passes of a transform of `n` numbers, a power of two from 2 up.
 * @param {number} n @returns {Pass[]}
 */
export function fftPlan(n) {
  if (!Number.isInteger(Math.log2(n)) || n < 2) throw new Error(`An FFT needs a power of two, not ${n}`);
  /** @type {Pass[]} */
  const passes = [];
  let span = 1;
  while (span * 4 <= n) {
    passes.push({ radix: 4, span });
    span *= 4;
  }
  if (span < n) passes.push({ radix: 2, span });
  return passes;
}

/**
 * Where output `o` of a pass reads from, as the shader works it out: its first input, the gap between its inputs, and
 * the share of a turn (out of `span × radix`) that its twiddles step by.
 * @param {number} o @param {number} n @param {Pass} pass
 */
export function passIndex(o, n, { radix, span }) {
  const width = span * radix;
  return { first: Math.floor(o / width) * span + (o % span), gap: n / radix, turn: o % width, width };
}

/**
 * One pass over one line of complex numbers (re and im side by side), as each output pixel of the shader does it.
 * `sign` is −1 forward and +1 back.
 * @param {Float64Array} from @param {Float64Array} to @param {number} n @param {Pass} pass @param {number} sign
 */
export function fftPass(from, to, n, pass, sign) {
  for (let o = 0; o < n; o++) {
    const { first, gap, turn, width } = passIndex(o, n, pass);
    let re = 0;
    let im = 0;
    for (let m = 0; m < pass.radix; m++) {
      const a = (sign * 2 * Math.PI * m * turn) / width;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const i = 2 * (first + m * gap);
      re += from[i] * c - from[i + 1] * s;
      im += from[i] * s + from[i + 1] * c;
    }
    to[2 * o] = re;
    to[2 * o + 1] = im;
  }
}

/**
 * A 2D transform of an n × n grid of complex numbers (rows of re, im pairs), by the plan: each row's passes, then each
 * column's. Unscaled both ways, as the shader's: a transform there and back multiplies by n².
 * @param {Float64Array} grid @param {number} n @param {number} sign @returns {Float64Array}
 */
export function fft2(grid, n, sign) {
  const plan = fftPlan(n);
  const out = Float64Array.from(grid);
  let a = new Float64Array(2 * n);
  let b = new Float64Array(2 * n);
  for (const along of ['row', 'column']) {
    for (let line = 0; line < n; line++) {
      for (let i = 0; i < n; i++) {
        const at = along === 'row' ? line * n + i : i * n + line;
        a[2 * i] = out[2 * at];
        a[2 * i + 1] = out[2 * at + 1];
      }
      for (const pass of plan) {
        fftPass(a, b, n, pass, sign);
        [a, b] = [b, a];
      }
      for (let i = 0; i < n; i++) {
        const at = along === 'row' ? line * n + i : i * n + line;
        out[2 * at] = a[2 * i];
        out[2 * at + 1] = a[2 * i + 1];
      }
    }
  }
  return out;
}

/**
 * The plain discrete Fourier transform of one line, the slow way, to check the passes against.
 * @param {Float64Array} line @param {number} sign @returns {Float64Array}
 */
export function dft(line, sign) {
  const n = line.length / 2;
  const out = new Float64Array(2 * n);
  for (let k = 0; k < n; k++) {
    let re = 0;
    let im = 0;
    for (let j = 0; j < n; j++) {
      const a = (sign * 2 * Math.PI * ((j * k) % n)) / n;
      re += line[2 * j] * Math.cos(a) - line[2 * j + 1] * Math.sin(a);
      im += line[2 * j] * Math.sin(a) + line[2 * j + 1] * Math.cos(a);
    }
    out[2 * k] = re;
    out[2 * k + 1] = im;
  }
  return out;
}
