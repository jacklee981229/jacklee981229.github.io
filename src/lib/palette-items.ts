// What the command palette can find besides posts, and what Random can open, made while the site is built from
// lists the site already keeps (the menu, the Lab's lists, the posts), so new things show up by themselves.
import { NAV } from '../site';
import { EFFECTS, TOOLS, WORLDS, effectUrl, toolUrl, worldUrl } from './lab/tools.js';
import { experimentPosts, listedPosts, postUrl, summaryOf } from './collections';

export type PaletteItem = { title: string; group: 'Pages' | 'Lab'; href: string; icon: string; description?: string; words?: string[] };
export type Openable = { title: string; href: string; kind: 'Post' | 'Tool' | 'Game' | 'Effect' | 'World'; description?: string };

/** The other words each menu page can be found by. */
const PAGE_WORDS: Record<string, string[]> = {
  '/': ['start', 'blog', 'latest'],
  '/writing/': ['topics', 'posts', 'articles', 'all', 'archives'],
  '/lab/': ['tools', 'games', 'effects', 'worlds'],
  '/collections/': ['movies', 'games', 'favourites', 'favorites', 'shows'],
  '/travel/': ['map', 'countries', 'places', 'visited'],
  '/about/': ['jack', 'me', 'contact', 'links'],
};

/** The palette's pages and Lab items, in the order they're offered. */
export async function paletteItems(): Promise<PaletteItem[]> {
  return [
    ...NAV.map(({ href, label, icon }) => ({ title: label, group: 'Pages' as const, href, icon, words: PAGE_WORDS[href] })),
    { title: 'Now', group: 'Pages', href: '/now/', icon: 'clock', words: ['doing', 'currently', 'playing', 'building'] },
    { title: 'Changelog', group: 'Pages', href: '/changelog/', icon: 'list', words: ['changes', 'updates', 'history', 'new'] },
    { title: "Jack's Build Log", group: 'Pages', href: '/build-log/', icon: 'branch', words: ['build log', 'commits', 'git', 'history', 'numbers', 'stats'] },
    { title: 'Guestbook', group: 'Pages', href: '/guestbook/', icon: 'message', words: ['notes', 'comments', 'messages', 'say hi'] },
    ...TOOLS.filter((t) => t.status === 'ready').map((t) => ({ title: t.name, group: 'Lab' as const, href: toolUrl(t.slug), icon: t.icon, description: t.description, words: ['tool'] })),
    ...(await experimentPosts()).map((post) => ({ title: post.data.title, group: 'Lab' as const, href: postUrl(post), icon: 'gamepad', description: summaryOf(post), words: ['game', 'play'] })),
    ...EFFECTS.map((e) => ({ title: e.name, group: 'Lab' as const, href: effectUrl(e.slug), icon: 'pointer', description: e.description, words: ['effect'] })),
    ...WORLDS.map((w) => ({ title: w.name, group: 'Lab' as const, href: worldUrl(w.slug), icon: w.icon, description: w.description, words: ['world', 'little world', ...w.words] })),
  ];
}

/** Everything Random can open: the posts, the finished tools, the games, the effects and the worlds. */
export async function openables(): Promise<Openable[]> {
  const games = await experimentPosts();
  return [
    ...(await listedPosts()).map((post) => ({ title: post.data.title, href: postUrl(post), kind: 'Post' as const, description: summaryOf(post) })),
    ...TOOLS.filter((t) => t.status === 'ready').map((t) => ({ title: t.name, href: toolUrl(t.slug), kind: 'Tool' as const, description: t.description })),
    ...games.map((post) => ({ title: post.data.title, href: postUrl(post), kind: 'Game' as const, description: summaryOf(post) })),
    ...EFFECTS.map((e) => ({ title: e.name, href: effectUrl(e.slug), kind: 'Effect' as const, description: e.description })),
    ...WORLDS.map((w) => ({ title: w.name, href: worldUrl(w.slug), kind: 'World' as const, description: w.description })),
  ];
}
