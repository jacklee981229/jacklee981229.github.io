import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DURATION_MS, MAX_BYTES, MIN_MS, Meter, PINGS, STREAMS, WARMUP_MS, measureDownload, measurePing, median, pingFromTiming, toMbps } from '../src/lib/speed-check.js';

test('the middle of a list, and megabits from bytes and time', () => {
  assert.equal(median([5, 1, 9]), 5);
  assert.equal(median([4, 1, 9, 6]), 5);
  assert.ok(Number.isNaN(median([])));
  assert.equal(toMbps(125_000_000, 1000), 1000);
  assert.equal(toMbps(1_250_000, 1000), 10);
  assert.equal(toMbps(100, 0), 0);
});

test('a ping leaves out the time Cloudflare spent on the answer', () => {
  const serverTiming = [{ duration: 3 }, { duration: 19 }, { duration: 0 }];
  assert.equal(pingFromTiming({ requestStart: 100, responseStart: 130.5, serverTiming }), 8.5);
  // a slow worker answer comes out the same once its time is taken off
  assert.equal(pingFromTiming({ requestStart: 0, responseStart: 183, serverTiming: [{ duration: 2 }, { duration: 171 }] }), 10);
  assert.equal(pingFromTiming({ requestStart: 0, responseStart: 12 }), 12);
  assert.equal(pingFromTiming({ requestStart: 0, responseStart: 5, serverTiming: [{ duration: 9 }] }), 0);
});

test('the ping is the middle of its pings, the first (opening the connection) left out', async () => {
  const times = [250, ...Array.from({ length: PINGS }, (_, i) => (i % 2 ? 8 : 6)), 999];
  let asked = 0;
  const seen = [];
  const ms = await measurePing({ ping: async () => times[asked++], onPing: (_, done) => seen.push(done) });
  assert.equal(asked, PINGS + 1);
  assert.equal(ms, 7);
  assert.equal(seen.length, PINGS);
  assert.equal(seen.at(-1), PINGS);
});

test('the speed leaves out the warm-up, the live reading only the last second', () => {
  const m = new Meter(0);
  // 1 MB every 10 ms (800 Mbps) for the warm-up, then 2 MB every 10 ms (1600 Mbps)
  for (let t = 10; t <= 4000; t += 10) m.add(t, t <= WARMUP_MS ? 1e6 : 2e6);
  assert.equal(Math.round(m.final(4000)), 1600);
  assert.equal(Math.round(m.live(4000)), 1600);
  // before the warm-up ends, the final reading is the live one, from the start while under a second in
  const early = new Meter(0);
  for (let t = 10; t <= 500; t += 10) early.add(t, 1e6);
  assert.equal(Math.round(early.live(500)), 800);
  assert.equal(Math.round(early.final(500)), 800);
});

/** A fake line: every piece moves the clock on 1 ms and brings `rate(t)` bytes (250 kB a ms is 2000 Mbps). */
function fakeLine({ fail = false, rate = () => 250_000 } = {}) {
  const clock = { t: 0 };
  let asked = 0;
  const download = async (onBytes, signal) => {
    asked++;
    if (fail) throw new Error('offline');
    for (let got = 0; got < 25 && !signal.aborted; got++) {
      await Promise.resolve();
      clock.t += 1;
      onBytes(rate(clock.t));
    }
    if (signal.aborted) throw new DOMException('aborted', 'AbortError');
  };
  return { clock, download, asked: () => asked, now: () => clock.t };
}
const never = () => new Promise(() => {});

test('a fast line stops at MAX_BYTES, its streams asking again as each answer ends', async () => {
  const line = fakeLine();
  const { mbps, bytes } = await measureDownload({ download: line.download, now: line.now, wait: never });
  assert.equal(Math.round(mbps), 2000);
  assert.equal(bytes, MAX_BYTES);
  assert.equal(line.clock.t, MAX_BYTES / 250_000);
  assert.ok(line.asked() > STREAMS, 'streams ask again');
});

test('a steady line stops after MIN_MS; an unsteady one runs to DURATION_MS', async () => {
  const steady = fakeLine({ rate: () => 10_000 });
  const result = await measureDownload({ download: steady.download, now: steady.now, wait: never });
  assert.equal(steady.clock.t, MIN_MS);
  assert.equal(Math.round(result.mbps), 80);
  assert.equal(result.bytes, MIN_MS * 10_000);

  // 40 Mbps and 120 Mbps by turns, 1.5 s each: never steady for two seconds
  const shaky = fakeLine({ rate: (t) => (Math.floor(t / 1500) % 2 ? 15_000 : 5_000) });
  await measureDownload({ download: shaky.download, now: shaky.now, wait: never });
  assert.equal(shaky.clock.t, DURATION_MS);
});

test('a stalled line still ends on time; a failed one says so; Stop stops it', async () => {
  let stalled = { t: 0 };
  const result = await measureDownload({
    download: (_, signal) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))),
    now: () => stalled.t,
    wait: async (ms) => { stalled.t += ms; },
  });
  assert.deepEqual(result, { mbps: 0, bytes: 0 });

  const broken = fakeLine({ fail: true });
  await assert.rejects(measureDownload({ download: broken.download, now: broken.now, wait: never }), /offline/);

  const line = fakeLine();
  const stop = new AbortController();
  const run = measureDownload({ download: line.download, now: line.now, wait: never, onSpeed: () => line.clock.t >= 500 && stop.abort(), signal: stop.signal });
  await run;
  assert.ok(line.clock.t < 520, `stopped near 500 ms, not ${line.clock.t}`);
});
