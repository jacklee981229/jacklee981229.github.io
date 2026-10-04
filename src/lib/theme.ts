// Switching the theme, for the header's button and the command palette alike, so the two can't get out of step.
// Base.astro's head script applies the saved theme (and the night sky, if it's on) before the page paints; this is
// what changes them afterwards, on <html>'s data-theme and data-sky, which pages that draw in the theme's colours (the
// effects, the globe) watch.

const root = document.documentElement;
/** The light or dark choice, kept between visits. */
const THEME_KEY = 'theme';
/** The night sky: on or not, kept apart from the theme so leaving it goes back to the theme from before. */
const NIGHT_KEY = 'sky';
/** Remembers that the night sky has been found, so the palette offers it from then on. */
const FOUND_KEY = 'sky-found';

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private browsing can block storage; the choice then lasts until the page reloads.
  }
};

export const isDark = () => root.dataset.theme === 'dark';
export const isNight = () => root.dataset.sky === 'night';
export const nightFound = () => read(FOUND_KEY) === '1' || isNight();

/** What the theme button and the palette's item say: where a press takes you. */
export const themeLabel = () => (isNight() ? 'Leave the night sky' : `Switch to ${isDark() ? 'light' : 'dark'} theme`);

/** Sets the theme buttons' labels to match the page. */
export const labelThemeButtons = () => {
  document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((b) => {
    b.setAttribute('aria-label', themeLabel());
    b.title = themeLabel();
  });
};

/** Runs a change with the page's cross-fade (its length is in global.css); at once for less motion or older browsers. */
const fade = (change: () => void) => {
  const smooth = 'startViewTransition' in document && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (smooth) document.startViewTransition(change);
  else change();
};

/** The theme back to what the visitor chose before the night, or the system's when they never chose. */
const daylight = () => {
  const saved = read(THEME_KEY);
  return saved === 'light' || saved === 'dark' ? saved : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

/** Night on or off. Night is the dark theme with a sky of its own (data-sky="night"). */
export function setNight(on: boolean) {
  fade(() => {
    if (on) {
      root.dataset.sky = 'night';
      root.dataset.theme = 'dark';
      write(NIGHT_KEY, 'night');
      write(FOUND_KEY, '1');
    } else {
      delete root.dataset.sky;
      root.dataset.theme = daylight();
      write(NIGHT_KEY, null);
    }
    labelThemeButtons();
  });
}

/** The theme button: light to dark and back, or out of the night sky when it's on. */
export function switchTheme() {
  if (isNight()) return setNight(false);
  fade(() => {
    root.dataset.theme = isDark() ? 'light' : 'dark';
    write(THEME_KEY, root.dataset.theme);
    labelThemeButtons();
  });
}
