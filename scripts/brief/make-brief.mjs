// Makes today's Morning Brief: reads the sources and Jack's latest scores, asks Sonnet to pick and write, and saves
// src/content/brief/YYYY-MM-DD.json (Malaysia's date). GitHub Actions runs it each morning (brief.yml); on the
// laptop: `npm run brief` with scripts/brief/.env filled in. A day that already has its file is left alone unless
// --again is given.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { isoDay, localTimestamp } from '../../src/lib/dates.js';
import { MODEL, SCHEMA, SYSTEM, briefFile, userMessage } from './prompt.js';
import { excerptOf, mergeCandidates, postedSince, readHn, readLobsters, readTrending } from './sources.js';

const FOLDER = 'src/content/brief';
const EDITOR = process.env.NOW_EDITOR_URL || 'https://jacks-space-now.jacklee981229.workers.dev';
const AGENT = { 'User-Agent': 'jacks-space-brief (+https://jacklee981229.github.io/brief/)' };
/** How many from each source are considered, and how many earlier days' stories aren't told again. */
const PER_SOURCE = { hn: 30, github: 15, lobsters: 15 };
const RECENT_DAYS = 3;

/** @param {string} url @param {number} ms */
async function get(url, ms = 15000, headers = {}) {
  const answer = await fetch(url, { headers: { ...AGENT, ...headers }, signal: AbortSignal.timeout(ms), redirect: 'follow' });
  if (!answer.ok) throw new Error(`${url} answered ${answer.status}`);
  return answer;
}

async function hackerNews() {
  const ids = (await (await get('https://hacker-news.firebaseio.com/v0/topstories.json')).json()).slice(0, PER_SOURCE.hn);
  const items = await Promise.all(ids.map((id) => get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then((r) => r.json()).catch(() => null)));
  return readHn(items);
}
const trending = async () => readTrending(await (await get('https://github.com/trending?since=daily')).text()).slice(0, PER_SOURCE.github);
const lobsters = async () => readLobsters(await (await get('https://lobste.rs/hottest.json')).json()).slice(0, PER_SOURCE.lobsters);

/** A candidate's page as a short excerpt; a repository's README; nothing when the page won't come or isn't text. */
async function excerpt(c) {
  try {
    if (c.source === 'github') return excerptOf(await (await get(`https://raw.githubusercontent.com/${c.title}/HEAD/README.md`, 8000)).text(), true);
    const answer = await get(c.url, 8000);
    if (!/text\/html/i.test(answer.headers.get('content-type') ?? '')) return '';
    return excerptOf((await answer.text()).slice(0, 2_000_000));
  } catch {
    return '';
  }
}

/** Runs `work` over `list`, `width` at a time. */
async function inTurns(list, width, work) {
  const out = new Array(list.length);
  let next = 0;
  await Promise.all(Array.from({ length: width }, async () => {
    while (next < list.length) {
      const at = next++;
      out[at] = await work(list[at]);
    }
  }));
  return out;
}

/** Jack's latest scores from the Now editor, newest first; none (with a warning) when they can't be had. */
async function scores() {
  const token = process.env.BRIEF_READ_TOKEN;
  if (!token) return [];
  try {
    return (await (await get(`${EDITOR}/api/brief/scores`, 15000, { Authorization: `Bearer ${token}` })).json()).scores ?? [];
  } catch (error) {
    console.warn(`No scores this time: ${error.message}`);
    return [];
  }
}

/**
 * The ids told in the last few days' briefs, and since when the news is new: when the latest of them was made, or a
 * day back when there's none.
 * @param {string} today @param {Date} now
 */
function earlier(today, now) {
  const ids = new Set();
  let since = 0;
  const day = new Date(`${today}T12:00:00+08:00`);
  for (let back = 1; back <= RECENT_DAYS; back++) {
    const name = `${FOLDER}/${isoDay(new Date(day.getTime() - back * 86400000))}.json`;
    try {
      const brief = JSON.parse(readFileSync(name, 'utf8'));
      for (const item of brief.items ?? []) ids.add(item.id);
      since = Math.max(since, Date.parse(brief.made) || 0);
    } catch {
      // No brief that day.
    }
  }
  return { ids, since: since || now.getTime() - 86400000 };
}

async function main() {
  const now = new Date();
  const date = isoDay(now);
  const file = `${FOLDER}/${date}.json`;
  if (existsSync(file) && !process.argv.includes('--again')) return console.log(`${file} is already there.`);

  const lists = await Promise.allSettled([hackerNews(), trending(), lobsters()]);
  lists.forEach((r, i) => { if (r.status === 'rejected') console.warn(`${['Hacker News', 'GitHub Trending', 'Lobsters'][i]} skipped: ${r.reason?.message ?? r.reason}`); });
  const { ids, since } = earlier(date, now);
  const candidates = mergeCandidates(lists.map((r) => postedSince(r.status === 'fulfilled' ? r.value : [], since)), ids);
  if (!candidates.length) throw new Error('No source answered, so there is nothing to brief.');
  const excerpts = await inTurns(candidates, 8, excerpt);
  candidates.forEach((c, i) => { c.excerpt = excerpts[i]; });

  const client = new Anthropic();
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    // A refusal is re-run on a fallback model the API picks, so a touchy headline doesn't cost the whole morning.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    messages: [{ role: 'user', content: userMessage(candidates, await scores(), date) }],
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
  });
  if (response.stop_reason !== 'end_turn') throw new Error(`The model stopped with ${response.stop_reason}.`);
  const block = response.content.find((b) => b.type === 'text');
  const brief = briefFile(JSON.parse(block?.text ?? '{}'), candidates, date, localTimestamp(now));

  mkdirSync(FOLDER, { recursive: true });
  writeFileSync(file, `${JSON.stringify(brief, null, 2)}\n`);
  const { input_tokens: inTok, output_tokens: outTok } = response.usage;
  console.log(`${file}: ${brief.items.length} items from ${candidates.length} candidates (${response.model}); ${inTok} in, ${outTok} out, about $${((inTok * 2 + outTok * 10) / 1e6).toFixed(3)}.`);
}

main().catch((error) => {
  console.error(error instanceof Anthropic.APIError ? `Claude answered ${error.status}: ${error.message}` : error);
  process.exit(1);
});
