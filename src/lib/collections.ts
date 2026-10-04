// Reading posts from Astro's content collection. The rules themselves live in posts.js, where tests cover them.
import { getCollection, type CollectionEntry } from 'astro:content';
import type { ImageMetadata } from 'astro';
import { homePageUrl, lastUpdated, listed, paginate, published, tagCounts } from './posts.js';
import { excerpt, slugify } from './text.js';
import { mostPopular, pageVisits } from './lab/popular.js';
import { EFFECTS, EXPERIMENTS, TOOLS, effectUrl, toolUrl } from './lab/tools.js';
import { nowFile } from './now-file.js';
import { POSTS_PER_PAGE, SITE } from '../site';

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

/** What a Lab card shows: one of the tools, a game's post, or an effect. */
export type LabItem =
  | { tool: (typeof TOOLS)[number]; post?: never; effect?: never }
  | { post: Post; tool?: never; effect?: never }
  | { effect: (typeof EFFECTS)[number]; tool?: never; post?: never };

// Asked once per build (or dev session) and kept, so the counter isn't asked again for every page drawn.
let popular: Promise<LabItem[]> | undefined;

/** The Lab's Most Popular: its four most visited ready tools, games and effects (lab/popular.js); none while there's no ranking. */
export function popularLabItems(): Promise<LabItem[]> {
  return (popular ??= (async () => {
    const items = [
      ...TOOLS.filter((t) => t.status === 'ready').map((tool) => ({ path: toolUrl(tool.slug), item: { tool } as LabItem })),
      ...(await experimentPosts()).map((post) => ({ path: postUrl(post), item: { post } as LabItem })),
      ...EFFECTS.map((effect) => ({ path: effectUrl(effect.slug), item: { effect } as LabItem })),
    ];
    const visits = await pageVisits(items.map((i) => i.path), SITE.goatcounter);
    if (!visits) console.warn("Most Popular: GoatCounter gave no counts, so the Lab home is built without it.");
    return mostPopular(items, visits).map((i) => i.item);
  })());
}

const images = import.meta.glob<{ default: ImageMetadata }>('/src/content/posts/*/*.{png,jpg,jpeg,webp,gif,avif}', { eager: true });

/** Every public page, for the sitemaps. Hidden posts and drafts are never in it. */
export async function publicPages(): Promise<{ path: string; lastmod?: Date }[]> {
  const posts = await listedPosts();
  const newest = lastUpdated(posts);
  return [
    { path: '/', lastmod: newest },
    ...paginate(posts, POSTS_PER_PAGE).slice(1).map((p) => ({ path: homePageUrl(p.page) })),
    { path: '/writing/', lastmod: newest },
    ...tagCounts(posts).map(({ tag }) => ({ path: tagUrl(tag) })),
    { path: '/collections/' },
    { path: '/travel/' },
    { path: '/about/' },
    { path: '/now/', lastmod: nowFile().updated },
    { path: '/changelog/' },
    // The Lab: its finished tools, its games and its effects. /random/ stays out (it's marked noindex).
    { path: '/lab/' },
    ...TOOLS.filter((t) => t.status === 'ready').map((t) => ({ path: toolUrl(t.slug) })),
    ...(await experimentPosts()).map((post) => ({ path: postUrl(post), lastmod: post.data.updated ?? post.data.date })),
    ...EFFECTS.map((e) => ({ path: effectUrl(e.slug) })),
    ...posts.map((post) => ({ path: postUrl(post), lastmod: post.data.updated ?? post.data.date })),
  ];
}

/** The post's chosen cover, else the first image in the post, else nothing (the card draws a topic cover). */
export function coverOf(post: Post): ImageMetadata | undefined {
  if (post.data.cover) return post.data.cover;
  const first = (post.body ?? '').match(/!\[[^\]]*\]\(\.\/([^)\s]+)\)/);
  return first ? images[`/src/content/posts/${post.id}/${first[1]}`]?.default : undefined;
}
