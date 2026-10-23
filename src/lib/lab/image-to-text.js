// Image to Text: the part that doesn't need a browser, kept apart from the page so the tests can check it. The
// reader finds lines of text one box at a time; this puts the boxes back in reading order (rows top to bottom, each
// row left to right) and joins them into text to copy.

/** Chinese, Japanese and Korean characters and full-width punctuation, which take no space between them. */
const CJK = /[\u{2E80}-\u{9FFF}\u{AC00}-\u{D7AF}\u{F900}-\u{FAFF}\u{FF00}-\u{FFEF}]/u;

/**
 * The found boxes as rows, in reading order. Two boxes share a row when they overlap up and down by at least half
 * the shorter one's height, so a slightly tilted photo still keeps a line together.
 * @param {{ poly: [number, number][], text: string }[]} items
 * @returns {string[][]} each row's texts, left to right
 */
export function readingOrder(items) {
  const boxes = items
    .filter((item) => item.text.trim() && item.poly?.length)
    .map((item) => {
      const ys = item.poly.map((p) => p[1]);
      const xs = item.poly.map((p) => p[0]);
      return { top: Math.min(...ys), bottom: Math.max(...ys), left: Math.min(...xs), text: item.text.trim() };
    })
    .sort((a, b) => a.top - b.top);
  /** @type {{ top: number, bottom: number, boxes: typeof boxes }[]} */
  const rows = [];
  for (const box of boxes) {
    const row = rows.find((r) => {
      const overlap = Math.min(r.bottom, box.bottom) - Math.max(r.top, box.top);
      return overlap >= 0.5 * Math.min(r.bottom - r.top, box.bottom - box.top);
    });
    if (row) {
      row.boxes.push(box);
      row.top = Math.min(row.top, box.top);
      row.bottom = Math.max(row.bottom, box.bottom);
    } else rows.push({ top: box.top, bottom: box.bottom, boxes: [box] });
  }
  return rows.sort((a, b) => a.top - b.top).map((r) => r.boxes.sort((a, b) => a.left - b.left).map((b) => b.text));
}

/** A row's pieces joined: a space between them, except where both sides are Chinese (or similar). @param {string[]} texts */
export function joinRow(texts) {
  return texts.reduce((out, text) => (out && !(CJK.test(out.at(-1)) && CJK.test(text[0])) ? `${out} ${text}` : out + text), '');
}

/** Everything the reader found, as text: one line a row. @param {{ poly: [number, number][], text: string }[]} items */
export const toText = (items) => readingOrder(items).map(joinRow).join('\n');
