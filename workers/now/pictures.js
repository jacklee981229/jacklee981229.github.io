// A game's pictures for Now, found on Steam when Jack's /now names a game (the palette, src/components/SearchDialog.astro):
// its poster, its tall store art and its first screenshot, all official art as in the Collection. Steam's store
// search and its store-items call are open to anyone, with no key.

const ASSETS = 'https://shared.akamai.steamstatic.com/store_item_assets/';
/** The most a picture may weigh: Steam's are 50 to 80 KB at the sizes asked for. */
export const HEAVIEST = 1024 * 1024;

/** A name as compared: small letters, and letters and digits only. @param {string} name */
const plain = (name) => name.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * The store search's result for this game: the one with exactly its name, else the first, since the search puts
 * a game before its soundtrack and add-ons. Nothing when it found no game.
 * @param {unknown} items the search's items @param {string} name
 * @returns {{ id: number, name: string } | null}
 */
export function bestMatch(items, name) {
  if (!Array.isArray(items)) return null;
  const apps = items.filter((item) => item?.type === 'app' && Number.isInteger(item.id) && typeof item.name === 'string');
  return apps.find((item) => plain(item.name) === plain(name)) ?? apps[0] ?? null;
}

/**
 * A store item's pictures, at sizes fit for Now: the poster (300×450), the tall store art (374×448) and the first
 * screenshot (600×338), each that it has.
 * @param {any} item one of the store-items call's store_items @returns {string[]}
 */
export function picturesOf(item) {
  const format = item?.assets?.asset_url_format;
  if (typeof format !== 'string') return [];
  const asset = (/** @type {unknown} */ file) => (typeof file === 'string' && file ? ASSETS + format.replace('${FILENAME}', file) : '');
  // The screenshot's own name is the 4K one; the same name with .600x338 before .jpg is a small copy.
  const shot = item.screenshots?.all_ages_screenshots?.[0]?.filename;
  const small = typeof shot === 'string' && /\.jpg(\?|$)/.test(shot) ? ASSETS + shot.replace(/\.jpg(\?|$)/, '.600x338.jpg$1') : '';
  return [asset(item.assets.library_capsule), asset(item.assets.hero_capsule), small].filter(Boolean);
}

/** Whether an address is one of Steam's store pictures, the only pictures a save takes. @param {unknown} address */
export function isSteamPicture(address) {
  if (typeof address !== 'string') return false;
  try {
    const url = new URL(address);
    return url.protocol === 'https:' && url.hostname === 'shared.akamai.steamstatic.com' && url.pathname.startsWith('/store_item_assets/steam/apps/') && url.pathname.endsWith('.jpg');
  } catch {
    return false;
  }
}

/**
 * Steam's pictures for a game, with the name Steam knows it by; none when Steam has no such game.
 * @param {string} name @returns {Promise<{ name: string, pictures: string[] }>}
 */
export async function steamPictures(name) {
  const search = await fetch(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(name)}&l=english&cc=MY`);
  if (!search.ok) throw new Error(`Steam answered ${search.status} to the search`);
  const match = bestMatch((await search.json())?.items, name);
  if (!match) return { name, pictures: [] };
  const input = { ids: [{ appid: match.id }], context: { language: 'english', country_code: 'MY' }, data_request: { include_assets: true, include_screenshots: true } };
  const items = await fetch(`https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(JSON.stringify(input))}`);
  if (!items.ok) throw new Error(`Steam answered ${items.status} to the store items`);
  return { name: match.name, pictures: picturesOf((await items.json())?.response?.store_items?.[0]) };
}

/**
 * A picked picture's bytes, checked: one of Steam's, a JPEG, and not too heavy.
 * @param {unknown} address @returns {Promise<Uint8Array | null>}
 */
export async function pictureBytes(address) {
  if (!isSteamPicture(address)) return null;
  const answer = await fetch(/** @type {string} */ (address));
  if (!answer.ok || !/^image\/jpe?g\b/i.test(answer.headers.get('Content-Type') ?? '')) return null;
  const bytes = new Uint8Array(await answer.arrayBuffer());
  return bytes.length && bytes.length <= HEAVIEST ? bytes : null;
}
