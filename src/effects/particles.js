// Particles: points drifting about, each drawing a line to any neighbour close enough. The pointer joins in: it
// draws lines too and gently pulls the near ones along. A click pushes them all away.

/** How close two points must be to get a line, and how far the pointer reaches. */
const LINK = 135;
const REACH = 210;
/** One point for this many square pixels of stage, within limits (every pair is compared each frame). */
const AREA_EACH = 10500;
const FEWEST = 36;
const MOST = 170;

/** @param {import('./stage.js').Stage} stage @returns {import('./stage.js').Piece} */
export default function particles(stage) {
  /** @type {{ x: number, y: number, vx: number, vy: number, cruise: number, r: number, color: number }[]} */
  const points = [];
  const born = () => {
    const angle = Math.random() * Math.PI * 2;
    const cruise = 14 + Math.random() * 30;
    return { x: Math.random() * stage.width, y: Math.random() * stage.height, vx: Math.cos(angle) * cruise, vy: Math.sin(angle) * cruise, cruise, r: 1.6 + Math.random() * 2, color: Math.floor(Math.random() * stage.colors.lanes.length) };
  };
  // On a new size the points stay where they are (a phone's address bar sliding away mustn't reshuffle them); only
  // their number changes to suit the room.
  const fit = () => {
    const count = Math.min(MOST, Math.max(FEWEST, Math.round((stage.width * stage.height) / AREA_EACH)));
    while (points.length < count) points.push(born());
    points.length = count;
  };
  fit();

  return {
    resize: fit,
    frame(dt) {
      const { ctx, pointer, colors, rgba, width, height } = stage;
      for (const p of points) {
        const dx = pointer.x - p.x;
        const dy = pointer.y - p.y;
        const far = Math.hypot(dx, dy) || 1;
        if (pointer.pressed && far < 320) {
          const shove = (1 - far / 320) * 620;
          p.vx -= (dx / far) * shove;
          p.vy -= (dy / far) * shove;
        } else if (far < REACH) {
          const pull = (1 - far / REACH) * 90 * dt;
          p.vx += (dx / far) * pull;
          p.vy += (dy / far) * pull;
        }
        // Whatever sped it up or slowed it down, it settles back to its own cruising speed.
        const speed = Math.hypot(p.vx, p.vy) || 1;
        const settle = 1 + (p.cruise / speed - 1) * Math.min(1, dt * 1.6);
        p.vx *= settle;
        p.vy *= settle;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < 0 || p.x > width) { p.x = Math.min(Math.max(p.x, 0), width); p.vx = -p.vx; }
        if (p.y < 0 || p.y > height) { p.y = Math.min(Math.max(p.y, 0), height); p.vy = -p.vy; }
      }

      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 1;
      for (let i = 0; i < points.length; i++) {
        const a = points[i];
        for (let j = i + 1; j < points.length; j++) {
          const b = points[j];
          const far = Math.hypot(a.x - b.x, a.y - b.y);
          if (far >= LINK) continue;
          ctx.strokeStyle = rgba(colors.muted, (1 - far / LINK) * 0.55);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
        const near = Math.hypot(a.x - pointer.x, a.y - pointer.y);
        if (near < REACH) {
          ctx.strokeStyle = rgba(colors.lanes[a.color], (1 - near / REACH) * 0.9);
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(pointer.x, pointer.y);
          ctx.stroke();
          ctx.lineWidth = 1;
        }
      }
      for (const p of points) {
        ctx.fillStyle = rgba(colors.lanes[p.color]);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  };
}
