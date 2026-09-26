---
name: new-post
description: Write a new post for Jack's Space together with Jack, from idea to preview to publishing. Use when Jack wants to write, draft, finish, edit or publish a blog post.
---

# Writing a post with Jack

Jack decides what the post says. You help shape it, write it up in his voice, handle the files and check the result. Follow the rules in this project's CLAUDE.md and in `C:\repos\Jack\CLAUDE.md` (especially the Git rules).

## 1. Agree what the post is

- Ask what it's about, the one thing a reader should take away, and what material he has: notes, commands, screenshots, links, code.
- Suggest a title, a topic (the list is in `src/lib/topics.js`), a few lowercase tags, and a short outline of `##` sections. Wait for his OK.
- If none of the topics fits, say so and ask; a new topic also needs lane colours (see CLAUDE.md, "Writing posts with Jack").

## 2. Start the draft

Run, in the project folder:

```
npm run new "<title>" <topic>
```

This creates `src/content/posts/<address>/index.md` with `draft: true`. The folder name is the post's web address and must not change once the post is published.

## 3. Write it

- Keep Jack's voice: casual, first person, short sentences. Use his own wording where he gave it. Fix spelling and grammar lightly unless he asks you to leave it.
- Structure: `##` for sections, `###` below that. The page title is already the only `#`.
- Code: fenced blocks with a language (```` ```bash ````). For a file, add its name: ```` ```js title="app.js" ````. Blocks over 24 lines fold automatically.
- Images: ask Jack to save them into the post's folder (or give you their path so you can copy them there), then add `![what the picture shows](./file.png)`. Write a real description as the alt text. The first image becomes the cover unless he picks one with `cover: ./file.png`.
- Add `description:` only if the automatic summary (the first lines of the post) reads badly.

## 4. Preview and check

- Start the local site with `npm run dev` (use a spare port such as `npm run dev -- --port 4602` if Jack's own copy may be running) and open `http://localhost:4321/<address>/`.
- Look at it yourself at desktop and phone width, in light and dark: headings, code blocks, images, the cover on the home page.
- Show Jack the preview and make his edits. Repeat until he is happy.

## 5. Publish (only when Jack says so)

1. Set `draft: false`. If days have passed since the draft was started, ask whether to set `date:` to today (`npm run new` wrote the time it started).
2. Run `npm test`, `npm run check` and `npm run build`. All must pass.
3. Suggest a commit message in the form `Post - <title>`, and use his words instead if he gives any. Commit only when he says so, with no AI attribution.
4. Push only when he says so, and tell him how many commits he is ahead of GitHub before pushing.
5. Pushing to `main` redeploys the site through GitHub Actions in about two minutes. Then open the live address and check the post is there.

## Things to keep in mind

- The repo is public: anything committed, drafts included, can be read on GitHub. Don't commit a draft unless Jack is fine with that.
- `hidden: true` gives a post a page but keeps it out of every list, the feed, search and the sitemap. `pinned: true` also shows it at the top of the home page.
- Never edit `dist/`; it is rebuilt on every build.
