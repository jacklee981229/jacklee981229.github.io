import { test } from 'node:test';
import assert from 'node:assert/strict';
import { counterUrl } from '../src/lib/visits.js';

test("the counter's address for the whole site and for a page, the path encoded", () => {
  assert.equal(counterUrl('https://example.goatcounter.com', 'TOTAL'), 'https://example.goatcounter.com/counter/TOTAL.json');
  assert.equal(counterUrl('https://example.goatcounter.com/', '/lab/game/2048/'), 'https://example.goatcounter.com/counter/%2Flab%2Fgame%2F2048%2F.json');
});
