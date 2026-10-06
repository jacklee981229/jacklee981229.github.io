// The topics a post can belong to, in lane order (left to right on the home page graph).
// A new topic also needs its colours in src/styles/tokens.css: a deep one (--topic-…) and a dark theme lane.
// A topic with `legacy` is about something the site no longer runs on: its posts open with that note, and it's
// listed after the others on Writing.
export const TOPICS = [
  { id: 'hexo', name: 'Hexo', icon: 'code', legacy: 'I wrote this in 2023 for the old version of this site, which ran on Hexo. It runs on Astro now, so these steps may no longer apply.' },
  { id: 'git', name: 'Git', icon: 'branch' },
  { id: 'chatgpt', name: 'ChatGPT', icon: 'sparkles' },
  { id: 'games', name: 'Games', icon: 'gamepad' },
  { id: 'flutter', name: 'Flutter', icon: 'phone' },
];

/** @type {[string, ...string[]]} */
export const TOPIC_IDS = /** @type {[string, ...string[]]} */ (TOPICS.map((t) => t.id));

/** @param {string} id */
export const topicOf = (id) => TOPICS.find((t) => t.id === id) ?? { id, name: id, icon: 'code' };

/**
 * Topics in the order they're listed: as in TOPICS, legacy ones last.
 * @template {{ legacy?: string }} T @param {T[]} topics @returns {T[]}
 */
export const listOrder = (topics) => [...topics].sort((a, b) => Number(Boolean(a.legacy)) - Number(Boolean(b.legacy)));
