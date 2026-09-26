// Direction B: builds the explorer tree, the home post list and the phone drawer from the shared data.
(() => {
  const M = window.MOCK;
  const U = window.MOCKUI;
  const PER_PAGE = 10;
  const isPost = document.body.dataset.page === 'post';
  const active = isPost ? U.currentPost() : null;

  function summaryOf(p) {
    if (p.locked) return `<p class="locked">${U.icon('lock')}Password required</p>`;
    return p.excerpt ? `<p class="excerpt">${U.esc(p.excerpt)}</p>` : '';
  }

  function renderTree() {
    document.querySelector('[data-tree]').innerHTML = U.topicCounts().map((t) => {
      const items = M.posts.filter((p) => p.topic === t.id).map((p) => {
        const current = p === active ? ' aria-current="page"' : '';
        const lock = p.locked ? `${U.icon('lock', 'i lock')}<span class="visually-hidden">(password required)</span>` : '';
        return `<li><a href="${U.linkFor(p)}"${current}>${U.icon('file')}<span class="name">${U.esc(p.title)}</span>${lock}</a></li>`;
      }).join('');
      return `<details open><summary>${U.icon('chevron', 'i chev')}${U.icon('folder')}<span class="name">${U.esc(t.name)}</span><span class="count">${t.count}</span></summary><ul>${items}</ul></details>`;
    }).join('');
  }

  function renderList() {
    document.querySelector('[data-post-list]').innerHTML = M.posts.slice(0, PER_PAGE).map((p) => `<li>`
      + `<time datetime="${p.date}">${U.fmtDate(p.date)}</time>`
      + `<div><h3 class="title"><a href="${U.linkFor(p)}">${U.esc(p.title)}</a></h3>${summaryOf(p)}`
      + `<p class="where">${U.icon('folder')}${U.esc(U.topicName(p.topic))}</p></div></li>`).join('');
  }

  // On phones the explorer slides in as a drawer.
  function initDrawer() {
    const app = document.querySelector('.app');
    const button = document.querySelector('[data-drawer-toggle]');
    const scrim = document.querySelector('[data-drawer-close]');
    const explorer = document.getElementById('explorer');
    const set = (open) => {
      app.dataset.drawer = open ? 'open' : 'closed';
      button.setAttribute('aria-expanded', String(open));
      scrim.hidden = !open;
      if (open) explorer.querySelector('summary, a').focus();
      else button.focus();
    };
    button.addEventListener('click', () => set(app.dataset.drawer !== 'open'));
    scrim.addEventListener('click', () => set(false));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && app.dataset.drawer === 'open') set(false);
    });
  }

  renderTree();
  if (isPost) U.fillPost(active);
  else renderList();
  document.querySelectorAll('[data-intro]').forEach((el) => { el.textContent = M.site.intro; });
  document.querySelectorAll('[data-tags]').forEach((ul) => { ul.innerHTML = M.site.tags.map((t) => `<li><a href="#">${U.esc(t)}</a></li>`).join(''); });
  initDrawer();
  U.init(document);
})();
