// Jack's dashboard (/dashboard/, src/pages/dashboard.astro): what needs him, what's fine, his to-dos and what he did,
// from the snapshot his laptop pushes (C:\repos\Jack\dashboard, collect.py, whose docstring is its format) and the
// to-dos the Worker already holds. The snapshot carries points in time only: everything that moves with the clock
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

/** "Today, 13:02", "Yesterday, 23:31", "Tomorrow, 15:01" or "Sun 1 Nov, 22:04". @param {number} ms @param {number} now */
export function whenWords(ms, now) {
  const at = myt(ms);
  const time = `${String(at.getUTCHours()).padStart(2, '0')}:${String(at.getUTCMinutes()).padStart(2, '0')}`;
  const day = dayOf(ms);
  const today = dayOf(now);
  const name = day === today ? 'Today' : day === addDays(today, -1) ? 'Yesterday' : day === addDays(today, 1) ? 'Tomorrow' : `${WEEKDAYS[at.getUTCDay()]} ${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]}`;
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
 * @typedef {{ level: 'act' | 'soon' | 'fyi', key: string, title: string, fig?: number, unit?: string,
 *   icon?: string, cells?: number, lines: string[], err?: string, link?: { href: string, text: string },
 *   rows?: { name: string, facts: string[] }[] }} Need
 * @typedef {{ id: string, project: string, text: string, notes: string, on?: string }} Todo
 */

/**
 * What needs Jack, most urgent first. act (red): broken, or an app with a day or less left. soon (amber): wants
 * doing in a day or two, or a source the laptop couldn't read. fyi: worth knowing, no hurry. Each has a big number,
 * or an icon where there's no number to give.
 * @param {any} snapshot @param {Todo[] | null} todos null when they couldn't be had @param {number} now
 * @returns {Need[]}
 */
export function attention(snapshot, todos, now) {
  /** @type {Need[]} */
  const out = [];
  const errors = [];
  for (const name of ['sideload', 'deploys', 'backup', 'repos', 'done']) {
    const error = snapshot[name]?.error;
    if (error) errors.push({ level: 'soon', key: `error-${name}`, title: unread(error).title, icon: 'bug', lines: [], err: unread(error).reason || undefined });
  }

  for (const app of snapshot.sideload?.apps ?? []) {
    const left = daysLeft(Date.parse(app.runs_out_at), now);
    const runsOut = whenIn(Date.parse(app.runs_out_at), now);
    if (left <= 2) {
      out.push({ level: left <= 1 ? 'act' : 'soon', key: `sideload-${app.app}`, title: `Re-sign ${app.app}`, fig: Math.max(0, left), unit: left === 1 ? 'day left' : 'days left', cells: Math.max(0, left), lines: [left > 0 ? `Runs out ${runsOut}` : `Ran out ${runsOut}`] });
    }
    if (app.failures > 0) {
      out.push({ level: 'act', key: `refresh-${app.app}`, title: 'Auto-refresh is failing', fig: app.failures, unit: app.failures === 1 ? 'try failed' : 'tries failed', lines: app.last_failure_at ? [`Last try ${whenIn(Date.parse(app.last_failure_at), now)}`] : [], err: app.last_error || undefined });
    }
    if (app.waiting_build_at) {
      out.push({ level: 'soon', key: `build-${app.app}`, title: `New ${app.app} build waiting`, icon: 'phone', lines: [`Built ${whenIn(Date.parse(app.waiting_build_at), now)}. The iPhone still has an older one.`] });
    }
  }

  for (const run of snapshot.deploys?.runs ?? []) {
    if (run.state === 'failure') out.push({ level: 'act', key: `deploy-${run.repo}-${run.workflow}`, title: `${run.repo}: ${run.workflow} failed`, icon: 'close', lines: [whenWords(Date.parse(run.at), now)], link: { href: run.url, text: 'Open the run' } });
  }

  const backup = snapshot.backup;
  if (backup && !backup.error) {
    const last = backup.last_success_at ? Date.parse(backup.last_success_at) : null;
    const due = backupDue(now);
    if (last === null) {
      out.push({ level: 'act', key: 'backup', title: 'KB backup is overdue', icon: 'close', lines: ['No backup has finished yet.'], err: backup.last_error || undefined });
    } else if (last < due) {
      const since = Math.floor((now - last) / DAY);
      out.push({ level: 'act', key: 'backup', title: 'KB backup is overdue', fig: since, unit: since === 1 ? 'day since the last' : 'days since the last', lines: [`Missed ${whenIn(due, now)}`], err: backup.last_error || undefined });
    } else if (backup.last_error) {
      out.push({ level: 'act', key: 'backup', title: 'KB backup failed', icon: 'close', lines: backup.last_error_at ? [whenWords(Date.parse(backup.last_error_at), now)] : [], err: backup.last_error });
    }
  }

  const today = dayOf(now);
  const late = (todos ?? []).filter((t) => t.on && t.on < today);
  if (late.length) {
    const most = Math.max(...late.map((t) => Math.round((Date.parse(today) - Date.parse(/** @type {string} */ (t.on))) / DAY)));
    out.push({ level: 'soon', key: 'todos', title: late.length === 1 ? 'A to-do is past its day' : `${late.length} to-dos are past their day`, fig: most, unit: most === 1 ? 'day late' : 'days late', lines: late.map((t) => t.text) });
  }

  out.push(...errors);

  const dirty = (snapshot.repos?.repos ?? []).filter((r) => r.uncommitted || r.unpushed);
  if (dirty.length) {
    const rows = dirty.map((r) => ({ name: r.name, facts: [...(r.uncommitted ? [`${plural(r.uncommitted, 'file')} not committed`] : []), ...(r.unpushed ? [`${plural(r.unpushed, 'commit')} not pushed`] : [])] }));
    out.push({ level: 'fyi', key: 'repos', title: 'Not committed or pushed', icon: 'branch', lines: [], rows });
  }

  const rank = { act: 0, soon: 1, fyi: 2 };
  // sort is stable: within a level, the order above.
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

/** The colour Needs you is lit in: its most urgent level, or calm when there's nothing. @param {Need[]} needs */
export const worst = (needs) => (needs.length ? needs[0].level : 'calm');

/**
 * The quiet line under "All clear": the next app to run out.
 * @param {any} snapshot @param {number} now
 */
export function nextUp(snapshot, now) {
  const apps = [...(snapshot.sideload?.apps ?? [])].sort((a, b) => Date.parse(a.runs_out_at) - Date.parse(b.runs_out_at));
  return apps.length ? `Next: the ${apps[0].app} sideload runs out ${whenIn(Date.parse(apps[0].runs_out_at), now)}` : 'Nothing is due.';
}

/**
 * What's fine, one row each: the thing and its detail, its state and its time.
 * @param {any} snapshot @param {Todo[] | null} todos @param {number} now
 * @returns {{ name: string, sub: string, state: string, when: string, running?: boolean, href?: string }[]}
 */
export function goodRows(snapshot, todos, now) {
  const out = [];
  for (const app of snapshot.sideload?.apps ?? []) {
    const left = daysLeft(Date.parse(app.runs_out_at), now);
    if (left > 2) out.push({ name: `${app.app} sideload`, sub: `Signed ${whenIn(Date.parse(app.signed_at), now)}`, state: `${left} days left`, when: `Runs out ${whenIn(Date.parse(app.runs_out_at), now)}` });
  }
  for (const run of snapshot.deploys?.runs ?? []) {
    if (run.state === 'success') out.push({ name: run.workflow, sub: run.repo, state: 'Passed', when: whenWords(Date.parse(run.at), now), href: run.url });
    if (run.state === 'running') out.push({ name: run.workflow, sub: run.repo, state: 'Running', when: `Since ${whenIn(Date.parse(run.at), now)}`, running: true, href: run.url });
  }
  const backup = snapshot.backup;
  if (backup && !backup.error && backup.last_success_at && !backup.last_error) {
    const last = Date.parse(backup.last_success_at);
    if (last >= backupDue(now)) out.push({ name: 'KB backup', sub: `Last ${whenIn(last, now)}`, state: 'Done', when: `Next ${whenIn(nextBackup(last), now)}` });
  }
  const repos = snapshot.repos?.repos;
  if (repos) {
    const clean = repos.filter((r) => !r.uncommitted && !r.unpushed).length;
    if (clean === repos.length) out.push({ name: 'Repos', sub: '', state: `All ${clean} clean`, when: '' });
    else if (clean) out.push({ name: 'Other repos', sub: '', state: `${clean} clean`, when: '' });
  }
  const today = dayOf(now);
  if (todos && !todos.some((t) => t.on && t.on < today)) out.push({ name: 'To-do', sub: '', state: 'None past its day', when: '' });
  return out;
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

/** Each project's colour number (1 to 8, then round again), in name order so a project keeps its colour. @param {DoneItem[]} items */
export function projectColours(items) {
  const names = [...new Set(items.map((i) => i.project))].sort((a, b) => a.localeCompare(b));
  return new Map(names.map((name, i) => [name, (i % 8) + 1]));
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
