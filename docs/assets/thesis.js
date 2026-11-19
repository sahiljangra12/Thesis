/* Thesis site ("Terra"): plates, findings, beeswarm, scatter, fingerprints, profiles, alluvial, associations, K, map. */
(async function () {
  if (typeof THESIS === 'undefined') return;
  const X = await fetch('data/thesis-extra.json?v=20261119').then(r => r.json());
  const P = THESIS.periods, CL = THESIS.clusters, K = ['C1', 'C2', 'C3', 'C4'];
  const A = THESIS_ANNUAL, COL = Object.fromEntries(A.columns.map((c, i) => [c, i]));
  const fmt = (v, n = 1) => (v == null || !isFinite(v) ? 'n/a' : (+v).toLocaleString('en-US', { maximumFractionDigits: n, minimumFractionDigits: n }));
  const byIso = {};
  P.forEach(p => THESIS.rows[p].forEach(r => { (byIso[r.iso3] = byIso[r.iso3] || {})[p] = r; }));
  const nameOf = iso => (byIso[iso] && Object.values(byIso[iso])[0].country) || iso;
  const onReveal = (el, fn) => {
    let done = false;
    const go = () => { if (!done) { done = true; fn(); } };
    if (el.classList.contains('in')) go(); else el.addEventListener('reveal', go, { once: true });
  };
  const legendHTML = () => K.map(k => `<span><i style="background:${CL[k].color};border-radius:50%"></i>${k} · ${CL[k].label}</span>`).join('');
  const tipFor = (r, p) => `<b>${r.country}</b>${p} · ${r.cl ? r.cl + ' · ' + CL[r.cl].label : 'not grouped'}<br>PPI ${fmt(r.ppi)} · life expectancy ${fmt(r.life_exp)} years<br>GDP per person $${fmt(r.gdp, 0)} · ${r.region}`;

  // ---------- period means of the annual indicators (2011–2023) for plates and fingerprints
  const IND = [
    ['renewable_energy', 'Renewable energy share', '%', true],
    ['forest_pct', 'Forest cover', '% of land', true],
    ['agri_land', 'Agricultural land', '% of land', false],
    ['fertilizer', 'Fertiliser use', 'kg/ha', false],
    ['pm25', 'PM2.5 exposure', 'µg/m³', false],
    ['energy_use_pc', 'Energy use per person', 'kgoe', false]
  ];
  const mean = {};
  for (const r of A.rows) {
    const y = r[COL.year]; if (y < 2011 || y > 2023) continue;
    const m = (mean[r[COL.iso3]] = mean[r[COL.iso3]] || {});
    for (const [k] of IND) { const v = r[COL[k]]; if (v == null) continue; (m[k] = m[k] || []).push(v); }
  }
  for (const iso in mean) for (const k in mean[iso]) { const a = mean[iso][k]; mean[iso][k] = a.reduce((s, v) => s + v, 0) / a.length; }
  // pressure percentile per indicator (reversed indicators: less = more pressure)
  const pct = {};
  for (const [k, , , rev] of IND) {
    const list = Object.keys(mean).filter(i => mean[i][k] != null && byIso[i]).map(i => [i, rev ? -mean[i][k] : mean[i][k]]).sort((a, b) => a[1] - b[1]);
    list.forEach(([i], j) => { (pct[i] = pct[i] || {})[k] = list.length > 1 ? j / (list.length - 1) * 100 : 50; });
  }

  // ---------- plates
  document.querySelectorAll('[data-ind]').forEach(b => {
    const [iso, k, unit] = b.dataset.ind.split(':');
    const v = mean[iso] && mean[iso][k];
    b.textContent = v == null ? 'n/a' : fmt(v, v >= 100 ? 0 : 1) + (unit.startsWith('%') ? '%' : unit);
  });

  // ---------- findings from the result tables
  const reg = X.regressions, le = reg.filter(r => r.outcome.startsWith('Life expectancy'));
  const r0 = le.find(r => r.period === P[0]).r, r2 = le.find(r => r.period === P[2]).r;
  document.getElementById('f-r').innerHTML = `${r0.toFixed(2)} → ${r2.toFixed(2)}`;
  document.getElementById('f-ppi').textContent = X.summary.map(s => (+s.mean_ppi).toFixed(1)).join(' · ');
  document.getElementById('f-sil').textContent = X.k.find(k => k.k === 4).sil.toFixed(2);

  // ---------- beeswarm of PPI by period
  (function swarm() {
    const svg = document.getElementById('swarm'); if (!svg) return;
    const W = 1100, rowH = 150, m = { l: 110, r: 20, t: 20, b: 36 }, H = m.t + m.b + rowH * P.length;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const x = v => m.l + v / 100 * (W - m.l - m.r);
    const ax = svgEl('g', { class: 'axis' }, svg);
    for (let v = 0; v <= 100; v += 10) { svgEl('line', { x1: x(v), x2: x(v), y1: m.t, y2: H - m.b, stroke: 'rgba(29,31,26,.07)' }, ax); const t = svgEl('text', { x: x(v), y: H - 12, 'text-anchor': 'middle' }, ax); t.textContent = v; }
    const r = 4.4, dots = [];
    P.forEach((p, k) => {
      const cy = m.t + rowH * k + rowH / 2;
      const lab = svgEl('text', { x: 0, y: cy + 5, fill: '#1d1f1a', 'font-family': 'Fraunces', 'font-size': 20 }, svg); lab.textContent = p;
      const rows = THESIS.rows[p].filter(d => d.ppi != null).sort((a, b) => a.ppi - b.ppi);
      const placed = [];
      rows.forEach(d => {
        const px = x(d.ppi); let best = cy;
        for (let j = 0; j < 30; j++) {
          let ok = false;
          for (const s of j ? [1, -1] : [1]) {
            const yy = cy + s * j * r * 0.95;
            if (placed.every(q => (q[0] - px) ** 2 + (q[1] - yy) ** 2 >= (2 * r + .6) ** 2)) { best = yy; ok = true; break; }
          }
          if (ok) break;
        }
        placed.push([px, best]);
        const c = svgEl('circle', { cx: px, cy, r, fill: d.cl ? CL[d.cl].color : '#999', 'fill-opacity': .9, tabindex: 0 }, svg);
        c.dataset.y = best; c.style.transition = `cy 1s cubic-bezier(.2,.8,.2,1) ${Math.random() * 0.5}s`;
        const show = e => showTip(tipFor(d, p), e.clientX || px, e.clientY || best);
        c.addEventListener('pointerenter', show); c.addEventListener('focus', show); c.addEventListener('pointerleave', hideTip); c.addEventListener('blur', hideTip);
        dots.push(c);
      });
      const mu = +X.summary[k].mean_ppi;
      svgEl('line', { x1: x(mu), x2: x(mu), y1: cy - rowH / 2 + 10, y2: cy + rowH / 2 - 10, stroke: '#1d1f1a', 'stroke-width': 2 }, svg);
      const mt = svgEl('text', { x: x(mu) + 6, y: cy - rowH / 2 + 22, fill: '#1d1f1a', 'font-family': 'Barlow', 'font-size': 12, 'font-weight': 600 }, svg); mt.textContent = `mean ${mu.toFixed(1)}`;
    });
    const t = svgEl('text', { x: W - m.r, y: H - 12 - 16, 'text-anchor': 'end', class: 'axis' }, svg);
    document.getElementById('swarm-legend').innerHTML = legendHTML();
    onReveal(document.getElementById('swarmviz'), () => requestAnimationFrame(() => requestAnimationFrame(() => dots.forEach(c => c.setAttribute('cy', c.dataset.y)))));
  })();

  // ---------- animated scatter
  (function scatter() {
    const svg = document.getElementById('scatter'); if (!svg) return;
    const W = 1100, H = 500, m = { l: 52, r: 18, t: 16, b: 42 };
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const x = v => m.l + v / 100 * (W - m.l - m.r), y = v => m.t + (1 - (v - 40) / (90 - 40)) * (H - m.t - m.b);
    const ax = svgEl('g', { class: 'axis' }, svg);
    for (let v = 0; v <= 100; v += 20) { svgEl('line', { x1: x(v), x2: x(v), y1: m.t, y2: H - m.b, stroke: 'rgba(29,31,26,.07)' }, ax); const t = svgEl('text', { x: x(v), y: H - m.b + 18, 'text-anchor': 'middle' }, ax); t.textContent = v; }
    for (let v = 40; v <= 90; v += 10) { svgEl('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), stroke: 'rgba(29,31,26,.07)' }, ax); const t = svgEl('text', { x: m.l - 8, y: y(v) + 4, 'text-anchor': 'end' }, ax); t.textContent = v; }
    const xl = svgEl('text', { x: W - m.r, y: H - 6, 'text-anchor': 'end' }, ax); xl.textContent = 'PLANETARY PRESSURE INDEX →';
    const yl = svgEl('text', { x: m.l, y: m.t - 2 }, ax); yl.textContent = 'LIFE EXPECTANCY (YEARS)';
    const big = svgEl('text', { x: W - m.r - 6, y: m.t + 64, 'text-anchor': 'end', fill: 'rgba(29,31,26,.1)', 'font-family': 'Fraunces', 'font-size': 76 }, svg);
    const g = svgEl('g', {}, svg);
    const isos = Object.keys(byIso).sort((a, b) => (byIso[b][P[0]]?.pop || 0) - (byIso[a][P[0]]?.pop || 0));
    const nodes = {}; let cur = P[2], timer = null;
    isos.forEach(iso => {
      const c = svgEl('circle', { r: 0, cx: x(50), cy: y(65), 'fill-opacity': .82, stroke: '#fbf8f2', 'stroke-width': .8, tabindex: 0 }, g);
      c.style.transition = 'cx 1.1s cubic-bezier(.2,.7,.1,1), cy 1.1s cubic-bezier(.2,.7,.1,1), r 1s, fill .8s';
      const show = e => { const r = byIso[iso][cur]; if (r) showTip(tipFor(r, cur), e.clientX || c.getBoundingClientRect().x, e.clientY || c.getBoundingClientRect().y); };
      c.addEventListener('pointerenter', show); c.addEventListener('focus', show); c.addEventListener('pointerleave', hideTip); c.addEventListener('blur', hideTip);
      nodes[iso] = c;
    });
    const seg = document.getElementById('sc-periods');
    seg.innerHTML = P.map(p => `<button aria-pressed="${p === cur}" data-p="${p}">${p}</button>`).join('');
    seg.addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (b) { stop(); draw(b.dataset.p); } });
    function draw(p) {
      cur = p; big.textContent = p;
      seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.p === p)));
      for (const iso of isos) {
        const r = byIso[iso][p], c = nodes[iso];
        if (!r || r.ppi == null || r.life_exp == null) { c.setAttribute('r', 0); continue; }
        c.setAttribute('cx', x(r.ppi)); c.setAttribute('cy', y(r.life_exp));
        c.setAttribute('r', Math.max(2.5, Math.sqrt(r.pop || 0) / 1300));
        c.setAttribute('fill', r.cl ? CL[r.cl].color : '#999');
      }
    }
    const play = document.getElementById('sc-play');
    function stop() { clearInterval(timer); timer = null; play.textContent = '▶'; }
    function run() { let k = 0; draw(P[0]); play.textContent = '❚❚'; timer = setInterval(() => { k++; if (k >= P.length) return stop(); draw(P[k]); }, 1800); }
    play.addEventListener('click', () => (timer ? stop() : run()));
    document.getElementById('sc-legend').innerHTML = legendHTML();
    onReveal(document.getElementById('scatterviz'), () => (prefersReducedMotion ? draw(cur) : run()));
  })();

  // ---------- fingerprints (petal chart)
  (function fingerprint() {
    const svg = document.getElementById('fp-svg'); if (!svg) return;
    const S = 460, c = S / 2, R = 172, r0 = 30;
    svg.setAttribute('viewBox', `-70 -10 ${S + 140} ${S + 20}`);
    [25, 50, 75, 100].forEach(v => svgEl('circle', { cx: c, cy: c, r: r0 + (R - r0) * v / 100, fill: 'none', stroke: v === 50 ? 'rgba(29,31,26,.35)' : 'rgba(29,31,26,.1)', 'stroke-dasharray': v === 50 ? '3 4' : '' }, svg));
    const n = IND.length, ang = k => -Math.PI / 2 + k * 2 * Math.PI / n;
    IND.forEach(([, lab], k) => {
      const a = ang(k), lx = c + Math.cos(a) * (R + 22), ly = c + Math.sin(a) * (R + 22);
      svgEl('line', { x1: c + Math.cos(a) * r0, y1: c + Math.sin(a) * r0, x2: c + Math.cos(a) * R, y2: c + Math.sin(a) * R, stroke: 'rgba(29,31,26,.1)' }, svg);
      const t = svgEl('text', { x: lx, y: ly + 4, 'text-anchor': Math.abs(Math.cos(a)) < .2 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end', fill: '#55594f', 'font-family': 'Barlow', 'font-size': 11, 'font-weight': 600, 'letter-spacing': '.06em' }, svg);
      t.textContent = lab.replace(' per person', '').replace(' share', '').toUpperCase();
    });
    const hub = svgEl('circle', { cx: c, cy: c, r: r0 + 2, fill: '#fbf8f2', stroke: 'rgba(29,31,26,.25)' }, svg);
    const mid = svgEl('text', { x: c, y: c + 5, 'text-anchor': 'middle', fill: '#1d1f1a', 'font-family': 'Fraunces', 'font-size': 15 }, svg);
    const gB = svgEl('g', {}, svg), gA = svgEl('g', {}, svg);
    const petal = (k, v) => {
      const a = ang(k), w = Math.PI / n * 0.82, rr = r0 + (R - r0) * v / 100;
      const p1 = [c + Math.cos(a - w) * r0, c + Math.sin(a - w) * r0], p2 = [c + Math.cos(a + w) * r0, c + Math.sin(a + w) * r0];
      const tip = [c + Math.cos(a) * rr, c + Math.sin(a) * rr];
      const c1 = [c + Math.cos(a - w) * rr * 0.92, c + Math.sin(a - w) * rr * 0.92], c2 = [c + Math.cos(a + w) * rr * 0.92, c + Math.sin(a + w) * rr * 0.92];
      return `M${p1}Q${c1} ${tip}Q${c2} ${p2}Z`;
    };
    const shapes = (g, fill, stroke, op) => IND.map((_, k) => { const p = svgEl('path', { d: petal(k, 0), fill, 'fill-opacity': op, stroke, 'stroke-width': 1.4 }, g); p.style.transition = 'd .9s cubic-bezier(.2,.7,.1,1)'; return p; });
    const pa = shapes(gA, '#2f6b4f', '#1f4a36', .55), pb = shapes(gB, 'none', '#b5762a', 1);
    pb.forEach(p => p.setAttribute('stroke-dasharray', '4 3'));
    const isos = Object.keys(pct).filter(i => byIso[i]).sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
    const sa = document.getElementById('fp-a'), sb = document.getElementById('fp-b');
    sa.innerHTML = isos.map(i => `<option value="${i}"${i === 'IND' ? ' selected' : ''}>${nameOf(i)}</option>`).join('');
    sb.innerHTML = '<option value="">No comparison</option>' + isos.map(i => `<option value="${i}"${i === 'USA' ? ' selected' : ''}>${nameOf(i)}</option>`).join('');
    const quick = ['IND', 'CHN', 'USA', 'BRA', 'DEU', 'NGA', 'SWE', 'QAT'];
    const qh = document.getElementById('fp-quick');
    qh.innerHTML = quick.filter(i => pct[i]).map(i => `<button class="chip" data-i="${i}">${nameOf(i)}</button>`).join('');
    qh.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) { sa.value = b.dataset.i; draw(); } });
    sa.addEventListener('change', draw); sb.addEventListener('change', draw);
    function draw() {
      const a = sa.value, b = sb.value;
      IND.forEach(([k], j) => {
        pa[j].setAttribute('d', petal(j, pct[a]?.[k] ?? 0));
        pb[j].setAttribute('d', petal(j, b ? (pct[b]?.[k] ?? 0) : 0));
        pb[j].style.opacity = b ? 1 : 0;
      });
      const r = byIso[a] && byIso[a][P[2]];
      mid.textContent = r && r.ppi != null ? `PPI ${r.ppi.toFixed(0)}` : '';
      svg.appendChild(hub); svg.appendChild(mid);
      document.getElementById('fp-name').textContent = nameOf(a);
      document.getElementById('fp-meta').innerHTML = r ? `${r.region} · ${r.cl ? r.cl + ' · ' + CL[r.cl].label : 'not grouped'} · 2011–2023` : '2011–2023';
      document.getElementById('fp-list').innerHTML = IND.map(([k, lab, unit]) => {
        const va = mean[a]?.[k], pa_ = pct[a]?.[k], vb = b ? mean[b]?.[k] : null;
        return `<li><span><i style="background:#2f6b4f"></i>${lab}</span><b>${va == null ? 'n/a' : fmt(va, va >= 100 ? 0 : 1)} <small>${unit}</small></b><small>${pa_ == null ? '' : 'P' + Math.round(pa_)}${b && vb != null ? ' · ' + b + ' ' + fmt(vb, vb >= 100 ? 0 : 1) : ''}</small></li>`;
      }).join('');
    }
    onReveal(document.getElementById('fpviz'), draw);
  })();

  // ---------- profiles from the pooled centroids
  const ph = document.getElementById('profiles');
  if (ph) {
    const cnt = X.summary[2];
    ph.innerHTML = X.centroids.map((c, i) => `<div class="card" data-reveal style="--d:${i * 0.08}s"><span class="swatch" style="background:${CL[c.cluster].color}"></span><span class="num">${c.cluster} · ${cnt['n_' + c.cluster]} countries in 2011–2023</span><h3>${c.label}</h3>
      <dl class="kv"><dt>PPI</dt><dd>${c.ppi.toFixed(1)}</dd><dt>Life expectancy</dt><dd>${c.life_expectancy.toFixed(1)} yrs</dd><dt>Infant mortality</dt><dd>${c.infant_mortality.toFixed(1)} / 1,000</dd><dt>Urban population</dt><dd>${c.urban_population_pct.toFixed(1)}%</dd><dt>GDP per person</dt><dd>≈ $${(Math.round(Math.exp(c.log_gdp_pc) / 50) * 50).toLocaleString('en-US')}</dd></dl></div>`).join('');
    ph.querySelectorAll('[data-reveal]').forEach(observeReveal);
  }

  // ---------- alluvial
  (function alluvial() {
    const svg = document.getElementById('alluvial'); if (!svg) return;
    const W = 1100, H = 460, m = { l: 20, r: 20, t: 30, b: 10 }, nw = 18, gap = 10;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const cols = P.map((_, k) => m.l + k * (W - m.l - m.r - nw) / (P.length - 1));
    const A2 = X.assign, isos = Object.keys(A2);
    const counts = P.map((_, k) => Object.fromEntries(K.map(c => [c, isos.filter(i => A2[i][k] === c).length])));
    const totalMax = Math.max(...counts.map(c => K.reduce((s, k) => s + c[k], 0)));
    const sc = (H - m.t - m.b - gap * 3) / totalMax;
    const pos = counts.map(cn => { let y0 = m.t; const o = {}; K.forEach(k => { o[k] = { y: y0, h: cn[k] * sc, out: y0, inn: y0 }; y0 += cn[k] * sc + gap; }); return o; });
    const flows = svgEl('g', {}, svg), nodesG = svgEl('g', {}, svg);
    for (let t = 0; t < P.length - 1; t++) {
      K.forEach(a => K.forEach(b => {
        const n = isos.filter(i => A2[i][t] === a && A2[i][t + 1] === b).length; if (!n) return;
        const h = n * sc, x0 = cols[t] + nw, x1 = cols[t + 1], y0 = pos[t][a].out, y1 = pos[t + 1][b].inn;
        pos[t][a].out += h; pos[t + 1][b].inn += h;
        const mx = (x0 + x1) / 2;
        const d = `M${x0},${y0}C${mx},${y0} ${mx},${y1} ${x1},${y1}L${x1},${y1 + h}C${mx},${y1 + h} ${mx},${y0 + h} ${x0},${y0 + h}Z`;
        const p = svgEl('path', { d, fill: CL[a === b ? a : b].color, 'fill-opacity': a === b ? .22 : .5 }, flows);
        p.style.transition = 'fill-opacity .3s';
        p.addEventListener('pointerenter', e => { p.setAttribute('fill-opacity', .85); showTip(`<b>${a} → ${b}</b>${P[t]} → ${P[t + 1]}<br>${n} ${n === 1 ? 'country' : 'countries'}`, e.clientX, e.clientY); });
        p.addEventListener('pointerleave', () => { p.setAttribute('fill-opacity', a === b ? .22 : .5); hideTip(); });
      }));
    }
    P.forEach((p, t) => {
      const lab = svgEl('text', { x: cols[t] + (t === 0 ? 0 : t === P.length - 1 ? nw : nw / 2), y: 18, 'text-anchor': t === 0 ? 'start' : t === P.length - 1 ? 'end' : 'middle', fill: '#1d1f1a', 'font-family': 'Fraunces', 'font-size': 17 }, nodesG); lab.textContent = p;
      K.forEach(k => {
        const o = pos[t][k];
        svgEl('rect', { x: cols[t], y: o.y, width: nw, height: Math.max(1, o.h), fill: CL[k].color }, nodesG);
        if (o.h > 16) { const tx = svgEl('text', { x: t === P.length - 1 ? cols[t] - 6 : cols[t] + nw + 6, y: o.y + o.h / 2 + 4, 'text-anchor': t === P.length - 1 ? 'end' : 'start', fill: '#1d1f1a', 'font-family': 'Barlow', 'font-weight': 600, 'font-size': 12 }, nodesG); tx.textContent = `${k} · ${counts[t][k]}`; }
      });
    });
    const st = X.persistence.map(p => Math.round(p.stayed * 100) + '%').join(' and ');
    document.getElementById('alluvial-note').textContent = `${st} stayed in the same profile in the two transitions`;
    const clip = svgEl('clipPath', { id: 'alclip' }, svgEl('defs', {}, svg)); const cr = svgEl('rect', { x: 0, y: 0, width: 0, height: H }, clip);
    flows.setAttribute('clip-path', 'url(#alclip)');
    onReveal(document.getElementById('alluvial-viz'), () => {
      if (prefersReducedMotion) return cr.setAttribute('width', W);
      const t0 = performance.now();
      const step = t => { const k = Math.max(0, Math.min(1, (t - t0) / 2000)), e = 1 - Math.pow(1 - k, 3); cr.setAttribute('width', W * e); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
  })();

  // ---------- associations (from regressions.csv)
  (function assoc() {
    const as = document.getElementById('assoc'); if (!as) return;
    const outs = [...new Set(reg.map(r => r.outcome))];
    const pal = ['#2f5f9e', '#1baf7a', '#1d1f1a', '#9a9d92', '#e34948', '#d49a2a'];
    const W = 640, H = 400, m = { l: 40, r: 210, t: 20, b: 30 };
    as.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const x = k => m.l + k / 2 * (W - m.l - m.r), y = v => m.t + (1 - (v + 0.5)) * (H - m.t - m.b);
    const ax = svgEl('g', { class: 'axis' }, as);
    [-0.4, -0.2, 0, 0.2, 0.4].forEach(v => { svgEl('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), stroke: v === 0 ? 'rgba(29,31,26,.35)' : 'rgba(29,31,26,.07)' }, ax); const t = svgEl('text', { x: m.l - 8, y: y(v) + 4, 'text-anchor': 'end' }, ax); t.textContent = v.toFixed(1); });
    P.forEach((p, k) => { const t = svgEl('text', { x: x(k), y: H - 8, 'text-anchor': 'middle' }, ax); t.textContent = p; });
    const lab = [];
    outs.forEach((o, j) => {
      const rs = P.map(p => reg.find(r => r.outcome === o && r.period === p));
      const p = svgEl('path', { d: 'M' + rs.map((r, k) => `${x(k)},${y(r.r)}`).join('L'), fill: 'none', stroke: pal[j], 'stroke-width': 2.4, class: 'draw' }, as);
      p.style.setProperty('--len', 700);
      rs.forEach((r, k) => {
        const sig = r.p < 0.05;
        const d = svgEl('circle', { cx: x(k), cy: y(r.r), r: 4.5, fill: sig ? pal[j] : '#fbf8f2', stroke: pal[j], 'stroke-width': 1.6 }, as);
        d.addEventListener('pointerenter', e => showTip(`<b>${o}</b>${r.period}: r = ${r.r.toFixed(2)}, β = ${r.beta.toFixed(3)} (SE ${r.se.toFixed(3)})<br>p ${r.p < 0.0001 ? '< 0.0001' : '= ' + r.p.toFixed(4)} · n = ${r.n}`, e.clientX, e.clientY));
        d.addEventListener('pointerleave', hideTip);
      });
      lab.push([y(rs[2].r), o, pal[j]]);
    });
    lab.sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < lab.length; i++) if (lab[i][0] - lab[i - 1][0] < 15) lab[i][0] = lab[i - 1][0] + 15;
    lab.forEach(([yy, o, c]) => { const t = svgEl('text', { x: x(2) + 12, y: yy + 4, fill: c, 'font-size': 12, 'font-family': 'Barlow', 'font-weight': 600 }, as); t.textContent = o; });
  })();

  // ---------- K diagnostics
  (function kchart() {
    const svg = document.getElementById('ksvg'); if (!svg) return;
    const W = 520, H = 200, m = { l: 36, r: 12, t: 14, b: 26 };
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const ks = X.k, kmin = ks[0].k, kmax = ks[ks.length - 1].k, smax = Math.max(...ks.map(k => k.sil)) * 1.15;
    const bw = (W - m.l - m.r) / ks.length;
    const y = v => m.t + (1 - v / smax) * (H - m.t - m.b);
    const ax = svgEl('g', { class: 'axis' }, svg);
    [0, 0.2, 0.4].forEach(v => { svgEl('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), stroke: 'rgba(29,31,26,.07)' }, ax); const t = svgEl('text', { x: m.l - 6, y: y(v) + 4, 'text-anchor': 'end' }, ax); t.textContent = v.toFixed(1); });
    ks.forEach((k, i) => {
      const bx = m.l + i * bw + bw * 0.18;
      const r = svgEl('rect', { x: bx, y: y(0), width: bw * 0.64, height: 0, fill: k.k === 4 ? '#2f6b4f' : '#cfc8b6' }, svg);
      r.style.transition = `all .9s cubic-bezier(.2,.7,.1,1) ${i * 0.07}s`; r.dataset.y = y(k.sil); r.dataset.h = y(0) - y(k.sil);
      const t = svgEl('text', { x: bx + bw * 0.32, y: H - 8, 'text-anchor': 'middle' }, ax); t.textContent = 'K=' + k.k;
      const v = svgEl('text', { x: bx + bw * 0.32, y: y(k.sil) - 6, 'text-anchor': 'middle', fill: '#1d1f1a', 'font-size': 11, 'font-family': 'Barlow', 'font-weight': 600 }, svg); v.textContent = k.sil.toFixed(2);
    });
    onReveal(document.getElementById('kviz'), () => requestAnimationFrame(() => requestAnimationFrame(() => svg.querySelectorAll('rect').forEach(r => { r.setAttribute('y', r.dataset.y); r.setAttribute('height', r.dataset.h); }))));
  })();

  // ---------- map
  (async function map() {
    const svg = document.getElementById('map'); if (!svg) return;
    const world = await fetch('assets/world.json').then(r => r.json());
    let cur = P[2], by = 'ppi', timer = null;
    const stops = [[245, 236, 214], [222, 190, 120], [196, 120, 60], [140, 45, 40]];
    const ramp = v => {
      const t = Math.max(0, Math.min(1, (v - 10) / 60)), s = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(s)), f = s - i;
      return `rgb(${stops[i].map((a, k) => Math.round(a + (stops[i + 1][k] - a) * f))})`;
    };
    const m = WorldMap(svg, world, { include: iso => !!byIso[iso], tip: iso => { const r = byIso[iso] && byIso[iso][cur]; return r ? tipFor(r, cur) : null; } });
    svg.querySelector('path').setAttribute('fill', '#1b1e19');
    const leg = document.getElementById('map-legend');
    function paint() {
      m.paint(iso => { const r = byIso[iso] && byIso[iso][cur]; if (!r) return null; return by === 'cl' ? (r.cl ? CL[r.cl].color : null) : (r.ppi == null ? null : ramp(r.ppi)); });
      leg.innerHTML = by === 'cl' ? legendHTML() : `<span style="display:flex;align-items:center;gap:10px">PPI 10 <i style="width:180px;height:10px;background:linear-gradient(90deg,${[10, 30, 50, 70].map(ramp).join(',')})"></i> 70+</span><span>Grey: no data</span>`;
      seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.p === cur)));
    }
    const seg = document.getElementById('map-periods');
    seg.innerHTML = P.map(p => `<button aria-pressed="${p === cur}" data-p="${p}">${p}</button>`).join('');
    seg.addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (b) { stop(); cur = b.dataset.p; paint(); } });
    document.querySelectorAll('#mapviz [data-by]').forEach(b => b.addEventListener('click', () => { by = b.dataset.by; document.querySelectorAll('#mapviz [data-by]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); paint(); }));
    const play = document.getElementById('map-play');
    function stop() { clearInterval(timer); timer = null; play.textContent = '▶'; }
    play.addEventListener('click', () => { if (timer) return stop(); let k = 0; cur = P[0]; paint(); play.textContent = '❚❚'; timer = setInterval(() => { k++; if (k >= P.length) return stop(); cur = P[k]; paint(); }, 1600); });
    paint();
  })();
})();
