// Jack's scores for Morning Brief items (1, not interested at all, to 5, very), kept in the Worker's D1 database
// (schema.sql). The brief's page saves them when Jack is logged in; each morning the brief's maker reads the latest
// ones with a read-only token to learn his taste. These are the rules, apart from the Worker so they can be tested.
import { KINDS, SOURCES } from '../../src/lib/brief.js';

/** The most scores one read sends back, newest first. */
export const MOST_SCORES = 500;

/** @param {unknown} v */
const text = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

/**
 * A score as the page sends it, checked: the item (its id, day, title, kind and source, so the maker can show Sonnet
 * what was scored without the day's file) and the score; 0 takes a score back.
 * @param {any} body
 * @returns {{ score: { id: string, day: string, title: string, kind: string, source: string, score: number } } | { error: string }}
 */
export function readScore(body) {
  const id = text(body?.id), day = text(body?.day), title = text(body?.title).slice(0, 200), kind = text(body?.kind), source = text(body?.source);
  const score = body?.score;
  if (!/^[0-9a-f]{8}$/.test(id) || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !title || !(kind in KINDS) || !(source in SOURCES)) return { error: "That item doesn't look right. Reload the page and try again." };
  if (!Number.isInteger(score) || score < 0 || score > 5) return { error: 'A score is 1 to 5.' };
  return { score: { id, day, title, kind, source, score } };
}
