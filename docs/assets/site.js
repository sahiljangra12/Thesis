/* Shared behaviour: nav, reveal-on-scroll, count-up numbers, parallax, lightbox, tooltip helper. */
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- nav: always fixed at the top; solid once scrolled; mobile menu ----------
  const nav = document.querySelector('.nav');
  if (nav) {
    addEventListener('scroll', () => {
      const y = scrollY;
      nav.classList.toggle('solid', y > 40);

    }, { passive: true });
    const b = nav.querySelector('.burger');
    if (b) {
      b.addEventListener('click', () => {
        const o = nav.classList.toggle('open');
        b.setAttribute('aria-expanded', String(o));
      });
      nav.querySelectorAll('ul a').forEach(a => a.addEventListener('click', () => {
        nav.classList.remove('open'); b.setAttribute('aria-expanded', 'false');
      }));
      addEventListener('keydown', e => { if (e.key === 'Escape') { nav.classList.remove('open'); b.setAttribute('aria-expanded', 'false'); } });
    }
    // highlight the current section
    const links = [...nav.querySelectorAll('ul a[href^="#"]')];
    const secs = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
    const so = new IntersectionObserver(es => {
      es.forEach(e => {
        if (e.isIntersecting) links.forEach(a => a.toggleAttribute('aria-current', a.getAttribute('href') === '#' + e.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    secs.forEach(s => so.observe(s));
  }

  // ---------- count-up ----------
  function countUp(el) {
    const to = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0), pre = el.dataset.pre || '', suf = el.dataset.suf || '';
    if (reduce || !isFinite(to)) { el.textContent = pre + to.toFixed(dec) + suf; return; }
    const from = parseFloat(el.dataset.from || 0), t0 = performance.now(), dur = +(el.dataset.dur || 1600);
    const step = t => {
      const k = Math.max(0, Math.min(1, (t - t0) / dur)), e = 1 - Math.pow(1 - k, 4);
      el.textContent = pre + (from + (to - from) * e).toFixed(dec) + suf;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ---------- reveal ----------
  const io = new IntersectionObserver(es => {
    es.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      e.target.querySelectorAll('[data-count]').forEach(countUp);
      if (e.target.matches('[data-count]')) countUp(e.target);
      e.target.dispatchEvent(new CustomEvent('reveal'));
      io.unobserve(e.target);
    });
  }, { threshold: 0.18 });
  document.querySelectorAll('[data-reveal],[data-count],.mask,.viz').forEach(el => io.observe(el));
  window.observeReveal = el => io.observe(el);

  // ---------- parallax backgrounds ----------
  const bgs = [...document.querySelectorAll('.scene .bg')];
  if (bgs.length && !reduce) {
    let ticking = false;
    const run = () => {
      ticking = false;
      for (const bg of bgs) {
        const r = bg.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) continue;
        const p = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
        bg.style.transform = `translate3d(0,${(p * -9).toFixed(2)}%,0) scale(1.04)`;
      }
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(run); } }, { passive: true });
    run();
  }

  // ---------- lightbox ----------
  const dlg = document.querySelector('dialog.lightbox');
  if (dlg) {
    const img = dlg.querySelector('img'), cap = dlg.querySelector('p');
    document.querySelectorAll('[data-zoom]').forEach(b => b.addEventListener('click', () => {
      img.src = b.dataset.zoom; img.alt = b.dataset.cap || ''; cap.textContent = b.dataset.cap || '';
      dlg.showModal();
    }));
    dlg.addEventListener('click', e => { if (e.target === dlg || e.target.matches('button')) dlg.close(); });
  }

  // ---------- tooltip helper ----------
  const tip = document.createElement('div');
  tip.className = 'tip'; tip.setAttribute('role', 'status'); document.body.appendChild(tip);
  window.showTip = (html, x, y) => {
    tip.innerHTML = html; tip.style.opacity = 1;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.min(innerWidth - w - 10, Math.max(10, x + 16)) + 'px';
    tip.style.top = Math.min(innerHeight - h - 10, Math.max(10, y - h - 12)) + 'px';
  };
  window.hideTip = () => { tip.style.opacity = 0; };

  // ---------- svg helpers ----------
  const NS = 'http://www.w3.org/2000/svg';
  window.svgEl = (tag, attrs, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  window.prefersReducedMotion = reduce;

  // =====================================================================
  // Explain: reading guides, live readouts, takeaways, annotations, glossary
  // =====================================================================
  const E = (window.Explain = {});
  // insert after the last header row or guide, so readouts sit right above the chart
  const after = (viz, el) => {
    const refs = viz.querySelectorAll(':scope > .viz-head, :scope > .guide');
    const ref = refs[refs.length - 1];
    if (ref) ref.after(el); else viz.prepend(el);
  };
  // "How to read" strip: items are short HTML strings
  E.guide = (viz, items) => {
    if (!viz) return null;
    const g = document.createElement('div');
    g.className = 'guide'; g.style.setProperty('--n', items.length);
    g.innerHTML = '<button type="button" class="gh" aria-expanded="false">How to read</button>' + items.map((t, i) => `<div class="gi"><b>${i + 1}</b><span>${t}</span></div>`).join('');
    const gb = g.querySelector('.gh');
    gb.addEventListener('click', () => { const o = g.classList.toggle('open'); gb.setAttribute('aria-expanded', String(o)); });
    const h = viz.querySelector(':scope > .viz-head');
    if (h) h.after(g); else viz.prepend(g);
    return g;
  };
  // telemetry readout: set([[label, value, sub, cls], ...])
  E.readout = viz => {
    const r = document.createElement('div');
    r.className = 'readout'; r.setAttribute('aria-live', 'polite');
    after(viz, r);
    let last = '';
    return {
      el: r,
      set(cells) {
        const html = cells.map(([k, v, sub, cls]) => `<div><span>${k}</span><b${cls ? ` class="${cls}"` : ''}>${v}</b>${sub ? `<small>${sub}</small>` : ''}</div>`).join('');
        if (html !== last) { r.innerHTML = html; last = html; }
      }
    };
  };
  // plain-language takeaway under the chart
  E.takeaway = (viz, label = 'What this shows') => {
    const t = document.createElement('div');
    t.className = 'takeaway';
    t.innerHTML = `<span>${label}</span><p></p>`;
    const leg = viz.querySelector(':scope > .legend');
    const svg = viz.querySelector(':scope > .svgwrap, :scope > svg, :scope > .fp, :scope > .pf-grid');
    (leg || svg) ? (leg || svg).after(t) : viz.appendChild(t);
    const p = t.querySelector('p');
    let cur = '', timer = null;
    return {
      el: t,
      set(html) {
        if (html === cur) return;
        cur = html;
        if (reduce || !p.innerHTML) { p.innerHTML = html; return; }
        clearTimeout(timer); p.classList.add('swap');
        timer = setTimeout(() => { p.innerHTML = cur; p.classList.remove('swap'); }, 160);
      }
    };
  };
  // annotation: ring at (x, y), leader to (tx, ty), multi-line label; fades in after `delay` ms
  E.annotate = (parent, o) => {
    const col = o.color || '#fff', g = svgEl('g', { class: 'annot' + (o.cls ? ' ' + o.cls : '') }, parent);
    const tx = o.tx ?? o.x, ty = o.ty ?? o.y;
    if (o.ring !== false && o.x != null) svgEl('circle', { cx: o.x, cy: o.y, r: o.r || 6, stroke: col }, g);
    if (o.x != null && (tx !== o.x || ty !== o.y)) {
      const ex = tx + (o.anchor === 'end' ? 4 : o.anchor === 'middle' ? 0 : -4);
      svgEl('polyline', { points: `${o.x},${o.y} ${o.elbow ? `${o.x},${ty} ` : ''}${ex},${ty}`, stroke: col, 'stroke-opacity': .65 }, g);
    }
    const lines = [].concat(o.text), lh = 14;
    const bg = svgEl('rect', { class: 'bg' }, g);
    const tg = svgEl('g', {}, g);
    lines.forEach((l, i) => {
      const t = svgEl('text', { x: tx, y: ty + 4 + (i - (lines.length - 1) / 2) * lh, 'text-anchor': o.anchor || 'start', fill: i === 0 ? col : (o.sub || '#c7cbd3') }, tg);
      t.textContent = l;
    });
    try { const b = tg.getBBox(); bg.setAttribute('x', b.x - 5); bg.setAttribute('y', b.y - 3); bg.setAttribute('width', b.width + 10); bg.setAttribute('height', b.height + 6); } catch (e) { /* not rendered yet */ }
    const on = () => g.classList.add('on');
    if (reduce || !o.delay) requestAnimationFrame(on); else setTimeout(on, o.delay);
    return g;
  };
  // number helpers shared by the pages
  E.fmt = (v, n = 1) => (v == null || !isFinite(v) ? 'n/a' : (+v).toLocaleString('en-US', { minimumFractionDigits: n, maximumFractionDigits: n }));
  E.strength = r => { const a = Math.abs(r); return a < 0.1 ? 'almost no' : a < 0.3 ? 'a weak' : a < 0.5 ? 'a moderate' : a < 0.7 ? 'a strong' : 'a very strong'; };
  // glossary: hover, focus or tap any [data-term]
  const termTip = el => {
    const G = window.GLOSSARY || {}, d = G[el.dataset.term]; if (!d) return;
    const r = el.getBoundingClientRect();
    window.showTip(`<span class="def-k">${d[0]}</span>${d[1]}`, r.left, r.top);
  };
  document.addEventListener('pointerover', e => { const t = e.target.closest && e.target.closest('[data-term]'); if (t) termTip(t); });
  document.addEventListener('pointerout', e => { if (e.target.closest && e.target.closest('[data-term]')) window.hideTip(); });
  document.addEventListener('focusin', e => { const t = e.target.closest && e.target.closest('[data-term]'); if (t) termTip(t); });
  document.addEventListener('focusout', e => { if (e.target.closest && e.target.closest('[data-term]')) window.hideTip(); });
  E.terms = () => document.querySelectorAll('[data-term]').forEach(t => { t.classList.add('term'); if (!t.hasAttribute('tabindex')) t.tabIndex = 0; });
  E.glossary = host => {
    if (!host) return;
    const G = window.GLOSSARY || {};
    host.innerHTML = Object.values(G).sort((a, b) => a[0].localeCompare(b[0])).map(([k, d]) => `<div><dt>${k}</dt><dd>${d}</dd></div>`).join('');
  };
  // charts keep a readable width on phones: wrap them so they can scroll sideways
  document.querySelectorAll('.viz > svg:not(#map)').forEach(svg => {
    const w = document.createElement('div'); w.className = 'svgwrap';
    svg.before(w); w.appendChild(svg);
  });
  // figure numbers on every chart title, in page order
  let fig = 0;
  document.querySelectorAll('.viz > .viz-head .viz-title').forEach(t => {
    fig++; t.insertAdjacentHTML('afterbegin', `<span class="fig">FIG ${String(fig).padStart(2, '0')}</span>`);
  });
  // scroll progress line
  const bar = document.createElement('div');
  bar.className = 'progress'; bar.setAttribute('aria-hidden', 'true'); document.body.appendChild(bar);
  const prog = () => { const h = document.documentElement.scrollHeight - innerHeight; bar.style.transform = `scaleX(${h > 0 ? Math.min(1, scrollY / h) : 0})`; };
  addEventListener('scroll', prog, { passive: true }); prog();
})();
