import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flowName, flowStyle } from '../src/lib/flow.js';

test('a link and the top of the page it leads to share one name, made from the address', () => {
  assert.equal(flowName('/lab/game/2048/'), 'to-lab-game-2048');
  assert.equal(flowName('/now/'), 'to-now');
  assert.equal(flowName('/c1/'), 'to-c1');
  assert.equal(flowName('/'), 'to-home');
  assert.equal(flowStyle('/now/'), 'view-transition-name: to-now');
});

test("a link's hash or query doesn't change the name, nor its slashes", () => {
  assert.equal(flowName('/collections/#movies'), 'to-collections');
  assert.equal(flowName('/writing/?from=home'), 'to-writing');
  assert.equal(flowName('now'), flowName('/now/'));
});

test('every name is a valid CSS name: a letter first, then letters, digits and dashes', () => {
  for (const path of ['/lab/game/2048/', '/3/', '/lab/world/pond/', '/Travel Map/', '/tags/c++/']) {
    assert.match(flowName(path), /^[a-z][a-z0-9-]*$/);
  }
});
