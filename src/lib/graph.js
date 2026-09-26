// The home page timeline: which topic lanes run through each row, plus the year, month and break rows.
import { daysBetween, monthKey, monthName, yearOf } from './dates.js';

// Posts at least this many days apart get a "N-month break" row between them.
export const BREAK_DAYS = 60;

/**
 * @typedef {import('./posts.js').PostLike} PostLike
 * @typedef {{ x: number, topic: string, top: boolean, bottom: boolean, node: boolean }} PostLane
 * @typedef {{ x: number, topic: string }} PassLane
 * @typedef {{ kind: 'year', year: string, lanes: PassLane[] }
 *   | { kind: 'break', label: string, lanes: PassLane[] }
 *   | { kind: 'post', index: number, month: string | null, lanes: PostLane[] }} Row
 */

/**
 * Each topic's lane runs from its newest post to its oldest, by index in the full newest-first list.
 * @param {PostLike[]} listedPosts @param {{ id: string }[]} topics
 * @returns {Record<string, { newest: number, oldest: number } | null>}
 */
export function laneSpans(listedPosts, topics) {
  return Object.fromEntries(topics.map((t) => {
    const at = listedPosts.flatMap((p, i) => (p.data.topic === t.id ? [i] : []));
    return [t.id, at.length ? { newest: at[0], oldest: at[at.length - 1] } : null];
  }));
}

/** @param {number} days */
export function breakLabel(days) {
  const months = Math.round(days / 30.44);
  return months < 24 ? `${months}-month break` : `${Math.round(months / 12)}-year break`;
}

/**
 * Rows for one page of the timeline, posts [start, end) of the full list. Lanes use the full list,
 * so a lane that continues onto the next page runs to the bottom of this one.
 * @param {PostLike[]} listedPosts @param {{ id: string }[]} topics @param {number} start @param {number} end
 * @returns {Row[]}
 */
export function timelineRows(listedPosts, topics, start, end) {
  const spans = laneSpans(listedPosts, topics);
  /** Lanes that run straight through the gap just above post i. @param {number} i */
  const passing = (i) => topics.flatMap((t, x) => {
    const s = spans[t.id];
    return s && i > s.newest && i <= s.oldest ? [{ x, topic: t.id }] : [];
  });
  /** @type {Row[]} */
  const rows = [];
  for (let i = start; i < Math.min(end, listedPosts.length); i += 1) {
    const post = listedPosts[i];
    const prev = i > start ? listedPosts[i - 1] : null;
    if (prev) {
      const gap = daysBetween(prev.data.date, post.data.date);
      if (gap >= BREAK_DAYS) rows.push({ kind: 'break', label: breakLabel(gap), lanes: passing(i) });
    }
    if (!prev || yearOf(prev.data.date) !== yearOf(post.data.date)) rows.push({ kind: 'year', year: yearOf(post.data.date), lanes: passing(i) });
    const newMonth = !prev || monthKey(prev.data.date) !== monthKey(post.data.date);
    rows.push({
      kind: 'post',
      index: i,
      month: newMonth ? monthName(post.data.date) : null,
      lanes: topics.flatMap((t, x) => {
        const s = spans[t.id];
        if (!s) return [];
        const lane = { x, topic: t.id, top: i > s.newest && i <= s.oldest, bottom: i >= s.newest && i < s.oldest, node: post.data.topic === t.id };
        return lane.top || lane.bottom || lane.node ? [lane] : [];
      }),
    });
  }
  return rows;
}
