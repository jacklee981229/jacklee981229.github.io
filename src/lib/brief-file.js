// Reading the Morning Brief's files while the site is built (src/lib/brief.js says what a file holds). A folder
// that's missing or a file that won't parse just means fewer days.
import { readdirSync, readFileSync } from 'node:fs';
import { readBrief } from './brief.js';

const FOLDER = 'src/content/brief';

/** Every day that has a brief, oldest first. @returns {import('./brief.js').Brief[]} */
export function briefDays() {
  let names = [];
  try {
    names = readdirSync(FOLDER).filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort();
  } catch {
    return [];
  }
  const days = [];
  for (const name of names) {
    let data = null;
    try {
      data = JSON.parse(readFileSync(`${FOLDER}/${name}`, 'utf8'));
    } catch {
      continue;
    }
    const day = readBrief(data);
    // The file's name is its day: a date inside that disagrees is the file's mistake.
    if (day && day.date === name.slice(0, 10)) days.push(day);
  }
  return days;
}
