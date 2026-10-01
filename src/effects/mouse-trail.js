// Mouse Trail: ribbons that chase the pointer. Each one's head circles the pointer at its own distance and speed, so
// on the move they weave around each other like a braid, and at rest they wind into a knot.

/** Points along each ribbon; every one follows the point ahead of it. */
const POINTS = 54;

/** @param {import('./stage.js').Stage} stage @returns {import('./stage.js').Piece} */
export default function mouseTrail(stage) {
  const ribbons = stage.colors.lanes.map((_, i) => ({
    // How wide its head circles the pointer, which way and how fast, and where on the circle it starts.
    circle: 16 + i * 9,
    spin: (i % 2 ? -1 : 1) * (3.1 - i * 0.35),
    phase: i * 1.9,
    // The spring that pulls the head to its place, and how quickly the rest of the ribbon follows.
    stiff: 190 - i * 22,
    damp: 15 - i * 1.2,
    follow: 28 - i * 2.4,
    width: 10 - i * 1.1,
    vx: 0,
    vy: 0,
    points: Array.from({ length: POINTS }, () => ({ x: stage.width / 2, y: stage.height / 2 })),
  }));

  return {
    frame(dt) {
      const { ctx, pointer, colors, rgba, time } = stage;
      ctx.clearRect(0, 0, stage.width, stage.height);
      ctx.lineCap = 'round';
      // Drawn widest-circling first, so the tightest ribbon lies on top.
      for (let r = ribbons.length - 1; r >= 0; r--) {
        const ribbon = ribbons[r];
        const head = ribbon.points[0];
        const tx = pointer.x + Math.cos(time * ribbon.spin + ribbon.phase) * ribbon.circle;
        const ty = pointer.y + Math.sin(time * ribbon.spin + ribbon.phase) * ribbon.circle;
        ribbon.vx += ((tx - head.x) * ribbon.stiff - ribbon.vx * ribbon.damp) * dt;
        ribbon.vy += ((ty - head.y) * ribbon.stiff - ribbon.vy * ribbon.damp) * dt;
        head.x += ribbon.vx * dt;
        head.y += ribbon.vy * dt;
        const ease = Math.min(1, ribbon.follow * dt);
        for (let i = 1; i < POINTS; i++) {
          const point = ribbon.points[i];
          const ahead = ribbon.points[i - 1];
          point.x += (ahead.x - point.x) * ease;
          point.y += (ahead.y - point.y) * ease;
        }
        // From the tail to the head, each piece a little wider and stronger than the one before. The fade is done by
        // mixing the colour into the page's, not by see-through paint: see-through pieces would show a darker bead
        // wherever two of them overlap.
        const color = colors.lanes[r % colors.lanes.length];
        for (let i = POINTS - 1; i > 0; i--) {
          const along = 1 - i / POINTS;
          const strength = along ** 1.2;
          ctx.strokeStyle = rgba(/** @type {import('./stage.js').Rgb} */ (color.map((part, c) => Math.round(colors.paper[c] + (part - colors.paper[c]) * strength))));
          ctx.lineWidth = 0.6 + ribbon.width * along ** 0.8;
          ctx.beginPath();
          ctx.moveTo(ribbon.points[i].x, ribbon.points[i].y);
          ctx.lineTo(ribbon.points[i - 1].x, ribbon.points[i - 1].y);
          ctx.stroke();
        }
      }
    },
  };
}
