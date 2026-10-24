// The Collection's Toolbox (collections.astro, its list in src/content/collections/toolbox.yaml): the two ways it's
// grouped, and the search over it.

/** Where a tool runs, in the order the "Where" view shows them. Each has a colour, `--tool-<id>` in tokens.css. */
export const PLACES = [
  { id: 'windows', label: 'Windows' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'chrome', label: 'Chrome' },
  { id: 'website', label: 'Website' },
];
export const PLACE_IDS = /** @type {['windows', 'terminal', 'chrome', 'website']} */ (PLACES.map((p) => p.id));
const placeLabel = (id) => PLACES.find((p) => p.id === id)?.label ?? id;

/** The "Where" view: the same tools, one group for each place that has any, in each the order they're listed. */
export function byPlace(groups) {
  const tools = groups.flatMap((g) => g.tools.map((tool) => ({ ...tool, group: g.name })));
  return PLACES.map((p) => ({ name: p.label, place: p.id, tools: tools.filter((t) => t.where === p.id) })).filter((g) => g.tools.length);
}

/** The tools Jack recommends (`star: true`), in the order they're listed, each also still in its own group. */
export const starred = (groups) => groups.flatMap((g) => g.tools.filter((t) => t.star).map((tool) => ({ ...tool, group: g.name })));

/** The words a tool is found by: its name, its note, where it runs and its group, in lower case. */
export const searchText = (tool, group) => [tool.name, tool.note, placeLabel(tool.where), group].join(' ').toLowerCase();

/** Whether a tool's words hold the search; an empty search holds everything. */
export const found = (text, query) => !query.trim() || text.includes(query.trim().toLowerCase());

const escape = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** The text as safe HTML, with each place the search appears marked. The page sets it as HTML, so everything else
    is escaped: the list's words never become markup. */
export function marked(text, query) {
  const q = query.trim().toLowerCase();
  if (!q) return escape(text);
  const low = text.toLowerCase();
  let out = '';
  let from = 0;
  for (let at = low.indexOf(q); at !== -1; at = low.indexOf(q, at + q.length)) {
    out += escape(text.slice(from, at)) + '<mark>' + escape(text.slice(at, at + q.length)) + '</mark>';
    from = at + q.length;
  }
  return out + escape(text.slice(from));
}
