// Spotlight: the stage is strewn with little shapes, too faint to make out, and somewhere among them a cat. The
// pointer is a torch: inside its light everything shows in full colour. A click throws the light wide for a moment.

/** One shape for about this many square pixels of stage. */
const AREA_EACH = 4600;
/** The torch's reach, as a share of the stage's shorter side, and how much of that is soft edge. */
const REACH = 0.34;
const SOFT = 0.5;
/** How strongly the shapes show outside the light. */
const DIM = 0.09;
/** A click's flare: seconds to open over the whole stage, and to close again. */
const OPEN = 0.3;
const CLOSE = 1.7;

/** The shapes, each drawn around 0,0 at size `r`, in the colour already set. */
const SHAPES = [
  // A star.
  (c, r) => {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      const d = i % 2 ? r * 0.45 : r;
      c.lineTo(Math.cos(a) * d, Math.sin(a) * d);
    }
    c.fill();
  },
  // A heart.
  (c, r) => {
    c.beginPath();
    c.moveTo(0, r * 0.9);
    c.bezierCurveTo(-r * 1.5, -r * 0.2, -r * 0.6, -r * 1.1, 0, -r * 0.35);
    c.bezierCurveTo(r * 0.6, -r * 1.1, r * 1.5, -r * 0.2, 0, r * 0.9);
    c.fill();
  },
  // A ring.
  (c, r) => {
    c.lineWidth = r * 0.3;
    c.beginPath();
    c.arc(0, 0, r * 0.8, 0, Math.PI * 2);
    c.stroke();
  },
  // A triangle.
  (c, r) => {
    c.beginPath();
    c.moveTo(0, -r);
    c.lineTo(r * 0.9, r * 0.75);
    c.lineTo(-r * 0.9, r * 0.75);
    c.fill();
  },
  // A plus.
  (c, r) => {
    const t = r * 0.32;
    c.fillRect(-r, -t, r * 2, t * 2);
    c.fillRect(-t, -r, t * 2, r * 2);
  },
];

/** The cat's head, with its face cut out in the page's colour. */
function cat(c, r, paper) {
  c.beginPath();
  c.arc(0, 0, r, 0, Math.PI * 2);
  for (const side of [-1, 1]) {
    c.moveTo(side * r * 0.97, -r * 0.3);
    c.lineTo(side * r * 0.78, -r * 1.5);
    c.lineTo(side * r * 0.12, -r * 0.92);
  }
  c.fill();
  c.fillStyle = paper;
  c.strokeStyle = paper;
  c.lineWidth = r * 0.07;
  c.beginPath();
  for (const side of [-1, 1]) {
    c.moveTo(side * r * 0.4 + r * 0.15, -r * 0.12);
    c.arc(side * r * 0.4, -r * 0.12, r * 0.15, 0, Math.PI * 2);
  }
  c.moveTo(-r * 0.12, r * 0.22);
  c.lineTo(r * 0.12, r * 0.22);
  c.lineTo(0, r * 0.38);
  c.fill();
  c.beginPath();
  for (const side of [-1, 1]) {
    for (const lift of [0.2, 0.42]) {
      c.moveTo(side * r * 0.3, r * 0.34);
      c.lineTo(side * r * 0.95, r * lift);
    }
  }
  c.stroke();
}

