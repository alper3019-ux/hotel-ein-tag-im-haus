/**
 * „Ein Tag im Haus“ – prozedurale Talszene (three.js, keine externen Modelle).
 *
 * - Himmel: three.js-Addon „Sky“ (Preetham-Tageslichtmodell). Die Sonnenposition folgt der
 *   Uhrzeit (Aufgang rechts/Nordost, Mittag hinter der Kamera/Süd, Untergang links/Nordwest).
 * - Nachthimmel: eigener Verlaufs-Dom + Sterne (Points), Deckkraft nach Sonnenstand.
 * - Gelände: Höhenfeld aus Value-Noise-fBm, Bergkette hinten, See links, Hotelplateau.
 * - Hotel: Steinsockel, Holzaufbau, Satteldach, Balkone, Spa-Anbau. Die Fenster sind nach
 *   Bereichen gruppiert (Zimmer, Restaurant, Spa, Dachfenster) und gehen je nach Uhrzeit an.
 * - Gerendert wird nur bei Änderung (Uhrzeit wird exponentiell nachgeführt) und nur, wenn
 *   der Abschnitt sichtbar ist.
 */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, Vector3, Fog, ACESFilmicToneMapping, SRGBColorSpace,
  PlaneGeometry, BoxGeometry, ConeGeometry, CylinderGeometry, SphereGeometry, CircleGeometry, BufferGeometry, Float32BufferAttribute, BufferAttribute,
  MeshStandardMaterial, MeshBasicMaterial, ShaderMaterial, PointsMaterial, Mesh, Group, InstancedMesh, Points, Object3D,
  DirectionalLight, HemisphereLight, PointLight, PCFShadowMap, BackSide, AdditiveBlending, MathUtils,
} from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

const { smoothstep, lerp, clamp, degToRad } = MathUtils;

/* ---------- Rauschen ---------- */
function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123; return s - Math.floor(s); }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x, y, oct = 5) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f); n += a; a *= 0.5; f *= 2.03; const t = x; x = 0.8 * x - 0.6 * y; y = 0.6 * t + 0.8 * y; }
  return s / n;
}
let seedRand = 7;
const rand = () => { seedRand = (seedRand * 16807) % 2147483647; return (seedRand - 1) / 2147483646; };

const LAKE = { x: -30, z: 4, r: 19 };
const PAD = { x: 8, z: 16, r: 17, h: 1.2 };

function terrainHeight(x, z) {
  const back = smoothstep(-z, 90, 320);
  const side = smoothstep(Math.abs(x), 120, 300) * 0.7;
  const m = Math.max(back, side);
  const n = fbm(x * 0.011 + 3.1, z * 0.011 - 1.7);
  const r = 1 - Math.abs(fbm(x * 0.021 + 9, z * 0.021 + 2, 4) * 2 - 1);
  let h = m * m * (30 + 52 * n + 26 * r * m);
  h += (fbm(x * 0.045, z * 0.045, 3) - 0.5) * 4 * (1 - m) + 0.6;
  const dl = Math.hypot(x - LAKE.x, (z - LAKE.z) * 1.35);
  const lakeT = smoothstep(dl, LAKE.r - 2, LAKE.r + 12);
  h = lerp(-2.4, h, lakeT);
  const dp = Math.hypot(x - PAD.x, z - PAD.z);
  h = lerp(PAD.h, h, smoothstep(dp, PAD.r - 6, PAD.r + 8));
  return h;
}

/* ---------- Tageszeit-Tabellen ---------- */
// Sonnenhöhe in Grad, stückweise mit Kosinus-Übergang interpoliert
const EL_KEYS = [[4, -12], [6, 1.5], [8, 15], [12, 50], [17, 17], [19.5, 2.5], [20, -1.5], [21, -9], [23, -24], [24, -28]];
function sunElevation(h) {
  for (let i = 0; i < EL_KEYS.length - 1; i++) {
    const [h0, e0] = EL_KEYS[i], [h1, e1] = EL_KEYS[i + 1];
    if (h <= h1) { const t = clamp((h - h0) / (h1 - h0), 0, 1); return lerp(e0, e1, (1 - Math.cos(t * Math.PI)) / 2); }
  }
  return EL_KEYS.at(-1)[1];
}
// Himmelsrichtung relativ zur Blickrichtung (0 = geradeaus/Nord, 90 = rechts/Ost, 180 = hinter der Kamera/Süd)
const sunAzimuth = (h) => 62 + ((h - 6) / 14) * 236;

