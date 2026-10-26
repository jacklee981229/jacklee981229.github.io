// The Morning Brief's files as the site reads them (src/lib/brief.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayTitle, itemId, neighbours, readBrief, signalText } from '../src/lib/brief.js';

const item = (over = {}) => ({ id: 'a1', kind: 'ai', lead: false, title: '标题', line: '一句话', desc: '说明', why: '为什么', orig: 'Title', source: 'hn', signal: 125, url: 'https://example.com/a', discuss: 'https://news.ycombinator.com/item?id=1', ...over });

test('a good day keeps its items, the leads first', () => {
  const day = readBrief({ date: '2026-10-26', made: '2026-10-26T07:04:00+08:00', items: [item({ id: 'a' }), item({ id: 'b', lead: true }), item({ id: 'c' })] });
  assert.equal(day.date, '2026-10-26');
  assert.deepEqual(day.items.map((i) => [i.id, i.lead]), [['b', true], ['a', false], ['c', false]]);
});

test('items that do not hold together are left out, the rest stay', () => {
  const day = readBrief({ date: '2026-10-26', items: [
    item({ id: 'ok' }),
    item({ id: 'no-kind', kind: 'politics' }),
    item({ id: 'no-source', source: 'reddit' }),
    item({ id: 'no-title', title: '  ' }),
    item({ id: 'bad-link', url: 'javascript:alert(1)' }),
    item({ id: 'ok' }),
    'not an item',
    null,
  ] });
  assert.deepEqual(day.items.map((i) => i.id), ['ok']);
});

test('too many leads become three; none becomes the first three', () => {
  const many = readBrief({ date: '2026-10-26', items: ['a', 'b', 'c', 'd', 'e'].map((id) => item({ id, lead: true })) });
  assert.deepEqual(many.items.filter((i) => i.lead).map((i) => i.id), ['a', 'b', 'c']);
  const none = readBrief({ date: '2026-10-26', items: ['a', 'b', 'c', 'd'].map((id) => item({ id })) });
  assert.deepEqual(none.items.filter((i) => i.lead).map((i) => i.id), ['a', 'b', 'c']);
});

test('no day at all when the file is broken or empty', () => {
  assert.equal(readBrief(null), null);
  assert.equal(readBrief({ date: '26 Oct', items: [item()] }), null);
  assert.equal(readBrief({ date: '2026-10-26', items: [] }), null);
  assert.equal(readBrief({ date: '2026-10-26', items: [item({ url: '' })] }), null);
});

test('words are tidied onto one line, a bad discussion link is dropped, a bad count is none', () => {
  const [one] = readBrief({ date: '2026-10-26', items: [item({ title: '  两个\n  空格 ', discuss: 'nope', signal: 'lots' })] }).items;
  assert.equal(one.title, '两个 空格');
  assert.equal(one.discuss, '');
  assert.equal(one.signal, 0);
});

test('each source counts its own way', () => {
  assert.equal(signalText({ source: 'hn', signal: 125 }), '125 分');
  assert.equal(signalText({ source: 'lobsters', signal: 96 }), '96 分');
  assert.equal(signalText({ source: 'github', signal: 1317 }), '今日 +1,317 ★');
  assert.equal(signalText({ source: 'hn', signal: 0 }), '');
});

test('the day reads in 华语 with its weekday', () => {
  assert.equal(dayTitle('2026-10-26'), '10 月 26 日 星期一');
  assert.equal(dayTitle('2026-11-01'), '11 月 1 日 星期日');
});

test('yesterday and tomorrow are the days on either side, when there are any', () => {
  const days = ['2026-10-24', '2026-10-25', '2026-10-26'];
  assert.deepEqual(neighbours(days, '2026-10-25'), { before: '2026-10-24', after: '2026-10-26' });
  assert.deepEqual(neighbours(days, '2026-10-26'), { before: '2026-10-25', after: undefined });
  assert.deepEqual(neighbours(days, '2026-10-01'), {});
});

test('the same address always has the same id, and different ones differ', () => {
  assert.equal(itemId('https://example.com/a'), itemId('https://example.com/a'));
  assert.notEqual(itemId('https://example.com/a'), itemId('https://example.com/b'));
  assert.match(itemId('https://example.com/a'), /^[0-9a-f]{8}$/);
});
