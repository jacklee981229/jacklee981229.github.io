// Reading src/content/changelog.md while the site is built. No file is no changes; a bad line stops the build
// (readChangelog in changelog.js).
import { readFileSync } from 'node:fs';
import { readChangelog } from './changelog.js';

/** @returns {import('./changelog.js').Change[]} */
export function changelogFile() {
  let text = '';
  try {
    text = readFileSync('src/content/changelog.md', 'utf8');
  } catch {
    // No file yet: nothing to list.
  }
  return readChangelog(text);
}
