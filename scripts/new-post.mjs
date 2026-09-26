// npm run new "Post title" topic: starts a draft post in src/content/posts/<address>/index.md.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { localTimestamp } from '../src/lib/dates.js';
import { RESERVED_SLUGS } from '../src/lib/posts.js';
import { slugify } from '../src/lib/text.js';
import { TOPIC_IDS } from '../src/lib/topics.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const [title = '', topic] = process.argv.slice(2);
if (!title.trim()) fail('Give the post a title: npm run new "My post title" topic');
if (!topic) fail(`Add a topic after the title, one of: ${TOPIC_IDS.join(', ')}\n  npm run new "${title}" ${TOPIC_IDS[0]}`);
if (!TOPIC_IDS.includes(topic)) fail(`"${topic}" isn't a topic. Use one of: ${TOPIC_IDS.join(', ')}`);

let slug = '';
try {
  slug = slugify(title);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
if (RESERVED_SLUGS.includes(slug)) fail(`"/${slug}/" is already one of the site's own pages. Pick a different title.`);
const dir = join(ROOT, 'src/content/posts', slug);
if (existsSync(dir)) fail(`A post already lives at ${relative(ROOT, dir)}. Pick a different title.`);

mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'index.md'), [
  '---',
  `title: ${JSON.stringify(title.trim())}`,
  `date: ${localTimestamp(new Date())}`,
  `topic: ${topic}`,
  'tags: []',
  'draft: true',
  '---',
  '',
  // In backticks, so the example isn't read as a real (missing) image.
  'Start writing here. Put images in this folder and add them like this: `![what the picture shows](./picture.png)`',
  '',
].join('\n'));

console.log(`Draft created: ${relative(ROOT, join(dir, 'index.md'))}`);
console.log(`Preview it: npm run dev, then open http://localhost:4321/${slug}/`);
