// Site-wide facts. Pages and components read these instead of repeating them.
export const SITE = {
  title: "Jack's Space",
  tagline: 'My programming journal',
  intro: 'Just sharing some of my thoughts, and maybe some tech that I learned. And some games to share :D',
  author: 'Jack Lee',
  role: 'Software developer in Malaysia',
  started: '2023-02-23',
  github: 'https://github.com/jacklee981229',
  email: 'jackjiunyihlee@gmail.com',
  license: { name: 'CC BY-NC-SA 4.0', url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/' },
} as const;

export const NAV = [
  { href: '/', label: 'Home' },
  { href: '/writing/', label: 'Writing' },
  { href: '/archives/', label: 'Archives' },
  { href: '/about/', label: 'About' },
] as const;

// Home and its later pages show this many posts each (same as the old site).
export const POSTS_PER_PAGE = 10;