const PALETTE = [ // Stunde, Nebel/Horizont, Halbkugel-Himmel, Halbkugel-Boden
  [5, '#2b3346', '#33405e', '#1a1c1e'],
  [6, '#e8b48e', '#f3c6a0', '#5a5040'],
  [8, '#cfd8dc', '#cfe0f0', '#6a6a50'],
  [12, '#c3d3e3', '#cfe2f6', '#6f7254'],
  [17, '#e9c393', '#f2d6aa', '#6e5a40'],
  [20, '#7a5a6e', '#6c6a90', '#2a2228'],
  [21, '#2f3550', '#3a4870', '#1c1c24'],
  [23, '#0e1424', '#2a3762', '#101218'],
];
const tmpA = new Color(), tmpB = new Color();
function palette(h, idx, out) {
  let i = 0;
  while (i < PALETTE.length - 2 && h > PALETTE[i + 1][0]) i++;
  const [h0] = PALETTE[i], [h1] = PALETTE[i + 1];
  const t = clamp((h - h0) / (h1 - h0), 0, 1);
  return out.copy(tmpA.set(PALETTE[i][idx])).lerp(tmpB.set(PALETTE[i + 1][idx]), t);
}

export function createValley(canvas, { mobile = false, onFirstFrame } = {}) {
  const renderer = new WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance', alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.75));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.shadowMap.enabled = !mobile;
  renderer.shadowMap.type = PCFShadowMap;

  const scene = new Scene();
  scene.fog = new Fog(0xcfd8dc, 180, 900);
  const camera = new PerspectiveCamera(mobile ? 52 : 38, 1, 0.5, 12000);

  /* Himmel */
  const sky = new Sky();
  sky.scale.setScalar(10000);
  const su = sky.material.uniforms;
  su.turbidity.value = 3.2; su.rayleigh.value = 1.6; su.mieCoefficient.value = 0.006; su.mieDirectionalG.value = 0.82;
  su.cloudCoverage.value = 0.32; su.cloudDensity.value = 0.45; su.cloudElevation.value = 0.55; su.cloudScale.value = 0.00022;
  sky.material.fog = false;
  scene.add(sky);

  /* Nacht-Dom + Sterne */
  const nightMat = new ShaderMaterial({
    side: BackSide, transparent: true, depthWrite: false, fog: false,
    uniforms: { uOpacity: { value: 0 }, uTop: { value: new Color('#060b1c') }, uLow: { value: new Color('#1d2a4a') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uOpacity; uniform vec3 uTop; uniform vec3 uLow; varying vec3 vP; void main(){ float t = smoothstep(-0.05, 0.55, vP.y); gl_FragColor = vec4(mix(uLow, uTop, t), uOpacity); }',
  });
  const nightDome = new Mesh(new SphereGeometry(4000, 32, 16), nightMat);
  nightDome.renderOrder = 1;
  scene.add(nightDome);

  const starCount = mobile ? 900 : 1800;
  const sp = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const u = rand() * Math.PI * 2, v = Math.asin(0.04 + rand() * 0.96);
    sp.set([Math.cos(u) * Math.cos(v) * 3500, Math.sin(v) * 3500, Math.sin(u) * Math.cos(v) * 3500], i * 3);
  }
  const starGeo = new BufferGeometry();
  starGeo.setAttribute('position', new Float32BufferAttribute(sp, 3));
  const starMat = new PointsMaterial({ color: 0xffffff, size: mobile ? 1.6 : 1.8, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false, blending: AdditiveBlending });
  const stars = new Points(starGeo, starMat);
  stars.renderOrder = 2;
  scene.add(stars);
  const moon = new Mesh(new CircleGeometry(60, 40), new MeshBasicMaterial({ color: 0xf3efe2, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  moon.renderOrder = 3;
  scene.add(moon);

  /* Licht */
  const sun = new DirectionalLight(0xffffff, 3);
  sun.castShadow = !mobile;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -45; sun.shadow.camera.right = 45; sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 400;
  sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.6; sun.shadow.radius = 3;
  sun.target.position.set(PAD.x, 0, PAD.z);
  scene.add(sun, sun.target);
  const moonLight = new DirectionalLight(0x9fb4ff, 0);
  moonLight.position.set(-200, 260, -300);
  scene.add(moonLight);
  const hemi = new HemisphereLight(0xcfe2f6, 0x6f7254, 1.2);
  scene.add(hemi);
  const glow = new PointLight(0xffb066, 0, 60, 1.6);
  glow.position.set(PAD.x, 4, PAD.z + 10);
  scene.add(glow);

  /* Gelände */
  const segX = mobile ? 120 : 200, segZ = mobile ? 90 : 150;
  const tg = new PlaneGeometry(820, 600, segX, segZ);
  tg.rotateX(-Math.PI / 2);
  tg.translate(0, 0, -190);
  const pos = tg.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
  tg.computeVertexNormals();
  const nrm = tg.attributes.normal;
  const cols = new Float32Array(pos.count * 3);
  const cGrass = new Color('#5f7a3a'), cMeadow = new Color('#7f9446'), cForest = new Color('#3e5530'), cRock = new Color('#7d7568'), cRockD = new Color('#5c564d'), cSnow = new Color('#f2f4f6'), cShore = new Color('#8a8064');
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), ny = nrm.getY(i);
    const n = fbm(x * 0.06, z * 0.06, 3);
    c.copy(cMeadow).lerp(cGrass, n);
    c.lerp(cForest, smoothstep(y, 12, 30) * 0.7);
    const rock = Math.max(smoothstep(1 - ny, 0.28, 0.5), smoothstep(y, 48, 75));
    c.lerp(n > 0.5 ? cRock : cRockD, rock);
    const snow = smoothstep(y + n * 20, 92, 112) * smoothstep(ny, 0.55, 0.8);
    c.lerp(cSnow, snow);
    c.lerp(cShore, 1 - smoothstep(y, -1.6, 0.4));
    cols.set([c.r, c.g, c.b], i * 3);
  }
  tg.setAttribute('color', new BufferAttribute(cols, 3));
  const terrain = new Mesh(tg, new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
  terrain.receiveShadow = !mobile;
  scene.add(terrain);

  /* See */
  const waterMat = new MeshStandardMaterial({ color: 0x41606e, roughness: 0.08, metalness: 0.35, transparent: true, opacity: 0.94 });
  const water = new Mesh(new CircleGeometry(1, 64), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.scale.set(LAKE.r + 9, (LAKE.r + 9) / 1.35, 1);
  water.position.set(LAKE.x, -0.55, LAKE.z);
  scene.add(water);

  /* Bäume (instanziert) */
  const treeN = mobile ? 450 : 1100;
  const crownGeo = new ConeGeometry(1, 3.2, 7); crownGeo.translate(0, 2.6, 0);
  const trunkGeo = new CylinderGeometry(0.16, 0.22, 1.2, 5); trunkGeo.translate(0, 0.6, 0);
  const crowns = new InstancedMesh(crownGeo, new MeshStandardMaterial({ color: 0x2c4027, roughness: 0.9, flatShading: true }), treeN);
  const trunks = new InstancedMesh(trunkGeo, new MeshStandardMaterial({ color: 0x4a3626, roughness: 1 }), treeN);
  crowns.castShadow = trunks.castShadow = !mobile;
  const dummy = new Object3D(); const tc = new Color();
  let placed = 0, guard = 0;
  while (placed < treeN && guard++ < treeN * 30) {
    const x = (rand() - 0.5) * 460, z = 60 - rand() * 300;
    const y = terrainHeight(x, z);
    if (y < 0.6 || y > 70) continue;
    if (Math.hypot(x - LAKE.x, (z - LAKE.z) * 1.35) < LAKE.r + 6) continue;
    if (Math.hypot(x - PAD.x, z - PAD.z) < 22) continue;
    if (z > 30 && Math.abs(x) < 45) continue;
    const clump = fbm(x * 0.03 + 4, z * 0.03 + 8, 3);
    if (clump < 0.46 + rand() * 0.12) continue;
    const s = 0.8 + rand() * 1.1;
    dummy.position.set(x, y - 0.2, z); dummy.scale.set(s * (0.8 + rand() * 0.3), s * (0.9 + rand() * 0.5), s * (0.8 + rand() * 0.3)); dummy.rotation.y = rand() * 6.28;
    dummy.updateMatrix();
    crowns.setMatrixAt(placed, dummy.matrix); trunks.setMatrixAt(placed, dummy.matrix);
    crowns.setColorAt(placed, tc.setHSL(0.3 + rand() * 0.05, 0.28 + rand() * 0.1, 0.17 + rand() * 0.07));
    placed++;
  }
  crowns.count = trunks.count = placed;
  scene.add(crowns, trunks);

  /* Hotel */
  const hotel = new Group();
  hotel.position.set(PAD.x, PAD.h, PAD.z);
  const stoneM = new MeshStandardMaterial({ color: 0xd8d0c0, roughness: 0.9 });
  const woodM = new MeshStandardMaterial({ color: 0x6a482f, roughness: 0.8 });
  const darkWoodM = new MeshStandardMaterial({ color: 0x3e2a1c, roughness: 0.85 });
  const roofM = new MeshStandardMaterial({ color: 0x3a3532, roughness: 0.7 });
  const glassOff = new MeshStandardMaterial({ color: 0x23313a, roughness: 0.15, metalness: 0.5 });
  const glassOn = new MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb45e, emissiveIntensity: 2.4, roughness: 0.4 });
  const glassDim = new MeshStandardMaterial({ color: 0xc9a77a, emissive: 0xff9d4a, emissiveIntensity: 0.9, roughness: 0.4 });
  const add = (geo, mat, x, y, z, parent = hotel) => { const m = new Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = !mobile; parent.add(m); return m; };
  add(new BoxGeometry(22, 3.4, 12), stoneM, 0, 1.7, 0);
  add(new BoxGeometry(22, 6.2, 12), woodM, 0, 3.4 + 3.1, 0);
  // Satteldach (Prisma), First entlang x
  const rw = 25, rd = 15.5, rh = 5.2, ry = 9.6;
  const roofGeo = new BufferGeometry();
  const v = [
    -rw / 2, 0, rd / 2, rw / 2, 0, rd / 2, rw / 2, rh, 0, -rw / 2, 0, rd / 2, rw / 2, rh, 0, -rw / 2, rh, 0,
    rw / 2, 0, -rd / 2, -rw / 2, 0, -rd / 2, -rw / 2, rh, 0, rw / 2, 0, -rd / 2, -rw / 2, rh, 0, rw / 2, rh, 0,
  ];
  roofGeo.setAttribute('position', new Float32BufferAttribute(v, 3));
  roofGeo.computeVertexNormals();
  const roof = add(roofGeo, roofM, 0, ry, 0); roof.material.side = 2;
  // Giebelwand (Holz) vorne/hinten als Dreiecke an den Stirnseiten x = ±11
  const gable = new BufferGeometry();
  gable.setAttribute('position', new Float32BufferAttribute([-11, 0, 6, -11, 0, -6, -11, rh * 0.95, 0, 11, 0, -6, 11, 0, 6, 11, rh * 0.95, 0], 3));
  gable.computeVertexNormals();
  add(gable, woodM, 0, ry, 0).material.side = 2;
  add(new BoxGeometry(1.4, 3.2, 1.4), stoneM, 6, ry + 4.2, -1.5); // Kamin
  // Balkone
  for (const y of [3.5, 6.6]) {
    add(new BoxGeometry(22.6, 0.25, 1.8), darkWoodM, 0, y, 6.9);
    add(new BoxGeometry(22.6, 0.9, 0.12), darkWoodM, 0, y + 0.55, 7.75);
  }
  // Spa-Anbau links
  const spa = new Group(); spa.position.set(-15.5, 0, 1.5); hotel.add(spa);
  add(new BoxGeometry(9, 3.6, 9), stoneM, 0, 1.8, 0, spa);
  add(new BoxGeometry(9.8, 0.4, 9.8), darkWoodM, 0, 3.8, 0, spa);

  // Fenster
  const windows = [];
  const win = (w, h, x, y, z, group, seed, parent = hotel, rotY = 0) => {
    const m = new Mesh(new PlaneGeometry(w, h), glassOff);
    m.position.set(x, y, z); m.rotation.y = rotY; parent.add(m);
    windows.push({ mesh: m, group, seed });
  };
  for (let i = 0; i < 5; i++) win(2.6, 1.9, -8 + i * 4, 1.7, 6.02, 'restaurant', i / 5);
  const rooms = [0.15, 0.62, 0.3, 0.88, 0.47, 0.05, 0.72, 0.38, 0.95, 0.22, 0.55, 0.8];
  for (let f = 0; f < 2; f++) for (let i = 0; i < 6; i++) win(1.4, 1.7, -8.75 + i * 3.5, 4.75 + f * 3.1, 6.02, 'rooms', rooms[f * 6 + i]);
  // Dachfenster der Suite („Himmelsfenster“) liegt in der vorderen Dachfläche
  win(2.4, 1.8, -4, ry + 2.0, (rd / 2) * (1 - 2.0 / rh) + 0.07, 'suite', 0.5);
  windows.at(-1).mesh.rotation.x = -Math.atan2(rd / 2, rh);
  for (let i = 0; i < 3; i++) win(2.5, 2.4, -2.9 + i * 2.9, 1.6, 4.52, 'spa', i / 3, spa);
  win(1.2, 1.4, -11.02, 4.8, 2.5, 'rooms', 0.33, hotel, -Math.PI / 2);
  win(1.2, 1.4, 11.02, 4.8, 2.5, 'rooms', 0.68, hotel, Math.PI / 2);
  scene.add(hotel);

  /* Zustand */
  const fog = new Color(), hemiSky = new Color(), hemiGround = new Color(), sunCol = new Color();
  const warm = new Color('#ff9a4d'), white = new Color('#fff4e6');
  const sunDir = new Vector3();
  let hour = 6, targetHour = 6, visible = true, raf = 0, last = 0, first = true;
  let width = 1, height = 1;

  function lightsFor(h) {
    const lit = (g, seed) => {
      if (g === 'restaurant') return (h >= 7 && h < 9.5) ? 1 : (h >= 18.5 && h < 22.5) ? 1 : 0;
      if (g === 'spa') return (h >= 15.5 && h < 21.5) ? 1 : 0;
      if (g === 'suite') return (h >= 19 && h < 23.6) ? 1 : (h < 6.6 ? 1 : 0);
      // Zimmer: früh einzelne, abends viele, um 23 Uhr nur noch wenige
      if (h < 7) return seed < 0.25 ? 1 : 0;
      if (h < 17.5) return 0;
      if (h < 19) return seed < 0.3 ? 0.5 : 0;
      if (h < 22) return seed < 0.75 ? 1 : 0;
      return seed < lerp(0.75, 0.18, clamp((h - 22) / 1, 0, 1)) ? 1 : 0;
    };
    for (const w of windows) {
      const on = lit(w.group, w.seed);
      w.mesh.material = on >= 1 ? glassOn : on > 0 ? glassDim : glassOff;
    }
  }

  function apply(h) {
    const el = sunElevation(h), az = sunAzimuth(h);
    const elR = degToRad(el), azR = degToRad(az);
    sunDir.set(Math.sin(azR) * Math.cos(elR), Math.sin(elR), -Math.cos(azR) * Math.cos(elR));
    su.sunPosition.value.copy(sunDir);
    const day = smoothstep(el, -4, 12);
    const night = 1 - smoothstep(el, -14, -1);
    const golden = (1 - smoothstep(el, 4, 22)) * smoothstep(el, -3, 2);
    su.rayleigh.value = lerp(1.2, 3.0, golden);
    su.turbidity.value = lerp(2.4, 6.5, golden);
    sun.position.copy(sunDir).multiplyScalar(220).add(sun.target.position);
    sunCol.copy(white).lerp(warm, golden * 0.85);
    sun.color.copy(sunCol);
    sun.intensity = day * lerp(1.8, 4.6, smoothstep(el, 2, 35));
    moonLight.intensity = night * 1.1;
    palette(h, 1, fog); palette(h, 2, hemiSky); palette(h, 3, hemiGround);
    scene.fog.color.copy(fog);
    hemi.color.copy(hemiSky); hemi.groundColor.copy(hemiGround);
    hemi.intensity = lerp(0.8, 1.9, day) + golden * 0.3;
    renderer.toneMappingExposure = lerp(0.7, 0.58, day) + golden * 0.06;
    nightMat.uniforms.uOpacity.value = night * 0.97;
    starMat.opacity = smoothstep(night, 0.4, 1);
    moon.material.opacity = smoothstep(night, 0.5, 1) * 0.95;
    const mAz = degToRad(-28), mEl = degToRad(22);
    moon.position.set(Math.sin(mAz) * Math.cos(mEl), Math.sin(mEl), -Math.cos(mAz) * Math.cos(mEl)).multiplyScalar(3300);
    moon.lookAt(camera.position);
    waterMat.color.copy(fog).multiplyScalar(0.55).lerp(tmpA.set('#2c4a56'), 0.5);
    glow.intensity = (h >= 17.5 ? smoothstep(h, 17.5, 20) : 0) * (h > 22 ? lerp(1, 0.35, clamp(h - 22, 0, 1)) : 1) * 260;
    lightsFor(h);
    // Kamera: langsame Fahrt über den Tag
    const k = (h - 6) / 17;
    if (mobile) {
      camera.position.set(lerp(-6, 6, k), 26, lerp(126, 120, k));
      camera.lookAt(lerp(6, 10, k), -10, -60);
    } else {
      camera.position.set(lerp(-10, 10, k), lerp(20, 18, k), lerp(106, 98, k));
      camera.lookAt(lerp(16, 24, k), lerp(19, 17, k), -60);
    }
  }

  function render() { renderer.render(scene, camera); if (first) { first = false; onFirstFrame?.(); } }

  function tick(now) {
    raf = 0;
    const dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
    const d = targetHour - hour;
    hour = Math.abs(d) < 0.002 ? targetHour : hour + d * (1 - Math.exp(-dt * 7));
    apply(hour); render();
    if (hour !== targetHour && visible) raf = requestAnimationFrame(tick);
    else last = 0;
  }
  const kick = () => { if (!raf && visible) raf = requestAnimationFrame(tick); };

  function resize() {
    width = canvas.clientWidth || 1; height = canvas.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    apply(hour); if (visible) render();
  }
  window.addEventListener('resize', resize);
  resize();

  // Shader vorab kompilieren (vermeidet Ruckler beim ersten Lichtwechsel)
  for (const mat of [glassOn, glassDim]) { windows[0].mesh.material = mat; renderer.compile(scene, camera); }
  apply(hour); render();

  return {
    setHour(h, immediate = false) { targetHour = h; if (immediate) { hour = h; apply(h); render(); } else kick(); },
    setVisible(v) { visible = v; if (v) { apply(hour); render(); kick(); } },
    resize,
  };
}
