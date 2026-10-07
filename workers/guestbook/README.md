# Jack's Space guestbook

A Cloudflare Worker (`index.js`, its rules in `notes.js`) over a D1 database (`schema.sql`). The guestbook page reads
the notes from it and posts new ones to it. Run every command in `C:\repos\Jack\jacks-space`.

## Setting it up, once

1. `npx wrangler login`, and allow it on the page that opens in your browser.
2. `npx wrangler d1 create jacks-space-guestbook`, then put the `database_id` it prints into `wrangler.toml`.
3. `npx wrangler d1 execute jacks-space-guestbook --remote --file workers/guestbook/schema.sql --config workers/guestbook/wrangler.toml`
4. `npx wrangler deploy --config workers/guestbook/wrangler.toml`; it prints the Worker's address.

## Looking after the notes

Run SQL in Cloudflare's dashboard (Storage & databases, D1, jacks-space-guestbook, Console), or with
`npx wrangler d1 execute jacks-space-guestbook --remote --config workers/guestbook/wrangler.toml --command "…"`.
Change 12 to the note's id.

- Notes waiting for you: `SELECT id, name, message, created_at FROM notes WHERE hidden = 1 ORDER BY id DESC;`
- Show one: `UPDATE notes SET hidden = 0 WHERE id = 12;`
- Hide one: `UPDATE notes SET hidden = 1 WHERE id = 12;`
- Pin one to the wall of notes (0 to unpin): `UPDATE notes SET pinned = 1 WHERE id = 12;`
- Reply: `UPDATE notes SET reply = 'Thank you!', reply_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = 12;`
- Change a note's words: `UPDATE notes SET message = 'The new words' WHERE id = 12;`
- Delete one for good, such as a test note of your own: `DELETE FROM notes WHERE id = 12;`
- A word that makes a note wait for you: `INSERT OR IGNORE INTO words (word) VALUES ('casino');`
