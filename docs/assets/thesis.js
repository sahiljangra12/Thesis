/* Page logic for the thesis study: animated scatter, profile map, profiles, transitions, associations. */
(function () {
  if (typeof THESIS === 'undefined') return;
  const P = THESIS.periods, CL = THESIS.clusters;
  const fmt = (v, n = 1) => (v == null ? 'n/a' : (+v).toLocaleString('en-US', { maximumFractionDigits: n, minimumFractionDigits: n }));
  const byIso = {};
  P.forEach(p => THESIS.rows[p].forEach(r => { (byIso[r.iso3] = byIso[r.iso3] || {})[p] = r; }));
  const onReveal = (el, fn) => {
    let done = false;
    const go = () => { if (!done) { done = true; fn(); } };
    if (el.classList.contains('in')) go(); else el.addEventListener('reveal', go, { once: true });
  };
  const segButtons = (host, onPick) => {
    host.innerHTML = P.map((p, k) => `<button aria-pressed="${k === P.length - 1}" data-p="${p}">${p}</button>`).join('');
    host.querySelectorAll('button').forEach(b => b.addEventListener('click', () => onPick(b.dataset.p)));
    return p => host.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.p === p)));
  };
  const legendHTML = () => Object.entries(CL).map(([k, c]) => `<span><i style="background:${c.color}"></i>${k} · ${c.label}</span>`).join('');
  const tipFor = (r, p) => `<b>${r.country}</b>${p} · ${r.cl ? r.cl + ' · ' + CL[r.cl].label : 'not grouped'}<br>PPI ${fmt(r.ppi)} · life expectancy ${fmt(r.life_exp)} years<br>GDP per person $${fmt(r.gdp, 0)} · ${r.region}`;

  // ------------------------------------------------------------- animated scatter
  (function scatter() {
    const svg = document.getElementById('scatter');
    if (!svg) return;
    const W = 980, H = 470, m = { l: 52, r: 18, t: 16, b: 42 };
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const x = v => m.l + v / 100 * (W - m.l - m.r), y = v => m.t + (1 - (v - 40) / (90 - 40)) * (H - m.t - m.b);
    const ax = svgEl('g', { class: 'axis' }, svg);
    for (let v = 0; v <= 100; v += 20) { svgEl('line', { x1: x(v), x2: x(v), y1: m.t, y2: H - m.b, stroke: 'rgba(255,255,255,.06)' }, ax); const t = svgEl('text', { x: x(v), y: H - m.b + 18, 'text-anchor': 'middle' }, ax); t.textContent = v; }
    for (let v = 40; v <= 90; v += 10) { svgEl('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), stroke: 'rgba(255,255,255,.06)' }, ax); const t = svgEl('text', { x: m.l - 8, y: y(v) + 4, 'text-anchor': 'end' }, ax); t.textContent = v; }
    const xl = svgEl('text', { x: W - m.r, y: H - 6, 'text-anchor': 'end' }, ax); xl.textContent = 'PLANETARY PRESSURE INDEX (0–100) →';
    const yl = svgEl('text', { x: m.l, y: m.t - 2 }, ax); yl.textContent = 'LIFE EXPECTANCY (YEARS)';
    const big = svgEl('text', { x: W - m.r - 6, y: m.t + 48, 'text-anchor': 'end', fill: 'rgba(255,255,255,.12)', 'font-family': 'Barlow Condensed', 'font-weight': 700, 'font-size': 64 }, svg);
    const g = svgEl('g', {}, svg);
    const isos = Object.keys(byIso).sort((a, b) => (byIso[b][P[0]]?.pop || 0) - (byIso[a][P[0]]?.pop || 0));
    const nodes = {};
    isos.forEach(iso => {
      const c = svgEl('circle', { r: 0, fill: '#888', 'fill-opacity': .78, stroke: '#000', 'stroke-width': .6, tabindex: 0 }, g);
      c.style.transition = 'cx 1s cubic-bezier(.2,.7,.1,1), cy 1s cubic-bezier(.2,.7,.1,1), r 1s, fill .8s';
      nodes[iso] = c;
      const show = e => { const r = byIso[iso][cur]; if (r) showTip(tipFor(r, cur), e.clientX || c.getBoundingClientRect().x, e.clientY || c.getBoundingClientRect().y); };
      c.addEventListener('pointerenter', show); c.addEventListener('focus', show);
      c.addEventListener('pointerleave', hideTip); c.addEventListener('blur', hideTip);
    });
    let cur = P[P.length - 1], timer = null;
    const mark = segButtons(document.getElementById('sc-periods'), p => { stop(); draw(p); });
    function draw(p) {
      cur = p; mark(p); big.textContent = p;
      for (const iso of isos) {
        const r = byIso[iso][p], c = nodes[iso];
        if (!r || r.ppi == null || r.life_exp == null) { c.setAttribute('r', 0); continue; }
        c.setAttribute('cx', x(r.ppi)); c.setAttribute('cy', y(r.life_exp));
        c.setAttribute('r', Math.max(2.5, Math.sqrt(r.pop || 0) / 1300));
        c.setAttribute('fill', r.cl ? CL[r.cl].color : '#666');
      }
    }
    const play = document.getElementById('sc-play');
    function stop() { clearInterval(timer); timer = null; play.textContent = '▶'; }
    play.addEventListener('click', () => {
      if (timer) return stop();
      let k = 0; draw(P[0]); play.textContent = '❚❚';
      timer = setInterval(() => { k++; if (k >= P.length) return stop(); draw(P[k]); }, 1700);
    });
    document.getElementById('sc-legend').innerHTML = legendHTML();
    // start collapsed at the centre, then animate into the first period, then play through
    isos.forEach(iso => { nodes[iso].setAttribute('cx', x(50)); nodes[iso].setAttribute('cy', y(65)); });
    onReveal(document.getElementById('scatterviz'), () => {
      if (prefersReducedMotion) return draw(cur);
      draw(P[0]); let k = 0; play.textContent = '❚❚';
      timer = setInterval(() => { k++; if (k >= P.length) return stop(); draw(P[k]); }, 1900);
    });
  })();

  // ------------------------------------------------------------- map
  (async function map() {
    const svg = document.getElementById('map');
    if (!svg) return;
    const world = await fetch('assets/world.json').then(r => r.json());
    let cur = P[P.length - 1], by = 'cl', timer = null;
    const ramp = v => { // PPI 10 → 70, dark blue → amber → red
      const t = Math.max(0, Math.min(1, (v - 10) / 60));
      const stops = [[22, 58, 110], [64, 140, 190], [240, 196, 90], [226, 73, 72]];
      const s = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(s)), f = s - i;
      const c = stops[i].map((a, k) => Math.round(a + (stops[i + 1][k] - a) * f));
      return `rgb(${c})`;
    };
    const m = WorldMap(svg, world, {
      include: iso => !!byIso[iso],
      tip: iso => { const r = byIso[iso] && byIso[iso][cur]; return r ? tipFor(r, cur) : null; }
    });
    const leg = document.getElementById('map-legend');
    function paint() {
      m.paint(iso => {
        const r = byIso[iso] && byIso[iso][cur];
        if (!r) return null;
        if (by === 'cl') return r.cl ? CL[r.cl].color : null;
        return r.ppi == null ? null : ramp(r.ppi);
      });
      leg.innerHTML = by === 'cl' ? legendHTML() + '<span><i style="background:#1a1d22"></i>Not grouped / no data</span>'
        : `<span style="display:flex;align-items:center;gap:10px">PPI 10 <i style="width:160px;height:10px;background:linear-gradient(90deg,${[10, 30, 50, 70].map(ramp).join(',')})"></i> 70+</span>`;
    }
    const mark = segButtons(document.getElementById('map-periods'), p => { stop(); cur = p; mark(p); paint(); });
    document.querySelectorAll('#mapviz [data-by]').forEach(b => b.addEventListener('click', () => {
      by = b.dataset.by; document.querySelectorAll('#mapviz [data-by]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); paint();
    }));
    const play = document.getElementById('map-play');
    function stop() { clearInterval(timer); timer = null; play.textContent = '▶'; }
    play.addEventListener('click', () => {
      if (timer) return stop();
      let k = 0; cur = P[0]; mark(cur); paint(); play.textContent = '❚❚';
      timer = setInterval(() => { k++; if (k >= P.length) return stop(); cur = P[k]; mark(cur); paint(); }, 1600);
    });
    paint();
  })();

  // ------------------------------------------------------------- profiles (pooled cluster centres from the thesis results)
  const CENTRES = {
    C1: { ppi: 30.4, le: 53.2, im: 87.2, urb: 31.2, gdp: '≈ $500' },
    C2: { ppi: 27.0, le: 64.8, im: 40.5, urb: 36.4, gdp: '≈ $1,250' },
    C3: { ppi: 36.8, le: 71.4, im: 19.6, urb: 60.4, gdp: '≈ $4,000' },
    C4: { ppi: 44.3, le: 78.3, im: 6.4, urb: 80.6, gdp: '≈ $25,000' }
  };
  const ph = document.getElementById('profiles');
  if (ph) {
    ph.innerHTML = Object.entries(CENTRES).map(([k, c], i) => `<div class="card" data-reveal style="--d:${i * 0.08}s"><span class="swatch" style="background:${CL[k].color}"></span><span class="num">${k}</span><h3>${CL[k].label}</h3>
      <dl class="kv"><dt>PPI</dt><dd>${c.ppi.toFixed(1)}</dd><dt>Life expectancy</dt><dd>${c.le.toFixed(1)} yrs</dd><dt>Infant mortality</dt><dd>${c.im.toFixed(1)} / 1,000</dd><dt>Urban population</dt><dd>${c.urb.toFixed(1)}%</dd><dt>GDP per person</dt><dd>${c.gdp}</dd></dl></div>`).join('');
    ph.querySelectorAll('[data-reveal]').forEach(observeReveal);
  }

  // ------------------------------------------------------------- transitions matrix
  const TR = [
    [[32, 20, 1, 0], [0, 19, 18, 0], [0, 1, 41, 9], [0, 0, 0, 35]],
    [[10, 21, 1, 0], [0, 23, 18, 0], [0, 0, 49, 13], [0, 0, 0, 44]]
  ];
  const tm = document.getElementById('trmat');
  function drawTR(t) {
    const M = TR[t], K = ['C1', 'C2', 'C3', 'C4'], mx = Math.max(...M.flat());
    let h = '<table class="matrix"><thead><tr><th></th>' + K.map(k => `<th style="color:${CL[k].color}">${k}</th>`).join('') + '</tr></thead><tbody>';
    M.forEach((row, i) => {
      h += `<tr><th style="color:${CL[K[i]].color}">${K[i]}</th>` + row.map((v, j) => {
        const a = v / mx, col = i === j ? '90,169,255' : (j > i ? '95,209,176' : '239,111,108');
        return `<td style="--a:${(0.08 + a * 0.75).toFixed(2)};--c:${col}" title="${K[i]} → ${K[j]}: ${v}"><span>${v}</span></td>`;
      }).join('') + '</tr>';
    });
    const stay = M.reduce((s, r, i) => s + r[i], 0), tot = M.flat().reduce((a, b) => a + b, 0);
    h += `</tbody></table><p class="viz-note">Blue diagonal: stayed (${Math.round(stay / tot * 100)}% of ${tot}). Green: moved to a more developed profile. Red: moved back.</p>`;
    tm.innerHTML = h;
  }
  if (tm) {
    drawTR(0);
    document.querySelectorAll('#tr-seg [data-t]').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('#tr-seg [data-t]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); drawTR(+b.dataset.t);
    }));
  }

  // ------------------------------------------------------------- associations slope chart (r by period)
  const R = [
    ['GDP per person (log)', [0.4164, 0.3679, 0.2231], '#8fd3ff'],
    ['Life expectancy', [0.4003, 0.3632, 0.2450], '#5fd1b0'],
    ['Urbanisation', [0.4592, 0.4204, 0.3071], '#ffffff'],
    ['Unemployment', [0.0340, 0.0013, 0.0154], '#6f7480'],
    ['Infant mortality', [-0.3575, -0.3150, -0.1604], '#ef6f6c'],
    ['Female labour participation', [-0.3447, -0.3650, -0.3372], '#f2c14e']
  ];
  const as = document.getElementById('assoc');
  if (as) {
    const W = 640, H = 380, m = { l: 40, r: 190, t: 20, b: 30 };
    as.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const x = k => m.l + k / 2 * (W - m.l - m.r), y = v => m.t + (1 - (v + 0.5) / 1.0) * (H - m.t - m.b);
    const ax = svgEl('g', { class: 'axis' }, as);
    [-0.4, -0.2, 0, 0.2, 0.4].forEach(v => { svgEl('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), stroke: v === 0 ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.06)' }, ax); const t = svgEl('text', { x: m.l - 8, y: y(v) + 4, 'text-anchor': 'end' }, ax); t.textContent = v.toFixed(1); });
    P.forEach((p, k) => { const t = svgEl('text', { x: x(k), y: H - 8, 'text-anchor': 'middle' }, ax); t.textContent = p; });
    const lab = [];
    R.forEach(([name, v, c]) => {
      const d = 'M' + v.map((r, k) => `${x(k)},${y(r)}`).join('L');
      const p = svgEl('path', { d, fill: 'none', stroke: c, 'stroke-width': 2.5, class: 'draw' }, as);
      p.style.setProperty('--len', 600);
      v.forEach((r, k) => { const dot = svgEl('circle', { cx: x(k), cy: y(r), r: 4, fill: c }, as); dot.addEventListener('pointerenter', e => showTip(`<b>${name}</b>${P[k]}: r = ${r.toFixed(2)}`, e.clientX, e.clientY)); dot.addEventListener('pointerleave', hideTip); });
      lab.push([y(v[2]), name, c]);
    });
    lab.sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < lab.length; i++) if (lab[i][0] - lab[i - 1][0] < 14) lab[i][0] = lab[i - 1][0] + 14;
    lab.forEach(([yy, name, c]) => { const t = svgEl('text', { x: x(2) + 12, y: yy + 4, fill: c, 'font-size': 12, 'font-family': 'Barlow' }, as); t.textContent = name; });
  }
})();
