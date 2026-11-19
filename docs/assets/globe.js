// Hero globe: textured Earth, atmosphere glow, star field and optional glowing data points.
import * as THREE from './vendor/three.module.min.js';

export function mountGlobe(canvas, opts = {}) {
  const o = Object.assign({
    texture: 'img/earth-night.jpg', bump: null, tint: 0xffffff, atmosphere: 0x5ab4ff,
    rotate: 0.035, tilt: 0.38, startLon: 75, points: [], offsetX: 0.42, zoom: 1, sun: false
  }, opts);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 6.2 / o.zoom);

  const group = new THREE.Group();
  group.rotation.z = -0.12;
  group.rotation.x = o.tilt;
  scene.add(group);

  const loader = new THREE.TextureLoader();
  const tex = loader.load(o.texture, () => { canvas.classList.add('ready'); });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const matOpts = { map: tex, color: o.tint };
  let mat;
  if (o.sun) {
    mat = new THREE.MeshPhongMaterial(Object.assign(matOpts, { shininess: 12, specular: 0x223344 }));
    if (o.bump) { mat.bumpMap = loader.load(o.bump); mat.bumpScale = 0.02; }
    scene.add(new THREE.AmbientLight(0x6f86a6, 0.55));
    const sunL = new THREE.DirectionalLight(0xffffff, 2.4);
    sunL.position.set(-4, 1.8, 3.2);
    scene.add(sunL);
  } else {
    mat = new THREE.MeshBasicMaterial(matOpts);
  }
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1.5, 128, 128), mat);
  group.add(earth);

  // atmosphere (fresnel rim)
  const atm = new THREE.Mesh(
    new THREE.SphereGeometry(1.5 * 1.16, 96, 96),
    new THREE.ShaderMaterial({
      uniforms: { c: { value: new THREE.Color(o.atmosphere) } },
      vertexShader: 'varying vec3 vN;varying vec3 vP;void main(){vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vP=-mv.xyz;gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'uniform vec3 c;varying vec3 vN;varying vec3 vP;void main(){float d=-dot(normalize(vN),normalize(vP));float f=pow(clamp(d/0.52,0.,1.),2.6);gl_FragColor=vec4(c*f*0.95,f);}',
      blending: THREE.AdditiveBlending, side: THREE.BackSide, transparent: true, depthWrite: false
    })
  );
  group.add(atm);

  // stars
  const n = 2600, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = 30 + Math.random() * 30, t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(p) * Math.cos(t); pos[i * 3 + 1] = r * Math.sin(p) * Math.sin(t); pos[i * 3 + 2] = r * Math.cos(p);
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.07, sizeAttenuation: true, transparent: true, opacity: 0.75 }));
  scene.add(stars);

  // data points (lat/lon) as soft glowing sprites on the surface
  const spin = new THREE.Group(); earth.add(spin);
  const dotTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
  })();
  const sprites = [];
  function setPoints(points) {
    sprites.splice(0).forEach(s => spin.remove(s));
    for (const p of points) {
      const phi = (90 - p.lat) * Math.PI / 180, th = (p.lon + 180) * Math.PI / 180, r = 1.53;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: new THREE.Color(p.color), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.position.set(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
      const k = 0.028 + 0.05 * (p.size || 0.3);
      s.scale.set(k, k, k); s.userData.k = k; s.userData.ph = Math.random() * 6.28;
      spin.add(s); sprites.push(s);
    }
  }
  setPoints(o.points);

  earth.rotation.y = -(o.startLon + 90) * Math.PI / 180;

  let w = 0, h = 0;
  function size() {
    const r = canvas.getBoundingClientRect();
    if (r.width === w && r.height === h) return;
    w = r.width; h = r.height;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const mobile = w < 760;
    camera.setViewOffset(w, h, mobile ? 0 : -w * o.offsetX * 0.5, mobile ? h * 0.18 : 0, w, h);
    camera.position.z = (mobile ? 7.4 : 6.2) / o.zoom;
    camera.updateProjectionMatrix();
  }
  let mx = 0, my = 0;
  addEventListener('pointermove', e => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; }, { passive: true });

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let visible = true, raf = 0, t0 = performance.now();
  new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible && !raf) loop(); }).observe(canvas);
  function loop() {
    raf = 0;
    if (!visible) return;
    size();
    const t = (performance.now() - t0) / 1000;
    if (!reduce) {
      earth.rotation.y += o.rotate * 0.016;
      group.rotation.y += (mx * 0.25 - group.rotation.y) * 0.03;
      group.rotation.x += (o.tilt + my * 0.15 - group.rotation.x) * 0.03;
      stars.rotation.y = t * 0.004;
      for (const s of sprites) { const k = s.userData.k * (1 + 0.25 * Math.sin(t * 2 + s.userData.ph)); s.scale.set(k, k, k); }
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }
  size(); loop();
  return { setPoints };
}
