// Reading posts from Astro's content collection. The rules themselves live in posts.js, where tests cover them.
import { getCollection, type CollectionEntry } from 'astro:content';
import type { ImageMetadata } from 'astro';
import { homePageUrl, lastUpdated, listed, paginate, published, tagCounts } from './posts.js';
import { excerpt, slugify } from './text.js';
import { TOOLS, toolUrl } from './lab/tools.js';
import { POSTS_PER_PAGE } from '../site';

export type Post = CollectionEntry<'posts'>;

// Drafts only show in local preview (npm run dev), never in a build.
const options = { includeDrafts: import.meta.env.DEV };

/** Every post that has its own page, hidden ones included, newest first. */
export const pagePosts = async () => published(await getCollection('posts'), options);

/** The posts that appear in lists, feeds, search and the sitemap, newest first. */
export const listedPosts = async () => listed(await getCollection('posts'), options);

export const postUrl = (post: Post) => `/${post.id}/`;
export const tagUrl = (tag: string) => `/tags/${slugify(tag)}/`;
export const summaryOf = (post: Post) => post.data.description ?? excerpt(post.body ?? '');

const images = import.meta.glob<{ default: ImageMetadata }>('/src/content/posts/*/*.{png,jpg,jpeg,webp,gif,avif}', { eager: true });

/** Every public page, for the sitemaps. Hidden posts and drafts are never in it. */
export async function publicPages(): Promise<{ path: string; lastmod?: Date }[]> {
  const posts = await listedPosts();
  const newest = lastUpdated(posts);
  return [
    { path: '/', lastmod: newest },
    ...paginate(posts, POSTS_PER_PAGE).slice(1).map((p) => ({ path: homePageUrl(p.page) })),
    { path: '/writing/', lastmod: newest },
    { path: '/archives/', lastmod: newest },
    ...tagCounts(posts).map(({ tag }) => ({ path: tagUrl(tag) })),
    { path: '/about/' },
    // The Lab and its finished tools; /random/ stays out until it does something.
    { path: '/lab/' },
    ...TOOLS.filter((t) => t.status === 'ready').map((t) => ({ path: toolUrl(t.slug) })),
    ...posts.map((post) => ({ path: postUrl(post), lastmod: post.data.updated ?? post.data.date })),
  ];
}

/** The post's chosen cover, else the first image in the post, else nothing (the card draws a topic cover). */
export function coverOf(post: Post): ImageMetadata | undefined {
  if (post.data.cover) return post.data.cover;
  const first = (post.body ?? '').match(/!\[[^\]]*\]\(\.\/([^)\s]+)\)/);
  return first ? images[`/src/content/posts/${post.id}/${first[1]}`]?.default : undefined;
}
