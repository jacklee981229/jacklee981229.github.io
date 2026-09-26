// The topics a post can belong to, in lane order (left to right on the home page graph).
// A new topic also needs its two lane colours (light and dark) in src/styles/tokens.css.
export const TOPICS = [
  { id: 'hexo', name: 'Hexo', icon: 'code' },
  { id: 'git', name: 'Git', icon: 'branch' },
  { id: 'chatgpt', name: 'ChatGPT', icon: 'sparkles' },
  { id: 'games', name: 'Games', icon: 'gamepad' },
  { id: 'flutter', name: 'Flutter', icon: 'phone' },
];

/** @type {[string, ...string[]]} */
export const TOPIC_IDS = /** @type {[string, ...string[]]} */ (TOPICS.map((t) => t.id));

/** @param {string} id */
export const topicOf = (id) => TOPICS.find((t) => t.id === id) ?? { id, name: id, icon: 'code' };
