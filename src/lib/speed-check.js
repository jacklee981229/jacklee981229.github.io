// Speed Test (/lab/speed-test/): ping and download speed, measured in the visitor's browser against
// Cloudflare's speed servers, the ones speed.cloudflare.com uses. They answer any site (CORS and Timing-Allow-Origin
// are open) from the nearest Cloudflare city. Nothing is sent but the test traffic itself.

/** Cloudflare's endpoint: answers with `bytes` bytes. */
export const DOWN_URL = 'https://speed.cloudflare.com/__down';
/** Tiny requests timed for the ping, after one that opens the connection. */
export const PINGS = 20;
/** Downloads at the same time: one alone doesn't fill a fast line; at 6 the browser's own limit starts to bite. */
export const STREAMS = 4;
/** Bytes each download asks for; a stream asks again until time is up. */
export const CHUNK = 25_000_000;
/**
 * The download stops at the first of: DURATION_MS; MAX_BYTES downloaded, so a fast line doesn't use half a gigabyte;
 * or, after MIN_MS, the live speed holding within STEADY of its middle over the last STEADY_MS. The start, while the
 * connections ramp up, is left out of the speed.
 */
export const DURATION_MS = 8000;
export const MAX_BYTES = 200_000_000;
export const MIN_MS = 3000;
export const STEADY_MS = 2000;
export const STEADY = 0.1;
export const WARMUP_MS = 1000;
/** The live reading is the speed over this last stretch, checked for steadiness this often. */
const WINDOW_MS = 1000;
const READ_EVERY_MS = 250;

/** @param {number[]} values @returns {number} the middle one (the mean of the two middle ones for an even count) */
export function median(values) {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** @param {number} bytes @param {number} ms @returns {number} megabits a second */
export const toMbps = (bytes, ms) => (ms > 0 ? (bytes * 8) / ms / 1000 : 0);

/**
 * One ping from a request's resource timing: request sent to first byte back, less the time Cloudflare says it spent
 * on the answer (its Server-Timing durations), which would otherwise add 15–20 ms, more when its worker is slow.
 * @param {{ requestStart: number, responseStart: number, serverTiming?: readonly { duration: number }[] }} entry
 * @returns {number} ms
 */
export function pingFromTiming(entry) {
  const server = (entry.serverTiming ?? []).reduce((sum, s) => sum + s.duration, 0);
  return Math.max(0, entry.responseStart - entry.requestStart - server);
}

/**
 * Counts the bytes as they arrive: the live speed over the last second, and the final speed, everything after the
 * warm-up over the time since it ended.
 */
export class Meter {
  /** @param {number} start when the download began, ms */
  constructor(start) {
    this.start = start;
    /** @type {[number, number][]} [time, bytes] of the last second's chunks */
    this.recent = [];
    this.total = 0;
    this.afterWarmup = 0;
    /** @type {[number, number][]} [time, live Mbps], one every READ_EVERY_MS */
    this.readings = [];
  }

  /** @param {number} t @param {number} bytes */
  add(t, bytes) {
    this.total += bytes;
    if (t - this.start > WARMUP_MS) this.afterWarmup += bytes;
    this.recent.push([t, bytes]);
    while (this.recent.length && this.recent[0][0] <= t - WINDOW_MS) this.recent.shift();
    if (t - (this.readings.at(-1)?.[0] ?? this.start) >= READ_EVERY_MS) this.readings.push([t, this.live(t)]);
  }

  /** @param {number} t @returns {boolean} whether the download can stop now (see DURATION_MS) */
  done(t) {
    const ran = t - this.start;
    if (ran >= DURATION_MS || this.total >= MAX_BYTES) return true;
    if (ran < MIN_MS) return false;
    const last = this.readings.filter(([at]) => at > t - STEADY_MS).map(([, mbps]) => mbps);
    if (last.length < STEADY_MS / READ_EVERY_MS - 1) return false;
    const mid = median(last);
    return mid > 0 && last.every((mbps) => Math.abs(mbps - mid) <= mid * STEADY);
  }

  /** @param {number} t @returns {number} Mbps over the last second (or since the start, early on) */
  live(t) {
    const from = Math.max(this.start, t - WINDOW_MS);
    const bytes = this.recent.reduce((sum, [at, n]) => (at > from ? sum + n : sum), 0);
    return toMbps(bytes, t - from);
  }

  /** @param {number} t @returns {number} Mbps after the warm-up; before it ends, the live speed */
  final(t) {
    const measured = t - this.start - WARMUP_MS;
    return measured > 0 ? toMbps(this.afterWarmup, measured) : this.live(t);
  }
}

/**
 * One ping from the browser: a request for no bytes, timed by the browser (the answer allows it), less Cloudflare's
 * own time.
 * @returns {Promise<number>} ms
 */
export async function browserPing() {
  const url = `${DOWN_URL}?bytes=0&r=${Math.random()}`;
  await (await fetch(url, { cache: 'no-store' })).arrayBuffer();
  const entry = /** @type {PerformanceResourceTiming} */ (performance.getEntriesByName(url).pop());
  performance.clearResourceTimings();
  return pingFromTiming(entry);
}

/**
 * One download from the browser, its bytes counted as they arrive.
 * @param {(n: number) => void} onBytes @param {AbortSignal} signal
 */
export async function browserDownload(onBytes, signal) {
  const answer = await fetch(`${DOWN_URL}?bytes=${CHUNK}&r=${Math.random()}`, { cache: 'no-store', signal });
  const reader = /** @type {ReadableStream<Uint8Array>} */ (answer.body).getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    onBytes(value.length);
  }
}

