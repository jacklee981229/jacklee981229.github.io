// Reading what Jack's Writing Islands grows from, while the site is built: the posts that are listed (their parts,
// dates and topics) and each one's visits (GoatCounter's public counter, as the Lab's Most Popular reads it). No
// counter just means no visits known, and every post a little green: never a failed build.
import { listedPosts, postUrl } from './collections';
import { isoDay } from './dates.js';
import { islandsOf } from './islands.js';
import { pageVisits } from './lab/popular.js';
import { TOPICS } from './topics.js';

/** @type {Promise<ReturnType<typeof islandsOf>> | undefined} */
let made;

/**
 * The islands, worked out once per build (or dev session).
 * @param {{ goatcounter: string }} site SITE in site.ts
 */
export function islandsFile(site) {
  return (made ??= (async () => {
    const posts = (await listedPosts()).map((post) => ({
      id: post.id,
      title: post.data.title,
      date: post.data.date,
      topic: post.data.topic,
      featured: post.data.featured,
      body: post.body ?? '',
      url: postUrl(post),
    }));
    const visits = await pageVisits(posts.map((p) => p.url), site.goatcounter);
    return islandsOf({ posts, topics: TOPICS, visits, today: isoDay(new Date()) });
  })());
}
