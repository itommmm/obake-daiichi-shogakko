/* PS1版 照明・霧・暗がり（グラフィック強化）
 * 部屋ごとに「冷たい月明かり」「奥へ向かう霧」「家具の下の暗がり」「窓から落ちる光だまり」
 * 「舞台の局所照明」を足し、蛍光灯のちらつきを不規則で弱いものにする。
 * 暗くするだけでなく、視線を導く（廊下の奥の非常口／舞台の光／窓の光だまり）ことを狙う。
 * 必須のアイテム・調査対象・主人公は、これまでの明るさ（懐中電灯・光る輪）で見える。
 * 読み込み順：rooms.js のあと、logic.js の前。logic.js が init で build() を呼ぶ。 */
'use strict';

const Atmosphere = (() => {
  const base = {};   // 部屋ごとの元の霧・環境光（部屋を戻したときの明るさ計算に使う）
  let blobTex = null, glowTex = null, edgeTex = null, beamTex = null;

  function makeTextures() {
    blobTex = canvasTex(64, 64, (g, w, h) => { // 家具の下の やわらかい影
      const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(.6, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    glowTex = canvasTex(64, 64, (g, w, h) => { // 光だまり（白→透明。色は板の color で決める）
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.55, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    edgeTex = canvasTex(4, 64, (g, w, h) => { // かべ・天井のすみの暗がり（上が濃い）
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    beamTex = canvasTex(8, 64, (g, w, h) => { // 舞台の光の筋（下へ向かって広がり、うすれる）
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, 'rgba(255,225,170,.9)'); gr.addColorStop(1, 'rgba(255,225,170,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    for (const t of [blobTex, glowTex, edgeTex, beamTex]) { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; }
  }
  // 影・光だまりなどの、ライトに影響されない半透明の板
  function sheet(R, map, w, h, x, y, z, rx, ry, rz, color, opacity, additive) {
    const m = ps1(new THREE.MeshBasicMaterial({
      map, color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    }));
    const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    o.position.set(x, y, z); o.rotation.set(rx, ry, rz || 0); o.renderOrder = 2;
    R.scene.add(o); return o;
  }
  const floor = (R, map, w, d, x, z, ry, color, op, add) => sheet(R, map, w, d, x, .018, z, -Math.PI / 2, ry || 0, 0, color, op, add);

  // 家具の足もとと、かべ・天井のすみを暗くして、奥行きと重さを出す
  function shade(R) {
    for (const c of R.colliders) {
      const w = c.x1 - c.x0, d = c.z1 - c.z0;
      floor(R, blobTex, w + .5, d + .5, (c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2, 0, 0x000000, .5);
    }
    const b = R.bounds, h = R.h, o = .09, hh = Math.min(1.1, h * .35);
    const W = b.x1 - b.x0, D = b.z1 - b.z0;
    // かべの足もと
    sheet(R, edgeTex, W, hh, (b.x0 + b.x1) / 2, hh / 2, b.z0 + o, 0, 0, 0, 0x000000, .55);
    sheet(R, edgeTex, W, hh, (b.x0 + b.x1) / 2, hh / 2, b.z1 - o, 0, Math.PI, 0, 0x000000, .55);
    sheet(R, edgeTex, D, hh, b.x0 + o, hh / 2, (b.z0 + b.z1) / 2, 0, Math.PI / 2, 0, 0x000000, .55);
    sheet(R, edgeTex, D, hh, b.x1 - o, hh / 2, (b.z0 + b.z1) / 2, 0, -Math.PI / 2, 0, 0x000000, .55);
    // 天井のすみ（上下を反転して、天井ぎわを暗く）
    sheet(R, edgeTex, W, hh, (b.x0 + b.x1) / 2, h - hh / 2, b.z0 + o, Math.PI, 0, 0, 0x000000, .45);
    sheet(R, edgeTex, W, hh, (b.x0 + b.x1) / 2, h - hh / 2, b.z1 - o, Math.PI, Math.PI, 0, 0x000000, .45);
    sheet(R, edgeTex, D, hh, b.x0 + o, h - hh / 2, (b.z0 + b.z1) / 2, Math.PI, Math.PI / 2, 0, 0x000000, .45);
    sheet(R, edgeTex, D, hh, b.x1 - o, h - hh / 2, (b.z0 + b.z1) / 2, Math.PI, -Math.PI / 2, 0, 0x000000, .45);
  }
  // 窓から床に落ちる、冷たい青の光だまり（斜めにのびる）
  function moonPatches(R, wallX, zs, width, dir) {
    for (const z of zs) {
      const p = floor(R, glowTex, 3.0, width * 1.1, wallX + dir * 1.45, z, 0, 0x5b78b8, .22, true);
      p.rotation.z = dir * .35; // 月の光は斜めに差しこむ
    }
  }
  function addLight(R, light) { R.scene.add(light); R.lights.push(light); return light; }

  const AMBIENT_DARK = .7, AMBIENT_RESTORED = 1.15;
  const FOG = { // 霧の色と濃さ（青黒く、奥ほど沈む）
    classroom: [0x0a101a, .05], corridor: [0x070d18, .072], staff: [0x0c0f19, .06],
    gym: [0x05080f, .04], entrance: [0x080d17, .058],
  };
  function build() {
    if (!blobTex) makeTextures();
    for (const R of Object.values(ROOMS)) {
      const f = FOG[R.id];
      if (f) { R.scene.fog.color.setHex(f[0]); R.scene.fog.density = f[1]; R.scene.background.setHex(f[0]); }
      shade(R);
    }
    const C = ROOMS.classroom, K = ROOMS.corridor, S = ROOMS.staff, Y = ROOMS.gym, E = ROOMS.entrance;
    // 教室：東の窓の月明かり
    if (C) { moonPatches(C, 4.4, [-1.8, 0, 1.8], 1.45, -1); }
    // 廊下：西の窓の月明かり。いちばん奥に非常口の緑の灯り（視線の行き先）
    if (K) {
      moonPatches(K, -1.6, [-8, -4, 0, 4, 8], 1.45, 1);
      const sign = box(.62, .22, .05, bm(0x56e08a), 0, 2.55, -10.9, K.scene);
      box(.7, .3, .04, bm(0x0b2016), 0, 2.55, -10.93, K.scene);
      sheet(K, glowTex, 2.2, 1.4, 0, 2.55, -10.8, 0, 0, 0, 0x2fe07a, .35, true);
      K.props.exit = sign;
      addLight(K, new THREE.PointLight(0x4cf08c, .5, 7, 1)).position.set(0, 2.3, -10.2);
      const blue = addLight(K, new THREE.PointLight(0x7f9bdc, .32, 9, 1)); blue.position.set(-1.0, 2.0, -3.5);
    }
    // 職員室：東の窓の月明かり
    if (S) { moonPatches(S, 3.9, [-1.6, 0], 1.3, -1); }
    // 体育館：舞台だけに光がある（スポットライトと光の筋）
    if (Y) {
      const spot = new THREE.SpotLight(0xffc98f, 1.5, 16, .62, .7, 1);
      spot.position.set(0, 6.4, -3.2); spot.target.position.set(0, .7, -7.5);
      addLight(Y, spot); Y.scene.add(spot.target);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(.35, 2.4, 6, 14, 1, true), ps1(new THREE.MeshBasicMaterial({
        map: beamTex, transparent: true, opacity: .13, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      })));
      beam.position.set(0, 3.55, -5.4); beam.rotation.x = -.34; beam.renderOrder = 3; Y.scene.add(beam);
      floor(Y, glowTex, 7, 3.6, 0, -7.2, 0, 0xffc98f, .22, true); // 舞台の床に光だまり
    }
    // 玄関：ガラス戸から入る月明かり
    if (E) { floor(E, glowTex, 4.2, 3.2, 0, -2.0, 0, 0x5b78b8, .24, true); }
    for (const R of Object.values(ROOMS)) {
      // 環境光は元の 7 割に。暗さと引きかえに、窓・蛍光灯・舞台の光が目立つようにする（元に戻すと、もとの明るさ以上に戻る）
      const amb = [];
      R.scene.traverse(o => { if (o.isAmbientLight || o.isHemisphereLight) { amb.push({ light: o, i: o.intensity }); o.intensity *= AMBIENT_DARK; } });
      base[R.id] = { fog: R.scene.fog.density, color: R.scene.fog.color.getHex(), amb };
    }
  }

  // 部屋を元に戻したときの明るさ：霧がうすくなり、あたたかい色が戻る（光の強さは logic.js 側で1.45倍）
  function applyLooks(R, restored) {
    const b = base[R.id]; if (!b) return;
    R.scene.fog.density = b.fog * (restored ? .62 : 1);
    R.scene.fog.color.setHex(restored ? 0x14161c : b.color);
    R.scene.background.setHex(restored ? 0x14161c : b.color);
    for (const a of b.amb) a.light.intensity = a.i * (restored ? AMBIENT_RESTORED : AMBIENT_DARK);
  }

  // 蛍光灯：ふだんは弱くゆらぎ、ときどき（7〜14秒に一度）短く不規則にちらつく。暗くなりすぎない。
  // 画面のゆれオフ（G.fx=false）のときは、ちらつかない。
  function flicker(f, t) {
    if (!G.fx) return f.base;
    const hum = .93 + .07 * Math.sin(t * 6.1 + f.ph);
    const period = 7 + ((f.ph * 3.7) % 7), ph = (t + f.ph * 5) % period;
    let m = 1;
    if (ph < .55) m = .5 + .5 * Math.abs(Math.sin(ph * 31 + f.ph * 9)) * (ph < .3 ? .7 : 1);
    return f.base * Math.min(1, Math.max(.5, hum * m)); // ゆらぎとちらつきが重なっても、基準の5割より暗くしない
  }
  return { build, applyLooks, flicker };
})();
