// A spring that carries a value to its target and lets it settle (stiffness 400, damping 40, the 细节实验页's), for a
// glide that answers a double-click or a let-go: the lightbox back to 100%, the Preview line to the middle.

/**
 * Runs `step` with values from `from` to `to` each frame until it settles; returns a way to stop it early.
 * @param {number} from @param {number} to @param {(value: number) => void} step
 */
export function spring(from, to, step) {
  let x = from;
  let v = 0;
  let last = performance.now();
  let frame = 0;
  const tick = (now) => {
    // At most two frames' worth at once, so a slow frame can't fling it.
    const dt = Math.min(0.032, (now - last) / 1000);
    last = now;
    v += (-400 * (x - to) - 40 * v) * dt;
    x += v * dt;
    if (Math.abs(x - to) < 1e-3 * Math.max(1, Math.abs(to - from)) && Math.abs(v) < 0.01) return step(to);
    step(x);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}
