// How Now's cards sit in two columns, so a card without a picture never stretches into an empty block beside one
// with a picture. The rules (docs/plan/todo/now-cards.md, D2) go through the items in now.md's order:
//   a picture and the next one or two others: the picture two rows tall, the others stacked beside it;
//   two pictures in a row: side by side; another before a picture: the picture on the right;
//   two others in a row: side by side; a lone other: the whole row; a lone picture: half the row.

/**
 * @typedef {{ type: 'pair', items: [number, number] }
 *   | { type: 'tall', picture: number, beside: number[] }
 *   | { type: 'row', item: number }
 *   | { type: 'half', item: number }} NowBlock
 * A tall block puts its picture on the right when the first of `beside` comes before it.
 */

/**
 * The blocks, top to bottom, for items that do or don't have a picture.
 * @param {boolean[]} pictures one per item, in now.md's order @returns {NowBlock[]}
 */
export function nowLayout(pictures) {
  /** @type {NowBlock[]} */
  const blocks = [];
  let i = 0;
  while (i < pictures.length) {
    const [here, next, after] = [pictures[i], pictures[i + 1], pictures[i + 2]];
    if (here) {
      if (next) {
        blocks.push({ type: 'pair', items: [i, i + 1] });
        i += 2;
        continue;
      }
      const beside = [];
      let j = i + 1;
      while (beside.length < 2 && pictures[j] === false) beside.push(j++);
      blocks.push(beside.length ? { type: 'tall', picture: i, beside } : { type: 'half', item: i });
      i = j;
      continue;
    }
    if (next === false) {
      blocks.push({ type: 'pair', items: [i, i + 1] });
      i += 2;
    } else if (next && !after) {
      // Two pictures in a row pair up instead, so this one only leads a picture that has no partner.
      const beside = after === false ? [i, i + 2] : [i];
      blocks.push({ type: 'tall', picture: i + 1, beside });
      i += 1 + beside.length;
    } else {
      blocks.push({ type: 'row', item: i });
      i += 1;
    }
  }
  return blocks;
}

/**
 * How long something has been going, said short: "45 mins" under an hour, "23 hrs" under two days, then "3 days".
 * @param {Date} since @param {Date} now
 */
export function howLong(since, now) {
  const minutes = Math.max(1, Math.floor((now.getTime() - since.getTime()) / 60000));
  const say = (/** @type {number} */ n, /** @type {string} */ unit) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  if (minutes < 60) return say(minutes, 'min');
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return say(hours, 'hr');
  return say(Math.floor(hours / 24), 'day');
}

/**
 * A mood's leading emoji and the words after it: "😌 Chilling" is ["😌", "Chilling"]; no emoji, an empty one.
 * @param {string} text @returns {[string, string]}
 */
export function splitEmoji(text) {
  // RGI_Emoji (the v flag) takes flags, keycaps and skin tones whole; the build runs this, not the browser.
  const match = text.trim().match(/^(\p{RGI_Emoji})\s*(.*)$/v);
  return match ? [match[1], match[2]] : ['', text.trim()];
}
