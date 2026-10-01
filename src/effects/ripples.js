// Ripples: the pointer skims a pond. It leaves a drop every so often along its way, and each drop spreads in rings
// that slow down and fade. A click drops a stone: wider rings, more of them, and a few splashes landing around it.

/** Pixels the pointer travels between one drop and the next. */
const SPACING = 46;
/** Further than this in one frame isn't travel: the pointer arrived from somewhere else, and leaves no trail. */
const JUMP = 260;
/** A drop's rings: how far the first one spreads, the gap to the ones behind it, how many, and how long they last. */
const SPREAD = 115;
const GAP = 13;
const RINGS = 3;
const LIFE = 2.2;
/** A click's stone is this many times a drop. */
const STONE = 2.5;
/** More drops than this at once and the oldest go. */
const MOST = 150;

/** @param {import('./stage.js').Stage} stage @returns {import('./stage.js').Piece} */
export default function ripples(stage) {
  /** @type {{ x: number, y: number, size: number, color: number, age: number, life: number }[]} A drop with an age below 0 hasn't landed yet. */
  let drops = [];
  const last = { x: stage.pointer.x, y: stage.pointer.y };
  let color = 0;
  /** @param {number} x @param {number} y */
  const drop = (x, y, size = 1, wait = 0) => {
    if (drops.length >= MOST) drops.shift();
    // A bigger drop lasts longer. Each takes the next colour in turn.
    drops.push({ x, y, size, color, age: -wait, life: LIFE * Math.sqrt(size) });
    color = (color + 1) % stage.colors.lanes.length;
  };

  return {
    frame(dt) {
      const { ctx, pointer, colors, rgba } = stage;
      const dx = pointer.x - last.x;
      const dy = pointer.y - last.y;
      const far = Math.hypot(dx, dy) || 1;
      if (pointer.pressed) {
        drop(pointer.x, pointer.y, STONE);
        // What the stone throws up lands around it a moment later.
        for (let i = 0; i < 5; i++) {
          const angle = Math.random() * Math.PI * 2;
          const away = 70 + Math.random() * 110;
          drop(pointer.x + Math.cos(angle) * away, pointer.y + Math.sin(angle) * away, 0.55, 0.15 + Math.random() * 0.35);
        }
      }
      if (pointer.pressed || far > JUMP) {
        last.x = pointer.x;
        last.y = pointer.y;
      } else {
        // A quick move leaves several drops between two frames, evenly along the way.
        for (let left = far; left >= SPACING; left -= SPACING) {
          last.x += (dx / far) * SPACING;
          last.y += (dy / far) * SPACING;
          drop(last.x, last.y);
        }
      }

      ctx.clearRect(0, 0, stage.width, stage.height);
      drops = drops.filter((d) => (d.age += dt) < d.life);
      for (const d of drops) {
        if (d.age < 0) continue;
        const t = d.age / d.life;
        // Fast at first, then slowing, as rings on water do.
        const reach = SPREAD * d.size * (1 - (1 - t) ** 2.4);
        const rings = d.size > 1 ? RINGS + 2 : RINGS;
        ctx.lineWidth = (2.6 - 1.8 * t) * (d.size > 1 ? 1.35 : 1);
        for (let k = 0; k < rings; k++) {
          const r = reach - k * GAP * Math.max(1, d.size * 0.7);
          if (r < 1) break;
          // Each ring behind the first is fainter, and all of them fade as the drop ages.
          ctx.strokeStyle = rgba(colors.lanes[d.color], (1 - t) ** 1.5 * (1 - k / rings));
          ctx.beginPath();
          ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    },
  };
}
