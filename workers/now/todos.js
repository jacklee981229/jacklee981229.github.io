// Jack's open to-dos, pushed from his laptop's to-do widget (C:\repos\Jack\todo-widget, sync.py) and kept in the
// Worker's D1 database (schema.sql, todo_list) for his eyes only: the palette's /todo and the top of /brief/. The
// laptop has already left out ticked items and work projects and put everything in order; these are the checks on
// what it sends, apart from the Worker so they can be tested. Each to-do may carry the day Jack plans to do it on
// (src/lib/todo-days.js); the site puts those in order itself.

import { isDay } from '../../src/lib/todo-days.js';

// The list is kept in one D1 row, which holds about 2 MB: these limits keep it under 1 MB even in Chinese (3 bytes a
// character). Longer words are cut, not refused, so one long to-do never stops the whole list from arriving.
export const MOST_TODOS = 200;
export const LONGEST_TEXT = 300;
export const LONGEST_NOTES = 1000;
/** How far ahead of the Worker's clock a push may be dated: a laptop clock that runs fast, not a date in the future. */
export const CLOCK_SLACK_MS = 5 * 60 * 1000;

/** @param {unknown} v @param {number} longest */
const clip = (v, longest) => (typeof v === 'string' ? v.trim().slice(0, longest) : null);

/**
 * A push as the laptop sends it, checked: when it read the file (milliseconds), the projects in the order to show
 * them, and the open to-dos oldest first, each with its day ("" for none).
 * @param {any} body @param {number} now the Worker's time, in milliseconds
 * @returns {{ list: { pushedAt: number, projects: string[], items: { id: string, project: string, text: string, notes: string, on: string }[] } } | { error: string }}
 */
export function readTodos(body, now = Date.now()) {
  const pushedAt = body?.pushedAt;
  if (!Number.isSafeInteger(pushedAt) || pushedAt <= 0) return { error: 'pushedAt must be a time in milliseconds.' };
  if (pushedAt > now + CLOCK_SLACK_MS) return { error: "pushedAt is ahead of the Worker's clock." };
  if (!Array.isArray(body?.items) || !Array.isArray(body?.projects)) return { error: 'items and projects must be lists.' };
  if (body.items.length > MOST_TODOS) return { error: `A push holds up to ${MOST_TODOS} to-dos.` };
  const projects = body.projects.map((p) => clip(p, 100));
  if (projects.some((p) => !p) || new Set(projects).size !== projects.length) return { error: 'projects must be different names.' };
  const items = [];
  for (const raw of body.items) {
    const id = typeof raw?.id === 'string' && /^[0-9a-f]{32}$/.test(raw.id) ? raw.id : null;
    const project = clip(raw?.project, 100);
    const text = clip(raw?.text, LONGEST_TEXT);
    const notes = clip(raw?.notes ?? '', LONGEST_NOTES);
    // A laptop that hasn't sent days yet sends none.
    const on = raw?.on === undefined ? '' : raw.on;
    if (!id || !text || notes === null || !project || !projects.includes(project)) return { error: "A to-do doesn't look right." };
    if (on !== '' && !isDay(on)) return { error: 'A to-do has a day that is not YYYY-MM-DD.' };
    items.push({ id, project, text, notes, on });
  }
  if (projects.some((p) => !items.some((i) => i.project === p))) return { error: 'A project has no to-dos.' };
  return { list: { pushedAt, projects, items } };
}
