import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dft, fft2, fftPass, fftPlan } from '../src/lib/fft-plan.js';

/** Numbers that look random but are the same on every run. */
function seeded(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647 - 0.5;
  };
}

/** The slow 2D transform: the plain DFT of every row, then of every column. */
function slow2(grid, n, sign) {
  const out = Float64Array.from(grid);
  for (const along of ['row', 'column']) {
    for (let line = 0; line < n; line++) {
      const at = (i) => (along === 'row' ? line * n + i : i * n + line);
      const one = new Float64Array(2 * n);
      for (let i = 0; i < n; i++) [one[2 * i], one[2 * i + 1]] = [out[2 * at(i)], out[2 * at(i) + 1]];
      const done = dft(one, sign);
      for (let i = 0; i < n; i++) [out[2 * at(i)], out[2 * at(i) + 1]] = [done[2 * i], done[2 * i + 1]];
    }
  }
  return out;
}

const biggest = (a, b) => a.reduce((most, v, i) => Math.max(most, Math.abs(v - b[i])), 0);

test('the plan is passes of four, and one of two when the size needs it', () => {
  assert.deepEqual(fftPlan(256), [{ radix: 4, span: 1 }, { radix: 4, span: 4 }, { radix: 4, span: 16 }, { radix: 4, span: 64 }]);
  assert.deepEqual(fftPlan(128), [{ radix: 4, span: 1 }, { radix: 4, span: 4 }, { radix: 4, span: 16 }, { radix: 2, span: 64 }]);
  assert.deepEqual(fftPlan(2), [{ radix: 2, span: 1 }]);
  assert.throws(() => fftPlan(96), /power of two/);
});

test('one line through the passes matches the plain transform, both ways', () => {
  for (const n of [2, 8, 32, 64, 128, 256]) {
    const random = seeded(n);
    const line = Float64Array.from({ length: 2 * n }, random);
    for (const sign of [-1, 1]) {
      let a = Float64Array.from(line);
      let b = new Float64Array(2 * n);
      for (const pass of fftPlan(n)) {
        fftPass(a, b, n, pass, sign);
        [a, b] = [b, a];
      }
      assert.ok(biggest(a, dft(line, sign)) < 1e-9 * n, `${n}, sign ${sign}`);
    }
  }
});

test('the 2D passes match the plain 2D transform to 1e-4 at 128² and 256², there and back', () => {
  for (const n of [128, 256]) {
    const random = seeded(7 * n);
    const grid = Float64Array.from({ length: 2 * n * n }, random);
    const there = fft2(grid, n, -1);
    // Measured against the size of what the sums add up to, as a float on the GPU would be.
    assert.ok(biggest(there, slow2(grid, n, -1)) / n < 1e-4, `${n}² forward`);
    const back = fft2(there, n, 1).map((v) => v / (n * n));
    assert.ok(biggest(back, grid) < 1e-4, `${n}² back again`);
  }
});

test('two real grids packed as one complex grid come apart again by their mirror images', () => {
  // The liquid's step packs the spikes' height (real part) with the forces on them (imaginary part).
  const n = 16;
  const random = seeded(3);
  const u = Float64Array.from({ length: n * n }, random);
  const f = Float64Array.from({ length: n * n }, random);
  const packed = new Float64Array(2 * n * n);
  u.forEach((v, i) => { packed[2 * i] = v; packed[2 * i + 1] = f[i]; });
  const z = fft2(packed, n, -1);
  const alone = (values) => fft2(Float64Array.from({ length: 2 * n * n }, (_, i) => (i % 2 ? 0 : values[i / 2])), n, -1);
  const [U, F] = [alone(u), alone(f)];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = 2 * (y * n + x);
      const m = 2 * (((n - y) % n) * n + ((n - x) % n));
      // U = (Z(k) + conj Z(−k)) / 2 and F = (Z(k) − conj Z(−k)) / 2i.
      assert.ok(Math.abs((z[i] + z[m]) / 2 - U[i]) < 1e-9 && Math.abs((z[i + 1] - z[m + 1]) / 2 - U[i + 1]) < 1e-9);
      assert.ok(Math.abs((z[i + 1] + z[m + 1]) / 2 - F[i]) < 1e-9 && Math.abs((z[m] - z[i]) / 2 - F[i + 1]) < 1e-9);
    }
  }
});
