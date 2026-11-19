/* World choropleth (Equal Earth). Small states missing from the 110m outlines are drawn as dots. */
window.WorldMap = function (svg, world, opts) {
  const W = 960, H = 470;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('role', 'img');
  const proj = d3.geoEqualEarth().fitExtent([[6, 6], [W - 6, H - 6]], { type: 'Sphere' });
  const path = d3.geoPath(proj);
  const g = svgEl('g', {}, svg);
  svgEl('path', { d: path({ type: 'Sphere' }), fill: '#07090c', stroke: 'rgba(255,255,255,.12)' }, g);
  svgEl('path', { d: path(d3.geoGraticule10()), fill: 'none', stroke: 'rgba(255,255,255,.05)' }, g);
  const feats = topojson.feature(world.topo, world.topo.objects.countries).features;
  const nodes = {};
  for (const f of feats) {
    if (f.id === 'ATA') continue;
    const p = svgEl('path', { d: path(f), class: 'country', fill: '#1a1d22', tabindex: f.id ? 0 : -1 }, g);
    if (f.id) { nodes[f.id] = nodes[f.id] || []; nodes[f.id].push(p); p.dataset.iso = f.id; }
  }
  for (const [iso, c] of Object.entries(world.small)) {
    if (!opts.include || !opts.include(iso)) continue;
    const xy = proj(c);
    const p = svgEl('circle', { cx: xy[0], cy: xy[1], r: 3.2, class: 'country', fill: '#1a1d22', tabindex: 0 }, g);
    p.dataset.iso = iso; nodes[iso] = [p];
  }
  const tipFor = e => {
    const iso = e.target.dataset && e.target.dataset.iso;
    if (!iso) return;
    const html = opts.tip(iso);
    if (!html) return hideTip();
    const r = e.target.getBoundingClientRect();
    showTip(html, e.clientX || r.x + r.width / 2, e.clientY || r.y);
  };
  svg.addEventListener('pointermove', tipFor);
  svg.addEventListener('focusin', tipFor);
  svg.addEventListener('pointerleave', hideTip);
  svg.addEventListener('focusout', hideTip);
  return {
    paint(colorOf) {
      for (const [iso, ps] of Object.entries(nodes)) {
        const c = colorOf(iso) || '#1a1d22';
        ps.forEach(p => { p.setAttribute('fill', c); p.setAttribute('aria-label', iso); });
      }
    }
  };
};
