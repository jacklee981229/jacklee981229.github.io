// The palette's /now: Jack changes Now from the site's command palette through his Now editor Worker (workers/now).
// "/now login" asks for the password once per browser; "/now <words>" has Claude tidy the words, shows the line, and
// saves it as the whole of Now. Only a browser that has logged in shows the command at all.

/** Where the browser keeps the login pass. */
export const PASS_KEY = 'now-pass';

/**
 * What a typed /now asks for, or nothing when it isn't /now.
 * @param {string} query @returns {{ login: true } | { words: string } | null}
 */
export function readNowCommand(query) {
  const match = query.trimStart().match(/^\/now(?:\s+([\s\S]*))?$/i);
  if (!match) return null;
  const words = (match[1] ?? '').trim();
  return /^login$/i.test(words) ? { login: true } : { words };
}

/** The editor's text ("- a\n- b") as one line for the palette: "a · b". @param {string} text */
export const oneLine = (text) =>
  text
    .split('\n')
    .map((line) => line.replace(/^\s*[-*]\s+/, '').trim())
    .filter(Boolean)
    .join(' · ');
