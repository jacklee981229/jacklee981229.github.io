// Reading src/content/now.md while the site is built, and the date it last changed: its last commit, from git, so
// there's no date to write in the file. A missing file, an empty one or no git just mean less to show.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { readNow } from './now.js';

const FILE = 'src/content/now.md';

/**
 * When a file was last committed, or nothing when git can't say (not a git folder, never committed, no git).
 * @param {string} file @returns {Date | undefined}
 */
export function lastCommitted(file) {
  try {
    const when = execFileSync('git', ['log', '-1', '--format=%cI', '--', file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return when ? new Date(when) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Now's items and note, and when the file last changed.
 * @returns {ReturnType<typeof readNow> & { updated?: Date }}
 */
export function nowFile() {
  let text = '';
  try {
    text = readFileSync(FILE, 'utf8');
  } catch {
    // No file: no card.
  }
  return { ...readNow(text), updated: text.trim() ? lastCommitted(FILE) : undefined };
}
