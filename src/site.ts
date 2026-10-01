// Site-wide facts. Pages and components read these instead of repeating them.
export const SITE = {
  title: "Jack's Space",
  tagline: 'My programming journal',
  intro: 'Just sharing some of my thoughts, and maybe some tech that I learned. And some games to share :D',
  author: 'Jack Lee',
  role: 'Senior Software Engineer at Squarebox Technology',
  started: '2023-02-23',
  license: { name: 'CC BY-NC-SA 4.0', url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/' },
  // GoatCounter counts page views, without cookies. Every page's script reports its view here, and the build reads
  // the Lab pages' public counts from here to rank Most Popular (D13 in docs/PLAN.md).
  goatcounter: 'https://jacklee981229.goatcounter.com',
} as const;

// Jack's links, shown the same way on the About page and in the home page's profile card.
export const LINKS = [
  // The live resume Doc (the one LinkedIn links to); the old PDF export went out of date.
  { label: 'Resume', href: 'https://docs.google.com/document/d/1C6nfetX6QgpChFIBkQsq_vUNzDPrA6p36HvRUL9RrZQ/edit?usp=sharing', icon: 'file' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/lee-jiunyih-software-developer/', icon: 'linkedin' },
  { label: 'GitHub', href: 'https://github.com/jacklee981229', icon: 'github' },
  { label: 'Email', href: 'mailto:jackjiunyihlee@gmail.com', icon: 'mail' },
] as const;

export const NAV = [
  { href: '/', label: 'Home' },
  { href: '/writing/', label: 'Writing' },
  { href: '/archives/', label: 'Archives' },
  { href: '/lab/', label: 'Lab' },
  { href: '/about/', label: 'About' },
] as const;

// Home and its later pages show this many posts each (same as the old site).
export const POSTS_PER_PAGE = 10;
