import { test } from 'node:test';
import assert from 'node:assert/strict';
import { howLong, nowLayout, splitEmoji } from '../src/lib/now-layout.js';

/** "P S S" as pictures: P has one, S hasn't. @param {string} kinds */
const from = (kinds) => kinds.split(' ').map((k) => k === 'P');

/**
 * The blocks drawn on a two-column grid, one row per text line; '.' is an empty cell. A tall block takes two rows.
 * @param {ReturnType<typeof nowLayout>} blocks
 */
function grid(blocks) {
  const rows = [];
  for (const b of blocks) {
    if (b.type === 'pair') rows.push([b.items[0], b.items[1]]);
    if (b.type === 'row') rows.push([b.item, b.item]);
    if (b.type === 'half') rows.push([b.item, '.']);
    if (b.type === 'tall') {
      const right = b.beside[0] < b.picture;
      const top = b.beside[0];
      const bottom = b.beside[1] ?? b.beside[0];
      rows.push(right ? [top, b.picture] : [b.picture, top], right ? [bottom, b.picture] : [b.picture, bottom]);
    }
  }
  return rows;
}

test("the current Now, a mood, Jarvis and a game: Jarvis on the right, the two stacked on the left", () => {
  assert.deepEqual(nowLayout(from('S P S')), [{ type: 'tall', picture: 1, beside: [0, 2] }]);
});

test('each case the plan names', () => {
  assert.deepEqual(nowLayout(from('S')), [{ type: 'row', item: 0 }]);
  assert.deepEqual(nowLayout(from('P')), [{ type: 'half', item: 0 }]);
  assert.deepEqual(nowLayout(from('P S')), [{ type: 'tall', picture: 0, beside: [1] }]);
  assert.deepEqual(nowLayout(from('S P')), [{ type: 'tall', picture: 1, beside: [0] }]);
  assert.deepEqual(nowLayout(from('P P')), [{ type: 'pair', items: [0, 1] }]);
  assert.deepEqual(nowLayout(from('S S')), [{ type: 'pair', items: [0, 1] }]);
  assert.deepEqual(nowLayout(from('P S S S')), [{ type: 'tall', picture: 0, beside: [1, 2] }, { type: 'row', item: 3 }]);
  assert.deepEqual(nowLayout(from('S P P')), [{ type: 'row', item: 0 }, { type: 'pair', items: [1, 2] }]);
  assert.deepEqual(nowLayout(from('P S P')), [{ type: 'tall', picture: 0, beside: [1] }, { type: 'half', item: 2 }]);
  assert.deepEqual(nowLayout([]), []);
});

test('every combination of 1 to 6 items: each placed once, in order, the first top left, no hole but beside a lone picture', () => {
  for (let n = 1; n <= 6; n++) {
    for (let mask = 0; mask < 2 ** n; mask++) {
      const pictures = [...Array(n)].map((_, b) => Boolean((mask >> b) & 1));
      const name = pictures.map((p) => (p ? 'P' : 'S')).join(' ');
      const blocks = nowLayout(pictures);
      const members = (/** @type {typeof blocks[number]} */ c) => (c.type === 'pair' ? c.items : c.type === 'tall' ? [c.picture, ...c.beside] : [c.item]);
      const placed = blocks.flatMap(members);
      assert.deepEqual([...placed].sort((a, b) => a - b), [...Array(n).keys()], `${name}: each item once`);
      blocks.forEach((b, k) => {
        if (k > 0) assert.ok(Math.min(...members(b)) > Math.max(...members(blocks[k - 1])), `${name}: blocks in now.md's order`);
        if (b.type === 'tall') {
          assert.ok(pictures[b.picture] && b.beside.every((x) => !pictures[x]), `${name}: a tall block is a picture beside others`);
          assert.ok(b.beside.length === 1 || b.beside.length === 2, `${name}: one or two beside a picture`);
        }
        if (b.type === 'half') assert.ok(pictures[b.item], `${name}: only a picture stands alone at half width`);
        if (b.type === 'row') assert.ok(!pictures[b.item], `${name}: only an item without a picture takes the whole row`);
      });
      const rows = grid(blocks);
      assert.equal(rows[0][0], 0, `${name}: the first item top left`);
      rows.forEach((row) => {
        if (row[1] === '.') assert.ok(pictures[row[0]], `${name}: an empty cell only beside a lone picture`);
      });
    }
  }
});

test('how long, said short', () => {
  const at = new Date('2026-10-27T00:16:56+08:00');
  const later = (/** @type {number} */ minutes) => new Date(at.getTime() + minutes * 60000);
  assert.equal(howLong(at, at), '1 min');
  assert.equal(howLong(at, later(1)), '1 min');
  assert.equal(howLong(at, later(45)), '45 mins');
  assert.equal(howLong(at, later(60)), '1 hr');
  assert.equal(howLong(at, later(23 * 60 + 59)), '23 hrs');
  assert.equal(howLong(at, later(47 * 60 + 59)), '47 hrs');
  assert.equal(howLong(at, later(48 * 60)), '2 days');
  assert.equal(howLong(at, later(-5)), '1 min');
});

test("a mood's emoji and its words", () => {
  assert.deepEqual(splitEmoji('😌 Chilling'), ['😌', 'Chilling']);
  assert.deepEqual(splitEmoji('🛠️ Building'), ['🛠️', 'Building']);
  assert.deepEqual(splitEmoji('Taking it easy'), ['', 'Taking it easy']);
  assert.deepEqual(splitEmoji('  😴Sleeping '), ['😴', 'Sleeping']);
  assert.deepEqual(splitEmoji('🇨🇳 Visiting Yunnan'), ['🇨🇳', 'Visiting Yunnan']);
  assert.deepEqual(splitEmoji('🧘🏽 Meditating'), ['🧘🏽', 'Meditating']);
  assert.deepEqual(splitEmoji('1️⃣ First'), ['1️⃣', 'First']);
  assert.deepEqual(splitEmoji('👨‍💻 Coding'), ['👨‍💻', 'Coding']);
});
