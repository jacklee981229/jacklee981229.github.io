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

/**
 * Runs a change in a circle at `from` (the button pressed; the header's theme button when the palette asked): toward
 * light, the new theme spreads out of the button over the page; toward dark (`inward`), the light page is drawn back
 * into it. At once for less motion or older browsers.
 */
const spread = (change: () => void, inward: boolean, from?: Element | null) => {
  if (!('startViewTransition' in document) || matchMedia('(prefers-reduced-motion: reduce)').matches) return change();
  const box = (from ?? document.querySelector('[data-theme-toggle]'))?.getBoundingClientRect();
  const x = box?.width ? box.left + box.width / 2 : innerWidth / 2;
  const y = box?.height ? box.top + box.height / 2 : innerHeight / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  root.classList.add('spreading');
  root.classList.toggle('inward', inward);
  const circle = [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`];
  const turn = document.startViewTransition(change);
  turn.ready.then(() => root.animate({ clipPath: inward ? circle.reverse() : circle }, { duration: 500, easing: inward ? 'cubic-bezier(0.6, 0, 0.8, 0.2)' : 'cubic-bezier(0.2, 0.8, 0.2, 1)', pseudoElement: inward ? '::view-transition-old(root)' : '::view-transition-new(root)' }));
  turn.finished.finally(() => root.classList.remove('spreading', 'inward'));
};

/** The theme back to what the visitor chose before the night, or the system's when they never chose. */
const daylight = () => {
  const saved = read(THEME_KEY);
  return saved === 'light' || saved === 'dark' ? saved : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

/** Night on or off. Night is the dark theme with a sky of its own (data-sky="night"). */
export function setNight(on: boolean) {
  spread(() => {
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
  }, on);
}

/** The theme button: light to dark and back, or out of the night sky when it's on. */
export function switchTheme(event?: Event) {
  if (isNight()) return setNight(false);
  spread(() => {
    root.dataset.theme = isDark() ? 'light' : 'dark';
    write(THEME_KEY, root.dataset.theme);
    labelThemeButtons();
  }, !isDark(), event?.currentTarget as Element | null);
}
