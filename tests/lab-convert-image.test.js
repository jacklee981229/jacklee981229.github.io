import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import { makePdf, outputName, pdfPlace, sizeOf, uniqueNames, zipFiles } from '../src/lib/lab/convert-image.js';

const text = (bytes) => Buffer.from(bytes).toString('latin1');
/** Some stand-in JPG bytes: the PDF only carries them. */
const fakeJpeg = (n) => Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) % 256);

test('a new type keeps the name and changes its ending', () => {
  assert.equal(outputName('photo.jpg', 'png'), 'photo.png');
  assert.equal(outputName('IMG_0001.final.JPG', 'webp'), 'IMG_0001.final.webp');
  assert.equal(outputName('scan', 'pdf'), 'scan.pdf');
  assert.equal(outputName('.hidden', 'png'), '.hidden.png');
  assert.equal(outputName('', 'jpg'), 'picture.jpg');
});

test('names that would clash in one ZIP get a number', () => {
  assert.deepEqual(uniqueNames(['a.png', 'a.png', 'A.png', 'b.png']), ['a.png', 'a (2).png', 'A (3).png', 'b.png']);
});

test('a picture on its A4 page: turned to suit it, as big as fits inside the margin, in the middle', () => {
  const tall = pdfPlace(3000, 4000);
  assert.deepEqual([Math.round(tall.pageW), Math.round(tall.pageH)], [595, 842]);
  assert.ok(Math.abs(tall.w / tall.h - 0.75) < 1e-9, 'keeps its shape');
  assert.ok(tall.x >= 36 - 1e-9 && tall.y >= 36 - 1e-9 && Math.abs(tall.x * 2 + tall.w - tall.pageW) < 1e-6);
  const wide = pdfPlace(1920, 1080);
  assert.deepEqual([Math.round(wide.pageW), Math.round(wide.pageH)], [842, 595]);
  assert.ok(Math.abs(wide.w - (wide.pageW - 72)) < 1e-6, 'a wide one fills the width between the margins');
  const square = pdfPlace(500, 500);
  assert.equal(Math.round(square.pageH), 842, 'square stays upright');
});

test('the PDF: one page per picture, and its index points at every object exactly', () => {
  const pictures = [{ jpeg: fakeJpeg(1234), width: 3000, height: 4000 }, { jpeg: fakeJpeg(777), width: 1920, height: 1080 }];
  const pdf = makePdf(pictures);
  const all = text(pdf);
  assert.ok(all.startsWith('%PDF-1.4\n%'), 'the header');
  assert.ok(all.endsWith('%%EOF\n'), 'the end');
  const start = Number(all.match(/startxref\n(\d+)\n%%EOF\n$/)[1]);
  assert.ok(all.startsWith('xref\n', start), 'startxref points at the index');
  const [, first, count] = all.slice(start).match(/^xref\n(\d+) (\d+)\n/);
  assert.equal(Number(first), 0);
  assert.equal(Number(count), 3 + pictures.length * 3);
  const entries = all.slice(start).split('\n').slice(2, 2 + Number(count));
  entries.forEach((entry, i) => {
    assert.equal(entry.length, 19, `entry ${i} is 20 bytes with its line end`);
    if (i === 0) return;
    const offset = Number(entry.slice(0, 10));
    assert.ok(all.startsWith(`${i} 0 obj\n`, offset), `object ${i} is where the index says`);
  });
  assert.match(all, /\/Type \/Pages \/Kids \[3 0 R 6 0 R\] \/Count 2/);
  assert.match(all, /\/MediaBox \[0 0 595.28 841.89\]/, 'the tall one on an upright page');
  assert.match(all, /\/MediaBox \[0 0 841.89 595.28\]/, 'the wide one on its side');
  // Each picture's bytes as they were, the Length its own.
  for (const [i, picture] of pictures.entries()) {
    const head = `/Width ${picture.width} /Height ${picture.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${picture.jpeg.length} >>\nstream\n`;
    const from = all.indexOf(head) + head.length;
    assert.ok(from > head.length, `picture ${i}'s image`);
    assert.deepEqual(pdf.slice(from, from + picture.jpeg.length), picture.jpeg);
    assert.ok(all.startsWith('\nendstream', from + picture.jpeg.length));
  }
});

test('the ZIP holds every file as it was, clashing names numbered', () => {
  const files = [{ name: 'a.png', bytes: fakeJpeg(50) }, { name: 'a.png', bytes: fakeJpeg(60) }, { name: 'b.webp', bytes: fakeJpeg(70) }];
  const back = unzipSync(zipFiles(files));
  assert.deepEqual(Object.keys(back), ['a.png', 'a (2).png', 'b.webp']);
  assert.deepEqual(back['a (2).png'], files[1].bytes);
});

test('file sizes for people', () => {
  assert.equal(sizeOf(512), '512 B');
  assert.equal(sizeOf(840_000), '840 KB');
  assert.equal(sizeOf(3_200_000), '3.2 MB');
});
