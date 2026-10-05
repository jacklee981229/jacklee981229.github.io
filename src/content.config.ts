import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { validStars } from './lib/shelves.js';
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
      // Featured posts are listed under "Start here" at the top of Writing: the ones to read first.
      featured: z.boolean().default(false),
      // false hides the CC licence notice, for posts that are mostly other people's code.
      license: z.boolean().default(true),
    }),
});

const pages = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    // About: where Jack has worked, newest first. Shown only once there's an entry.
    work: z.array(z.object({ role: z.string().min(1), place: z.string().min(1), years: z.string().min(1) })).default([]),
    // About: what Jack works with, in a few named groups.
    tools: z.array(z.object({ group: z.string().min(1), items: z.array(z.string().min(1)).min(1) })).default([]),
  }),
});

// The Collections page. One folder per collection: src/content/collections/<name>/index.yaml, with its pictures
// beside it (how to add an item: src/content/collections/README.md). Here they're "shelves", because "collections"
// is already Astro's word for these folders of content.
const shelves = defineCollection({
  loader: glob({
    pattern: '*/index.yaml',
    base: './src/content/collections',
    generateId: ({ entry }) => entry.split('/')[0],
  }),
  schema: z.object({
    name: z.string().min(1),
    // Collections show lowest number first; ones without a number come after, by name.
    order: z.number().optional(),
    // Shown in the order they're listed.
    items: z.array(
      z
        .object({
          name: z.string().min(1),
          stars: z.number(),
          // A picture in the same folder. Without one, the item gets a plain cover with its name.
          image: z.string().optional(),
          // More pictures in the same folder, shown after the cover in the item's gallery, in this order.
          gallery: z.array(z.string().min(1)).optional(),
        })
        .superRefine((item, ctx) => {
          if (!validStars(item.stars)) ctx.addIssue({ code: 'custom', path: ['stars'], message: `"${item.name}" has ${item.stars} stars. Stars go from 1 to 5, in halves: 4 or 4.5, not 4.2.` });
        }),
    ),
  }),
});

// The Travel Map's one list: src/content/travel/visited.yaml.
const travel = defineCollection({
  loader: glob({ pattern: 'visited.yaml', base: './src/content/travel' }),
  schema: z.object({
    // Names the map knows (src/lib/travel/places.js). The first is home: the globe starts facing it, and the
    // colours run from it to the farthest place.
    visited: z.array(z.string().min(1)),
  }),
});

export const collections = { posts, pages, shelves, travel };
