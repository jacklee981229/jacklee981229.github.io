// Direction A: builds the commit graph of post cards, the topic legend, and the mockup-only options panel.
(() => {
  const M = window.MOCK;
  const U = window.MOCKUI;
  const root = document.documentElement;
  const PER_PAGE = 10;
  const BREAK_DAYS = 60;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const TOPIC_ICON = { hexo: 'code', git: 'branch', chatgpt: 'sparkles', games: 'gamepad', flutter: 'phone' };

  const dayNumber = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000; };
  const breakLabel = (days) => {
    const months = Math.round(days / 30.44);
    return months < 24 ? `${months}-month break` : `${Math.round(months / 12)}-year break`;
  };

  // Each topic's lane runs from its newest post to its oldest, by index in the newest-first list.
  const spans = Object.fromEntries(M.topics.map((t) => {
    const idx = M.posts.flatMap((p, i) => (p.topic === t.id ? [i] : []));
    return [t.id, idx.length ? { newest: idx[0], oldest: idx[idx.length - 1] } : null];
  }));

  // `pass` draws a row with no post of its own (a year or a break): lanes only run straight through it.
  function graph(i, topic, pass) {
    let html = '';
    M.topics.forEach((t, x) => {
      const s = spans[t.id];
      if (!s) return;
      const cls = `lane-${t.id}`;
      const passesAbove = i > s.newest && i <= s.oldest;
      if (pass) {
        if (passesAbove) html += `<span class="seg ${pass} ${cls}" style="--x:${x}"></span>`;
        return;
      }
      if (passesAbove) html += `<span class="seg top ${cls}" style="--x:${x}"></span>`;
      if (i >= s.newest && i < s.oldest) html += `<span class="seg bottom ${cls}" style="--x:${x}"></span>`;
      if (topic === t.id) html += `<span class="link ${cls}" style="--x:${x}"></span><span class="node ${cls}" style="--x:${x}"></span>`;
    });
    return `<div class="graph" aria-hidden="true">${html}</div>`;
  }

  // A cover shows the post's image if it has one, otherwise the topic's icon, with the topic name large and faint behind.
  function cover(p, cls) {
    let art = U.icon(TOPIC_ICON[p.topic] || 'file', 'cover-icon');
    if (p.locked) art = U.icon('lock', 'cover-icon');
    else if (p.cover) art = `<img src="${p.cover.src}" alt="" width="${p.cover.w}" height="${p.cover.h}" loading="lazy" decoding="async"${p.cover.h > p.cover.w ? ' class="is-tall"' : ''}>`;
    return `<div class="${cls}" aria-hidden="true"><span class="cover-word">${U.esc(U.topicName(p.topic))}</span>${art}</div>`;
  }

  function card(p) {
    const lock = p.locked ? `<span class="card-lock">${U.icon('lock')}Password required</span>` : '';
    const tags = p.tags.length ? `<ul class="card-tags" aria-label="Tags">${p.tags.map((t) => `<li>${U.esc(t)}</li>`).join('')}</ul>` : '<span></span>';
    return `<article class="card">${cover(p, 'cover')}<div class="card-body">`
      + `<p class="card-topic">${U.esc(U.topicName(p.topic))}${lock}</p>`
      + `<h3 class="card-title"><a href="${U.linkFor(p)}">${U.esc(p.title)}</a></h3>`
      + (p.excerpt ? `<p class="card-excerpt">${U.esc(p.excerpt)}</p>` : '')
      + `<div class="card-foot">${tags}<time datetime="${p.date}">${U.fmtDate(p.date)}</time></div>`
      + '</div></article>';
  }

  // The timeline details: the year, the month beside the first post of each month, and a marker where posts are far apart.
  function renderLog() {
    const rows = M.posts.slice(0, PER_PAGE);
    let html = '';
    rows.forEach((p, i) => {
      const prev = rows[i - 1];
      const gap = prev ? dayNumber(prev.date) - dayNumber(p.date) : 0;
      if (gap >= BREAK_DAYS) {
        html += `<li class="break-row" style="--row:${i}">${graph(i, null, 'dash')}<p class="break-label">${breakLabel(gap)}</p></li>`;
      }
      if (!prev || prev.date.slice(0, 4) !== p.date.slice(0, 4)) {
        html += `<li class="year-row" style="--row:${i}">${graph(i, null, 'full')}<p class="year">${p.date.slice(0, 4)}</p></li>`;
      }
      const month = !prev || prev.date.slice(0, 7) !== p.date.slice(0, 7) ? MONTHS[Number(p.date.slice(5, 7)) - 1] : '';
      html += `<li class="commit" data-topic="${p.topic}" style="--row:${i}">`
        + `<div class="ruler" aria-hidden="true">${month ? `<span class="month">${month}</span>` : ''}</div>`
        + `${graph(i, p.topic)}${card(p)}</li>`;
    });
    document.querySelector('[data-log]').innerHTML = html;
  }

  // Pointing at a topic in the legend lights up its lane and dims the rest.
  function renderLegend() {
    const log = document.querySelector('[data-log]');
    const legend = document.querySelector('[data-legend]');
    legend.innerHTML = U.topicCounts().map((t) => `<li><a href="#" class="lane-${t.id}" data-lane="${t.id}"><span class="dot"></span>${U.esc(t.name)} <span class="count">${t.count}</span></a></li>`).join('');
    const focus = (el) => {
      const lane = el && el.closest('[data-lane]');
      if (lane) log.dataset.focus = lane.dataset.lane;
      else delete log.dataset.focus;
    };
    legend.addEventListener('pointerover', (e) => focus(e.target));
    legend.addEventListener('pointerleave', () => focus(null));
    legend.addEventListener('focusin', (e) => focus(e.target));
    legend.addEventListener('focusout', () => focus(null));
  }

  function renderPostExtras(post) {
    document.querySelector('[data-post-cover]').outerHTML = cover(post, 'cover post-cover');
    const related = M.posts.filter((p) => p !== post && p.topic === post.topic && !p.locked).slice(0, 3);
    document.querySelector('[data-related]').innerHTML = related.length
      ? related.map((p) => `<li class="mini" data-topic="${p.topic}">${cover(p, 'cover mini-cover')}<div><a class="mini-title" href="${U.linkFor(p)}">${U.esc(p.title)}</a><time datetime="${p.date}">${U.fmtDate(p.date)}</time></div></li>`).join('')
      : `<li class="empty">No other ${U.esc(U.topicName(post.topic))} posts yet.</li>`;
  }

  // Mockup-only panel for trying fonts and card styles. The real site ships only the font you pick.
  const FONTS = [
    { id: 'schibsted', name: 'Schibsted Grotesk', family: 'Schibsted Grotesk', note: 'Your pick. Newsroom grotesk.' },
    { id: 'mona', name: 'Mona Sans', family: 'Mona Sans', note: 'GitHub’s own typeface. Fits the commit graph.' },
    { id: 'bricolage', name: 'Bricolage Grotesque', family: 'Bricolage Grotesque', note: 'Quirky, with a lot of character.' },
    { id: 'geist', name: 'Geist', family: 'Geist', note: 'Clean and sharp. Made for developer sites.' },
    { id: 'unbounded', name: 'Unbounded + Onest', family: 'Unbounded', note: 'Wide, loud titles over calm body text.' },
    { id: 'funnel', name: 'Funnel Display + Funnel Sans', family: 'Funnel Display', note: 'Soft, rounded and friendly.' },
  ];
  const CARDS = [
    { id: 'top', name: 'Cover on top', note: 'Like your example: a big picture, then the text.' },
    { id: 'side', name: 'Cover on the side', note: 'Your pick. Shorter cards, so more posts fit on screen.' },
  ];

  function store(key, value) {
    try { localStorage.setItem(key, value); } catch { /* private mode: the pick lasts until reload */ }
  }

  function renderOptions() {
    const radios = (name, list, current) => list.map((o) => `<label class="opt"><input type="radio" name="${name}" value="${o.id}"${o.id === current ? ' checked' : ''}>`
      + `<span class="opt-text"><span class="opt-name"${o.family ? ` style="font-family:'${o.family}', system-ui, sans-serif"` : ''}>${U.esc(o.name)}</span>`
      + `<span class="opt-note">${U.esc(o.note)}</span></span></label>`).join('');
    const wrap = document.createElement('div');
    wrap.className = 'tryout';
    wrap.innerHTML = `<button type="button" class="tryout-btn" aria-expanded="false" aria-controls="tryout-panel">${U.icon('sliders')}Try fonts and cards</button>`
      + '<div id="tryout-panel" class="tryout-panel" role="group" aria-label="Mockup options" hidden>'
      + '<p class="tryout-note">Mockup only. Your picks are saved in this browser and apply to every page.</p>'
      + `<fieldset><legend>Font</legend>${radios('font', FONTS, root.dataset.font)}</fieldset>`
      + `<fieldset><legend>Cards</legend>${radios('cards', CARDS, root.dataset.cards)}</fieldset></div>`;
    document.body.append(wrap);
    const button = wrap.querySelector('.tryout-btn');
    const panel = wrap.querySelector('.tryout-panel');
    const toggle = (open) => {
      panel.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
    };
    button.addEventListener('click', () => toggle(panel.hidden));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !panel.hidden) {
        toggle(false);
        button.focus();
      }
    });
    panel.addEventListener('change', (e) => {
      const { name, value } = e.target;
      root.dataset[name] = value;
      store(`jacks-space-${name}`, value);
    });
  }

  if (document.body.dataset.page === 'home') {
    renderLog();
    renderLegend();
  } else {
    const post = U.currentPost();
    U.fillPost(post);
    renderPostExtras(post);
  }
  document.querySelectorAll('[data-intro]').forEach((el) => { el.textContent = M.site.intro; });
  document.querySelectorAll('[data-tags]').forEach((ul) => { ul.innerHTML = M.site.tags.map((t) => `<li><a href="#">${U.esc(t)}</a></li>`).join(''); });
  renderOptions();
  U.init(document);
})();
