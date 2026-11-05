// The pictures Jack picked for things on Now with the palette's /now (workers/now saves them here, each named after
// its thing by pictureFile), for the home page's Now card and /now/. A thing in the Collection uses its cover instead.
import type { ImageMetadata } from 'astro';
import { pictureFile } from './now.js';

const pictures = import.meta.glob<{ default: ImageMetadata }>('/src/assets/now/*.jpg', { eager: true });

/** The picture Jack picked for this thing on Now, if there is one. @param value an item's thing, as now.md has it */
export function nowPicture(value: string): ImageMetadata | undefined {
  const file = pictureFile(value);
  return file ? pictures[`/src/assets/now/${file}`]?.default : undefined;
}
