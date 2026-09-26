import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { TOPIC_IDS } from './lib/topics.js';

// One folder per post: src/content/posts/<address>/index.md, with its images beside it.
// The folder name is the post's address, so src/content/posts/11/index.md is /11/.
const posts = defineCollection({
  loader: glob({
    pattern: '*/index.md',
    base: './src/content/posts',
    generateId: ({ entry }) => entry.split('/')[0],
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string().min(1),
      date: z.coerce.date(),
      updated: z.coerce.date().optional(),
      topic: z.enum(TOPIC_IDS),
      tags: z
        .array(z.string().regex(/^[a-z0-9]+(?:[ -][a-z0-9]+)*$/, 'Tags are lowercase words, like "flutter" or "dev tools"'))
        .default([]),
      // Shown on cards and in search results instead of the automatic summary.
      description: z.string().optional(),
      // Without one, the post's first image is the cover, else a cover in the topic's colour.
      cover: image().optional(),
      // Drafts only show in local preview (npm run dev).
      draft: z.boolean().default(false),
      // Hidden posts have a page but appear in no list, feed, search or sitemap.
      hidden: z.boolean().default(false),
      // Pinned posts also show at the top of the home page.
      pinned: z.boolean().default(false),
      // false hides the CC licence notice, for posts that are mostly other people's code.
      license: z.boolean().default(true),
    }),
});

const pages = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/pages' }),
  schema: z.object({ title: z.string() }),
});

export const collections = { posts, pages };
