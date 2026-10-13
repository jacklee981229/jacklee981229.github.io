// The Now editor's one page: log in, see Now as it is, change it, tidy it with Claude, save. Its colours, sizes and
// spacing are the site's own tokens, read from src/styles/tokens.css when the Worker is built.
import tokens from '../../src/styles/tokens.css';

export const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Now editor</title>
<script>
  // The site's dark theme is chosen by a data attribute; here it simply follows the device.
  const dark = matchMedia('(prefers-color-scheme: dark)');
  const theme = () => { document.documentElement.dataset.theme = dark.matches ? 'dark' : 'light'; };
  theme();
  dark.addEventListener('change', theme);
</script>
<style>
${tokens}
* { box-sizing: border-box; }
body { margin: 0; min-height: 100dvh; background: var(--paper); color: var(--ink); font: var(--text-base)/1.5 var(--font-sans); -webkit-text-size-adjust: 100%; }
main { max-width: 40rem; margin: 0 auto; padding: var(--space-5) var(--space-4) var(--space-7); display: grid; gap: var(--space-4); }
.top { background: linear-gradient(135deg, var(--now-from), var(--now-to)); color: #fff; border-radius: var(--radius-2xl); padding: var(--space-5); }
.top h1 { margin: 0; font-size: var(--text-xl); line-height: 1.2; }
.top p { margin: var(--space-1) 0 0; color: var(--now-soft); font-size: var(--text-sm); }
.card { background: var(--surface); border-radius: var(--radius-2xl); padding: var(--space-5); display: grid; gap: var(--space-3); }
[hidden] { display: none !important; }
label { font-size: var(--text-sm); color: var(--muted); }
input, textarea { width: 100%; font: inherit; font-size: max(16px, var(--text-base)); color: var(--ink); background: var(--paper); border: 0; border-radius: var(--radius-md); padding: var(--space-3); }
textarea { min-height: 12rem; resize: vertical; line-height: 1.6; }
input:focus-visible, textarea:focus-visible, button:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.row { display: flex; flex-wrap: wrap; gap: var(--space-2); }
button { font: inherit; font-size: var(--text-ui); font-weight: 600; border: 0; border-radius: var(--radius-pill); padding: var(--space-3) var(--space-5); cursor: pointer; background: var(--paper); color: var(--ink); transition: transform var(--motion-press) var(--ease-out), opacity var(--motion-quick) var(--ease-out); -webkit-tap-highlight-color: transparent; }
button.main { background: var(--now-from); color: #fff; }
button:active { transform: scale(0.97); }
button:disabled { opacity: 0.5; cursor: default; transform: none; }
.status { margin: 0; font-size: var(--text-sm); color: var(--muted); min-height: 1.5em; }
.status a { color: inherit; }
.hint { margin: 0; font-size: var(--text-sm); color: var(--muted); }
@media (prefers-reduced-motion: reduce) { button { transition: none; } button:active { transform: none; } }
</style>
</head>
<body>
<main>
  <header class="top">
    <h1>Now</h1>
    <p>Change what you're up to. The site shows it about two minutes after you save.</p>
  </header>

  <form class="card" id="login" hidden>
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required>
    <div class="row"><button class="main" type="submit">Log in</button></div>
    <p class="status" role="status"></p>
  </form>

  <form class="card" id="editor" hidden>
    <label for="text">One line each, like "- 🎮 Playing: Shape of Dreams"</label>
    <textarea id="text" name="text" spellcheck="true" autocapitalize="sentences"></textarea>
    <div class="row">
      <button type="button" id="tidy">Tidy</button>
      <button class="main" type="submit" id="save">Save</button>
    </div>
    <p class="status" role="status"></p>
    <p class="hint">Tidy asks Claude to put your notes into Now's lines. Check them before you save.</p>
  </form>
</main>
<script>
  const login = document.getElementById('login');
  const editor = document.getElementById('editor');
  const text = document.getElementById('text');
  const buttons = editor.querySelectorAll('button');
  let sha = '';

  const say = (form, words, link) => {
    const status = form.querySelector('.status');
    status.textContent = words;
    if (link) {
      const a = document.createElement('a');
      a.href = link.href;
      a.textContent = link.text;
      a.target = '_blank';
      a.rel = 'noopener';
      status.append(' ', a);
    }
  };
  // The login pass is kept in this browser (localStorage can be blocked, in a private window say: then each visit
  // logs in again).
  const PASS = 'now-pass';
  const pass = { get: () => { try { return localStorage.getItem(PASS) ?? ''; } catch { return ''; } }, set: (v) => { try { localStorage.setItem(PASS, v); } catch {} } };
  let held = pass.get();

  const call = async (path, body) => {
    const headers = { Authorization: 'Bearer ' + held, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) };
    const answer = await fetch(path, body === undefined ? { headers } : { method: 'POST', headers, body: JSON.stringify(body) });
    const data = await answer.json().catch(() => ({ error: 'Something went wrong. Please try again.' }));
    return { status: answer.status, data };
  };
  const busy = (on) => buttons.forEach((b) => { b.disabled = on; });

  async function open() {
    const { status, data } = await call('/api/now');
    if (status === 401) {
      editor.hidden = true;
      login.hidden = false;
      document.getElementById('password').focus();
      return;
    }
    login.hidden = true;
    editor.hidden = false;
    if (data.error) return say(editor, data.error);
    text.value = data.text;
    sha = data.sha;
    say(editor, '');
  }

  login.addEventListener('submit', async (event) => {
    event.preventDefault();
    say(login, 'Logging in…');
    const { data } = await call('/api/login', { password: document.getElementById('password').value });
    if (data.error) return say(login, data.error);
    held = data.pass;
    pass.set(held);
    document.getElementById('password').value = '';
    say(login, '');
    open();
  });

  document.getElementById('tidy').addEventListener('click', async () => {
    busy(true);
    say(editor, 'Claude is tidying…');
    const { status, data } = await call('/api/tidy', { text: text.value });
    busy(false);
    if (status === 401) return open();
    if (data.error) return say(editor, data.error);
    text.value = data.text;
    say(editor, 'Tidied. Check it, then save.');
  });

  editor.addEventListener('submit', async (event) => {
    event.preventDefault();
    busy(true);
    say(editor, 'Saving…');
    const { status, data } = await call('/api/save', { text: text.value, sha });
    busy(false);
    if (status === 401) return open();
    if (data.error) return say(editor, data.error);
    sha = data.sha;
    say(editor, 'Saved. The site updates in about two minutes.', { href: data.commit, text: 'See the commit' });
  });

  open();
</script>
</body>
</html>
`;
