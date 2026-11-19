/* Shared behaviour: nav, reveal-on-scroll, count-up numbers, parallax, lightbox, tooltip helper. */
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- nav: always fixed at the top; solid once scrolled; mobile menu ----------
  const nav = document.querySelector('.nav');
  if (nav) {
    let last = scrollY;
    addEventListener('scroll', () => {
      const y = scrollY;
      nav.classList.toggle('solid', y > 40);
      last = y;
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
})();
