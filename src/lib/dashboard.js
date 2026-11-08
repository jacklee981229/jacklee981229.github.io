// Jack's dashboard (/dashboard/, src/pages/dashboard.astro): what needs him, his reminders, today's to-dos, his projects
// by kind, the other to-dos and what he did, from the snapshot his laptop pushes (C:\repos\Jack\dashboard, collect.py,
// whose docstring is its format) and the to-dos the Worker already holds. The snapshot carries points in time only: everything that moves with the clock
// (days left, minutes ago, an overdue backup) is worked out here against the browser's clock, so it keeps moving while
// the laptop is off. Times and days are Malaysia's, whatever the browser's time zone.
import { dayWords, dueFirst, isDue } from './todo-days.js';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** Malaysia is UTC+8 all year. */
const MYT = 8 * HOUR;
/** The laptop pushes every 15 minutes; an hour without one means it's off. */
export const OFFLINE_AFTER = HOUR;
/** The KB backup runs on Sundays at 22:00 and takes minutes; it counts as missed an hour later, so the page doesn't
 *  turn red while it runs. */
export const BACKUP_GRACE = HOUR;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A moment as a Date whose UTC fields read Malaysia's clock. @param {number} ms */
const myt = (ms) => new Date(ms + MYT);
/** Malaysia's day for a moment, YYYY-MM-DD. @param {number} ms */
export const dayOf = (ms) => myt(ms).toISOString().slice(0, 10);
/** @param {string} day @param {number} n */
const addDays = (day, n) => new Date(Date.parse(day) + n * DAY).toISOString().slice(0, 10);
/** @param {number} n @param {string} word */
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** A day as "Sun 1 Nov". @param {string} day YYYY-MM-DD */
export function dayName(day) {
  const date = new Date(Date.parse(day));
  return `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

/** "Today, 13:02", "Yesterday, 23:31", "Tomorrow, 15:01" or "Sun 1 Nov, 22:04". @param {number} ms @param {number} now */
export function whenWords(ms, now) {
  const at = myt(ms);
  const time = `${String(at.getUTCHours()).padStart(2, '0')}:${String(at.getUTCMinutes()).padStart(2, '0')}`;
  const day = dayOf(ms);
  const today = dayOf(now);
  const name = day === today ? 'Today' : day === addDays(today, -1) ? 'Yesterday' : day === addDays(today, 1) ? 'Tomorrow' : dayName(day);
  return `${name}, ${time}`;
}

/** whenWords after other words, a day's name in small letters: "Runs out tomorrow, 12:46". @param {number} ms @param {number} now */
const whenIn = (ms, now) => whenWords(ms, now).replace(/^(Today|Yesterday|Tomorrow)/, (day) => day.toLowerCase());

/**
 * Whole days until a sideloaded app runs out, rounded up: 2 from exactly 48 hours before, which is when the laptop
 * adds its reminder to-do (calc.reminder in collect.py's folder); 0 or less once it has run out.
 * @param {number} runsOut @param {number} now
 */
export const daysLeft = (runsOut, now) => Math.ceil((runsOut - now) / DAY);

/** The Sunday 22:00 (Malaysia) on or before a moment. @param {number} ms */
function sundayRun(ms) {
  const at = myt(ms);
  const run = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate() - at.getUTCDay(), 22) - MYT;
  return run <= ms ? run : run - 7 * DAY;
}
/** The weekly KB backup run the last success must have come after, given its grace. @param {number} now */
export const backupDue = (now) => sundayRun(now - BACKUP_GRACE);
/** The first weekly run after a success. @param {number} last */
export const nextBackup = (last) => sundayRun(last) + 7 * DAY;

/**
 * The line under the page's title: how long ago the laptop pushed, or that it seems to be off.
 * @param {number} madeAt @param {number} now @returns {{ offline: boolean, text: string }}
 */
export function lede(madeAt, now) {
  const minutes = Math.max(0, Math.floor((now - madeAt) / MINUTE));
  if (now - madeAt >= OFFLINE_AFTER) return { offline: true, text: `Last update ${whenIn(madeAt, now)}` };
  return { offline: false, text: minutes === 0 ? 'Updated just now' : `Updated ${plural(minutes, 'minute')} ago` };
}

/** "Can't read GitHub: gh isn't installed" as a title and its reason. @param {string} error */
function unread(error) {
  const cut = error.indexOf(': ');
  return cut < 0 ? { title: error, reason: '' } : { title: error.slice(0, cut), reason: error.slice(cut + 2) };
}

/**
 * The kinds a repo can be, in the order Projects shows them, each with its name and icon (its colour is the page's
 * --dg-kind-<key>). The laptop's table (collect.py's KINDS) says which repo is which; in a snapshot from before it,
 * every repo is Other.
 */
export const KINDS = [
  { key: 'web', name: 'Websites', icon: 'globe' },
  { key: 'mobile', name: 'Mobile App', icon: 'phone' },
  { key: 'pc', name: 'PC app', icon: 'monitor' },
  { key: 'mods', name: 'Claude mods', icon: 'mods' },
  { key: 'behind', name: 'Behind the scenes', icon: 'gear' },
  { key: 'other', name: 'Other', icon: 'folder' },
];
/** A signing lasts seven days (a free Apple ID); Reminders' ring has a day each. */
export const SIGN_DAYS = 7;

/** Each repo's kind, by name. A to-do's project that isn't a repo (Jack, General) has none. @param {any} snapshot */
export function kindsOf(snapshot) {
  return new Map((snapshot.repos?.repos ?? []).map((/** @type {any} */ r) => [String(r.name), KINDS.some((k) => k.key === r.kind) ? String(r.kind) : 'other']));
}

/** A signing's state by its days left: fine past 2, amber at 2, red at 1 or once it has run out. @param {number} left */
const signLevel = (left) => (left <= 1 ? 'act' : left <= 2 ? 'soon' : 'ok');

/**
 * The KB backup's state: done (when it last ran), never finished, overdue (the days since the last, the run it
 * missed), or failed after its last success.
 * @param {any} backup @param {number} now
 */
function backupState(backup, now) {
  const last = backup.last_success_at ? Date.parse(backup.last_success_at) : null;
  const due = backupDue(now);
  if (last === null) return { state: 'never', last: 0, since: 0, due };
  if (last < due) return { state: 'overdue', last, since: Math.floor((now - last) / DAY), due };
  return { state: backup.last_error ? 'failed' : 'done', last, since: 0, due };
}

/**
 * @typedef {{ level: 'act' | 'soon', key: string, title: string, project?: string, fig?: number, unit?: string,
 *   icon?: string, cells?: number, lines: string[], err?: string, link?: { href: string, text: string } }} Need
 * @typedef {{ id: string, project: string, text: string, notes: string, on?: string }} Todo
 * @typedef {{ app: string, project: string, text: string }} Reminder
 */

/**
 * What needs Jack, most urgent first. act (red): broken, or an app with a day or less left. soon (amber): wants
 * doing in a day or two, or a source the laptop couldn't read. Each has a big number, or an icon where there's no
 * number to give, and the project it's about, for its kind's mark. Work not committed or pushed shows on its
 * project's card instead, and to-dos past their day lead Today.
 * @param {any} snapshot @param {number} now
 * @returns {Need[]}
 */
export function attention(snapshot, now) {
  /** @type {Need[]} */
  const out = [];
  const errors = [];
  for (const name of ['sideload', 'deploys', 'backup', 'repos', 'done']) {
    const error = snapshot[name]?.error;
    if (error) errors.push({ level: /** @type {const} */ ('soon'), key: `error-${name}`, title: unread(error).title, icon: 'bug', lines: [], err: unread(error).reason || undefined });
  }

  for (const app of snapshot.sideload?.apps ?? []) {
    const left = daysLeft(Date.parse(app.runs_out_at), now);
    const runsOut = whenIn(Date.parse(app.runs_out_at), now);
    const level = signLevel(left);
    if (level !== 'ok') {
      out.push({ level, key: `sideload-${app.app}`, title: `Re-sign ${app.app}`, project: app.project, fig: Math.max(0, left), unit: left === 1 ? 'day left' : 'days left', cells: Math.max(0, left), lines: [left > 0 ? `Runs out ${runsOut}` : `Ran out ${runsOut}`] });
    }
    if (app.failures > 0) {
      out.push({ level: 'act', key: `refresh-${app.app}`, title: 'Auto-refresh is failing', project: app.project, fig: app.failures, unit: app.failures === 1 ? 'try failed' : 'tries failed', lines: app.last_failure_at ? [`Last try ${whenIn(Date.parse(app.last_failure_at), now)}`] : [], err: app.last_error || undefined });
    }
    if (app.waiting_build_at) {
      out.push({ level: 'soon', key: `build-${app.app}`, title: `New ${app.app} build waiting`, project: app.project, icon: 'phone', lines: [`Built ${whenIn(Date.parse(app.waiting_build_at), now)}. The iPhone still has an older one.`] });
    }
  }

  for (const run of snapshot.deploys?.runs ?? []) {
    if (run.state === 'failure') out.push({ level: 'act', key: `deploy-${run.repo}-${run.workflow}`, title: `${run.repo}: ${run.workflow} failed`, project: run.repo, icon: 'close', lines: [whenWords(Date.parse(run.at), now)], link: { href: run.url, text: 'Open the run' } });
  }

  const backup = snapshot.backup;
  if (backup && !backup.error) {
    const b = backupState(backup, now);
    const base = { level: /** @type {const} */ ('act'), key: 'backup', project: backup.project, err: backup.last_error || undefined };
    if (b.state === 'never') out.push({ ...base, title: 'KB backup is overdue', icon: 'close', lines: ['No backup has finished yet.'] });
    else if (b.state === 'overdue') out.push({ ...base, title: 'KB backup is overdue', fig: b.since, unit: b.since === 1 ? 'day since the last' : 'days since the last', lines: [`Missed ${whenIn(b.due, now)}`] });
    else if (b.state === 'failed') out.push({ ...base, title: 'KB backup failed', icon: 'close', lines: backup.last_error_at ? [whenWords(Date.parse(backup.last_error_at), now)] : [] });
  }

  out.push(...errors);
  const rank = { act: 0, soon: 1 };
  // sort is stable: within a level, the order above.
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

/** The colour Needs you is lit in: its most urgent level, or calm when there's nothing. @param {Need[]} needs */
export const worst = (needs) => (needs.length ? needs[0].level : 'calm');

/**
 * Jack's open to-dos for the page. Today: those whose day has come, the late ones first (dueFirst), each with its
 * notes and its day's words, red once passed; the rest go to To-do. The to-dos the laptop put on the list as
 * reminders (re-sign an app: the snapshot's reminders, by project and words) are in neither: Reminders shows them.
 * @param {Todo[]} items @param {Reminder[]} reminders @param {string} today
 */
export function splitTodos(items, reminders, today) {
  const own = items.filter((t) => !reminders.some((r) => r.project === t.project && r.text === t.text));
  return {
    today: dueFirst(own, today).map((t) => ({ text: t.text, notes: t.notes, project: t.project, day: dayWords(/** @type {string} */ (t.on), today) })),
    rest: own.filter((t) => !isDue(t, today)),
    own,
  };
}

/**
 * The dashboard's state, for the menu's button: Needs you's colour, or amber when only a to-do is past its day (late
 * to-dos lead Today now, but the button still says so).
 * @param {any} snapshot @param {Todo[] | null} todos @param {number} now
 * @returns {'act' | 'soon' | 'calm'}
 */
export function pageLevel(snapshot, todos, now) {
  const level = worst(attention(snapshot, now));
  const late = splitTodos(todos ?? [], snapshot.reminders ?? [], dayOf(now)).today.some((t) => t.day.kind === 'late');
  return level === 'calm' && late ? 'soon' : level;
}

/**
 * Reminders: each sideloaded app's signing (one per app, the install that runs out first, as the laptop's reminders
 * go), soonest first: its days left, which light that many of the ring's seven days in its state's colour, when it
 * runs out and when it was signed.
 * @param {any} snapshot @param {number} now
 */
export function reminderRings(snapshot, now) {
  const apps = [...(snapshot.sideload?.apps ?? [])].sort((a, b) => Date.parse(a.runs_out_at) - Date.parse(b.runs_out_at));
  const seen = new Set();
  const out = [];
  for (const app of apps) {
    if (seen.has(app.app)) continue;
    seen.add(app.app);
    const runsOut = Date.parse(app.runs_out_at);
    const left = daysLeft(runsOut, now);
    out.push({
      app: String(app.app), project: app.project ? String(app.project) : '', title: `Re-sign ${app.app}`, left: Math.max(0, left), lit: Math.min(SIGN_DAYS, Math.max(0, left)),
      level: signLevel(left), runsOut: `${left > 0 ? 'Runs out' : 'Ran out'} ${whenIn(runsOut, now)}`, signed: `Signed ${whenIn(Date.parse(app.signed_at), now)}`,
    });
  }
  return out;
}

/** A card's states, the worst first: red, amber, running, work not committed or pushed, fine. */
const RANK = { act: 0, soon: 1, run: 2, fyi: 3, ok: 4 };

/**
 * @typedef {{ name: string, state: 'act' | 'soon' | 'run' | 'ok', word: string, when: string, href?: string }} Check
 * @typedef {{ name: string, kind: string, state: 'act' | 'soon' | 'run' | 'fyi' | 'ok', checks: Check[], repo: string[],
 *   week: number[], done: number, todos: number }} Card
 */

/**
 * Projects: a shelf a kind, in KINDS' order, the empty ones left out. A project with anything to say gets a card: its
 * checks as state pills (its app's signing, its deploys, the KB backup), its work not committed or pushed, its done
 * things each day this week (Monday to Sunday) and its open to-dos; its state is its worst. The cards in trouble come
 * first; the projects with nothing to say are only named, as the shelf's quiet ones. A project a check names that
 * isn't among the repos (the repos couldn't be read) is Other.
 * @param {any} snapshot @param {Todo[] | null} todos Jack's own (splitTodos' own), null when they couldn't be had
 * @param {number} now
 * @returns {{ key: string, name: string, icon: string, count: number, cards: Card[], quiet: string[] }[]}
 */
export function projectShelves(snapshot, todos, now) {
  const kinds = kindsOf(snapshot);
  const runs = snapshot.deploys?.runs ?? [];
  const apps = snapshot.sideload?.apps ?? [];
  const backup = snapshot.backup && !snapshot.backup.error ? snapshot.backup : null;
  for (const name of [...runs.map((/** @type {any} */ r) => r.repo), ...apps.map((/** @type {any} */ a) => a.project), backup?.project]) {
    if (name && !kinds.has(name)) kinds.set(name, 'other');
  }
  const week = doneWeek(snapshot.done?.items ?? [], 'this', now);
  const repos = new Map((snapshot.repos?.repos ?? []).map((/** @type {any} */ r) => [r.name, r]));
  /** @type {Card[]} */
  const cards = [...kinds].map(([name, kind]) => {
    /** @type {Check[]} */
    const checks = [];
    for (const app of apps.filter((/** @type {any} */ a) => a.project === name)) {
      const runsOut = Date.parse(app.runs_out_at);
      const left = daysLeft(runsOut, now);
      checks.push({ name: 'Sideload', state: signLevel(left), word: left > 0 ? plural(left, 'day') + ' left' : 'Ran out', when: left > 0 ? `Runs out ${whenIn(runsOut, now)}` : whenWords(runsOut, now) });
      if (app.failures > 0) checks.push({ name: 'Auto-refresh', state: 'act', word: `${app.failures} ${app.failures === 1 ? 'try' : 'tries'} failed`, when: app.last_failure_at ? `Last try ${whenIn(Date.parse(app.last_failure_at), now)}` : '' });
      if (app.waiting_build_at) checks.push({ name: 'New build', state: 'soon', word: 'Waiting', when: `Built ${whenIn(Date.parse(app.waiting_build_at), now)}` });
    }
    for (const run of runs.filter((/** @type {any} */ r) => r.repo === name)) {
      const at = Date.parse(run.at);
      if (run.state === 'running') checks.push({ name: run.workflow, state: 'run', word: 'Running', when: `Since ${whenIn(at, now)}`, href: run.url });
      else checks.push({ name: run.workflow, state: run.state === 'success' ? 'ok' : 'act', word: run.state === 'success' ? 'Passed' : 'Failed', when: whenWords(at, now), href: run.url });
    }
    if (backup?.project === name) {
      const b = backupState(backup, now);
      if (b.state === 'done') checks.push({ name: 'KB backup', state: 'ok', word: 'Done', when: `Next ${whenIn(nextBackup(b.last), now)}` });
      else if (b.state === 'failed') checks.push({ name: 'KB backup', state: 'act', word: 'Failed', when: backup.last_error_at ? whenWords(Date.parse(backup.last_error_at), now) : '' });
      else checks.push({ name: 'KB backup', state: 'act', word: 'Overdue', when: b.state === 'never' ? 'None has finished yet' : `Missed ${whenIn(b.due, now)}` });
    }
    const repo = repos.get(name);
    const facts = [...(repo?.uncommitted ? [`${repo.uncommitted} not committed`] : []), ...(repo?.unpushed ? [`${repo.unpushed} not pushed`] : [])];
    const days = week.map((d) => d.items.filter((i) => i.project === name).length);
    const states = [...checks.map((c) => c.state), ...(facts.length ? /** @type {const} */ (['fyi']) : [])].sort((a, b) => RANK[a] - RANK[b]);
    return { name, kind, state: states[0] ?? 'ok', checks, repo: facts, week: days, done: days.reduce((sum, n) => sum + n, 0), todos: (todos ?? []).filter((t) => t.project === name).length };
  });
  return KINDS.map((k) => {
    const mine = cards.filter((c) => c.kind === k.key);
    const loud = mine.filter((c) => c.checks.length || c.repo.length || c.todos || c.done);
    // sort is stable: within a state, the repos' order (by name).
    return { ...k, count: mine.length, cards: loud.sort((a, b) => RANK[a.state] - RANK[b.state]), quiet: mine.filter((c) => !loud.includes(c)).map((c) => c.name) };
  }).filter((shelf) => shelf.count);
}

/**
 * The open to-dos as rows: those whose day has come first (the earliest first), then those with a day still to come
 * (the soonest first), then the rest in the laptop's order; each with its day's words, red once passed.
 * @param {Todo[]} items @param {string} today
 * @returns {{ text: string, project: string, day: { text: string, kind: 'late' | 'today' | 'later' } | null }[]}
 */
export function todoRows(items, today) {
  const due = dueFirst(items, today);
  const coming = items.filter((i) => i.on && !isDue(i, today)).sort((a, b) => (a.on < b.on ? -1 : a.on > b.on ? 1 : 0));
  const rest = items.filter((i) => !i.on);
  return [...due, ...coming, ...rest].map((i) => ({ text: i.text, project: i.project, day: i.on ? dayWords(i.on, today) : null }));
}

/**
 * @typedef {{ day: string, at: string, project: string, kind: 'commit' | 'todo', text: string }} DoneItem
 */

/**
 * One week of Done, Monday to Sunday: each day's label, its things, whether it is today or still to come.
 * @param {DoneItem[]} items @param {'this' | 'last'} which @param {number} now
 */
export function doneWeek(items, which, now) {
  const today = dayOf(now);
  const weekday = (new Date(Date.parse(today)).getUTCDay() + 6) % 7;
  const monday = addDays(today, -weekday - (which === 'last' ? 7 : 0));
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(monday, i);
    const date = new Date(Date.parse(day));
    return { day, label: day === today ? 'Today' : `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()}`, today: day === today, future: day > today, items: items.filter((it) => it.day === day) };
  });
}

/** How many projects get a lane of their own in a busy week; the rest share one. */
export const LANES = 6;

/**
 * A week of Done as lanes, one a project, each with its things day by day. Which projects get a lane of their own is
 * always the week's busiest (most things, then by name): past seven projects the six busiest keep a lane and the rest
 * share the last one ("N more projects"); seven or fewer each get their own, as a lane for "1 more project" would hide
 * a name for nothing. Jack's dragged order then only sorts those lanes: the projects in it in its order, the others
 * after them, busiest first; the shared lane stays last.
 * @param {ReturnType<typeof doneWeek>} days
 * @param {string[]} [order] Projects in the order Jack dragged them to (laneOrder), for either week.
 * @returns {{ key: string, name: string, projects: string[], total: number, days: DoneItem[][] }[]}
 */
export function doneLanes(days, order = []) {
  /** @type {Map<string, number>} */
  const totals = new Map();
  for (const item of days.flatMap((d) => d.items)) totals.set(item.project, (totals.get(item.project) ?? 0) + 1);
  const ranked = [...totals.keys()].sort((a, b) => (totals.get(b) ?? 0) - (totals.get(a) ?? 0) || a.localeCompare(b));
  const place = (/** @type {string} */ p) => (order.includes(p) ? order.indexOf(p) : order.length);
  // Array sort is stable, so the projects not in the order keep the busiest-first ranking among themselves.
  const own = (ranked.length > LANES + 1 ? ranked.slice(0, LANES) : ranked).sort((a, b) => place(a) - place(b));
  const rest = ranked.filter((p) => !own.includes(p));
  /** @param {string} key @param {string} name @param {string[]} projects */
  const lane = (key, name, projects) => {
    const perDay = days.map((d) => d.items.filter((item) => projects.includes(item.project)));
    return { key, name, projects, total: perDay.reduce((sum, list) => sum + list.length, 0), days: perDay };
  };
  return [...own.map((p) => lane(`p:${p}`, p, [p])), ...(rest.length ? [lane('more', `${rest.length} more projects`, rest)] : [])];
}

/**
 * The order after Jack moves one lane: `shown` is the week's own lanes as drawn (doneLanes with `order`), `project`
 * one of them, `to` its new place among them. The order also holds projects not shown this week; each keeps its
 * place next to the shown ones it sat by, so a move in one week doesn't shuffle the other.
 * @param {string[]} order @param {string[]} shown @param {string} project @param {number} to
 * @returns {string[]}
 */
export function laneOrder(order, shown, project, to) {
  // Shown lanes never moved yet sit after the ordered ones as drawn, so adding them at the end keeps them in place.
  const full = [...order, ...shown.filter((p) => !order.includes(p))].filter((p) => p !== project);
  const moved = shown.filter((p) => p !== project);
  const at = Math.max(0, Math.min(to, moved.length));
  const next = moved[at];
  const index = next === undefined ? full.indexOf(moved[at - 1]) + 1 : full.indexOf(next);
  full.splice(index, 0, project);
  return full;
}

/**
 * Each project's colour number (1 to 8) in Done, the same in both weeks (Jack: a project's colour must tally), and no
 * two lanes of one week alike. This week's lanes take theirs in name order; last week's keep the one they have this
 * week, and the rest take, in name order, the colours left in that week, the ones this week doesn't use first. A week
 * has seven lanes at most, so eight colours always go round.
 * @param {string[]} thisWeek @param {string[]} lastWeek The projects with a lane of their own in each week.
 * @returns {Map<string, number>}
 */
export function weekColours(thisWeek, lastWeek) {
  const byName = (/** @type {string[]} */ list) => [...list].sort((a, b) => a.localeCompare(b));
  const colours = new Map(byName(thisWeek).map((name, i) => [name, (i % 8) + 1]));
  const taken = new Set(lastWeek.filter((p) => colours.has(p)).map((p) => colours.get(p)));
  const used = new Set(colours.values());
  const left = [1, 2, 3, 4, 5, 6, 7, 8].filter((c) => !taken.has(c)).sort((a, b) => Number(used.has(a)) - Number(used.has(b)));
  for (const name of byName(lastWeek.filter((p) => !colours.has(p)))) colours.set(name, left.shift() ?? 1);
  return colours;
}

// A module is the few words before " - " (Jack's commits, "Scan - learn retyped kinds") or ": " (his plan to-dos,
// "Plan: Report refine"); a commit naming two goes on with "; " ("Analysis - …; Ledger - …").
const MODULE = /^(\S+(?: \S+){0,3}?) - (.+)$/s;
const LABEL = /^([^\s:]+(?: [^\s:]+){0,2}?): (.+)$/s;
const NEXT_MODULE = /; (?=\S+(?: \S+){0,3} - )/;

/**
 * Some done things by module, so a day reads by feature: each module with its things, the module's name taken off
 * them; a commit naming two modules is a line in each. Modules come in the order of their newest thing, the things
 * without one last, named ''; inside each, to-dos then commits, newest first, as the lists show them.
 * @param {DoneItem[]} items Newest first, as the laptop sends them.
 * @returns {{ name: string, items: DoneItem[] }[]}
 */
export function doneModules(items) {
  /** @type {Map<string, { name: string, items: DoneItem[] }>} */
  const groups = new Map();
  const other = { name: '', items: /** @type {DoneItem[]} */ ([]) };
  for (const item of items) {
    const first = item.text.match(MODULE);
    const parts = first ? item.text.split(NEXT_MODULE) : [item.text];
    for (const part of parts) {
      const found = part.match(MODULE) ?? part.match(LABEL);
      if (!found) {
        other.items.push(item);
        continue;
      }
      // "Docs" and "docs" are one module, under the name it first came with.
      const key = found[1].toLowerCase();
      if (!groups.has(key)) groups.set(key, { name: found[1], items: [] });
      groups.get(key)?.items.push({ ...item, text: found[2] });
    }
  }
  const sorted = (/** @type {DoneItem[]} */ list) => [...list.filter((i) => i.kind === 'todo'), ...list.filter((i) => i.kind === 'commit')];
  return [...groups.values(), ...(other.items.length ? [other] : [])].map((g) => ({ name: g.name, items: sorted(g.items) }));
}

/** What some done things hold, "1 to-do" and "3 commits" (to-dos first, as the lists show them), leaving out a kind
 *  there's none of. @param {DoneItem[]} items @returns {string[]} */
export function doneCounts(items) {
  const todos = items.filter((i) => i.kind === 'todo').length;
  const commits = items.length - todos;
  const out = [];
  if (todos) out.push(plural(todos, 'to-do'));
  if (commits) out.push(plural(commits, 'commit'));
  return out;
}
