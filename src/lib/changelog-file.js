// Reading src/content/changelog.md while the site is built. No file is no changes; a bad line stops the build
// (readChangelog in changelog.js).
import { readFileSync } from 'node:fs';
import { dayToDate, readChangelog } from './changelog.js';

/**
 * The site's last update: the newest post or the newest change in the Changelog, whichever is later.
 * @param {Date} [newestPost] @returns {Date | undefined}
 */
export function lastUpdate(newestPost) {
  const newest = changelogFile()[0];
  const changed = newest && dayToDate(newest.day);
  return newestPost && changed ? (newestPost > changed ? newestPost : changed) : (newestPost ?? changed);
}

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