/** @param {import('./stage.js').Stage} stage @returns {import('./stage.js').Piece} */
export default function spotlight(stage) {
  // Painted once: the shapes without the cat (all that shows faintly in the dark), and the same with the cat (what
  // the torch shows). Then, each frame, the part of that second picture the torch is on.
  const hints = document.createElement('canvas');
  const full = document.createElement('canvas');
  const lit = document.createElement('canvas');
  const hctx = /** @type {CanvasRenderingContext2D} */ (hints.getContext('2d'));
  const fctx = /** @type {CanvasRenderingContext2D} */ (full.getContext('2d'));
  const lctx = /** @type {CanvasRenderingContext2D} */ (lit.getContext('2d'));
  /** @type {{ x: number, y: number, size: number, turn: number, kind: number, color: number }[]} The cat is kind -1. */
  let shapes = [];
  /** The colours the picture was last painted in: a new theme means painting it again. */
  let painted = null;
  /** Seconds since the last click. */
  let flare = OPEN + CLOSE;

  const scatter = () => {
    const lanes = stage.colors.lanes.length;
    const count = Math.round((stage.width * stage.height) / AREA_EACH);
    shapes = Array.from({ length: count }, (_, i) => ({ x: Math.random() * stage.width, y: Math.random() * stage.height, size: 7 + Math.random() * 11, turn: Math.random() * Math.PI * 2, kind: i % SHAPES.length, color: Math.floor(Math.random() * lanes) }));
    // The cat goes on last, over its neighbours, and away from the edges so the whole of it can be found.
    shapes.push({ x: stage.width * (0.12 + Math.random() * 0.76), y: stage.height * (0.24 + Math.random() * 0.56), size: 17, turn: 0, kind: -1, color: Math.floor(Math.random() * lanes) });
    painted = null;
  };
  const paint = () => {
    const { canvas } = stage.ctx;
    for (const c of [hints, full, lit]) {
      c.width = canvas.width;
      c.height = canvas.height;
    }
    const scale = canvas.width / stage.width;
    for (const s of shapes) {
      // The cat goes on the torch's picture only, over a copy of everything else.
      if (s.kind < 0) fctx.drawImage(hints, 0, 0);
      const c = s.kind < 0 ? fctx : hctx;
      const paintIn = stage.rgba(stage.colors.lanes[s.color]);
      c.save();
      c.setTransform(scale, 0, 0, scale, 0, 0);
      c.translate(s.x, s.y);
      c.rotate(s.turn);
      c.fillStyle = paintIn;
      c.strokeStyle = paintIn;
      if (s.kind < 0) cat(c, s.size, stage.rgba(stage.colors.paper));
      else SHAPES[s.kind](c, s.size);
      c.restore();
    }
    painted = stage.colors;
  };
  scatter();

  return {
    resize: scatter,
    frame(dt) {
      const { ctx, pointer, colors, rgba, time, width, height } = stage;
      if (painted !== colors) paint();
      if (pointer.pressed) flare = 0;
      flare += dt;
      // The light opens fast and eases shut.
      const open = flare < OPEN ? flare / OPEN : Math.max(0, 1 - (flare - OPEN) / CLOSE) ** 2;
      // A torch is never quite steady.
      const narrow = Math.min(width, height) * REACH * (1 + 0.03 * Math.sin(time * 5.3) + 0.018 * Math.sin(time * 8.9));
      const reach = narrow + (Math.hypot(width, height) - narrow) * open;

      ctx.clearRect(0, 0, width, height);
      ctx.globalAlpha = DIM;
      ctx.drawImage(hints, 0, 0, width, height);
      ctx.globalAlpha = 1;

      const scale = lit.width / width;
      lctx.setTransform(scale, 0, 0, scale, 0, 0);
      lctx.globalCompositeOperation = 'source-over';
      lctx.clearRect(0, 0, width, height);
      const light = lctx.createRadialGradient(pointer.x, pointer.y, reach * (1 - SOFT), pointer.x, pointer.y, reach);
      light.addColorStop(0, rgba(colors.ink, 1));
      light.addColorStop(1, rgba(colors.ink, 0));
      lctx.fillStyle = light;
      lctx.fillRect(0, 0, width, height);
      // Only where the light fell does the picture come through.
      lctx.globalCompositeOperation = 'source-in';
      lctx.drawImage(full, 0, 0, width, height);
      ctx.drawImage(lit, 0, 0, width, height);

      ctx.strokeStyle = rgba(colors.ink, 0.14);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(pointer.x, pointer.y, reach, 0, Math.PI * 2);
      ctx.stroke();
    },
  };
}
