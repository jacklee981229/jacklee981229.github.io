// Kaleidoscope: the pointer draws, and the line is repeated in mirrors all round the middle of the stage, so any
// scribble comes out as a pattern. The colour changes as you go, and old lines fade away. A click changes how many
// mirrors there are.

/** Seconds a line lasts, fading all the while. */
const LIFE = 10;
/** Drawing is kept in pieces this many seconds long: each piece has one colour and fades as one. */
const PIECE = 0.4;
/** How many times the drawing repeats round the middle (each also mirrored); a click moves on to the next. */
const MIRRORS = [8, 12, 6];
/** Further than this in one frame isn't a stroke: the pointer arrived from somewhere else. */
const JUMP = 220;

/** @param {import('./stage.js').Stage} stage @returns {import('./stage.js').Piece} */
export default function kaleidoscope(stage) {
  /** @type {{ born: number, path: Path2D, color: number }[]} Paths are measured from the stage's middle. */
  let pieces = [];
  /** @type {{ x: number, y: number } | null} */
  let last = null;
  let color = 0;
  let mirrors = 0;

  return {
    frame() {
      const { ctx, pointer, colors, rgba, time, width, height } = stage;
      if (pointer.pressed) mirrors = (mirrors + 1) % MIRRORS.length;
      const count = MIRRORS[mirrors];
      const x = pointer.x - width / 2;
      const y = pointer.y - height / 2;
      const moved = last ? Math.hypot(x - last.x, y - last.y) : Infinity;
      if (moved > JUMP) {
        last = { x, y };
      } else if (last && moved > 0.5) {
        let piece = pieces[pieces.length - 1];
        if (!piece || time - piece.born > PIECE) {
          piece = { born: time, path: new Path2D(), color };
          pieces.push(piece);
          color = (color + 1) % colors.lanes.length;
        }
        piece.path.moveTo(last.x, last.y);
        piece.path.lineTo(x, y);
        last = { x, y };
      }
      pieces = pieces.filter((p) => time - p.born < LIFE);

      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(width / 2, height / 2);
      // The mirrors themselves, faintly, so the stage shows how it's cut up before anything is drawn.
      const reach = Math.hypot(width, height) / 2;
      ctx.strokeStyle = rgba(colors.muted, 0.16);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 0; k < count; k++) {
        const angle = (k * Math.PI * 2) / count;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * reach, Math.sin(angle) * reach);
      }
      ctx.stroke();

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 2.8;
      for (const piece of pieces) {
        ctx.strokeStyle = rgba(colors.lanes[piece.color], (1 - (time - piece.born) / LIFE) ** 1.3);
        for (let k = 0; k < count; k++) {
          ctx.save();
          ctx.rotate((k * Math.PI * 2) / count);
          ctx.stroke(piece.path);
          ctx.scale(1, -1);
          ctx.stroke(piece.path);
          ctx.restore();
        }
      }
      ctx.restore();
    },
  };
}