/**
 * A whole check in the browser, ping then download, telling `on` as it goes. Throws if the speed server can't be
 * reached.
 * @param {{ phase: (name: 'ping' | 'download') => void, ping: (ms: number) => void, speed: (mbps: number) => void }} on
 * @returns {Promise<{ ping: number, mbps: number, bytes: number }>}
 */
export async function checkSpeed(on) {
  on.phase('ping');
  const ping = await measurePing({ ping: browserPing, onPing: on.ping });
  on.phase('download');
  const { mbps, bytes } = await measureDownload({
    download: browserDownload,
    now: () => performance.now(),
    wait: (ms) => new Promise((done) => setTimeout(done, ms)),
    onSpeed: on.speed,
  });
  return { ping, mbps, bytes };
}

/**
 * Times the pings one after another (the first, which opens the connection, left out) and hands over each as it
 * comes; returns the middle one.
 * @param {{ ping: () => Promise<number>, onPing?: (ms: number, done: number) => void, signal?: AbortSignal }} options
 * @returns {Promise<number>} ms
 */
export async function measurePing({ ping, onPing, signal }) {
  await ping();
  const times = [];
  for (let i = 0; i < PINGS && !signal?.aborted; i++) {
    times.push(await ping());
    onPing?.(median(times), times.length);
  }
  return median(times);
}

/**
 * Runs STREAMS downloads at once, each asking again when its answer ends, and stops them all when the meter says
 * it's done (see DURATION_MS) or `signal` is aborted. `download` fetches CHUNK bytes and calls `onBytes` for each piece as it arrives;
 * it stops when its signal is aborted. `wait` resolves after the given ms, so a stalled line still ends on time.
 * @param {{
 *   download: (onBytes: (n: number) => void, signal: AbortSignal) => Promise<void>,
 *   now: () => number,
 *   wait: (ms: number) => Promise<void>,
 *   onSpeed?: (mbps: number, progress: number) => void,
 *   signal?: AbortSignal,
 * }} options
 * @returns {Promise<{ mbps: number, bytes: number }>}
 */
export async function measureDownload({ download, now, wait, onSpeed, signal }) {
  const stop = new AbortController();
  const end = () => stop.abort();
  signal?.addEventListener('abort', end, { once: true });
  const start = now();
  const meter = new Meter(start);
  let stoppedAt = start + DURATION_MS;
  const onBytes = (/** @type {number} */ n) => {
    const t = now();
    if (stop.signal.aborted) return;
    meter.add(t, n);
    onSpeed?.(meter.live(t), Math.min(1, (t - start) / DURATION_MS));
    if (meter.done(t)) {
      stoppedAt = t;
      end();
    }
  };
  const stream = async () => {
    while (!stop.signal.aborted) {
      try {
        await download(onBytes, stop.signal);
      } catch (error) {
        if (stop.signal.aborted) break;
        end();
        throw error;
      }
    }
  };
  wait(DURATION_MS).then(end);
  try {
    await Promise.all(Array.from({ length: STREAMS }, stream));
  } finally {
    signal?.removeEventListener('abort', end);
    end();
  }
  return { mbps: meter.final(Math.min(now(), stoppedAt)), bytes: meter.total };
}
