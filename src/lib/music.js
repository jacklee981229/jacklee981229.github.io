// The site's music player (MusicPlayer.astro): the rules it follows, kept here so they can be tested. Its songs are
// src/lib/music-songs.json, the files in the media repo's music/.

/**
 * How soon after one page is left the next picks its music up again, in milliseconds. A page change takes a second or
 * two; longer, and the visitor went elsewhere and came back, so the music waits for a press.
 */
export const RESUME_WITHIN = 20000;

/** How many song colours tokens.css has (--music-1 on); the songs take them in turn, round again after the last. */
export const SONG_COLOURS = 8;

/** The colour of the song at `index`, as a CSS value. @param {number} index */
export const songColour = (index) => `var(--music-${(index % SONG_COLOURS) + 1})`;

/** Volume when the visitor never set one (a travel story's song plays at the same). */
export const DEFAULT_VOLUME = 0.7;

/** A time as m:ss. @param {number} seconds */
export function clock(seconds) {
  const s = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The song `by` places on from `index`, round the list. @param {number} index @param {number} count */
export const songAfter = (index, count, by = 1) => (((index + by) % count) + count) % count;

/**
 * Previous: a song that has played a few seconds starts again; near its start, the one before.
 * @param {number} index @param {number} count @param {number} time
 */
export const back = (index, count, time) => (time > 3 ? index : songAfter(index, count, -1));

/**
 * What a page does with what the last page saved: which song, from when, and whether to play on. Playing on needs the
 * last page to have been playing, left moments ago, and this page to be the one on screen (a tab opened behind
 * doesn't take the music).
 * @param {unknown} saved `{ index, time, playing, at }`, as the last page left it
 * @param {number} count how many songs there are
 * @param {number} now Date.now()
 * @param {boolean} visible whether this page is on screen
 */
export function resume(saved, count, now, visible) {
  const fresh = { index: 0, time: 0, play: false };
  if (!saved || typeof saved !== 'object') return fresh;
  const { index, time, playing, at } = /** @type {Record<string, unknown>} */ (saved);
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= count) return fresh;
  const since = typeof at === 'number' ? now - at : NaN;
  return {
    index,
    time: typeof time === 'number' && Number.isFinite(time) && time > 0 ? time : 0,
    play: playing === true && visible && since >= 0 && since < RESUME_WITHIN,
  };
}

/** A saved volume, 0 to 1, or the default. @param {string | null} text */
export function volumeFrom(text) {
  const v = text === null || text.trim() === '' ? NaN : Number(text);
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : DEFAULT_VOLUME;
}

/**
 * How loud a song is `time` seconds in, 0 to 1, from its level: one character a tenth of a second, "0" silent to "z"
 * loudest.
 * @param {string} level @param {number} time
 */
export function levelAt(level, time) {
  if (!level) return 0;
  const i = Math.min(level.length - 1, Math.max(0, Math.floor(time * 10)));
  return Math.min(1, Math.max(0, (level.charCodeAt(i) - 48) / 74));
}

/**
 * The four bars in the closed button, each 0.35 to 1: the song's loudness now and a little ahead, so they rise and
 * fall one after another, and never shrink to dots (these are quiet songs).
 * @param {string} level @param {number} time
 */
export const barHeights = (level, time) =>
  [0, 0.35, 0.7, 1.05].map((ahead, k) => Math.min(1, Math.max(0.35, 0.3 + levelAt(level, time + ahead) * [0.95, 1.1, 0.85, 1][k])));
