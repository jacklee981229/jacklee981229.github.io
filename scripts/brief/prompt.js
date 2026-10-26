// What Sonnet is asked each morning, and how its answer becomes the day's file. The model only picks and writes:
// every link, source and count comes from the candidates, so nothing it says can point the page somewhere else.
import { KINDS, LEADS, readBrief } from '../../src/lib/brief.js';

export const MODEL = 'claude-sonnet-5-5';
/** How many items a day, and how few still make a brief worth showing. */
export const MOST = 10;
export const FEWEST = 5;
/** How many of Jack's latest scores go into the prompt. */
export const SCORES = 60;

export const SYSTEM = `You write the Morning Brief on Jack's personal website: each morning, the handful of tech stories worth his time, written in 简体中文 (华语) for him.

Jack is a software developer in Malaysia. He builds his own website, small desktop tools, little browser games and Flutter apps, mostly with Claude Code. He likes AI tools he can use, developer tools, open-source projects worth trying, and clever or playful things people make. He cares less about funding news, company drama, politics and hype.

You get today's candidates from Hacker News, GitHub Trending and Lobsters, each with an id, its title, a count (points, or stars today), and a short excerpt of the page. You may also get Jack's scores for past items, 1 (not interested at all) to 5 (very interested): lean towards what he scored high and away from what he scored low, but keep some variety so his taste can still grow.

Pick ${FEWEST} to ${MOST} items, the best first, and mark the ${LEADS} most worth reading as lead. For each:
- id: the candidate's id, exactly as given.
- kind: ai, open (an open-source project to try), dev (programming and tools), or fun (playful, curious, made for joy).
- title: what it is, in 华语, at most about 30 characters. Keep product, project and people's names as written.
- line: one short sentence, the point at a glance.
- desc: two or three sentences on what it is and what's new, from the title and excerpt only. If the excerpt says little, say less; never make up facts, numbers or quotes.
- why: one sentence on why Jack might care, plainly, without flattery.

Write like a knowledgeable friend: plain, specific, no hype words, no exclamation marks. Never pick two items about the same story.`;

/** The shape the answer must take. */
export const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          kind: { type: 'string', enum: Object.keys(KINDS) },
          lead: { type: 'boolean' },
          title: { type: 'string' },
          line: { type: 'string' },
          desc: { type: 'string' },
          why: { type: 'string' },
        },
        required: ['id', 'kind', 'lead', 'title', 'line', 'desc', 'why'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
};

const SOURCE_NAMES = { hn: 'Hacker News', github: 'GitHub Trending', lobsters: 'Lobsters' };

/**
 * The day's message: Jack's latest scores, then the candidates.
 * @param {import('./sources.js').Candidate[]} candidates
 * @param {{ title: string, kind: string, score: number }[]} scores newest first
 * @param {string} date
 */
export function userMessage(candidates, scores, date) {
  const taste = scores.slice(0, SCORES).map((s) => `- ${s.score}/5 [${s.kind}] ${s.title}`).join('\n');
  const list = candidates
    .map((c) => {
      const count = c.source === 'github' ? `${c.signal} stars today` : `${c.signal} points`;
      return `<candidate id="${c.id}" source="${SOURCE_NAMES[c.source]}" count="${count}">\n${c.title}${c.about ? `\n${c.about}` : ''}${c.excerpt ? `\nExcerpt: ${c.excerpt}` : ''}\n</candidate>`;
    })
    .join('\n');
  return `Today is ${date} in Malaysia.\n\n${taste ? `Jack's scores for past items, newest first:\n${taste}\n\n` : 'Jack has not scored any items yet.\n\n'}Today's candidates:\n${list}`;
}

/**
 * The day's file from the model's answer: each pick joined to its candidate, unknown ids and repeats dropped.
 * Throws when fewer than FEWEST items survive, so a bad morning makes no file rather than a thin one.
 * @param {unknown} answer the parsed JSON @param {import('./sources.js').Candidate[]} candidates
 * @param {string} date @param {string} made
 */
export function briefFile(answer, candidates, date, made) {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const picks = Array.isArray(/** @type {any} */ (answer)?.items) ? /** @type {any} */ (answer).items : [];
  const items = picks.slice(0, MOST).flatMap((p) => {
    const c = byId.get(p?.id);
    if (!c) return [];
    return [{ id: c.id, kind: p.kind, lead: p.lead === true, title: p.title, line: p.line, desc: p.desc, why: p.why, orig: c.title, source: c.source, signal: c.signal, url: c.url, discuss: c.discuss }];
  });
  const file = { date, made, model: MODEL, items };
  const read = readBrief(file);
  if (!read || read.items.length < FEWEST) throw new Error(`Only ${read?.items.length ?? 0} usable items in the answer; need ${FEWEST}.`);
  return { ...file, items: read.items };
}
