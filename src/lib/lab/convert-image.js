// Convert Image: the parts that don't need a browser, kept apart from the page so the tests can check them: the
// types a picture can be saved as, the new files' names, a PDF with one picture to an A4 page (written here, byte by
// byte), and a ZIP of several pictures (with fflate).
import { zipSync } from 'fflate';

/** What a picture can be saved as. The PDF holds JPGs, one to a page. */
export const FORMATS = [
  { id: 'jpg', label: 'JPG', type: 'image/jpeg', ext: 'jpg' },
  { id: 'png', label: 'PNG', type: 'image/png', ext: 'png' },
  { id: 'webp', label: 'WebP', type: 'image/webp', ext: 'webp' },
  { id: 'pdf', label: 'PDF', type: 'application/pdf', ext: 'pdf' },
];

/** A file's name with a new type: `photo.HEIC.jpg` stays `photo.HEIC`, then the new ending. @param {string} name @param {string} ext */
export function outputName(name, ext) {
  const dot = name.lastIndexOf('.');
  const base = (dot > 0 ? name.slice(0, dot) : name).trim() || 'picture';
  return `${base}.${ext}`;
}

/** The same names, with "(2)", "(3)"… added where two would clash in one ZIP. @param {string[]} names */
export function uniqueNames(names) {
  const seen = new Map();
  return names.map((name) => {
    const key = name.toLowerCase();
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    if (count === 1) return name;
    const dot = name.lastIndexOf('.');
    return dot > 0 ? `${name.slice(0, dot)} (${count})${name.slice(dot)}` : `${name} (${count})`;
  });
}

/** An A4 page in PDF points (a 72nd of an inch), and the margin left round a picture: about 12.7 mm. */
const A4 = [595.28, 841.89];
const MARGIN = 36;

/**
 * Where a picture goes on its page: an A4 page turned to suit it (on its side for a wide one), the picture as big as
 * fits inside the margin, keeping its shape, in the middle. All in PDF points.
 * @param {number} width @param {number} height the picture's pixels
 */
export function pdfPlace(width, height) {
  const [pageW, pageH] = width > height ? [A4[1], A4[0]] : A4;
  const scale = Math.min((pageW - 2 * MARGIN) / width, (pageH - 2 * MARGIN) / height);
  const w = width * scale;
  const h = height * scale;
  return { pageW, pageH, x: (pageW - w) / 2, y: (pageH - h) / 2, w, h };
}

const n2 = (n) => Math.round(n * 100) / 100;

/**
 * A PDF with each picture on a page of its own, in order.
 * @param {{ jpeg: Uint8Array, width: number, height: number }[]} pictures JPG bytes and their size in pixels
 * @returns {Uint8Array<ArrayBuffer>}
 */
export function makePdf(pictures) {
  const text = new TextEncoder();
  /** @type {Uint8Array[]} */
  const parts = [];
  /** Where each object starts, by its number. @type {number[]} */
  const at = [];
  let length = 0;
  const put = (piece) => {
    const bytes = typeof piece === 'string' ? text.encode(piece) : piece;
    parts.push(bytes);
    length += bytes.length;
  };
  // The second line's high bytes tell programs reading it that the file holds binary data.
  put('%PDF-1.4\n');
  put(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  // Objects: 1 the catalogue, 2 the page list, then three for each picture: its page, its image and its drawing.
  const pageNumbers = pictures.map((_, i) => 3 + i * 3);
  const object = (number, body) => {
    at[number] = length;
    put(`${number} 0 obj\n`);
    for (const piece of body) put(piece);
    put('\nendobj\n');
  };
  object(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
  object(2, [`<< /Type /Pages /Kids [${pageNumbers.map((p) => `${p} 0 R`).join(' ')}] /Count ${pictures.length} >>`]);
  pictures.forEach((picture, i) => {
    const [page, image, drawing] = [pageNumbers[i], pageNumbers[i] + 1, pageNumbers[i] + 2];
    const place = pdfPlace(picture.width, picture.height);
    object(page, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n2(place.pageW)} ${n2(place.pageH)}] /Resources << /XObject << /Im${i + 1} ${image} 0 R >> >> /Contents ${drawing} 0 R >>`]);
    object(image, [`<< /Type /XObject /Subtype /Image /Width ${picture.width} /Height ${picture.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${picture.jpeg.length} >>\nstream\n`, picture.jpeg, '\nendstream']);
    const draw = `q ${n2(place.w)} 0 0 ${n2(place.h)} ${n2(place.x)} ${n2(place.y)} cm /Im${i + 1} Do Q`;
    object(drawing, [`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`]);
  });
  // The index of where every object starts, then where the index starts.
  const count = 3 + pictures.length * 3;
  const index = length;
  put(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let i = 1; i < count; i++) put(`${String(at[i]).padStart(10, '0')} 00000 n \n`);
  put(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${index}\n%%EOF\n`);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/**
 * One ZIP of several files, stored as they are: pictures are squeezed already, so squeezing again saves nothing.
 * @param {{ name: string, bytes: Uint8Array }[]} files @returns {Uint8Array<ArrayBuffer>}
 */
export function zipFiles(files) {
  const names = uniqueNames(files.map((f) => f.name));
  return new Uint8Array(zipSync(Object.fromEntries(files.map((file, i) => [names[i], [file.bytes, { level: 0 }]]))));
}

/** A file's size for people: 840 KB, 3.2 MB. @param {number} bytes */
export function sizeOf(bytes) {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}
