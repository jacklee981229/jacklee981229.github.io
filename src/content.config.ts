import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { byStars, validStars } from './lib/shelves.js';
import { TOPIC_IDS } from './lib/topics.js';
import { PLACE_IDS } from './lib/toolbox.js';

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

// A travel post's story: story.json beside its index.md, written by Media Studio (C:\repos\Jack\media-studio) when
// Jack publishes a trip. Never edited by hand: the next publish rewrites it. The photos are in the media repo
// (src/lib/travel/story.js).
const stories = defineCollection({
  loader: glob({
    pattern: '*/story.json',
    base: './src/content/posts',
    generateId: ({ entry }) => entry.split('/')[0],
  }),
  schema: z.object({
    // The trip's folder in the media repo.
    folder: z.string().regex(/^[a-z0-9-]+$/),
    moments: z.array(z.object({
      id: z.string().regex(/^[a-z0-9_~-]+$/),
      // A photo, or a video's clip of about 7 seconds.
      kind: z.enum(['photo', 'video']).default('photo'),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      // When the photo was taken, in the place's own time; null when the file didn't say.
      taken: z.string().nullable(),
      words: z.string(),
      // A clip's length. Clips are silent in a story: the story has one song of its own.
      seconds: z.number().positive().optional(),
      // Joined to the moment before: one group, sharing that one's words (its own are empty).
      joined: z.boolean().optional(),
      // Where it was, if Jack named it: shown with a pin over the words.
      place: z.string().optional(),
      // Words on their own after it (after its group): a slide of their own, without a photo.
      after: z.string().optional(),
    })).min(1),
    // Words before the first photo and after the last, if Jack wrote any, and the moment whose photo is dimmed behind
    // each if he picked one (else the first and the last).
    intro: z.string().optional(),
    outro: z.string().optional(),
    introPhoto: z.string().optional(),
    outroPhoto: z.string().optional(),
    // The song under the whole story, in the trip's media folder, and who made it (shown at the story's end).
    music: z.object({
      file: z.string().regex(/^music\/[a-z0-9.-]+$/),
      title: z.string().min(1),
      artist: z.string().optional(),
      url: z.string().url().optional(),
    }).optional(),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    // About: where Jack has worked, newest first, each with a line on what he does there. Shown only once there's an
    // entry.
    work: z.array(z.object({ role: z.string().min(1), what: z.string().min(1).optional(), place: z.string().min(1), years: z.string().min(1) })).default([]),
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
    // Shown most stars first, equal stars in the order they're listed (byStars).
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
    ).transform(byStars),
  }),
});

// The Collection's Toolbox tab: one list, src/content/collections/toolbox.yaml (how to add a tool: the README there).
const toolbox = defineCollection({
  loader: glob({ pattern: 'toolbox.yaml', base: './src/content/collections' }),
  schema: z.object({
    groups: z.array(
      z.object({
        name: z.string().min(1),
        tools: z.array(
          z.object({
            name: z.string().min(1),
            where: z.enum(PLACE_IDS),
            link: z.string().url(),
            note: z.string().min(1),
            // Only for a terminal tool: shown with a Copy button.
            command: z.string().min(1).optional(),
            // Jack recommends it: also shown in Starred, at the top of both views.
            star: z.boolean().optional(),
          }),
        ).min(1),
      }),
    ).min(1),
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

export const collections = { posts, stories, pages, shelves, toolbox, travel };
