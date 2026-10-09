import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dragCorner, editedName, keepShape, moveBox, SMALLEST, startBox } from '../src/lib/lab/image-edit.js';

const inside = (b, width, height) => b.x >= 0 && b.y >= 0 && b.x + b.w <= width && b.y + b.h <= height;

test('the crop box starts as the biggest of its shape in the middle, or the middle 80% for Free', () => {
  assert.deepEqual(startBox(1, 1600, 1200), { x: 200, y: 0, w: 1200, h: 1200 });
  assert.deepEqual(startBox(16 / 9, 1600, 1200), { x: 0, y: 150, w: 1600, h: 900 });
  assert.deepEqual(startBox(4 / 3, 900, 1600), { x: 0, y: 463, w: 900, h: 675 });
  assert.deepEqual(startBox(null, 1000, 500), { x: 100, y: 50, w: 800, h: 400 });
});

test('moving the box keeps it inside the picture', () => {
  const box = { x: 100, y: 100, w: 200, h: 100 };
  assert.deepEqual(moveBox(box, 50, -20, 1000, 500), { x: 150, y: 80, w: 200, h: 100 });
  assert.deepEqual(moveBox(box, -500, 900, 1000, 500), { x: 0, y: 400, w: 200, h: 100 });
});

test('dragging a corner: the opposite one stays, the box stays inside and no smaller than the least', () => {
  const box = { x: 100, y: 100, w: 400, h: 200 };
  assert.deepEqual(dragCorner(box, 'se', 50, 30, null, 1000, 1000), { x: 100, y: 100, w: 450, h: 230 });
  assert.deepEqual(dragCorner(box, 'nw', -50, -30, null, 1000, 1000), { x: 50, y: 70, w: 450, h: 230 });
  // Past the picture's edge: it stops there.
  assert.deepEqual(dragCorner(box, 'se', 5000, 5000, null, 1000, 800), { x: 100, y: 100, w: 900, h: 700 });
  // Folded over: no smaller than the least.
  const tiny = dragCorner(box, 'ne', -1000, 1000, null, 1000, 1000);
  assert.deepEqual([tiny.w, tiny.h], [SMALLEST, SMALLEST]);
  assert.equal(tiny.x, 100, 'the west side stays where it was');
  assert.equal(tiny.y + tiny.h, 300, 'the south side stays where it was');
});

test('a box with a shape keeps it, whichever way the corner goes, and inside the picture', () => {
  const square = { x: 100, y: 100, w: 300, h: 300 };
  for (const [corner, dx, dy] of [['se', 80, 10], ['se', 5, -60], ['nw', -40, -200], ['ne', 900, -900], ['sw', -900, 900]]) {
    const b = dragCorner(square, corner, dx, dy, 1, 1000, 700);
    assert.equal(b.w, b.h, `${corner} ${dx},${dy}: square`);
    assert.ok(inside(b, 1000, 700), `${corner} ${dx},${dy}: inside, ${JSON.stringify(b)}`);
  }
  const wide = dragCorner({ x: 0, y: 0, w: 320, h: 180 }, 'se', 160, 0, 16 / 9, 1920, 1080);
  assert.deepEqual([wide.w, wide.h], [480, 270]);
});

test('a new size keeps the shape, from the width or the height', () => {
  assert.deepEqual(keepShape(4032, 3024, { w: 1200 }), { w: 1200, h: 900 });
  assert.deepEqual(keepShape(4032, 3024, { h: 600 }), { w: 800, h: 600 });
  assert.deepEqual(keepShape(1000, 3, { w: 10 }), { w: 10, h: 1 }, 'never less than a pixel');
});

test('the saved file is named after the picture', () => {
  assert.equal(editedName('photo.jpg', 'jpg'), 'photo-edited.jpg');
  assert.equal(editedName('scan.final.PNG', 'webp'), 'scan.final-edited.webp');
  assert.equal(editedName('', 'png'), 'picture-edited.png');
});
