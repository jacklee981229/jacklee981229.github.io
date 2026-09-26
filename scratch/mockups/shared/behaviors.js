// Behaviour shared by both mockups. Each direction styles the same hooks its own way.
window.MOCKUI = (() => {
  const M = window.MOCK;
  const root = document.documentElement;
  const THEME_KEY = 'jacks-space-theme';
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const parts = (iso) => iso.split('-').map(Number);
  const fmtDate = (iso) => { const [y, m, d] = parts(iso); return `${d} ${MONTHS[m - 1]} ${y}`; };
  const fmtDay = (iso) => { const [, m, d] = parts(iso); return `${d} ${MONTHS[m - 1]}`; };
  const fmtNum = (n) => n.toLocaleString('en-US');
  const daysSince = (iso) => {
    const [y, m, d] = parts(iso);
    const now = new Date();
    return Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(y, m - 1, d)) / 86400000);
  };

  const topicName = (id) => (M.topics.find((t) => t.id === id) || { name: id }).name;
  // Only the two sample posts have full text in the mockup; the rest link nowhere.
  const linkFor = (p) => (M.bodies[p.slug] ? `post.html?p=${encodeURIComponent(p.slug)}` : '#');
  const currentPost = () => {
    const slug = new URLSearchParams(location.search).get('p') || '11';
    return M.posts.find((p) => p.slug === slug && M.bodies[p.slug]) || M.posts[0];
  };
  const topicCounts = () => M.topics.map((t) => ({ ...t, count: M.posts.filter((p) => p.topic === t.id).length }));

  const ICONS = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    sidebar: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>',
    branch: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="7" r="2"/><path d="M6 7v10M18 9a6 6 0 0 1-6 6H8"/>',
    sparkles: '<path d="M11 3.5 12.9 8l4.6 1.9-4.6 1.9L11 16.4l-1.9-4.6-4.6-1.9L9.1 8z"/><path d="m18.5 14 .9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z"/>',
    gamepad: '<rect x="2.5" y="7" width="19" height="10" rx="5"/><path d="M7.5 10v4M5.5 12h4"/><circle cx="15.5" cy="11" r=".6"/><circle cx="17.5" cy="13" r=".6"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  };
  const GITHUB = '<path fill="currentColor" stroke="none" d="M12 1.5a10.5 10.5 0 0 0-3.3 20.5c.5.1.7-.2.7-.5v-1.8c-2.9.6-3.5-1.4-3.5-1.4-.5-1.2-1.2-1.5-1.2-1.5-1-.7.1-.7.1-.7 1 .1 1.6 1.1 1.6 1.1.9 1.6 2.5 1.1 3.1.9.1-.7.4-1.1.7-1.4-2.3-.3-4.8-1.2-4.8-5.2 0-1.1.4-2.1 1.1-2.8-.1-.3-.5-1.4.1-2.8 0 0 .9-.3 2.9 1.1a10 10 0 0 1 5.3 0c2-1.4 2.9-1.1 2.9-1.1.6 1.4.2 2.5.1 2.8.7.7 1.1 1.7 1.1 2.8 0 4-2.5 4.9-4.8 5.2.4.3.7 1 .7 1.9v2.8c0 .3.2.6.7.5A10.5 10.5 0 0 0 12 1.5z"/>';
  const icon = (name, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${name === 'github' ? GITHUB : ICONS[name]}</svg>`;

  function fillIcons(scope) {
    scope.querySelectorAll('[data-icon]').forEach((el) => { el.outerHTML = icon(el.dataset.icon, el.className || 'i'); });
  }

  function announce(text) {
    const box = document.querySelector('[data-announcer]');
    if (!box) return;
    box.textContent = '';
    setTimeout(() => { box.textContent = text; }, 30);
  }

  // If the clipboard is blocked, select the text instead (when there is text on screen to select).
  async function copyText(text, button, done, fallbackEl) {
    const label = button.querySelector('[data-label]') || button;
    if (!label.dataset.original) label.dataset.original = label.textContent;
    try {
      await navigator.clipboard.writeText(text);
      label.textContent = done;
      announce(done);
    } catch {
      if (fallbackEl) {
        getSelection().selectAllChildren(fallbackEl);
        label.textContent = 'Selected: press Ctrl+C';
      } else {
        label.textContent = 'Couldn’t copy';
      }
      announce(label.textContent);
    }
    clearTimeout(button._reset);
    button._reset = setTimeout(() => { label.textContent = label.dataset.original; }, 2000);
  }

  // Theme: the head script already applied the saved choice or the system setting.
  function setTheme(theme, save) {
    root.dataset.theme = theme;
    if (save) { try { localStorage.setItem(THEME_KEY, theme); } catch { /* private mode */ } }
    const next = theme === 'dark' ? 'light' : 'dark';
    document.querySelectorAll('[data-theme-toggle]').forEach((b) => {
      b.setAttribute('aria-label', `Switch to ${next} theme`);
      b.title = `Switch to ${next} theme`;
    });
  }

  function fillStats() {
    const s = M.site;
    const values = {
      posts: fmtNum(M.posts.length), topics: fmtNum(M.topics.length), tags: fmtNum(s.tags.length),
      days: fmtNum(daysSince(s.started)), visitors: fmtNum(s.visitors), views: fmtNum(s.views),
      updated: fmtDate(s.updated), year: String(new Date().getFullYear()),
    };
    document.querySelectorAll('[data-stat]').forEach((el) => { el.textContent = values[el.dataset.stat] ?? ''; });
  }

  function initSearch() {
    const dialog = document.querySelector('.search-dialog');
    if (!dialog) return;
    const input = dialog.querySelector('input');
    const list = dialog.querySelector('.search-results');
    const empty = dialog.querySelector('.search-empty');
    const render = () => {
      const q = input.value.trim().toLowerCase();
      const hits = M.posts.filter((p) => !q || [p.title, p.excerpt, topicName(p.topic), ...p.tags].join(' ').toLowerCase().includes(q));
      list.innerHTML = hits.map((p) => `<li><a href="${linkFor(p)}"><span class="search-title">${esc(p.title)}</span><span class="search-meta">${esc(topicName(p.topic))}, ${fmtDate(p.date)}</span></a></li>`).join('');
      empty.hidden = hits.length > 0;
      empty.textContent = hits.length ? '' : `No posts match “${input.value.trim()}”. Try a shorter word.`;
    };
    const open = () => {
      if (dialog.open) return;
      input.value = '';
      render();
      dialog.showModal();
      input.focus();
    };
    document.addEventListener('click', (e) => { if (e.target.closest('[data-search-open]')) open(); });
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open(); }
    });
    input.addEventListener('input', render);
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const links = [...list.querySelectorAll('a')];
      if (!links.length) return;
      e.preventDefault();
      const i = links.indexOf(document.activeElement);
      const next = e.key === 'ArrowDown' ? (i + 1) % links.length : (i <= 0 ? links.length - 1 : i - 1);
      links[next].focus();
    });
  }

  function highlightYaml(line) {
    const m = line.match(/^(\s*)([\w.-]+)(:)(\s*)(.*)$/);
    if (!m) return esc(line);
    const [, indent, key, colon, space, value] = m;
    let v = esc(value);
    if (/^(['"]).*\1$/.test(value)) v = `<span class="tok-str">${v}</span>`;
    else if (/^-?\d+(\.\d+)?$/.test(value)) v = `<span class="tok-num">${v}</span>`;
    else if (value) v = `<span class="tok-val">${v}</span>`;
    return `${indent}<span class="tok-key">${esc(key)}</span>${colon}${space}${v}`;
  }

  function enhanceCode(scope) {
    scope.querySelectorAll('pre[data-lang]').forEach((pre) => {
      const lang = pre.dataset.lang;
      const text = pre.textContent.replace(/\n$/, '');
      const yaml = lang === 'yml' || lang === 'yaml';
      const fig = document.createElement('figure');
      fig.className = 'code';
      fig.innerHTML = `<figcaption class="code-bar"><span class="code-lang">${esc(lang)}</span>`
        + `<button type="button" class="code-copy">${icon('copy', 'i')}<span data-label>Copy</span></button></figcaption>`
        + `<pre tabindex="0" aria-label="${esc(lang)} code"><code>${text.split('\n').map((l) => `<span class="ln">${yaml ? highlightYaml(l) : esc(l)}</span>`).join('')}</code></pre>`;
      fig.querySelector('.code-copy').addEventListener('click', (e) => copyText(text, e.currentTarget, 'Copied', fig.querySelector('code')));
      pre.replaceWith(fig);
    });
  }

  function enhanceImages(scope) {
    const box = document.querySelector('.lightbox');
    scope.querySelectorAll('img').forEach((img) => {
      img.loading = 'lazy';
      img.decoding = 'async';
      const w = Number(img.getAttribute('width'));
      const h = Number(img.getAttribute('height'));
      if (w && h > w * 1.2) img.classList.add('is-tall');
      if (w && w < 420) img.classList.add('is-small');
      if (!box) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'zoom';
      btn.setAttribute('aria-label', `Enlarge image: ${img.alt || 'screenshot'}`);
      img.replaceWith(btn);
      btn.append(img);
      btn.addEventListener('click', () => {
        const big = box.querySelector('img');
        big.src = img.src;
        big.alt = img.alt;
        box.querySelector('figcaption').textContent = img.alt;
        box.showModal();
      });
    });
    if (box) box.addEventListener('click', (e) => { if (!e.target.closest('.lightbox-close')) box.close(); });
  }

  function buildToc(scope) {
    const heads = [...scope.querySelectorAll('h2[id], h3[id]')];
    document.querySelectorAll('[data-toc]').forEach((list) => {
      const wrap = list.closest('[data-toc-wrap]');
      if (!heads.length) { if (wrap) wrap.hidden = true; return; }
      list.innerHTML = heads.map((h) => `<li class="toc-${h.tagName.toLowerCase()}"><a href="#${h.id}">${esc(h.textContent)}</a></li>`).join('');
    });
    // The table of contents is open beside the post on wide screens and folded above it on narrow ones.
    const folds = document.querySelectorAll('details[data-toc-wrap]');
    const wide = matchMedia('(min-width: 1100px)');
    const sync = () => folds.forEach((d) => { d.open = wide.matches; });
    wide.addEventListener('change', sync);
    sync();
    if (!heads.length || !('IntersectionObserver' in window)) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        document.querySelectorAll('[data-toc] a').forEach((a) => {
          if (a.getAttribute('href') === `#${en.target.id}`) a.setAttribute('aria-current', 'location');
          else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '0px 0px -70% 0px' });
    heads.forEach((h) => obs.observe(h));
  }

  function initBackToTop() {
    document.querySelectorAll('[data-back-to-top]').forEach((b) => {
      const toggle = () => b.classList.toggle('is-visible', scrollY > innerHeight * 0.8);
      addEventListener('scroll', toggle, { passive: true });
      toggle();
      b.addEventListener('click', () => {
        const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
        scrollTo({ top: 0, behavior: still ? 'auto' : 'smooth' });
        const main = document.getElementById('main');
        if (main) main.focus({ preventScroll: true });
      });
    });
  }

  const listItem = (p) => `<li><a href="${linkFor(p)}"><span class="li-title">${esc(p.title)}</span><time class="li-date" datetime="${p.date}">${fmtDate(p.date)}</time></a></li>`;

  // Fills the data hooks every post page shares.
  function fillPost(post) {
    const $ = (sel) => document.querySelector(sel);
    document.title = `${post.title} | ${M.site.title}`;
    document.querySelectorAll('[data-topic-host]').forEach((el) => { el.dataset.topic = post.topic; });
    document.querySelectorAll('[data-post-title]').forEach((el) => { el.textContent = post.title; });
    document.querySelectorAll('[data-post-topic]').forEach((el) => { el.textContent = topicName(post.topic); });
    const date = $('[data-post-date]');
    date.textContent = fmtDate(post.date);
    date.dateTime = post.date;
    const upd = $('[data-post-updated]');
    if (post.updated && post.updated !== post.date) {
      const t = upd.querySelector('time');
      t.textContent = fmtDate(post.updated);
      t.dateTime = post.updated;
    } else upd.remove();
    const views = $('[data-post-views]');
    if (post.views) views.querySelector('[data-views-count]').textContent = fmtNum(post.views);
    else views.remove();
    $('[data-post-tags]').innerHTML = post.tags.map((t) => `<li><a href="#">${esc(t)}</a></li>`).join('');
    $('[data-post-body]').innerHTML = M.bodies[post.slug];
    const i = M.posts.indexOf(post);
    const side = (p, label) => (p
      ? `<span class="nav-label">${label}</span><a href="${linkFor(p)}">${esc(p.title)}</a>`
      : `<span class="nav-label">${label}</span><span class="nav-none">None yet</span>`);
    $('[data-newer]').innerHTML = side(M.posts[i - 1], 'Newer post');
    $('[data-older]').innerHTML = side(M.posts[i + 1], 'Older post');
    const rel = M.posts.filter((p) => p !== post && p.topic === post.topic && !p.locked).slice(0, 3);
    $('[data-related]').innerHTML = rel.length ? rel.map(listItem).join('') : `<li class="empty">No other ${esc(topicName(post.topic))} posts yet.</li>`;
    $('[data-recent]').innerHTML = M.posts.filter((p) => p !== post).slice(0, 5).map(listItem).join('');
  }

  function init(scope = document) {
    fillIcons(scope);
    setTheme(root.dataset.theme || 'light', false);
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-theme-toggle]')) setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark', true);
      const share = e.target.closest('[data-copy-link]');
      if (share) copyText(location.href, share, 'Link copied');
    });
    fillStats();
    initSearch();
    const body = scope.querySelector('[data-post-body]');
    if (body) { enhanceCode(body); enhanceImages(body); buildToc(body); }
    initBackToTop();
  }

  return { esc, fmtDate, fmtDay, fmtNum, topicName, linkFor, currentPost, topicCounts, icon, listItem, fillPost, init };
})();
