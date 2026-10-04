// The collections' pictures, shared by the Collections page and Now (which shows an item's cover when it names one).
import type { ImageMetadata } from 'astro';
import { getCollection } from 'astro:content';
import { pictureOf } from './shelves.js';

// Every picture in the collections' folders, of the kinds a collection takes: PICTURE_TYPES in shelves.js, in small
// letters and in capitals. They're spelt out because the build reads this line as it stands; a test keeps the two
// in step.
export const pictures = import.meta.glob<{ default: ImageMetadata }>('/src/content/collections/*/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}', { eager: true });

/** The collection item with this name (ignoring case), with its collection's id and its picture, if there is one. */
export async function shelfItemNamed(name: string) {
  const wanted = name.trim().toLowerCase();
  for (const shelf of await getCollection('shelves')) {
    const item = shelf.data.items.find((i) => i.name.trim().toLowerCase() === wanted);
    if (item) return { shelf: shelf.id, item, picture: pictureOf(pictures, shelf.id, item)?.default };
  }
  return undefined;
}
