// Stained Glass: the stage is cut into coloured panes, one around each of a few dozen drifting points; a pane is
// everywhere that's nearer to its point than to any other. The pointer is a point too, with a pane of its own, and
// the others shy away from it, so its pane makes room wherever it goes. A click shoves them all aside.

/** One pane for about this many square pixels of stage, within limits. */
const AREA_EACH = 24000;
const FEWEST = 14;
const MOST = 60;
/** How far the pointer's push reaches and how hard it is; and the same for a click's shove. */
const REACH = 240;
const PUSH = 260;
const SHOVE_REACH = 420;
const SHOVE = 520;
/** Panes this near the pointer take a stronger colour. */
const GLOW = 300;
/** Pixels of gap between panes. */
const LEAD = 4;

/**
 * What's left of a pane (x, y, x, y...) after cutting away everything nearer to b than to a.
 * @param {number[]} pane
 */
function cut(pane, ax, ay, bx, by) {
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const nx = bx - ax;
  const ny = by - ay;
  const out = [];
  for (let i = 0; i < pane.length; i += 2) {
    const x1 = pane[i];
    const y1 = pane[i + 1];
    const x2 = pane[(i + 2) % pane.length];
    const y2 = pane[(i + 3) % pane.length];
    // How far each corner is past the line half-way between the two points: past it is b's side.
    const d1 = (x1 - mx) * nx + (y1 - my) * ny;
    const d2 = (x2 - mx) * nx + (y2 - my) * ny;
    if (d1 <= 0) out.push(x1, y1);
    if ((d1 < 0 && d2 > 0) || (d1 > 0 && d2 < 0)) {
      const t = d1 / (d1 - d2);
      out.push(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t);
    }
  }
  return out;
}

/** @param {import('./stage.js').Stage} stage @returns {import('./stage.js').Piece} */
export default function stainedGlass(stage) {
  /** @type {{ x: number, y: number, vx: number, vy: number, cruise: number, color: number, tint: number }[]} */
  const points = [];
  const born = () => {
    const angle = Math.random() * Math.PI * 2;
    const cruise = 6 + Math.random() * 13;
    return { x: Math.random() * stage.width, y: Math.random() * stage.height, vx: Math.cos(angle) * cruise, vy: Math.sin(angle) * cruise, cruise, color: Math.floor(Math.random() * stage.colors.lanes.length), tint: 0.28 + Math.random() * 0.34 };
  };
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
        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const far = Math.hypot(dx, dy) || 1;
        if (pointer.pressed && far < SHOVE_REACH) {
          p.vx += (dx / far) * (1 - far / SHOVE_REACH) * SHOVE;
          p.vy += (dy / far) * (1 - far / SHOVE_REACH) * SHOVE;
        } else if (far < REACH) {
          p.vx += (dx / far) * (1 - far / REACH) * PUSH * dt;
          p.vy += (dy / far) * (1 - far / REACH) * PUSH * dt;
        }
        // Whatever pushed it, it settles back to its own slow drift.
        const speed = Math.hypot(p.vx, p.vy) || 1;
        const settle = 1 + (p.cruise / speed - 1) * Math.min(1, dt * 1.8);
        p.vx *= settle;
        p.vy *= settle;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < 0 || p.x > width) { p.x = Math.min(Math.max(p.x, 0), width); p.vx = -p.vx; }
        if (p.y < 0 || p.y > height) { p.y = Math.min(Math.max(p.y, 0), height); p.vy = -p.vy; }
      }

      ctx.clearRect(0, 0, width, height);
      ctx.lineJoin = 'round';
      ctx.lineWidth = LEAD;
      // The gaps between panes are the page showing through: each pane is edged in the page's own colour.
      ctx.strokeStyle = rgba(colors.paper);
      /** @param {import('./stage.js').Rgb} color @param {number} strength */
      const mixed = (color, strength) => rgba(/** @type {import('./stage.js').Rgb} */ (color.map((part, c) => Math.round(colors.paper[c] + (part - colors.paper[c]) * strength))));
      // The pointer's pane goes last, on top.
      const all = [...points, { x: pointer.x, y: pointer.y, color: -1, tint: 0 }];
      for (const a of all) {
        let pane = [0, 0, width, 0, width, height, 0, height];
        for (const b of all) {
          if (b !== a) pane = cut(pane, a.x, a.y, b.x, b.y);
          if (pane.length < 6) break;
        }
        if (pane.length < 6) continue;
        const near = Math.max(0, 1 - Math.hypot(a.x - pointer.x, a.y - pointer.y) / GLOW);
        ctx.fillStyle = a.color < 0 ? mixed(colors.ink, 0.86) : mixed(colors.lanes[a.color], Math.min(1, a.tint + 0.45 * near));
        ctx.beginPath();
        ctx.moveTo(pane[0], pane[1]);
        for (let i = 2; i < pane.length; i += 2) ctx.lineTo(pane[i], pane[i + 1]);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    },
  };
}
