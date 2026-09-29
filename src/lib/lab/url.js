// Encode URL: text to % codes (UTF-8, as web addresses use) and back, kept apart from the page so the tests can
// check it. Each returns the result, and a note in plain words when something couldn't be done.

/** @param {string} text @returns {{ text: string, note?: string }} */
export function encodeUrl(text) {
  try {
    return { text: encodeURIComponent(text) };
  } catch {
    // Only half of an emoji pair, cut off by whatever the text was copied from, can't be encoded.
    return { text: '', note: 'This text has a broken character, so it can’t be encoded. Try copying it again.' };
  }
}

// How many bytes a UTF-8 character takes, from its first byte; 0 when that byte can't start one.
const bytesFor = (/** @type {number} */ byte) => (byte < 0x80 ? 1 : byte < 0xc0 ? 0 : byte < 0xe0 ? 2 : byte < 0xf0 ? 3 : byte < 0xf8 ? 4 : 0);

/**
 * Reads % codes back into text. A % that isn't a proper code (like the one in "100%", or half a character's
 * codes) is left as it is instead of failing the whole text, and the note counts them.
 * @param {string} text
 * @returns {{ text: string, note?: string }}
 */
export function decodeUrl(text) {
  let out = '';
  let broken = 0;
  let i = 0;
  for (let at = text.indexOf('%'); at !== -1; at = text.indexOf('%', i)) {
    out += text.slice(i, at);
    const code = /^%[0-9a-f]{2}/i.test(text.slice(at, at + 3)) ? parseInt(text.slice(at + 1, at + 3), 16) : -1;
    const codes = code < 0 ? '' : text.slice(at, at + 3 * bytesFor(code));
    let char = '';
    try {
      char = codes && decodeURIComponent(codes);
    } catch {
      // Not a whole, valid character: fall through and keep the % as it is.
    }
    if (char) {
      out += char;
      i = at + codes.length;
    } else {
      out += '%';
      broken++;
      i = at + 1;
    }
  }
  out += text.slice(i);
  if (!broken) return { text: out };
  return { text: out, note: broken === 1 ? '1 % code couldn’t be read, so it’s left as it was.' : `${broken} % codes couldn’t be read, so they’re left as they were.` };
}
