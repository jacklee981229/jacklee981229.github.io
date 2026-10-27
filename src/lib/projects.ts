// Jack's projects, one list for the Projects page and for Now (which shows a project's picture and line when an item
// names it).
import jacksSpace from '../assets/projects/jacks-space.webp';
import usage from '../assets/projects/usage.webp';
import jarvis from '../assets/projects/jarvis.webp';
import studio from '../assets/projects/studio.webp';
import todo from '../assets/projects/todo.webp';

const GITHUB = 'https://github.com/jacklee981229';

// `at` is where the project's chapter starts in the video, in seconds, and `tone` its colour there.
// shortcut: `at` (and the Projects page's CLOSING) are copied from SCENES in showcase-video's src/Showcase.tsx (a
// scene's first frame / 30); change both together, and generate them from the video if it changes often.
export const PROJECTS = [
  { name: "Jack's Space", line: 'This site: writing, a Lab of tools, games and little worlds, my collections and travels.', tags: ['Astro', 'Cloudflare Workers'], kind: 'world', picture: jacksSpace, code: `${GITHUB}/jacklee981229.github.io`, wide: true, at: 2.6, tone: '--projects-top-from' },
  { name: 'Claude usage widget', line: 'A desktop widget for my Claude plan: the 5-hour window and the weekly limit.', tags: ['Python', 'Claude Code mod'], kind: 'preview', picture: usage, code: `${GITHUB}/claude-usage-widget`, wide: true, at: 18.33, tone: '--about-top-from' },
  { name: "Jack's Jarvis", line: 'A small, safe Windows agent: ask, it picks a tool, you see what happened.', tags: ['TypeScript', 'Voice'], kind: 'misc', picture: jarvis, at: 22.37, tone: '--lab-from' },
  { name: 'Media Studio', line: 'Pick the keepers from a trip, give them one look, export for the site.', tags: ['Python', 'FFmpeg'], kind: 'text', picture: studio, at: 26.4, tone: '--travel-top-from' },
  { name: 'To-do widget', line: 'My to-do list on the desktop. Claude adds to it and ticks it off.', tags: ['Python'], kind: 'effect', picture: todo, code: `${GITHUB}/todo-widget`, at: 30.43, tone: '--writing-top-from' },
] as const;
