// Reading posts from Astro's content collection. The rules themselves live in posts.js, where tests cover them.
import { getCollection, type CollectionEntry } from 'astro:content';
import type { ImageMetadata } from 'astro';
import { lastUpdated, listed, published, tagCounts } from './posts.js';
import { excerpt, slugify } from './text.js';
import { mostPopular, pageVisits } from './lab/popular.js';
import { EFFECTS, EXPERIMENTS, TOOLS, WORLDS, effectUrl, toolUrl, worldUrl } from './lab/tools.js';
import { nowFile } from './now-file.js';
import { lastUpdate } from './changelog-file.js';
import { SITE } from '../site';

export type Post = CollectionEntry<'posts'>;

// Drafts only show in local preview (npm run dev), never in a build.
const options = { includeDrafts: import.meta.env.DEV };

/** Every post that has its own page, hidden ones included, newest first. */
export const pagePosts = async () => published(await getCollection('posts'), options);

/** The posts that appear in lists, feeds, search and the sitemap, newest first. */
export const listedPosts = async () => listed(await getCollection('posts'), options);

/** The Lab's experiments (EXPERIMENTS in lab/tools.js) as posts, in the Lab's order. */
export async function experimentPosts(): Promise<Post[]> {
  const posts = await pagePosts();
  return EXPERIMENTS.map((id) => {
    const post = posts.find((p) => p.id === id);
    if (!post) throw new Error(`The Lab's experiment "${id}" is not a post. Fix EXPERIMENTS in src/lib/lab/tools.js.`);
    return post;
  });
}

export const postUrl = (post: Post) => (EXPERIMENTS.includes(post.id) ? `/lab/game/${post.id}/` : `/${post.id}/`);
export const tagUrl = (tag: string) => `/tags/${slugify(tag)}/`;
export const summaryOf = (post: Post) => post.data.description ?? excerpt(post.body ?? '');

/** What a Lab card shows: one of the tools, a game's post, an effect or a Little World. */
export type LabItem =
  | { tool: (typeof TOOLS)[number]; post?: never; effect?: never; world?: never }
  | { post: Post; tool?: never; effect?: never; world?: never }
  | { effect: (typeof EFFECTS)[number]; tool?: never; post?: never; world?: never }
  | { world: (typeof WORLDS)[number]; tool?: never; post?: never; effect?: never };

type CountedItem = { path: string; item: LabItem; kind: 'Tool' | 'Game' | 'Effect' | 'World'; name: string };

// Asked once per build (or dev session) and kept, so the counter isn't asked again for every page drawn.
let counted: Promise<{ items: CountedItem[]; visits: Map<string, number> | null }> | undefined;

/** Every ready Lab item in the Lab's order, with GoatCounter's visits to each (null when there are no counts). */
function labVisits() {
  return (counted ??= (async () => {
    const items: CountedItem[] = [
      ...TOOLS.filter((t) => t.status === 'ready').map((tool) => ({ path: toolUrl(tool.slug), item: { tool } as LabItem, kind: 'Tool' as const, name: tool.name })),
      ...(await experimentPosts()).map((post) => ({ path: postUrl(post), item: { post } as LabItem, kind: 'Game' as const, name: post.data.title })),
      ...EFFECTS.map((effect) => ({ path: effectUrl(effect.slug), item: { effect } as LabItem, kind: 'Effect' as const, name: effect.name })),
      ...WORLDS.map((world) => ({ path: worldUrl(world.slug), item: { world } as LabItem, kind: 'World' as const, name: world.name })),
    ];
    const visits = await pageVisits(items.map((i) => i.path), SITE.goatcounter);
    if (!visits) console.warn('Most Popular: GoatCounter gave no counts, so the Lab is built without a ranking.');
    return { items, visits };
  })());
}

/** The Lab's Most Popular: its four most visited ready tools, games, effects and worlds (lab/popular.js); none while there's no ranking. */
export async function popularLabItems(): Promise<LabItem[]> {
  const { items, visits } = await labVisits();
  return mostPopular(items, visits).map((i) => i.item);
}

const images = import.meta.glob<{ default: ImageMetadata }>('/src/content/posts/*/*.{png,jpg,jpeg,webp,gif,avif}', { eager: true });

/** Every public page, for the sitemaps. Hidden posts and drafts are never in it. */
export async function publicPages(): Promise<{ path: string; lastmod?: Date }[]> {
  const posts = await listedPosts();
  const newest = lastUpdated(posts);
  return [
    // The home page shows the newest changes as well as the newest posts.
    { path: '/', lastmod: lastUpdate(newest) },
    { path: '/writing/', lastmod: newest },
    ...tagCounts(posts).map(({ tag }) => ({ path: tagUrl(tag) })),
    { path: '/collections/' },
    { path: '/travel/' },
    { path: '/about/' },
    { path: '/now/', lastmod: nowFile().updated },
    { path: '/changelog/', lastmod: lastUpdate() },
    { path: '/guestbook/' },
    // The Lab: its finished tools, its games, its effects and its worlds. /random/ stays out (it's marked noindex).
    { path: '/lab/' },
    ...TOOLS.filter((t) => t.status === 'ready').map((t) => ({ path: toolUrl(t.slug) })),
    ...(await experimentPosts()).map((post) => ({ path: postUrl(post), lastmod: post.data.updated ?? post.data.date })),
    ...EFFECTS.map((e) => ({ path: effectUrl(e.slug) })),
    ...WORLDS.map((w) => ({ path: worldUrl(w.slug) })),
    ...posts.map((post) => ({ path: postUrl(post), lastmod: post.data.updated ?? post.data.date })),
  ];
}

/** The post's chosen cover, else the first image in the post, else nothing (the card draws a topic cover). */
export function coverOf(post: Post): ImageMetadata | undefined {
  if (post.data.cover) return post.data.cover;
  const first = (post.body ?? '').match(/!\[[^\]]*\]\(\.\/([^)\s]+)\)/);
  return first ? images[`/src/content/posts/${post.id}/${first[1]}`]?.default : undefined;
}
