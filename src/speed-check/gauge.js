// Jack's Speed Check, drawn on the effects' stage (src/effects/stage.js), which runs it only while it's on screen: an
// arc that fills with the download speed on a log scale (0 to 1000 Mbps), light running along the filled part to a
// soft glow at its tip, quicker the faster the line, and streaks pouring in from both sides that vanish at a ring
// round it, more and faster with the speed. Each ping is an echo up the arc and back. When the check is done it all
// slows and settles. In the page's colours (its --c1 onward, speed-check.astro). With less motion asked for, only the
// arc fills.

/** The arc: where it starts (radians from 3 o'clock, clockwise) and how far round it goes. */
const START = (150 * Math.PI) / 180;
const SWEEP = (240 * Math.PI) / 180;
/** The scale's marks, in Mbps. */
const MARKS = [0, 10, 100, 500, 1000];
/** Seconds an echo takes up the arc and back, and how far up it goes. */
const ECHO = 0.7;
const ECHO_REACH = 0.3;
/** Seconds the motion takes to settle once the check is done. */
const SETTLE = 1.2;

/** Where a speed sits on the arc, 0 to 1. @param {number} mbps */
export const arcShare = (mbps) => Math.min(1, Math.log10(1 + Math.max(0, mbps)) / 3);

/**
 * @param {import('../effects/stage.js').Stage} stage
 * @param {HTMLElement} readout where the speed is written, eased toward the measured one so it climbs, not flickers
 */
export function createGauge(stage, readout) {
  const { ctx } = stage;
  let phase = 'idle';
  let target = 0;
  let shown = 0;
  let changed = 0;
  let asked = false;
  /** @type {number[]} */
  const echoes = [];
  /** @type {{ x: number, y: number, len: number, side: number, alpha: number }[]} */
  const streaks = [];

  const write = () => {
    readout.textContent = shown >= 100 ? String(Math.round(shown)) : shown < 0.05 ? '0' : shown.toFixed(1);
  };

  /** @param {number} dt */
  const frame = (dt) => {
    const t = stage.time;
    const { width: w, height: h } = stage;
    const [fill, track, light, streak, scale] = stage.colors.lanes;
    shown = stage.still ? target : shown + (target - shown) * (1 - Math.exp(-dt * 6));
    write();
    const f = arcShare(shown);
    // How lively it is: all go while downloading, easing to rest once done.
    const life = stage.still ? 0 : phase === 'download' ? 1 : phase === 'done' ? Math.max(0, 1 - (t - changed) / SETTLE) : 0;
    const cx = w / 2;
    const cy = h * 0.6;
    // A phone's card is narrow but tall enough: the arc takes more of its width there.
    const r = Math.min(w * (w < 500 ? 0.36 : 0.3), h * 0.46);
    const ring = r * 1.32;
    ctx.clearRect(0, 0, w, h);

    // The streaks, behind the arc: in from both sides, each gone at the ring.
    const rate = life * (8 + 220 * f * f);
    for (let n = rate * dt; n > 0; n--) {
      if (n < 1 && Math.random() > n) break;
      const side = Math.random() < 0.5 ? -1 : 1;
      streaks.push({ x: side * (w / 2 + 40), y: cy + (Math.random() * 2 - 1) * ring * 0.94, len: 30 + 160 * f * Math.random(), side, alpha: 0.25 + 0.6 * Math.random() });
    }
    const speed = (300 + 2600 * f) * (phase === 'done' ? Math.max(0.15, life) : 1);
    ctx.lineCap = 'round';
    ctx.lineWidth = 2;
    for (let i = streaks.length - 1; i >= 0; i--) {
      const s = streaks[i];
      s.x -= s.side * speed * dt;
      const edge = Math.abs(s.x);
      const hole = Math.sqrt(Math.max(0, ring * ring - (s.y - cy) ** 2));
      const fade = Math.min(1, Math.max(0, (edge - hole) / 120)) * (phase === 'done' ? life : 1);
      if (edge < hole || fade <= 0) {
        streaks.splice(i, 1);
        continue;
      }
      const x = cx + s.x;
      const tail = x + s.side * s.len;
      const g = ctx.createLinearGradient(x, 0, tail, 0);
      g.addColorStop(0, stage.rgba(streak, s.alpha * fade));
      g.addColorStop(1, stage.rgba(streak, 0));
      ctx.strokeStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, s.y);
      ctx.lineTo(tail, s.y);
      ctx.stroke();
    }

    // The arc's track, then its fill, with light running along the fill to a glow at the tip.
    ctx.lineWidth = r * 0.13;
    ctx.strokeStyle = stage.rgba(track);
    ctx.beginPath();
    ctx.arc(cx, cy, r, START, START + SWEEP);
    ctx.stroke();
    if (f > 0.002) {
      const tip = START + SWEEP * f;
      ctx.strokeStyle = stage.rgba(fill);
      ctx.beginPath();
      ctx.arc(cx, cy, r, START, tip);
      ctx.stroke();
      if (life > 0) {
        ctx.save();
        ctx.lineWidth = r * 0.045;
        ctx.setLineDash([r * 0.06, r * 0.32]);
        ctx.lineDashOffset = -t * r * (0.6 + 2.4 * f);
        ctx.strokeStyle = stage.rgba(light, 0.55 * life);
        ctx.beginPath();
        ctx.arc(cx, cy, r, START, tip);
        ctx.stroke();
        ctx.restore();
        const tx = cx + Math.cos(tip) * r;
        const ty = cy + Math.sin(tip) * r;
        const glow = ctx.createRadialGradient(tx, ty, 0, tx, ty, r * 0.22);
        glow.addColorStop(0, stage.rgba(light, 0.35 * life));
        glow.addColorStop(1, stage.rgba(light, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(tx, ty, r * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Each ping's echo: up the arc and back, fading.
    ctx.strokeStyle = stage.rgba(fill);
    for (let i = echoes.length - 1; i >= 0; i--) {
      const p = (t - echoes[i]) / ECHO;
      if (p > 1) {
        echoes.splice(i, 1);
        continue;
      }
      const at = (p < 0.5 ? p * 2 : (1 - p) * 2) * ECHO_REACH;
      ctx.globalAlpha = 1 - p * 0.6;
      ctx.beginPath();
      ctx.arc(cx, cy, r, START + SWEEP * Math.max(0, at - 0.035), START + SWEEP * at);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // The scale's marks, just outside the arc.
    ctx.fillStyle = stage.rgba(scale);
    ctx.font = `700 ${Math.max(11, r * 0.075)}px ${getComputedStyle(readout).fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const mark of MARKS) {
      const a = START + SWEEP * arcShare(mark);
      ctx.fillText(String(mark), cx + Math.cos(a) * r * 1.2, cy + Math.sin(a) * r * 1.2);
    }
  };

  return {
    frame,
    /** A new phase (idle, ping, download, done) and the speed to show. @param {string} next @param {number} mbps */
    set(next, mbps) {
      if (next !== phase) changed = stage.time;
      if (next === 'idle' || (next === 'ping' && phase !== 'ping')) {
        shown = 0;
        streaks.length = 0;
      }
      phase = next;
      target = mbps;
      // Still, the stage draws only when asked: once a frame at most, as speeds arrive with every piece downloaded.
      if (stage.still && !asked) {
        asked = true;
        requestAnimationFrame(() => {
          asked = false;
          stage.redraw();
        });
      }
    },
    /** One ping came back. */
    echo() {
      if (!stage.still) echoes.push(stage.time);
    },
  };
}
