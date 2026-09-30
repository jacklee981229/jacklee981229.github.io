import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addScore, cleanName, formatTime, NAME_MAX, readBoard } from '../public/games/leaderboard.js';

const names = (board) => board.map((e) => `${e.name} ${e.score}`);

test('a new name joins in score order, highest first', () => {
  let board = [];
  board = addScore(board, { name: 'Ann', score: 500, time: 9000 }).board;
  board = addScore(board, { name: 'Ben', score: 900, time: 9000 }).board;
  const r = addScore(board, { name: 'Cat', score: 700, time: 9000 });
  assert.deepEqual(names(r.board), ['Ben 900', 'Cat 700', 'Ann 500']);
  assert.equal(r.place, 2);
  assert.equal(r.improved, true);
});

test('each name keeps one entry, and only a better game replaces it', () => {
  const board = [{ name: 'Jack', score: 1000, time: 60000 }];
  const lower = addScore(board, { name: 'Jack', score: 800, time: 1000 });
  assert.equal(lower.improved, false);
  assert.equal(lower.board, board);
  assert.equal(lower.place, 1);
  const higher = addScore(board, { name: 'Jack', score: 1200, time: 90000 });
  assert.deepEqual(higher.board, [{ name: 'Jack', score: 1200, time: 90000 }]);
});

test('the same name in other letter case is the same person', () => {
  const r = addScore([{ name: 'Jack', score: 1000, time: 60000 }], { name: 'JACK', score: 1500, time: 60000 });
  assert.deepEqual(names(r.board), ['JACK 1500']);
});

test('the same score goes to the faster time', () => {
  const board = [{ name: 'Ann', score: 1000, time: 50000 }, { name: 'Ben', score: 1000, time: 70000 }];
  assert.deepEqual(names(addScore(board, { name: 'Cat', score: 1000, time: 60000 }).board), ['Ann 1000', 'Cat 1000', 'Ben 1000']);
  // A faster game with the same score is better; a slower one isn't.
  assert.equal(addScore(board, { name: 'Ben', score: 1000, time: 40000 }).place, 1);
  assert.equal(addScore(board, { name: 'Ann', score: 1000, time: 55000 }).improved, false);
});

test('names are tidied and kept short', () => {
  assert.equal(cleanName('  Jack   Lee  '), 'Jack Lee');
  assert.equal(cleanName('   '), '');
  assert.equal(cleanName('x'.repeat(30)).length, NAME_MAX);
  assert.equal(cleanName('杰克 👍'), '杰克 👍');
});

test('times show minutes, seconds and hundredths, cut off like a stopwatch, and hours when there are any', () => {
  assert.equal(formatTime(0), '00:00.00');
  assert.equal(formatTime(1234.9), '00:01.23');
  assert.equal(formatTime(83459), '01:23.45');
  assert.equal(formatTime(3599999), '59:59.99');
  assert.equal(formatTime(3723456), '1:02:03.45');
  assert.equal(formatTime(-5), '00:00.00');
});

test('a saved board is read back, dropping anything broken', () => {
  const saved = JSON.stringify([
    { name: 'Ann', score: 500, time: 1000 },
    { name: 'ann', score: 700, time: 1000 },
    { name: '', score: 900, time: 1000 },
    { name: 'Ben', score: 'lots', time: 1000 },
    { name: 'Cat', score: 300, time: -1 },
    null,
  ]);
  assert.deepEqual(readBoard(saved), [{ name: 'ann', score: 700, time: 1000 }]);
  assert.deepEqual(readBoard(null), []);
  assert.deepEqual(readBoard('not json'), []);
  assert.deepEqual(readBoard('{"name":"Ann"}'), []);
});
