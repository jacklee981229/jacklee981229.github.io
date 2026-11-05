// Jack's commands in the site's command palette, answered by his Now editor Worker (workers/now). "/login" asks for
// the password once per browser, and that login also opens his Morning Brief scores and Writing's drafts; "/logout"
// forgets it in this browser. "/now <words>" has Claude tidy the words, shows the line, and saves it as the whole of
// Now. Only a browser that has logged in shows /now and /logout at all.

/** Where the browser keeps the login pass (named before the login covered more than Now; renaming it logs Jack out). */
export const PASS_KEY = 'now-pass';

/**
 * What a typed command asks for, or nothing when it isn't one of these.
 * @param {string} query @returns {{ login: true } | { logout: true } | { words: string } | null}
 */
export function readNowCommand(query) {
  const typed = query.trim();
  if (/^\/login$/i.test(typed)) return { login: true };
  if (/^\/logout$/i.test(typed)) return { logout: true };
  const match = typed.match(/^\/now(?:\s+([\s\S]*))?$/i);
  return match ? { words: (match[1] ?? '').trim() } : null;
}

/** The editor's text ("- a\n- b") as one line for the palette: "a · b". @param {string} text */
export const oneLine = (text) =>
  text
    .split('\n')
    .map((line) => line.replace(/^\s*[-*]\s+/, '').trim())
    .filter(Boolean)
    .join(' · ');
