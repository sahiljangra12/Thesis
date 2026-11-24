/* Thesis site ("Terra", dark): year-by-year dashboards with uncertainty, plus the published period results. */
window.GLOSSARY = {
  ppi: ['Planetary Pressure Index (PPI)', 'A 0–100 score combining six indicators: renewable energy share and forest cover (reversed, so less means more pressure), agricultural land, fertiliser use, PM2.5 air pollution and energy use per person. Each is standardised, at least four must be present, and the average is rescaled to 0–100. Relative to this sample, not a physical limit.'],
  profile: ['Development profile', 'One of four groups (C1–C4) found by k-means clustering on the PPI, income, life expectancy, infant mortality and urbanisation: C1 low development and lower pressure up to C4 high development and higher pressure.'],
  kmeans: ['k-means clustering', 'A method that sorts countries into K groups so that countries in the same group are as similar as possible on the chosen measures.'],
  silhouette: ['Silhouette score', 'How well each country fits its own group compared with the next-nearest group, from −1 to 1. Around 0.25 means the groups overlap noticeably.'],
  ci: ['95% confidence interval', 'The range that would contain the true value in 95% of repeated samples. If an interval for a change or a trend includes zero, the change is not statistically significant at the 5% level.'],
  bootstrap: ['Bootstrap', 'Uncertainty found by recomputing the statistic thousands of times on samples of countries drawn with replacement (2,000 draws here). The middle 95% of the results is the interval.'],
  r: ['Correlation (r)', 'How closely two measures move together across countries, from −1 (perfectly opposite) through 0 (no straight-line link) to +1 (perfectly together). Roughly: below 0.3 weak, 0.3–0.5 moderate, above 0.5 strong. It does not show cause.'],
  fisher: ['Fisher z interval', 'The standard way to put a confidence interval on a correlation: r is transformed so its sampling error is roughly normal, the interval is built, then transformed back.'],
  pvalue: ['p-value', 'How surprising the data would be if there were truly no effect. Below 0.05 is called statistically significant. It is not the probability that a finding is true.'],
  fe: ['Within-country trend (fixed effects)', 'A regression that compares each country only with itself over time, so fixed differences between countries cannot drive the result. Standard errors are clustered by country to allow for year-to-year dependence.'],
  percentile: ['Percentile', 'The share of countries with a lower value. The 80th percentile means higher than 80% of countries in that year.'],
  provisional: ['Provisional data', 'The newest World Bank values, fetched weekly and placed on the thesis scale without re-estimating anything. Not part of the thesis results; they may be revised.'],
  pooled: ['Pooled scale', 'One fixed scale built from all three periods together, so a score of 40 means the same in 1995 and in 2020.'],
  ols: ['Least-squares line (OLS)', 'The straight line that best fits the points, minimising the squared vertical distances. Its slope is the average change in the outcome per unit of PPI.']
};
(async function () {
  if (typeof THESIS === 'undefined') return;
  const V = '20261124a';
  const [X, AN] = await Promise.all([
    fetch(`data/thesis-extra.json?v=${V}`).then(r => r.json()),
    fetch(`data/thesis_annual.json?v=${V}`).then(r => r.json())
  ]);
  // live layer: newest copy on the main branch, falling back to the deployed copy
  const LIVE = await fetch('https://raw.githubusercontent.com/sahiljangra12/Thesis/main/docs/data/live.json', { cache: 'no-store' })
    .then(r => (r.ok ? r.json() : Promise.reject())).catch(() => fetch('data/live.json').then(r => (r.ok ? r.json() : null)).catch(() => null));

  Explain.terms();
  Explain.glossary(document.getElementById('gloss'));
  const INK = '#ece6d8', MUTED = '#aaa592', GRID = 'rgba(236,230,216,.07)', SAND = '#d9c9a3', SAGE = '#9cc7a4', PANEL = '#151912';
  const P = THESIS.periods, CL = AN.clusters, K = ['C1', 'C2', 'C3', 'C4'];
  const YEARS = AN.years, Y0 = YEARS[0], Y1 = YEARS[YEARS.length - 1];
  const A = THESIS_ANNUAL, COL = Object.fromEntries(A.columns.map((c, i) => [c, i]));
  const C = AN.countries, isos = Object.keys(C).sort((a, b) => C[a].n.localeCompare(C[b].n));
  const SUM = Object.fromEntries(AN.summary.map(s => [s.year, s]));
  const fmt = (v, n = 1) => (v == null || !isFinite(v) ? 'n/a' : (+v).toLocaleString('en-US', { maximumFractionDigits: n, minimumFractionDigits: n }));
  const yi = y => y - Y0;
  const FULL = AN.summary.filter(s => s.countries_with_ppi >= 150).map(s => s.year);
  const FIRSTFULL = Math.min(...FULL), LASTFULL = Math.max(...FULL);
  const onReveal = (el, fn) => {
    let done = false;
    const go = () => { if (!done) { done = true; fn(); } };
    if (el.classList.contains('in')) go(); else el.addEventListener('reveal', go, { once: true });
  };
  const legendHTML = () => K.map(k => `<span><i style="background:${CL[k].color};border-radius:50%"></i>${k} · ${CL[k].label}</span>`).join('');
  const liveRow = (iso, y) => LIVE && LIVE.countries[iso] && LIVE.countries[iso].years[y];
  const LIVE_YEARS = LIVE ? Object.keys(LIVE.coverage || {}).map(Number).filter(y => y > Y1 && LIVE.coverage[y] >= 1) : [];
  const YMAX = Math.max(Y1, ...LIVE_YEARS);

  // ---------- indicator means for the plates; per-year percentiles for fingerprints
  const IND = [
    ['renewable_energy', 'Renewable energy share', '%', true],
    ['forest_pct', 'Forest cover', '% of land', true],
    ['agri_land', 'Agricultural land', '% of land', false],
    ['fertilizer', 'Fertiliser use', 'kg/ha', false],
    ['pm25', 'PM2.5 exposure', 'µg/m³', false],
    ['energy_use_pc', 'Energy use per person', 'kgoe', false]
  ];
  const byYear = {};
  for (const r of A.rows) (byYear[r[COL.year]] = byYear[r[COL.year]] || {})[r[COL.iso3]] = r;
  const mean1123 = {};
  for (let y = 2011; y <= 2023; y++) for (const [iso, r] of Object.entries(byYear[y] || {})) {
    const m = (mean1123[iso] = mean1123[iso] || {});
    for (const [k] of IND) { const v = r[COL[k]]; if (v != null) (m[k] = m[k] || []).push(v); }
  }
  for (const iso in mean1123) for (const k in mean1123[iso]) { const a = mean1123[iso][k]; mean1123[iso][k] = a.reduce((s, v) => s + v, 0) / a.length; }
  document.querySelectorAll('[data-ind]').forEach(b => {
    const [iso, k, unit] = b.dataset.ind.split(':'), v = mean1123[iso] && mean1123[iso][k];
    b.textContent = v == null ? 'n/a' : fmt(v, v >= 100 ? 0 : 1) + (unit.startsWith('%') ? '%' : unit);
  });
  const pctCache = {};
  function percentiles(y) {
    if (pctCache[y]) return pctCache[y];
    const rows = byYear[y] || {}, out = {};
    for (const [k, , , rev] of IND) {
      const list = Object.keys(rows).filter(i => rows[i][COL[k]] != null && C[i]).map(i => [i, rev ? -rows[i][COL[k]] : rows[i][COL[k]]]).sort((a, b) => a[1] - b[1]);
      list.forEach(([i], j) => { (out[i] = out[i] || {})[k] = list.length > 1 ? j / (list.length - 1) * 100 : 50; });
    }
    return (pctCache[y] = out);
  }

  // ---------- statistical findings (results/csv/annual_tests.csv)
  (function tests() {
    const host = document.getElementById('tests'); if (!host) return;
    const T = AN.tests, find = s => T.find(t => t.measure.startsWith(s));
    const ppi = find('ppi per year'), le = find('life_expectancy per year'), ch = find('change in r(PPI, Life'), val = find('r(mean of annual');
    const sig = t => t.ci_low > 0 || t.ci_high < 0;
    const s0 = SUM[FIRSTFULL], s1 = SUM[LASTFULL];
    const lePeriod = X.regressions.filter(r => r.outcome.startsWith('Life expectancy'));
    const pv = p => (p < 0.001 ? 'p < 0.001' : 'p = ' + fmt(p, 3));
    host.innerHTML = [
      `<div class="test"><span class="k">Pressure within countries</span><b>${ppi.estimate >= 0 ? '+' : ''}${fmt(ppi.estimate, 3)}<small style="font-size:.4em"> PPI points / year</small></b><span class="ci">95% CI ${fmt(ppi.ci_low, 3)} to ${fmt(ppi.ci_high, 3)} · ${pv(ppi.p_value)} · ${ppi.countries} countries, ${ppi.observations.toLocaleString('en-US')} country-years</span><p>Country fixed effects, standard errors clustered by country. Mean PPI was ${fmt(s0.mean_ppi)} in ${s0.year} and ${fmt(s1.mean_ppi)} in ${s1.year}; the intervals overlap.</p><span class="verdict ${sig(ppi) ? 'yes' : 'no'}">${sig(ppi) ? 'Significant change' : 'No detectable change'}</span></div>`,
      `<div class="test"><span class="k">Life expectancy within countries</span><b>+${fmt(le.estimate, 3)}<small style="font-size:.4em"> years / year</small></b><span class="ci">95% CI ${fmt(le.ci_low, 3)} to ${fmt(le.ci_high, 3)} · ${pv(le.p_value)} · ${le.countries} countries</span><p>The same model for life expectancy: lives lengthened by about ${fmt(le.estimate * 10, 1)} years per decade while measured pressure stayed level.</p><span class="verdict ${sig(le) ? 'yes' : 'no'}">${sig(le) ? 'Significant rise' : 'No detectable change'}</span></div>`,
      `<div class="test"><span class="k">Has the pressure–health link weakened?</span><b>${fmt(ch.estimate, 3)}<small style="font-size:.4em"> change in r</small></b><span class="ci">95% CI ${fmt(ch.ci_low, 3)} to ${fmt(ch.ci_high, 3)} · ${pv(ch.p_value)} · ${(ch.measure.match(/\d{4}→\d{4}/) || [''])[0]} · ${ch.countries} countries</span><p>Paired country bootstrap (${ch.method.replace('paired country bootstrap, ', '')}). In decade averages r moved from ${fmt(lePeriod[0].r, 2)} to ${fmt(lePeriod[2].r, 2)}, but year by year the change is within sampling uncertainty.</p><span class="verdict ${sig(ch) ? 'yes' : 'no'}">${sig(ch) ? 'Significant weakening' : 'Not statistically significant'}</span></div>`
    ].join('');
    const t = document.getElementById('trend-note');
    if (t) t.textContent = `Annual values use the published pooled scale; averages of annual PPI reproduce the period PPI with r = ${fmt(val.estimate, 3)} (${val.method}). Hollow points: years with fewer than 150 countries.`;
  })();

  // ---------- pressure over time (mean + bootstrap band) / profile shares
  (function trend() {
    const svg = document.getElementById('trend'); if (!svg) return;
    const W = MOB ? 600 : 1100, H = MOB ? 440 : 380, m = MOB ? { l: 44, r: 16, t: 18, b: 38 } : { l: 48, r: 20, t: 18, b: 34 };
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const x = y => m.l + (y - Y0) / (YMAX - Y0) * (W - m.l - m.r);
    const layer = svgEl('g', {}, svg);
    const leg = document.getElementById('trend-legend');
    const viz = document.getElementById('trendviz');
    const GD = Explain.guide(viz, [
      'Each point is the <strong>average pressure score</strong> of all countries that year (0 = least pressure, 100 = most).',
      'The <strong>shaded band</strong> is the 95% confidence interval: where the true average most likely lies. Point at a year for its numbers.',
      '<strong>Hollow points</strong> are years with incomplete data (fewer than 150 countries). Diamonds are provisional live data.'
    ]);
    const RO = Explain.readout(viz), TK = Explain.takeaway(viz);
    const tst = AN.tests.find(t => t.measure.startsWith('ppi per year'));
    const setYear = s => RO.set([
      ['Year', s.year],
      ['Mean PPI', fmt(s.mean_ppi), `95% CI ${fmt(s.ci_low)}–${fmt(s.ci_high)}`],
      ['Median PPI', fmt(s.median_ppi), 'middle country'],
      ['Countries', s.countries_with_ppi, s.countries_with_ppi >= 150 ? 'full coverage' : 'partial coverage', s.countries_with_ppi >= 150 ? '' : 'warn'],
      ['Trend within countries', (tst.estimate >= 0 ? '+' : '') + fmt(tst.estimate, 3), `per year · p = ${fmt(tst.p_value, 2)}`]
    ]);
    let mode = 'ppi';
    svg.addEventListener('pointermove', e => { if (mode !== 'share') return; const bb = svg.getBoundingClientRect(); const yy = Math.round(Y0 + ((e.clientX - bb.left) / bb.width * W - m.l) / (W - m.l - m.r) * (YMAX - Y0)); if (SUM[yy] && SUM[yy].countries_profiled >= 150) setShare(SUM[yy]); });
    const setShare = s => RO.set([['Year', s.year], ...K.map(c => [`${c} · ${CL[c].label.split(',')[0]}`, Math.round(s['share_' + c] * 100) + '%', ''])]);
    function axes(y, ticks, fmtT) {
      const ax = svgEl('g', { class: 'axis' }, layer);
      ticks.forEach(v => { svgEl('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), stroke: GRID }, ax); const t = svgEl('text', { x: m.l - 8, y: y(v) + 4, 'text-anchor': 'end' }, ax); t.textContent = fmtT(v); });
      for (let yy = 1990; yy <= YMAX; yy += MOB ? 10 : 5) { const t = svgEl('text', { x: x(yy), y: H - 10, 'text-anchor': 'middle' }, ax); t.textContent = yy; }
    }
    function drawPPI() {
      layer.innerHTML = '';
      const y = v => m.t + (1 - (v - 25) / (45 - 25)) * (H - m.t - m.b);
      axes(y, [25, 30, 35, 40, 45], v => v);
      const S = AN.summary;
      const up = S.map(s => [x(s.year), y(s.ci_high)]), dn = S.map(s => [x(s.year), y(s.ci_low)]).reverse();
      svgEl('path', { d: 'M' + up.join('L') + 'L' + dn.join('L') + 'Z', fill: SAND, 'fill-opacity': .14 }, layer);
      const line = svgEl('path', { d: 'M' + S.map(s => [x(s.year), y(s.mean_ppi)]).join('L'), fill: 'none', stroke: SAND, 'stroke-width': 2.6, class: 'draw' }, layer);
      line.style.setProperty('--len', line.getTotalLength());
      requestAnimationFrame(() => requestAnimationFrame(() => { line.style.strokeDashoffset = 0; }));
      svgEl('path', { d: 'M' + S.map(s => [x(s.year), y(s.median_ppi)]).join('L'), fill: 'none', stroke: MUTED, 'stroke-width': 1.2, 'stroke-dasharray': '3 4' }, layer);
      S.forEach(s => {
        const full = s.countries_with_ppi >= 150;
        const c = svgEl('circle', { cx: x(s.year), cy: y(s.mean_ppi), r: MOB ? 5 : 4, fill: full ? SAND : PANEL, stroke: SAND, 'stroke-width': 1.5 }, layer);
        c.addEventListener('pointerenter', e => { setYear(s); showTip(`<b>${s.year}</b>Mean PPI ${fmt(s.mean_ppi)} (95% CI ${fmt(s.ci_low)}–${fmt(s.ci_high)})<br>Median ${fmt(s.median_ppi)} · ${s.countries_with_ppi} countries${full ? '' : '<br>Partial coverage: compare with care'}`, e.clientX, e.clientY); });
        c.addEventListener('pointerleave', () => { hideTip(); setYear(SUM[LASTFULL]); });
      });
      setYear(SUM[LASTFULL]);
      const a = SUM[FIRSTFULL], b = SUM[LASTFULL], z = SUM[Y1];
      Explain.annotate(layer, { x: x(a.year), y: y(a.mean_ppi), tx: x(a.year) + 14, ty: y(a.ci_high) - 26, elbow: true, text: [`${a.year}: ${fmt(a.mean_ppi)}`, `95% CI ${fmt(a.ci_low)}–${fmt(a.ci_high)}`], color: SAND, delay: 1400 });
      Explain.annotate(layer, { x: x(b.year), y: y(b.mean_ppi), tx: x(b.year) - 14, ty: y(b.ci_low) + 30, anchor: 'end', elbow: true, text: [`${b.year}: ${fmt(b.mean_ppi)}`, `95% CI ${fmt(b.ci_low)}–${fmt(b.ci_high)}`], color: SAND, delay: 1700 });
      if (z && z.countries_with_ppi < 150) Explain.annotate(layer, { x: x(z.year), y: y(z.mean_ppi), tx: x(z.year) - 14, ty: y(43), anchor: 'end', elbow: true, text: [`${z.year}: ONLY ${z.countries_with_ppi} COUNTRIES`, 'read with care'], color: '#d9a35a', delay: 2000 });
      TK.set(`Average pressure barely moved: <b>${fmt(a.mean_ppi)}</b> in ${a.year} and <b>${fmt(b.mean_ppi)}</b> in ${b.year}, with overlapping intervals. Within countries the trend is ${tst.estimate >= 0 ? '+' : ''}${fmt(tst.estimate, 3)} points a year (95% CI ${fmt(tst.ci_low, 3)} to ${fmt(tst.ci_high, 3)}), which is <b>statistically indistinguishable from zero</b>. Over the same years life expectancy rose by about 0.28 years every year.`);
      LIVE_YEARS.forEach(yy => {
        const v = Object.values(LIVE.countries).map(c => c.years[yy] && c.years[yy].ppi).filter(z => z != null);
        if (v.length < 30) return; // too few countries for a comparable mean
        const mu = v.reduce((a, b) => a + b, 0) / v.length;
        const c = svgEl('rect', { x: x(yy) - 4, y: y(mu) - 4, width: 8, height: 8, fill: 'none', stroke: SAGE, 'stroke-width': 1.5, transform: `rotate(45 ${x(yy)} ${y(mu)})` }, layer);
        c.addEventListener('pointerenter', e => showTip(`<b>${yy} · provisional</b>Mean PPI ${fmt(mu)} from ${v.length} countries (live World Bank data, no interval: coverage is partial)`, e.clientX, e.clientY));
        c.addEventListener('pointerleave', hideTip);
      });
      leg.innerHTML = `<span><i style="background:${SAND}"></i>Mean PPI</span><span><i style="background:${SAND};opacity:.3"></i>95% bootstrap interval</span><span><i style="border-top:1px dashed ${MUTED};height:0"></i>Median</span>${LIVE_YEARS.length ? `<span><i style="border:1.5px solid ${SAGE};width:8px;height:8px;background:none"></i>Provisional (live)</span>` : ''}`;
    }
    function drawShare() {
      layer.innerHTML = '';
      const y = v => m.t + (1 - v) * (H - m.t - m.b);
      axes(y, [0, .25, .5, .75, 1], v => Math.round(v * 100) + '%');
      const S = AN.summary.filter(s => s.countries_profiled >= 150);
      for (let k = 3; k >= 0; k--) {
        const top = S.map(s => [x(s.year), y(K.slice(0, k + 1).reduce((a, c) => a + s['share_' + c], 0))]);
        const bot = S.map(s => [x(s.year), y(K.slice(0, k).reduce((a, c) => a + s['share_' + c], 0))]).reverse();
        const p = svgEl('path', { d: 'M' + top.join('L') + 'L' + bot.join('L') + 'Z', fill: CL[K[k]].color, 'fill-opacity': .85 }, layer);
        p.addEventListener('pointermove', e => {
          const bb = svg.getBoundingClientRect();
          const yy = Math.round(Y0 + ((e.clientX - bb.left) / bb.width * W - m.l) / (W - m.l - m.r) * (YMAX - Y0)), s = SUM[yy];
          if (s) showTip(`<b>${yy}</b>${K.map(c => `${c}: ${Math.round(s['share_' + c] * 100)}%`).join(' · ')}<br>${s.countries_profiled} countries profiled`, e.clientX, e.clientY);
        });
        p.addEventListener('pointerleave', hideTip);
      }
      leg.innerHTML = legendHTML() + '<span>Years with at least 150 profiled countries</span>';
      const a = S[0], b = S[S.length - 1];
      setShare(b);
      const pc = (s, c) => Math.round(s['share_' + c] * 100) + '%';
      TK.set(`Countries moved up the development ladder: the least-developed profile C1 shrank from <b>${pc(a, 'C1')}</b> of countries in ${a.year} to <b>${pc(b, 'C1')}</b> in ${b.year}, while the two higher-pressure profiles C3 and C4 grew from ${Math.round((a.share_C3 + a.share_C4) * 100)}% to <b>${Math.round((b.share_C3 + b.share_C4) * 100)}%</b>.`);
    }
    document.querySelectorAll('#trendviz [data-t]').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('#trendviz [data-t]').forEach(z => z.setAttribute('aria-pressed', String(z === b)));
      mode = b.dataset.t;
      b.dataset.t === 'ppi' ? drawPPI() : drawShare();
      GD.querySelectorAll('.gi span')[0].innerHTML = b.dataset.t === 'ppi' ? 'Each point is the <strong>average pressure score</strong> of all countries that year (0 = least pressure, 100 = most).' : 'Each colour is the <strong>share of countries</strong> in one development profile that year; together they make 100%.';
    }));
    onReveal(document.getElementById('trendviz'), drawPPI);
  })();

  // ---------- scatter by year
  (function scatter() {
    const svg = document.getElementById('scatter'); if (!svg) return;
    const W = MOB ? 600 : 1100, H = MOB ? 620 : 500, m = MOB ? { l: 44, r: 12, t: 52, b: 48 } : { l: 52, r: 18, t: 16, b: 42 };
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const x = v => m.l + (Math.max(-5, Math.min(105, v)) + 5) / 110 * (W - m.l - m.r);
    const y = v => m.t + (1 - (Math.max(35, Math.min(90, v)) - 35) / 55) * (H - m.t - m.b);
    const ax = svgEl('g', { class: 'axis' }, svg);
    for (let v = 0; v <= 100; v += 20) { svgEl('line', { x1: x(v), x2: x(v), y1: m.t, y2: H - m.b, stroke: GRID }, ax); const t = svgEl('text', { x: x(v), y: H - m.b + 18, 'text-anchor': 'middle' }, ax); t.textContent = v; }
    for (let v = 40; v <= 90; v += 10) { svgEl('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), stroke: GRID }, ax); const t = svgEl('text', { x: m.l - 8, y: y(v) + 4, 'text-anchor': 'end' }, ax); t.textContent = v; }
    const xl = svgEl('text', { x: W - m.r, y: H - 6, 'text-anchor': 'end' }, ax); xl.textContent = 'PLANETARY PRESSURE INDEX →';
    const yl = svgEl('text', { x: MOB ? 4 : m.l + 6, y: MOB ? 18 : m.t + 12 }, ax); yl.textContent = MOB ? '↑ LIFE EXPECTANCY (YEARS)' : 'LIFE EXPECTANCY (YEARS)';
    const big = svgEl('text', { class: 'big', x: W - m.r - 6, y: H - m.b - 14, 'text-anchor': 'end', fill: 'rgba(236,230,216,.08)', 'font-family': 'Fraunces', 'font-size': MOB ? 84 : 120 }, svg);
    svgEl('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b }, svgEl('clipPath', { id: 'scclip' }, svgEl('defs', {}, svg)));
    const fitL = svgEl('line', { stroke: SAND, 'stroke-width': 1.5, 'stroke-dasharray': '6 5', opacity: .8, 'clip-path': 'url(#scclip)' }, svg);
    const g = svgEl('g', {}, svg);
    const order = [...isos].sort((a, b) => (C[b].pop[yi(2000)] || 0) - (C[a].pop[yi(2000)] || 0));
    const nodes = {};
    let cur = Y0, timer = null;
    const val = (iso, yy) => {
      if (yy <= Y1) { const c = C[iso], i = yi(yy); return { ppi: c.ppi[i], le: c.le[i], pop: c.pop[i], cl: c.cl[i], prov: false }; }
      const r = liveRow(iso, yy); return r ? { ppi: r.ppi, le: r.le, pop: r.pop, cl: r.profile, prov: true } : {};
    };
    order.forEach(iso => {
      const c = svgEl('circle', { r: 0, cx: x(50), cy: y(65), 'fill-opacity': .85, stroke: '#0d0f0b', 'stroke-width': .8, tabindex: 0 }, g);
      c.style.transition = 'cx .45s linear, cy .45s linear, r .45s, fill .45s';
      const show = e => { const v = val(iso, cur); if (v.ppi == null) return; const bb = c.getBoundingClientRect(); showTip(`<b>${C[iso].n}</b>${cur}${v.prov ? ' · provisional' : ''} · ${v.cl ? v.cl + ' · ' + CL[v.cl].label : 'no profile'}<br>PPI ${fmt(v.ppi)} · life expectancy ${fmt(v.le)} years`, e.clientX || bb.x, e.clientY || bb.y); };
      c.addEventListener('pointerenter', show); c.addEventListener('focus', show); c.addEventListener('pointerleave', hideTip); c.addEventListener('blur', hideTip);
      nodes[iso] = c;
    });
    const input = document.getElementById('sc-year'), out = document.getElementById('sc-out'), badge = document.createElement('span'); // r now shown in the readout
    document.getElementById('sc-r')?.remove();
    input.min = Y0; input.max = YMAX;
    const viz = document.getElementById('scatterviz');
    Explain.guide(viz, [
      'Each circle is a <strong>country</strong>: size shows population, colour shows its development profile that year.',
      '<strong>Further right</strong> = more environmental pressure. <strong>Higher</strong> = longer life expectancy.',
      'The dashed line is the <strong>average trend</strong>; r measures how tightly countries follow it (0 = no link, 1 = perfect).'
    ]);
    const RO = Explain.readout(viz), TK = Explain.takeaway(viz);
    const named = (MOB ? ['CHN', 'IND', 'USA', 'NGA'] : ['CHN', 'IND', 'USA', 'NGA', 'BRA', 'SWE', 'QAT']).filter(i => C[i]);
    const tags = Object.fromEntries(named.map(i => { const t = svgEl('text', { 'font-family': 'IBM Plex Mono', 'font-size': 11, 'font-weight': 500, fill: INK, 'paint-order': 'stroke', stroke: '#0d0f0b', 'stroke-width': 3, opacity: 0 }, svg); t.textContent = C[i].n.toUpperCase(); return [i, t]; }));
    function draw(yy) {
      cur = yy; input.value = yy; out.textContent = yy; big.textContent = yy;
      const pts = [];
      for (const iso of order) {
        const v = val(iso, yy), c = nodes[iso];
        if (v.ppi == null || v.le == null) { c.setAttribute('r', 0); continue; }
        c.setAttribute('cx', x(v.ppi)); c.setAttribute('cy', y(v.le));
        c.setAttribute('r', Math.max(MOB ? 3.5 : 2.5, Math.sqrt(v.pop || 0) / (MOB ? 1700 : 1300)));
        c.setAttribute('fill', v.cl ? CL[v.cl].color : '#777');
        c.setAttribute('fill-opacity', v.prov ? .35 : .85);
        pts.push([v.ppi, v.le]);
      }
      const r = AN.correlations.find(z => z.year === yy && z.outcome.startsWith('Life expectancy'));
      badge.innerHTML = r ? `r = ${fmt(r.r, 2)} · 95% CI ${fmt(r.ci_low, 2)} to ${fmt(r.ci_high, 2)} · n = ${r.n}${r.n < 150 ? ' · partial coverage' : ''}` : `provisional · n = ${pts.length}`;
      let b = null;
      if (pts.length > 2) {
        const n = pts.length, mx = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + p[1], 0) / n;
        b = pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0) / pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0);
        fitL.setAttribute('x1', x(0)); fitL.setAttribute('x2', x(100)); fitL.setAttribute('y1', y(my - b * mx)); fitL.setAttribute('y2', y(my + b * (100 - mx)));
      }
      for (const i of named) {
        const v = val(i, yy), t = tags[i];
        if (v.ppi == null || v.le == null) { t.setAttribute('opacity', 0); continue; }
        const rr = Math.max(MOB ? 3.5 : 2.5, Math.sqrt(v.pop || 0) / (MOB ? 1700 : 1300));
        t.setAttribute('x', x(v.ppi) + rr + 4); t.setAttribute('y', y(v.le) - rr * 0.6); t.setAttribute('opacity', .95);
      }
      const sg = r ? r.p_value < 0.05 : null;
      RO.set([
        ['Year', yy, yy > Y1 ? 'provisional' : ''],
        ['Countries', pts.length, r && r.n < 150 ? 'partial coverage' : ''],
        ['Correlation r', r ? fmt(r.r, 2) : 'n/a', r ? `95% CI ${fmt(r.ci_low, 2)} to ${fmt(r.ci_high, 2)}` : ''],
        ['Strength', r ? Explain.strength(r.r).replace(/^a /, '') : 'n/a', r ? (sg ? 'significant at 5%' : 'not significant') : '', r ? (sg ? 'up' : 'warn') : ''],
        ['Slope', b == null ? 'n/a' : (b >= 0 ? '+' : '') + fmt(b * 10, 1) + ' yrs', 'life expectancy per +10 PPI']
      ]);
      if (r && b != null) TK.set(`In <b>${yy}</b>, countries with more environmental pressure tended to live longer: ${Explain.strength(r.r)} ${r.r >= 0 ? 'positive' : 'negative'} link (r = ${fmt(r.r, 2)}). On average, each 10 extra pressure points went with <b>${fmt(Math.abs(b * 10), 1)} ${b >= 0 ? 'more' : 'fewer'} years</b> of life expectancy. This is a pattern across countries, not proof that pressure causes longer lives: richer countries both live longer and press harder.`);
      else TK.set(`${yy} uses provisional data for ${pts.length} countries; no interval is computed for it.`);
    }
    const play = document.getElementById('sc-play');
    function stop() { clearInterval(timer); timer = null; play.textContent = '▶'; }
    function run() { if (cur >= YMAX) cur = Y0 - 1; play.textContent = '❚❚'; timer = setInterval(() => { if (cur >= YMAX) return stop(); draw(cur + 1); }, 420); }
    play.addEventListener('click', () => (timer ? stop() : run()));
    input.addEventListener('input', () => { stop(); draw(+input.value); });
    document.getElementById('sc-legend').innerHTML = legendHTML() + `<span><i style="border-top:1px dashed ${SAND};height:0"></i>Least-squares line</span>`;
    onReveal(document.getElementById('scatterviz'), () => { if (prefersReducedMotion) return draw(LASTFULL); draw(Y0); setTimeout(run, 700); });
  })();

  // ---------- correlation by year with Fisher-z band
  (function corr() {
    const svg = document.getElementById('corr'); if (!svg) return;
    const outs = [...new Set(AN.correlations.map(c => c.outcome))];
    const first = outs.find(o => o.startsWith('Life')) || outs[0];
    const seg = document.getElementById('corr-seg');
    seg.innerHTML = outs.map(o => `<button aria-pressed="${o === first}" data-o="${o}">${o.replace(/ \(.*\)/, '')}</button>`).join('');
    const W = MOB ? 600 : 1100, H = MOB ? 400 : 320, m = MOB ? { l: 50, r: 14, t: 16, b: 38 } : { l: 48, r: 20, t: 16, b: 32 };
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const x = yy => m.l + (yy - Y0) / (Y1 - Y0) * (W - m.l - m.r), y = v => m.t + (1 - (v + 0.8) / 1.6) * (H - m.t - m.b);
    const ax = svgEl('g', { class: 'axis' }, svg);
    [-0.8, -0.4, 0, 0.4, 0.8].forEach(v => { svgEl('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), stroke: v === 0 ? 'rgba(236,230,216,.35)' : GRID }, ax); const t = svgEl('text', { x: m.l - 8, y: y(v) + 4, 'text-anchor': 'end' }, ax); t.textContent = v.toFixed(1); });
    for (let yy = 1990; yy <= Y1; yy += MOB ? 10 : 5) { const t = svgEl('text', { x: x(yy), y: H - 8, 'text-anchor': 'middle' }, ax); t.textContent = yy; }
    const zl = svgEl('text', { x: m.l + 6, y: y(0) - 6, fill: MUTED, 'font-family': 'IBM Plex Mono', 'font-size': 10.5 }, svg); zl.textContent = 'r = 0 · NO LINK';
    const layer = svgEl('g', {}, svg);
    const viz = document.getElementById('corrviz');
    Explain.guide(viz, [
      'Pick an outcome. Each point is the <strong>correlation r</strong> between pressure and that outcome across all countries in one year, from −1 to +1.',
      'Above the zero line: more pressure goes with <strong>more</strong> of the outcome. Below: with <strong>less</strong>.',
      'The band is the 95% confidence interval. <strong>Filled points</strong> are significant; where the band crosses zero, there is no clear link.'
    ]);
    const RO = Explain.readout(viz), TK = Explain.takeaway(viz);
    function draw(o) {
      layer.innerHTML = '';
      const S = AN.correlations.filter(c => c.outcome === o);
      const up = S.map(s => [x(s.year), y(s.ci_high)]), dn = S.map(s => [x(s.year), y(s.ci_low)]).reverse();
      svgEl('path', { d: 'M' + up.join('L') + 'L' + dn.join('L') + 'Z', fill: SAGE, 'fill-opacity': .15 }, layer);
      const line = svgEl('path', { d: 'M' + S.map(s => [x(s.year), y(s.r)]).join('L'), fill: 'none', stroke: SAGE, 'stroke-width': 2.4, class: 'draw' }, layer);
      line.style.setProperty('--len', line.getTotalLength()); requestAnimationFrame(() => requestAnimationFrame(() => { line.style.strokeDashoffset = 0; }));
      S.forEach(s => {
        const sig = s.p_value < 0.05;
        const c = svgEl('circle', { cx: x(s.year), cy: y(s.r), r: MOB ? 5 : 3.6, fill: sig ? SAGE : PANEL, stroke: SAGE, 'stroke-width': 1.4 }, layer);
        c.addEventListener('pointerenter', e => showTip(`<b>${s.year} · ${o}</b>r = ${fmt(s.r, 3)} (95% CI ${fmt(s.ci_low, 2)} to ${fmt(s.ci_high, 2)})<br>p ${s.p_value < 0.001 ? '< 0.001' : '= ' + fmt(s.p_value, 3)} · n = ${s.n}`, e.clientX, e.clientY));
        c.addEventListener('pointerleave', hideTip);
      });
      const n0 = S.find(s => s.year === FIRSTFULL), n1 = S.find(s => s.year === LASTFULL), zz = S[S.length - 1];
      if (zz && zz.n < 150) Explain.annotate(layer, { x: x(zz.year), y: y(zz.r), tx: x(zz.year) - 16, ty: y(zz.ci_low) + 26, anchor: 'end', elbow: true, text: [`${zz.year}: ONLY ${zz.n} COUNTRIES`, 'wide interval, read with care'], color: '#d9a35a', delay: 1300 });
      const chg = AN.tests.find(t => t.measure.startsWith(`change in r(PPI, ${o})`));
      document.getElementById('corr-note').textContent = (n0 && n1 ? `${o}: r = ${fmt(n0.r, 2)} in ${n0.year} and ${fmt(n1.r, 2)} in ${n1.year}` : o) +
        (chg ? ` (change ${fmt(chg.estimate, 2)}, 95% CI ${fmt(chg.ci_low, 2)} to ${fmt(chg.ci_high, 2)}, paired bootstrap)` : '') +
        '. Filled points are significant at 5%; the band is the 95% Fisher-z interval for each year.';
      const nsig = S.filter(z => z.p_value < 0.05).length, plain = o.replace(/ \(.*\)/, '').toLowerCase();
      const csig = chg ? (chg.ci_low > 0 || chg.ci_high < 0) : null;
      RO.set([
        ['Outcome', o.replace(/ \(.*\)/, '')],
        [`r in ${n0 ? n0.year : FIRSTFULL}`, n0 ? fmt(n0.r, 2) : 'n/a', n0 ? `95% CI ${fmt(n0.ci_low, 2)} to ${fmt(n0.ci_high, 2)}` : ''],
        [`r in ${n1 ? n1.year : LASTFULL}`, n1 ? fmt(n1.r, 2) : 'n/a', n1 ? `95% CI ${fmt(n1.ci_low, 2)} to ${fmt(n1.ci_high, 2)}` : ''],
        ['Change tested', chg ? (chg.estimate >= 0 ? '+' : '') + fmt(chg.estimate, 2) : 'not tested', chg ? `p = ${fmt(chg.p_value, 2)} · ${csig ? 'significant' : 'not significant'}` : '', chg ? (csig ? 'up' : 'warn') : ''],
        ['Significant years', `${nsig} of ${S.length}`, 'p < 0.05']
      ]);
      const dir = n1 && n1.r >= 0 ? 'more' : 'less';
      TK.set(n1 ? `Across countries, more environmental pressure goes with <b>${dir} ${plain}</b>: ${Explain.strength(n1.r)} link in ${n1.year} (r = ${fmt(n1.r, 2)}), significant in ${nsig} of ${S.length} years. ${chg ? (csig ? `The link changed significantly between ${FIRSTFULL} and ${LASTFULL} (${fmt(chg.estimate, 2)}).` : `It looks ${Math.abs(n1.r) < Math.abs(n0.r) ? 'weaker' : 'stronger'} in ${LASTFULL} than in ${FIRSTFULL}, but the change (${fmt(chg.estimate, 2)}, 95% CI ${fmt(chg.ci_low, 2)} to ${fmt(chg.ci_high, 2)}) is <b>not statistically significant</b>.`) : ''}` : '');
    }
    seg.addEventListener('click', e => { const b = e.target.closest('[data-o]'); if (!b) return; seg.querySelectorAll('button').forEach(z => z.setAttribute('aria-pressed', String(z === b))); draw(b.dataset.o); });
    onReveal(document.getElementById('corrviz'), () => draw(first));
  })();

  // ---------- fingerprints by year
  (function fingerprint() {
    const svg = document.getElementById('fp-svg'); if (!svg) return;
    const S = 460, c = S / 2, R = 172, r0 = 30;
    svg.setAttribute('viewBox', `-70 -10 ${S + 140} ${S + 20}`);
    [25, 50, 75, 100].forEach(v => svgEl('circle', { cx: c, cy: c, r: r0 + (R - r0) * v / 100, fill: 'none', stroke: v === 50 ? 'rgba(236,230,216,.35)' : 'rgba(236,230,216,.1)', 'stroke-dasharray': v === 50 ? '3 4' : '' }, svg));
    const n = IND.length, ang = k => -Math.PI / 2 + k * 2 * Math.PI / n;
    IND.forEach(([, lab], k) => {
      const a = ang(k), lx = c + Math.cos(a) * (R + 22), ly = c + Math.sin(a) * (R + 22);
      svgEl('line', { x1: c + Math.cos(a) * r0, y1: c + Math.sin(a) * r0, x2: c + Math.cos(a) * R, y2: c + Math.sin(a) * R, stroke: 'rgba(236,230,216,.1)' }, svg);
      const t = svgEl('text', { x: lx, y: ly + 4, 'text-anchor': Math.abs(Math.cos(a)) < .2 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end', fill: MUTED, 'font-family': 'Barlow', 'font-size': 11, 'font-weight': 600, 'letter-spacing': '.06em' }, svg);
      const SHORT = { 'Renewable energy share': 'RENEWABLES', 'Forest cover': 'FOREST', 'Agricultural land': 'FARMLAND', 'Fertiliser use': 'FERTILISER', 'PM2.5 exposure': 'PM2.5', 'Energy use per person': 'ENERGY' };
      t.textContent = MOB ? SHORT[lab] : lab.replace(' per person', '').replace(' share', '').toUpperCase();
    });
    const gB = svgEl('g', {}, svg), gA = svgEl('g', {}, svg);
    const hub = svgEl('circle', { cx: c, cy: c, r: r0 + 2, fill: PANEL, stroke: 'rgba(236,230,216,.25)' }, svg);
    const mid = svgEl('text', { x: c, y: c + 5, 'text-anchor': 'middle', fill: INK, 'font-family': 'Fraunces', 'font-size': 14 }, svg);
    const petal = (k, v) => {
      const a = ang(k), w = Math.PI / n * 0.82, rr = r0 + (R - r0) * v / 100;
      const p1 = [c + Math.cos(a - w) * r0, c + Math.sin(a - w) * r0], p2 = [c + Math.cos(a + w) * r0, c + Math.sin(a + w) * r0];
      const tip = [c + Math.cos(a) * rr, c + Math.sin(a) * rr];
      const c1 = [c + Math.cos(a - w) * rr * 0.92, c + Math.sin(a - w) * rr * 0.92], c2 = [c + Math.cos(a + w) * rr * 0.92, c + Math.sin(a + w) * rr * 0.92];
      return `M${p1}Q${c1} ${tip}Q${c2} ${p2}Z`;
    };
    const shapes = (g, fill, stroke, op) => IND.map((_, k) => { const p = svgEl('path', { d: petal(k, 0), fill, 'fill-opacity': op, stroke, 'stroke-width': 1.4 }, g); p.style.transition = 'd .7s cubic-bezier(.2,.7,.1,1)'; return p; });
    const pa = shapes(gA, SAGE, '#cfe3d4', .55), pb = shapes(gB, 'none', '#d9a35a', 1);
    pb.forEach(p => p.setAttribute('stroke-dasharray', '4 3'));
    const sa = document.getElementById('fp-a'), sb = document.getElementById('fp-b'), yr = document.getElementById('fp-year'), out = document.getElementById('fp-out');
    const viz = document.getElementById('fpviz');
    Explain.guide(viz, [
      'Each <strong>petal</strong> is one of the six pressures. Its length is the country\u2019s <strong>percentile</strong> among all countries that year.',
      'A petal reaching the dotted middle ring is average (50th percentile). Longer = more pressure than most countries.',
      'The <strong style="color:#d9a35a">dashed orange outline</strong> is the comparison country. Missing indicators are left blank.'
    ]);
    const TK = Explain.takeaway(viz);
    // default: the latest year in which at least 150 countries report five or more of the six indicators
    const FPY = Math.max(...YEARS.filter(y => Object.values(byYear[y] || {}).filter(r => IND.filter(([k]) => r[COL[k]] != null).length >= 5).length >= 150));
    yr.min = Y0; yr.max = Y1; yr.value = FPY; out.textContent = FPY;
    sa.innerHTML = isos.map(i => `<option value="${i}"${i === 'IND' ? ' selected' : ''}>${C[i].n}</option>`).join('');
    sb.innerHTML = '<option value="">No comparison</option>' + isos.map(i => `<option value="${i}"${i === 'USA' ? ' selected' : ''}>${C[i].n}</option>`).join('');
    const qh = document.getElementById('fp-quick');
    qh.innerHTML = ['IND', 'CHN', 'USA', 'BRA', 'DEU', 'NGA', 'SWE', 'QAT'].filter(i => C[i]).map(i => `<button class="chip" data-i="${i}">${C[i].n}</button>`).join('');
    qh.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) { sa.value = b.dataset.i; draw(); } });
    sa.addEventListener('change', draw); sb.addEventListener('change', draw);
    let timer = null; const play = document.getElementById('fp-play');
    function stop() { clearInterval(timer); timer = null; play.textContent = '▶'; }
    yr.addEventListener('input', () => { stop(); draw(); });
    play.addEventListener('click', () => { if (timer) return stop(); if (+yr.value >= Y1) yr.value = Y0; play.textContent = '❚❚'; timer = setInterval(() => { if (+yr.value >= Y1) return stop(); yr.value = +yr.value + 1; draw(); }, 600); });
    function draw() {
      const y = +yr.value, a = sa.value, b = sb.value, pct = percentiles(y), rows = byYear[y] || {};
      out.textContent = y;
      IND.forEach(([k], j) => {
        pa[j].setAttribute('d', petal(j, pct[a]?.[k] ?? 0));
        pa[j].style.opacity = pct[a]?.[k] == null ? 0 : 1; // missing indicator: no petal, not a zero
        pb[j].setAttribute('d', petal(j, b ? (pct[b]?.[k] ?? 0) : 0));
        pb[j].style.opacity = b && pct[b]?.[k] != null ? 1 : 0;
      });
      const ppi = C[a].ppi[yi(y)], cl = C[a].cl[yi(y)];
      mid.textContent = ppi != null ? (MOB ? ppi.toFixed(0) : `PPI ${ppi.toFixed(0)}`) : '';
      svg.appendChild(hub); svg.appendChild(mid);
      document.getElementById('fp-name').textContent = C[a].n;
      document.getElementById('fp-meta').innerHTML = `${y} · ${cl ? cl + ' · ' + CL[cl].label : 'no profile'}${b ? ` · dashed: ${C[b].n}` : ''}`;
      document.getElementById('fp-list').innerHTML = IND.map(([k, lab, unit]) => {
        const va = rows[a]?.[COL[k]], p_ = pct[a]?.[k], vb = b ? rows[b]?.[COL[k]] : null;
        return `<li><span><i style="background:${SAGE}"></i>${lab}</span><b>${va == null ? '<span class="muted">not reported</span>' : fmt(va, va >= 100 ? 0 : 1) + ` <small>${unit}</small>`}</b><small>${p_ == null ? '' : 'P' + Math.round(p_)}${b && vb != null ? ' · ' + b + ' ' + fmt(vb, vb >= 100 ? 0 : 1) : ''}</small></li>`;
      }).join('');
      const have = IND.filter(([k]) => pct[a]?.[k] != null).map(([k, lab]) => [lab, pct[a][k]]).sort((p, q) => q[1] - p[1]);
      if (have.length) {
        const lc = t => (t.startsWith('PM') ? t : t.charAt(0).toLowerCase() + t.slice(1));
        const hi = have[0], lo = have[have.length - 1];
        let cmp = '';
        if (b && C[b]) { const pb_ = C[b].ppi[yi(y)]; if (pb_ != null && ppi != null) cmp = ` Its overall score of ${fmt(ppi)} is ${ppi > pb_ ? 'higher' : 'lower'} than ${C[b].n}\u2019s ${fmt(pb_)}.`; }
        TK.set(`In <b>${y}</b>, ${C[a].n}\u2019s biggest pressure was <b>${lc(hi[0])}</b>, higher than ${Math.round(hi[1])}% of countries; its smallest was ${lc(lo[0])} (${Math.round(lo[1])}th percentile).${cmp}${have.length < IND.length ? ` ${IND.length - have.length} of the six indicators were not reported that year.` : ''}`);
      } else TK.set(`${C[a].n} reported none of the six indicators in ${y}.`);
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

  // ---------- alluvial (published period result)
  (function alluvial() {
    const svg = document.getElementById('alluvial'); if (!svg) return;
    const W = MOB ? 600 : 1100, H = MOB ? 620 : 460, m = MOB ? { l: 6, r: 6, t: 36, b: 10 } : { l: 20, r: 20, t: 30, b: 10 }, nw = MOB ? 22 : 18, gap = 10;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const cols = P.map((_, k) => m.l + k * (W - m.l - m.r - nw) / (P.length - 1));
    const A2 = X.assign, ids = Object.keys(A2);
    const counts = P.map((_, k) => Object.fromEntries(K.map(c => [c, ids.filter(i => A2[i][k] === c).length])));
    const totalMax = Math.max(...counts.map(c => K.reduce((s, k) => s + c[k], 0)));
    const sc = (H - m.t - m.b - gap * 3) / totalMax;
    const pos = counts.map(cn => { let y0 = m.t; const o = {}; K.forEach(k => { o[k] = { y: y0, h: cn[k] * sc, out: y0, inn: y0 }; y0 += cn[k] * sc + gap; }); return o; });
    const flows = svgEl('g', {}, svg), nodesG = svgEl('g', {}, svg);
    for (let t = 0; t < P.length - 1; t++) {
      K.forEach(a => K.forEach(b => {
        const n = ids.filter(i => A2[i][t] === a && A2[i][t + 1] === b).length; if (!n) return;
        const h = n * sc, x0 = cols[t] + nw, x1 = cols[t + 1], y0 = pos[t][a].out, y1 = pos[t + 1][b].inn;
        pos[t][a].out += h; pos[t + 1][b].inn += h;
        const mx = (x0 + x1) / 2;
        const d = `M${x0},${y0}C${mx},${y0} ${mx},${y1} ${x1},${y1}L${x1},${y1 + h}C${mx},${y1 + h} ${mx},${y0 + h} ${x0},${y0 + h}Z`;
        const p = svgEl('path', { d, fill: CL[a === b ? a : b].color, 'fill-opacity': a === b ? .22 : .55 }, flows);
        p.addEventListener('pointerenter', e => { p.setAttribute('fill-opacity', .9); showTip(`<b>${a} → ${b}</b>${P[t]} → ${P[t + 1]}<br>${n} ${n === 1 ? 'country' : 'countries'}`, e.clientX, e.clientY); });
        p.addEventListener('pointerleave', () => { p.setAttribute('fill-opacity', a === b ? .22 : .55); hideTip(); });
      }));
    }
    P.forEach((p, t) => {
      const lab = svgEl('text', { x: cols[t] + (t === 0 ? 0 : t === P.length - 1 ? nw : nw / 2), y: 18, 'text-anchor': t === 0 ? 'start' : t === P.length - 1 ? 'end' : 'middle', fill: INK, 'font-family': 'Fraunces', 'font-size': 17 }, nodesG); lab.textContent = p;
      K.forEach(k => {
        const o = pos[t][k];
        svgEl('rect', { x: cols[t], y: o.y, width: nw, height: Math.max(1, o.h), fill: CL[k].color }, nodesG);
        if (o.h > (MOB ? 26 : 16)) { const tx = svgEl('text', { x: t === P.length - 1 ? cols[t] - 6 : cols[t] + nw + 6, y: o.y + o.h / 2 + 4, 'text-anchor': t === P.length - 1 ? 'end' : 'start', fill: INK, 'font-family': 'Barlow', 'font-weight': 600, 'font-size': 12 }, nodesG); tx.textContent = `${k} · ${counts[t][k]}`; }
      });
    });
    document.getElementById('alluvial-note').textContent = X.persistence.map(p => Math.round(p.stayed * 100) + '%').join(' and ') + ' stayed in the same profile';
    {
      const viz = document.getElementById('alluvial-viz');
      Explain.guide(viz, [
        'The three columns are the three periods. Each coloured block is a <strong>profile</strong>; its height is the number of countries in it.',
        'The bands between columns are <strong>countries moving</strong>: a band\u2019s width is how many countries took that path. Point at one for the count.',
        'Faint bands stay in the same profile; bright bands change profile.'
      ]);
      const mv = [0, 1].map(t => { let up = 0, down = 0, n = 0; ids.forEach(i => { const a = A2[i][t], b = A2[i][t + 1]; if (!a || !b) return; n++; if (b > a) up++; else if (b < a) down++; }); return { up, down, n }; });
      Explain.takeaway(viz).set(`Profiles are sticky: <b>${X.persistence.map(p => Math.round(p.stayed * 100) + '%').join(' and ')}</b> of countries kept their profile from one period to the next. Almost every move was <b>upward</b>, towards more development and more pressure: ${mv[0].up} up and ${mv[0].down} down from the 1990s to the 2000s, ${mv[1].up} up and ${mv[1].down} down from the 2000s to 2011–2023.`);
    }
    const clip = svgEl('clipPath', { id: 'alclip' }, svgEl('defs', {}, svg)); const cr = svgEl('rect', { x: 0, y: 0, width: 0, height: H }, clip);
    flows.setAttribute('clip-path', 'url(#alclip)');
    onReveal(document.getElementById('alluvial-viz'), () => {
      if (prefersReducedMotion) return cr.setAttribute('width', W);
      const t0 = performance.now();
      const step = t => { const k = Math.max(0, Math.min(1, (t - t0) / 2000)), e = 1 - Math.pow(1 - k, 3); cr.setAttribute('width', W * e); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
  })();

  // ---------- published period associations with Fisher-z intervals
  (function assoc() {
    const as = document.getElementById('assoc'); if (!as) return;
    const reg = X.regressions, outs = [...new Set(reg.map(r => r.outcome))];
    {
      const viz = document.getElementById('assocviz');
      Explain.guide(viz, [
        'Each line is one outcome; each point is its <strong>correlation with the PPI</strong> in one period.',
        'Vertical bars are 95% confidence intervals. <strong>Filled points</strong> are statistically significant; hollow ones are not.',
        'Points above zero rise with pressure, points below fall with it. Point at a dot for the regression details.'
      ]);
      Explain.takeaway(viz).set('Higher pressure goes with <b>higher income, longer lives, more urbanisation and lower infant mortality</b> in all three periods, and with lower female labour participation. Unemployment shows no link. The positive links look weaker in 2011–2023, but year by year that change is not statistically significant (see the correlation chart above).');
    }
    const pal = ['#8fb8ff', '#9cc7a4', '#ece6d8', '#a29f8c', '#ef7b6b', '#e2b45c'];
    const W = MOB ? 600 : 1100, H = MOB ? 480 : 420, m = MOB ? { l: 56, r: 14, t: 20, b: 36 } : { l: 48, r: 300, t: 20, b: 30 };
    as.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const x = k => m.l + 20 + k / 2 * (W - m.l - m.r - 40), y = v => m.t + (1 - (v + 0.7) / 1.4) * (H - m.t - m.b);
    const ax = svgEl('g', { class: 'axis' }, as);
    [-0.6, -0.3, 0, 0.3, 0.6].forEach(v => { svgEl('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), stroke: v === 0 ? 'rgba(236,230,216,.35)' : GRID }, ax); const t = svgEl('text', { x: m.l - 8, y: y(v) + 4, 'text-anchor': 'end' }, ax); t.textContent = v.toFixed(1); });
    P.forEach((p, k) => { const t = svgEl('text', { x: x(k), y: H - 8, 'text-anchor': 'middle' }, ax); t.textContent = p; });
    const fisher = (r, n) => { const z = Math.atanh(r), se = 1 / Math.sqrt(n - 3); return [Math.tanh(z - 1.96 * se), Math.tanh(z + 1.96 * se)]; };
    const lab = [];
    outs.forEach((o, j) => {
      const rs = P.map(p => reg.find(r => r.outcome === o && r.period === p));
      const dx = (j - 2.5) * 5;
      rs.forEach((r, k) => { const [lo, hi] = fisher(r.r, r.n); svgEl('line', { x1: x(k) + dx, x2: x(k) + dx, y1: y(lo), y2: y(hi), stroke: pal[j], 'stroke-opacity': .5, 'stroke-width': 2 }, as); });
      svgEl('path', { d: 'M' + rs.map((r, k) => `${x(k) + dx},${y(r.r)}`).join('L'), fill: 'none', stroke: pal[j], 'stroke-width': 1.6, 'stroke-opacity': .8 }, as);
      rs.forEach((r, k) => {
        const d = svgEl('circle', { cx: x(k) + dx, cy: y(r.r), r: 4, fill: r.p < 0.05 ? pal[j] : PANEL, stroke: pal[j], 'stroke-width': 1.5 }, as);
        const [lo, hi] = fisher(r.r, r.n);
        d.addEventListener('pointerenter', e => showTip(`<b>${o}</b>${r.period}: r = ${r.r.toFixed(2)} (95% CI ${lo.toFixed(2)} to ${hi.toFixed(2)})<br>β = ${r.beta.toFixed(3)} (SE ${r.se.toFixed(3)}) · p ${r.p < 0.0001 ? '< 0.0001' : '= ' + r.p.toFixed(4)} · n = ${r.n}`, e.clientX, e.clientY));
        d.addEventListener('pointerleave', hideTip);
      });
      lab.push([y(rs[2].r), o, pal[j]]);
    });
    lab.sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < lab.length; i++) if (lab[i][0] - lab[i - 1][0] < 15) lab[i][0] = lab[i - 1][0] + 15;
    if (!MOB) lab.forEach(([yy, o, c]) => { const t = svgEl('text', { x: x(2) + 20, y: yy + 4, fill: c, 'font-size': 12, 'font-family': 'Barlow', 'font-weight': 600 }, as); t.textContent = o; });
    const lg = document.createElement('div'); lg.className = 'legend';
    lg.innerHTML = outs.map((o, j) => `<span><i style="background:${pal[j]};border-radius:50%"></i>${o}</span>`).join('') + '<span><i style="background:transparent;border:1.5px solid #ece6d8;border-radius:50%"></i>Hollow: not significant</span>';
    (as.closest('.svgwrap') || as).after(lg);
  })();

  // ---------- K diagnostics
  (function kchart() {
    const svg = document.getElementById('ksvg'); if (!svg) return;
    const W = MOB ? 600 : 1100, H = MOB ? 340 : 280, m = MOB ? { l: 50, r: 8, t: 28, b: 34 } : { l: 44, r: 12, t: 22, b: 28 };
    {
      const viz = document.getElementById('kviz');
      Explain.guide(viz, [
        'K is the number of profiles the clustering is asked to find. Each bar is one choice of K.',
        'The <strong>silhouette score</strong> (0 to 1) measures how cleanly countries separate into groups. Higher is cleaner.',
        'The highlighted bar is <strong>K = 4</strong>, the choice used in the thesis.'
      ]);
      const k4 = X.k.find(k => k.k === 4), k2 = X.k.find(k => k.k === 2);
      Explain.takeaway(viz).set(`Two groups separate most cleanly (silhouette ${k2.sil.toFixed(2)}), but they only split rich from poor. Four profiles (silhouette ${k4.sil.toFixed(2)}) keep useful development tiers at a small cost in separation, so the groups overlap and are best read as a <b>typology</b>, not sharp categories.`);
    }
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const ks = X.k, smax = Math.max(...ks.map(k => k.sil)) * 1.15, bw = (W - m.l - m.r) / ks.length;
    const y = v => m.t + (1 - v / smax) * (H - m.t - m.b);
    const ax = svgEl('g', { class: 'axis' }, svg);
    [0, 0.2, 0.4].forEach(v => { svgEl('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), stroke: GRID }, ax); const t = svgEl('text', { x: m.l - 6, y: y(v) + 4, 'text-anchor': 'end' }, ax); t.textContent = v.toFixed(1); });
    ks.forEach((k, i) => {
      const bx = m.l + i * bw + bw * 0.18;
      const r = svgEl('rect', { x: bx, y: y(0), width: bw * 0.64, height: 0, fill: k.k === 4 ? SAGE : '#3d4136' }, svg);
      r.style.transition = `all .9s cubic-bezier(.2,.7,.1,1) ${i * 0.07}s`; r.dataset.y = y(k.sil); r.dataset.h = y(0) - y(k.sil);
      const t = svgEl('text', { x: bx + bw * 0.32, y: H - 8, 'text-anchor': 'middle' }, ax); t.textContent = 'K=' + k.k;
      const v = svgEl('text', { x: bx + bw * 0.32, y: y(k.sil) - 6, 'text-anchor': 'middle', fill: INK, 'font-size': 11, 'font-family': 'Barlow', 'font-weight': 600 }, svg); v.textContent = k.sil.toFixed(2);
    });
    onReveal(document.getElementById('kviz'), () => requestAnimationFrame(() => requestAnimationFrame(() => svg.querySelectorAll('rect').forEach(r => { r.setAttribute('y', r.dataset.y); r.setAttribute('height', r.dataset.h); }))));
  })();

  // ---------- map by year
  (async function map() {
    const svg = document.getElementById('map'); if (!svg) return;
    const world = await fetch('assets/world.json').then(r => r.json());
    const input = document.getElementById('map-year'), out = document.getElementById('map-out');
    input.min = Y0; input.max = YMAX;
    let cur = LASTFULL, by = 'ppi', timer = null;
    const stops = [[35, 64, 74], [92, 140, 110], [226, 182, 92], [232, 96, 66]];
    const ramp = v => {
      const t = Math.max(0, Math.min(1, (v - 10) / 60)), s = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(s)), f = s - i;
      return `rgb(${stops[i].map((a, k) => Math.round(a + (stops[i + 1][k] - a) * f))})`;
    };
    const val = (iso, y) => {
      if (!C[iso]) return null;
      if (y <= Y1) return { ppi: C[iso].ppi[yi(y)], cl: C[iso].cl[yi(y)], prov: false };
      const r = liveRow(iso, y); return r ? { ppi: r.ppi, cl: r.profile, prov: true } : null;
    };
    const mp = WorldMap(svg, world, {
      include: iso => !!C[iso],
      tip: iso => { const v = val(iso, cur); if (!C[iso]) return null; if (!v || v.ppi == null) return `<b>${C[iso].n}</b>${cur}: no PPI`; return `<b>${C[iso].n}</b>${cur}${v.prov ? ' · provisional' : ''}<br>PPI ${fmt(v.ppi)} · ${v.cl ? v.cl + ' · ' + CL[v.cl].label : 'no profile'}`; }
    });
    const leg = document.getElementById('map-legend'), note = document.getElementById('map-note');
    const viz = document.getElementById('mapviz');
    Explain.guide(viz, [
      '<strong>Pressure index</strong>: darker green = less pressure, orange and red = more. <strong>Profile</strong>: colour = development profile.',
      'Drag the slider or press <strong>▶</strong> to move through 1990–2023. Point at a country for its numbers.',
      'Dark grey = not enough data that year. Years after 2023 are provisional live data.'
    ]);
    const RO = Explain.readout(viz), TK = Explain.takeaway(viz);
    function paint() {
      input.value = cur; out.textContent = cur;
      let n = 0;
      mp.paint(iso => { const v = val(iso, cur); if (!v) return null; const c = by === 'cl' ? (v.cl ? CL[v.cl].color : null) : (v.ppi == null ? null : ramp(v.ppi)); if (c) n++; return c; });
      leg.innerHTML = by === 'cl' ? legendHTML() + '<span><i style="background:#1a1d22"></i>No data</span>' : `<span style="display:flex;align-items:center;gap:10px">Less pressure · PPI ≤ 10 <i style="width:180px;height:10px;background:linear-gradient(90deg,${[10, 30, 50, 70].map(ramp).join(',')})"></i> PPI ≥ 70 · more pressure</span><span><i style="background:#1a1d22"></i>No data</span>`;
      note.textContent = `${cur}: ${n} countries shown${cur > Y1 ? ' · provisional values from the live World Bank feed' : SUM[cur] && SUM[cur].countries_with_ppi < 150 ? ' · partial coverage, compare with care' : ''}.`;
      const vals = isos.map(i => [i, val(i, cur)]).filter(([, v]) => v && v.ppi != null).sort((p, q) => q[1].ppi - p[1].ppi);
      if (!vals.length) return;
      const mean = vals.reduce((a, [, v]) => a + v.ppi, 0) / vals.length, hi = vals[0], lo = vals[vals.length - 1];
      const sh = K.map(c => vals.filter(([, v]) => v.cl === c).length), np = sh.reduce((a, b) => a + b, 0);
      RO.set([
        ['Year', cur, cur > Y1 ? 'provisional' : SUM[cur] && SUM[cur].countries_with_ppi < 150 ? 'partial coverage' : '', cur > Y1 || (SUM[cur] && SUM[cur].countries_with_ppi < 150) ? 'warn' : ''],
        ['Countries', vals.length],
        ['Mean PPI', fmt(mean), SUM[cur] && cur <= Y1 ? `95% CI ${fmt(SUM[cur].ci_low)}–${fmt(SUM[cur].ci_high)}` : 'no interval'],
        ['Highest', fmt(hi[1].ppi), C[hi[0]].n],
        ['Lowest', fmt(lo[1].ppi), C[lo[0]].n]
      ]);
      TK.set(by === 'ppi'
        ? `In <b>${cur}</b> the highest pressure score was <b>${C[hi[0]].n}</b> (${fmt(hi[1].ppi)}) and the lowest <b>${C[lo[0]].n}</b> (${fmt(lo[1].ppi)}); the average across ${vals.length} countries was ${fmt(mean)}. Top five: ${vals.slice(0, 5).map(([i]) => C[i].n).join(', ')}.`
        : `In <b>${cur}</b>, of ${np} profiled countries: ${K.map((c, k) => `${sh[k]} in ${c} (${CL[c].label.toLowerCase()})`).join(', ')}.`);
    }
    document.querySelectorAll('#mapviz [data-by]').forEach(b => b.addEventListener('click', () => { by = b.dataset.by; document.querySelectorAll('#mapviz [data-by]').forEach(z => z.setAttribute('aria-pressed', String(z === b))); paint(); }));
    const play = document.getElementById('map-play');
    function stop() { clearInterval(timer); timer = null; play.textContent = '▶'; }
    input.addEventListener('input', () => { stop(); cur = +input.value; paint(); });
    play.addEventListener('click', () => { if (timer) return stop(); if (cur >= YMAX) cur = Y0 - 1; play.textContent = '❚❚'; timer = setInterval(() => { if (cur >= YMAX) return stop(); cur++; paint(); }, 450); });
    paint();
  })();

  // ---------- country by country
  (function country() {
    const sel = document.getElementById('c-country'); if (!sel) return;
    sel.innerHTML = isos.map(i => `<option value="${i}"${i === 'IND' ? ' selected' : ''}>${C[i].n}</option>`).join('');
    const qh = document.getElementById('c-quick');
    qh.innerHTML = ['IND', 'CHN', 'USA', 'BRA', 'NGA', 'DEU', 'BGD', 'QAT'].filter(i => C[i]).map(i => `<button class="chip" data-i="${i}">${C[i].n}</button>`).join('');
    qh.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) { sel.value = b.dataset.i; show(b.dataset.i); } });
    sel.addEventListener('change', () => show(sel.value));
    const PANELS = [
      ['ppi', 'Planetary Pressure Index', '0–100', r => r.ppi],
      ['le', 'Life expectancy', 'years', r => r.le],
      ['gdp', 'GDP per person', 'US$, log scale', r => (r.gdp > 0 ? Math.log(r.gdp) : null)],
      ['im', 'Infant mortality', 'per 1,000', null]
    ];
    function spark(host, c, iso, key, label, unit, liveVal) {
      const W = MOB ? 380 : 520, H = MOB ? 190 : 170, m = { l: MOB ? 56 : 52, r: 10, t: 14, b: 22 };
      const vals = c[key], lv = [];
      if (liveVal) LIVE_YEARS.forEach(y => { const r = liveRow(iso, y); const v = r ? liveVal(r) : null; if (v != null) lv.push([y, v]); });
      const all = [...vals.filter(v => v != null), ...lv.map(p => p[1])];
      const box = document.createElement('div'); box.className = 'pf-card';
      const lastI = vals.map((v, i) => (v == null ? -1 : i)).reduce((a, b) => Math.max(a, b), -1);
      const disp = v => (key === 'gdp' ? '$' + Math.round(Math.exp(v)).toLocaleString('en-US') : fmt(v, 1));
      box.innerHTML = `<div class="pf-t"><span>${label} <small class="muted">· ${unit}</small></span><b>${lastI < 0 ? 'n/a' : disp(vals[lastI])}<small> ${lastI < 0 ? '' : Y0 + lastI}</small></b></div>`;
      host.appendChild(box);
      if (!all.length) { box.insertAdjacentHTML('beforeend', '<p class="muted small">No data</p>'); return; }
      const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}` }, box);
      let lo = Math.min(...all), hi = Math.max(...all); const pad = (hi - lo) * 0.12 || 1; lo -= pad; hi += pad;
      const x = y => m.l + (y - Y0) / (YMAX - Y0) * (W - m.l - m.r), y = v => m.t + (1 - (v - lo) / (hi - lo)) * (H - m.t - m.b);
      const ax = svgEl('g', { class: 'axis' }, svg);
      [lo + pad, hi - pad].forEach(v => { svgEl('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), stroke: GRID }, ax); const t = svgEl('text', { x: m.l - 6, y: y(v) + 4, 'text-anchor': 'end' }, ax); t.textContent = key === 'gdp' ? '$' + Math.round(Math.exp(v)).toLocaleString('en-US') : Math.round(v); });
      [[Y0, 'start'], [YMAX, 'end']].forEach(([yy, a]) => { const t = svgEl('text', { x: x(yy), y: H - 4, 'text-anchor': a }, ax); t.textContent = yy; });
      let d = '', pen = false;
      vals.forEach((v, i) => { if (v == null) { pen = false; return; } d += (pen ? 'L' : 'M') + x(Y0 + i) + ',' + y(v); pen = true; });
      svgEl('path', { d, fill: 'none', stroke: key === 'ppi' ? SAND : SAGE, 'stroke-width': 2 }, svg);
      vals.forEach((v, i) => {
        if (v == null) return;
        const cl = c.cl[i];
        const dot = svgEl('circle', { cx: x(Y0 + i), cy: y(v), r: 2.6, fill: key === 'ppi' && cl ? CL[cl].color : (key === 'ppi' ? SAND : SAGE) }, svg);
        dot.addEventListener('pointerenter', e => showTip(`<b>${c.n} · ${Y0 + i}</b>${label}: ${disp(v)}${cl ? '<br>Profile ' + cl + ' · ' + CL[cl].label : ''}`, e.clientX, e.clientY));
        dot.addEventListener('pointerleave', hideTip);
      });
      lv.forEach(([yy, v]) => { const dot = svgEl('circle', { cx: x(yy), cy: y(v), r: 3.4, fill: PANEL, stroke: SAGE, 'stroke-width': 1.5 }, svg); dot.addEventListener('pointerenter', e => showTip(`<b>${c.n} · ${yy} · provisional</b>${label}: ${disp(v)}`, e.clientX, e.clientY)); dot.addEventListener('pointerleave', hideTip); });
    }
    const viz = document.getElementById('cviz');
    Explain.guide(viz, [
      'The <strong>strip</strong> shows the country\u2019s development profile in each year from 1990 (same colours as the map).',
      'The four charts follow its <strong>pressure score</strong>, life expectancy, income and infant mortality. Point at any dot for the value.',
      'Dots on the pressure chart take the profile colour. <strong>Hollow dots</strong> are provisional newer data.'
    ]);
    const RO = Explain.readout(viz), TK = Explain.takeaway(viz);
    document.getElementById('c-strip').after(RO.el);
    const firstLast = arr => { const f = arr.findIndex(v => v != null); let l = -1; arr.forEach((v, j) => { if (v != null) l = j; }); return f < 0 ? null : [f, l]; };
    function show(iso) {
      const c = C[iso];
      document.getElementById('c-name').textContent = c.n;
      const i = yi(LASTFULL), cl = c.cl[i];
      document.getElementById('c-sub').textContent = `${fmt((c.pop[i] || 0) / 1e6, 1)} million people in ${LASTFULL} · PPI ${fmt(c.ppi[i])}`;
      document.getElementById('c-status').innerHTML = cl ? `<span class="pill" style="border-color:${CL[cl].color};color:${CL[cl].color}">${LASTFULL} · ${cl} · ${CL[cl].label}</span>` : '';
      const strip = document.getElementById('c-strip'); strip.innerHTML = ''; strip.style.gridTemplateColumns = `repeat(${YEARS.length},1fr)`;
      YEARS.forEach((y, j) => { const s = document.createElement('span'); const k = c.cl[j]; s.style.background = k ? CL[k].color : '#1a1d22'; s.title = `${y}: ${k ? k + ' · ' + CL[k].label : 'no profile'}`; strip.appendChild(s); });
      strip.insertAdjacentHTML('beforeend', `<em>${Y0}</em><em>${Y1}</em>`);
      const grid = document.getElementById('c-grid'); grid.innerHTML = '';
      PANELS.forEach(([k, l, u, lv]) => spark(grid, c, iso, k, l, u, lv));
      const fp = firstLast(c.ppi), fl = firstLast(c.le), fg = firstLast(c.gdp);
      const path = c.cl.filter(Boolean).filter((k, j, a) => j === 0 || k !== a[j - 1]);
      const dP = fp ? c.ppi[fp[1]] - c.ppi[fp[0]] : null, dL = fl ? c.le[fl[1]] - c.le[fl[0]] : null;
      const gx = fg ? Math.exp(c.gdp[fg[1]] - c.gdp[fg[0]]) : null;
      RO.set([
        ['Pressure index', fp ? `${fmt(c.ppi[fp[0]])} → ${fmt(c.ppi[fp[1]])}` : 'n/a', fp ? `${Y0 + fp[0]}–${Y0 + fp[1]}` : '', dP == null ? '' : dP > 0 ? 'down' : 'up'],
        ['Life expectancy', fl ? `${dL >= 0 ? '+' : ''}${fmt(dL)} yrs` : 'n/a', fl ? `${fmt(c.le[fl[0]])} → ${fmt(c.le[fl[1]])}` : '', dL > 0 ? 'up' : ''],
        ['GDP per person', gx ? `×${fmt(gx, 1)}` : 'n/a', fg ? `$${Math.round(Math.exp(c.gdp[fg[0]])).toLocaleString('en-US')} → $${Math.round(Math.exp(c.gdp[fg[1]])).toLocaleString('en-US')}` : ''],
        ['Profile path', path.length ? path.join(' → ') : 'n/a', path.length > 1 ? 'changed profile' : 'stable']
      ]);
      TK.set(fp && fl ? `<b>${c.n}</b>: life expectancy ${dL >= 0 ? 'rose' : 'fell'} from ${fmt(c.le[fl[0]])} to ${fmt(c.le[fl[1]])} years and income grew ${fmt(gx, 1)}-fold, while its pressure score went from ${fmt(c.ppi[fp[0]])} to <b>${fmt(c.ppi[fp[1]])}</b> (${dP >= 0 ? '+' : ''}${fmt(dP)} points). ${path.length > 1 ? `It moved through the profiles ${path.join(' → ')}.` : path.length ? `It stayed in ${path[0]} (${CL[path[0]].label.toLowerCase()}) throughout.` : ''}` : `Not enough data for ${c.n}.`);
    }
    show('IND');
  })();

  // ---------- live panel
  (function live() {
    const kv = document.getElementById('live-kv'); if (!kv) return;
    if (!LIVE) {
      kv.innerHTML = '<dt>Status</dt><dd>The live feed could not be reached just now. The thesis results above do not depend on it.</dd>';
      return;
    }
    const d = new Date(LIVE.fetched.replace('Z', ':00Z'));
    document.getElementById('live-when').textContent = isNaN(d) ? 'weekly' : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const lu = Object.values(LIVE.last_updated || {}).filter(Boolean).sort().pop();
    const cov = Object.entries(LIVE.coverage || {}).slice(-6).map(([y, n]) => `${y}: ${n}`).join(' · ');
    const ag = LIVE.agreement_with_thesis;
    kv.innerHTML = `<dt>Last fetched</dt><dd>${LIVE.fetched.replace('T', ' ')} (UTC)</dd>
      <dt>Source</dt><dd>${LIVE.source}${lu ? ` · newest series updated ${lu}` : ''}</dd>
      <dt>Countries with a provisional PPI</dt><dd>${cov || 'n/a'}</dd>
      <dt>Agreement with thesis data</dt><dd>${ag ? `r = ${ag.r} over ${ag.pairs.toLocaleString('en-US')} country-years · mean absolute difference ${ag.mean_abs_diff} PPI points (data revisions)` : 'n/a'}</dd>
      <dt>Years beyond the thesis</dt><dd>${LIVE_YEARS.length ? LIVE_YEARS.join(', ') + ' (hollow points in the charts)' : 'None yet: several pressure series are published two or more years late.'}</dd>
      <dt>Rule</dt><dd>${LIVE.rule}</dd>`;
  })();
})();
