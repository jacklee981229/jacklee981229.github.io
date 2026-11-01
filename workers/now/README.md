# Jack's Now editor

A Cloudflare Worker (`index.js`, its rules in `now-editor.js`) that changes `src/content/now.md` by committing it to
`main` through GitHub's API, so the site deploys as after any push. Its page (`page.js`) works on a phone; the site's
command palette has `/now` too (`src/lib/now-command.js`). Claude Haiku tidies the words, from the Max plan's API
credits. Run every command in `C:\repos\Jack\jacks-space`.

## Setting it up, once

1. `npx wrangler deploy --config workers/now/wrangler.toml`; it prints the Worker's address, which `nowEditor` in
   `src/site.ts` must match.
2. Set the four secrets that `.dev.vars.example` lists, each with
   `npx wrangler secret put <NAME> --config workers/now/wrangler.toml` (it asks for the value).

## Using it

- On a phone or anywhere: open the Worker's address, log in, change the lines, press Tidy if you like, then Save.
- On the site: open the command palette, type `/now login` once in each browser, then `/now Playing chess` and press
  Enter twice: once to see Claude's line, once to save it as the whole of Now.
- Each save is a commit, "Now - update", made on GitHub: pull before your next commit on the laptop.
- A login lasts 30 days. To log every device out, set a new `SESSION_SECRET`.

## Drafts

Writing (`/writing/`) shows Drafts and `+ Draft` only in a browser that did `/now login`. A draft (text and pictures)
stays in the D1 database, private, until Publish commits `src/content/posts/<first free number>/` to `main` as
"Post - publish /N/" and removes it; the post is live about two minutes later. The editor is `/writing/draft/?id=…`.
Once, before first use: `npx wrangler d1 execute jacks-space-now --remote --file workers/now/schema.sql --config workers/now/wrangler.toml`.

## Trying it on the laptop

Copy `.dev.vars.example` to `.dev.vars`, fill it in, and run
`npx wrangler dev --config workers/now/wrangler.toml --port 8792`. With a real `GITHUB_TOKEN`, Save commits to the
real `main`.
