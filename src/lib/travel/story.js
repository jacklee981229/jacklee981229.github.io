// A travel post's story: its photos in the order they were taken, each with Jack's words under it. Media Studio
// writes the list (story.json beside the post's index.md) and puts the photos in the media repo
// (C:\repos\Jack\media, published at /media/); this file turns the list into addresses and checks the photos are there.
import { existsSync } from 'node:fs';
import { MONTHS } from '../dates.js';

/**
 * "14 Oct · 14:58" in the place's own time, as the camera wrote it; '' when the photo had no time.
 * @param {string | null} taken
 */
export function momentLabel(taken) {
  const parts = taken?.match(/^\d{4}-(\d\d)-(\d\d)T(\d\d:\d\d)/);
  return parts ? `${Number(parts[2])} ${MONTHS[Number(parts[1]) - 1]} · ${parts[3]}` : '';
}

/**
 * The days a trip ran, from its first photo's day to its last's, in the place's own time; null when no photo had a
 * time.
 * @param {{ taken: string | null }[]} moments @returns {{ from: string, to: string } | null}
 */
export function tripDays(moments) {
  const days = /** @type {string[]} */ (moments.map((m) => m.taken?.slice(0, 10)).filter((day) => day && /^\d{4}-\d\d-\d\d$/.test(day))).sort();
  return days.length ? { from: days[0], to: days[days.length - 1] } : null;
}

/**
 * The story's moments in groups: a moment marked `joined` belongs with the one before it, sharing that one's words.
 * Each group is the index of its first moment and how many it holds.
 * @param {{ joined?: boolean }[]} moments @returns {{ first: number, count: number }[]}
 */
export function groupsOf(moments) {
  const groups = [];
  moments.forEach((m, k) => {
    if (m.joined && groups.length) groups[groups.length - 1].count++;
    else groups.push({ first: k, count: 1 });
  });
  return groups;
}

/**
 * A group's time: one moment's ("14 Oct · 14:58"), or from the first to the last ("19 Oct · 10:26 – 12:48").
 * @param {string | null} first @param {string | null} last
 */
export function groupLabel(first, last) {
  const from = momentLabel(first);
  const to = momentLabel(last);
  if (!from || !to || from === to) return from;
  return from.split(' · ')[0] === to.split(' · ')[0] ? `${from} – ${to.split(' · ')[1]}` : `${from} – ${to}`;
}

// Every photo comes in three widths: the largest on top of its trip's folder, the two smaller in a folder of their own
// (Media Studio's export.file_name). Widths in the order a browser should know them.
export const WIDTHS = [640, 1280, 2048];

/**
 * Where one width of a photo lives, under the media address.
 * @param {string} folder
 * @param {string} id
 * @param {number} width
 */
export function photoPath(folder, id, width) {
  return width === WIDTHS[WIDTHS.length - 1] ? `${folder}/${id}.webp` : `${folder}/smaller/${id}_${width}.webp`;
}

/**
 * @param {string} base the media address, ending in a slash @param {string} folder @param {string} id @param {number} width
 */
export const photoUrl = (base, folder, id, width) => `${base}${photoPath(folder, id, width)}`;

/**
 * The srcset for one photo: its three widths, so a phone downloads the small one.
 * @param {string} base
 * @param {string} folder
 * @param {string} id
 */
export const srcsetOf = (base, folder, id) => WIDTHS.map((w) => `${photoUrl(base, folder, id, w)} ${w}w`).join(', ');

/**
 * Jack's words as paragraphs: a line break starts a new one; empty lines are dropped.
 * @param {string} words
 * @returns {string[]}
 */
export const paragraphs = (words) => words.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

/**
 * A clip and its cover (its first frame), in the trip's videos folder (Media Studio's export.export_video).
 * @param {string} folder @param {string} id
 */
export const clipPath = (folder, id) => `${folder}/videos/${id}.mp4`;
/** @param {string} folder @param {string} id */
export const posterPath = (folder, id) => `${folder}/videos/${id}.webp`;

/**
 * Every file a story needs, as paths under the media address: its photos, its clips and its song.
 * @param {{ folder: string, moments: { id: string, kind?: string }[], music?: { file: string } }} story
 */
export const storyFiles = (story) => [
  ...story.moments.flatMap((m) => (m.kind === 'video'
    ? [clipPath(story.folder, m.id), posterPath(story.folder, m.id)]
    : WIDTHS.map((w) => photoPath(story.folder, m.id, w)))),
  ...(story.music ? [`${story.folder}/${story.music.file}`] : []),
];

/**
 * The files a story needs that aren't there: checked in the media repo's folder beside the site when there is one
 * (Jack's laptop), else on the live site (the deploy), so a post never goes out with missing photos.
 * @param {{ folder: string, moments: { id: string, kind?: string }[], music?: { file: string } }} story
 * @param {{ local: string, live: string, fetch?: typeof fetch }} where
 */
export async function missingFiles(story, { local, live, fetch: get = fetch }) {
  const files = storyFiles(story);
  if (existsSync(local)) return files.filter((file) => !existsSync(`${local}/${file}`));
  const answers = await Promise.all(files.map((file) => get(`${live}${file}`, { method: 'HEAD' }).then((r) => r.ok, () => false)));
  return files.filter((_, k) => !answers[k]);
}
