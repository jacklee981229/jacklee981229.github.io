// The home page title types itself out. Together these keep the whole effect, cursor included, within 2 seconds.
export const TYPE_MS = 1300;
export const CURSOR_MS = 600;

// A fixed "random" number for each position: the rhythm is uneven like real typing, but the same on every build.
const jitter = (i) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** When each character of `text` appears, in ms from the start. The first is at 0 and the last lands exactly on `total`. */
export function typingTimeline(text, total = TYPE_MS) {
  const chars = [...text];
  // The beat before each character after the first. Letters vary; a space gets a longer beat on both sides, so words stand apart.
  const beats = chars.slice(1).map((ch, i) => (ch === ' ' || chars[i] === ' ' ? 2 : 0.6 + jitter(i)));
  const sum = beats.reduce((a, b) => a + b, 0);
  let t = 0;
  return [0, ...beats.map((b) => Math.round(((t += b) * total) / sum))];
}
