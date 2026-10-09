// Reading what Jack's Build Log counts, while the site is built: the commits (git; the deploy fetches the whole
// history), the Changelog, the Lab's lists and the site's visits (GoatCounter's public counter, as the Lab's Most
// Popular reads it). No git just means no commits, and no counter no visits: never a failed build.
import { execFileSync } from 'node:child_process';
import { buildLog, readGitLog } from './build-log.js';
import { changelogFile } from './changelog-file.js';
import { isoDay } from './dates.js';
import { parseCount } from './lab/popular.js';
import { EFFECTS, EXPERIMENTS, TOOLS, WORLDS } from './lab/tools.js';
import { counterUrl } from './visits.js';

/** The commits, oldest first, or none when git can't say. */
function commits() {
  try {
    const log = execFileSync('git', ['-c', 'core.quotepath=off', 'log', '--no-merges', '--no-renames', '--numstat', '--format=@%at%x09%h%x09%s'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
    return readGitLog(log);
  } catch {
    return [];
  }
}

/** The whole site's visits, or null when the counter can't be had. @param {string} base GoatCounter's address */
async function siteVisits(base) {
  try {
    const answer = await fetch(counterUrl(base, 'TOTAL'), { signal: AbortSignal.timeout(8000) });
    return answer.ok ? parseCount((await answer.json()).count) : null;
  } catch {
    return null;
  }
}

/** @type {Promise<ReturnType<typeof buildLog>> | undefined} */
let made;

/**
 * The Build Log's numbers, worked out once per build (or dev session).
 * @param {{ goatcounter: string, started: string, rebuilt: string }} site SITE in site.ts
 */
export function buildLogFile(site) {
  return (made ??= (async () => buildLog({
    commits: commits(),
    changes: changelogFile(),
    // The Effects page is a tool too, but its effects are counted one by one.
    lab: { tools: TOOLS.filter((t) => t.status === 'ready' && t.slug !== 'effects').length, games: EXPERIMENTS.length, effects: EFFECTS.length, worlds: WORLDS.length },
    visits: await siteVisits(site.goatcounter),
    today: isoDay(new Date()),
    started: site.started,
    rebuilt: site.rebuilt,
  }))());
}
