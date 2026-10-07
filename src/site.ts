// Site-wide facts. Pages and components read these instead of repeating them.
export const SITE = {
  title: "Jack's Space",
  tagline: 'Things I build, play and love',
  intro: 'Just sharing some of my thoughts, and maybe some tech that I learned. And some games to share :D',
  author: 'Jack Lee',
  role: 'Senior Software Engineer at Squarebox Technology',
  started: '2023-02-23',
  // When it moved from Hexo to Astro.
  rebuilt: '2026-09-26',
  // "Surprise me" (a random page) stays hidden until Jack wants it live: in the command palette, on the home page's Lab
  // card and on the Lab page. /random/ itself is still built, with nothing linking to it.
  surprise: false as boolean,
  license: { name: 'CC BY-NC-SA 4.0', url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/' },
  // GoatCounter counts page views, without cookies. Every page's script reports its view here, and the build reads
  // the Lab pages' public counts from here to rank Most Popular.
  goatcounter: 'https://jacklee981229.goatcounter.com',
  // The guestbook's notes live in a Cloudflare Worker of Jack's (workers/guestbook): the guestbook page and the home
  // page's Guestbook card read them from here, and new notes are posted here.
  guestbook: 'https://jacks-space-guestbook.jacklee981229.workers.dev',
} as const;

// Jack's links, shown the same way on the About page and in the home page's profile card.
export const LINKS = [
  // The live resume Doc (the one LinkedIn links to); the old PDF export went out of date.
  { label: 'Resume', href: 'https://docs.google.com/document/d/1C6nfetX6QgpChFIBkQsq_vUNzDPrA6p36HvRUL9RrZQ/edit?usp=sharing', icon: 'file' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/lee-jiunyih-software-developer/', icon: 'linkedin' },
  { label: 'GitHub', href: 'https://github.com/jacklee981229', icon: 'github' },
  { label: 'Email', href: 'mailto:jackjiunyihlee@gmail.com', icon: 'mail' },
] as const;

// The menu: each page with its icon (also the palette's) and, for the parts of the site, its colour (an
// --accent-* token in tokens.css).
export const NAV = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/writing/', label: 'Writing', icon: 'pen', accent: 'writing' },
  { href: '/lab/', label: 'Lab', icon: 'flask', accent: 'lab' },
  { href: '/collections/', label: 'Collection', icon: 'books', accent: 'collection' },
  { href: '/travel/', label: 'Travel', icon: 'globe', accent: 'travel' },
  { href: '/about/', label: 'About', icon: 'user', accent: 'about' },
] as const;

