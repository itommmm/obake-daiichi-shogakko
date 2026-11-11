/* ============================================================
   おばけ第一小学校 PS1版 : エンジン / 見た目 / 音
   固定カメラ・タンク操作・ローポリ・ディザ＋頂点のゆれ（なぞとき だっしゅつ）
   ============================================================ */
'use strict';

const $ = id => document.getElementById(id);
// 論理座標（HUD・タップ位置・マーカー）は 320×240 のまま。描画の細かさ（RW×RH）だけを品質で変える。
const V = { W: 320, H: 240, RW: 480, RH: 360 };
// 画質プリセット。low は従来の見た目（かるい）。levels は色の段階（RGB各 levels+1 段）、tone は暗部の階調補正の強さ。
const QUALITY = {
  low:  { label: 'かるい',   w: 320, h: 240, levels: 31, tone: 0 },
  mid:  { label: 'ふつう',   w: 480, h: 360, levels: 63, tone: 1 },
  high: { label: 'きれい',   w: 640, h: 480, levels: 63, tone: 1 },
};
const GFX = { quality: 'mid', levels: 63, tone: 1 };
const SAVE_KEY = 'obake-daiichi-ps1-v2';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

/* ===== 状態 ===== */
const G = {
  state: 'title', t: 0, time: 0,
  p: { x: 0, z: -2.4, a: 0, walk: 0, moving: 0 },
  hp: 4, maxHp: 4, herbs: 0,
  room: 'entrance',
  bag: [], fixed: [], flags: {}, damage: 0,
  lock: null, endStep: -1,
  invuln: 0, hurt: 0, flash: 0,
  msg: '', msgT: 0, prompt: '', roomTitle: 0, roomTitleText: '',
  autosave: 0, footT: 0, heartT: 0,
  boss: null, bossFight: false,
  trans: null, introT: 0, introStep: -1, endT: 0,
  taken: [], dead: [], bossDead: false,
  mode: 'modern',
  sound: true, fx: true, muted: false,
  keyboard: false, // キーボードを 1回でも 使ったか（[E] のような キー表示に 必要）
  keys: Object.create(null), touch: Object.create(null),
};
// 旧モード設定は引き継がず、固定カメラ＋スティックを標準にする。ゲーム進行セーブは維持。
try { const m = localStorage.getItem('obake-ps1-controls-v4'); if (m === 'modern' || m === 'tank') G.mode = m; } catch (_) {}
try { G.fx = localStorage.getItem('obake-ps1-fx') !== '0'; } catch (_) {}
// 画質の設定。セーブとは別のキーなので、ゲームの進行には影響しない
try { const q = localStorage.getItem('obake-ps1-quality'); if (QUALITY[q]) GFX.quality = q; } catch (_) {}
G.autoQuality = true; // 動きが重いときは、自動で「かるい」に戻す
Object.assign(V, { RW: QUALITY[GFX.quality].w, RH: QUALITY[GFX.quality].h });
GFX.levels = QUALITY[GFX.quality].levels; GFX.tone = QUALITY[GFX.quality].tone;

/* ===== Three.js ===== */
let renderer, rt, postScene, postCam, postMat, ditherTex;
let activeRoom = null, activeCam = null;
let titleScene = null, titleCam = null, titleGhost = null, titleRain = null, titleLamp = null;
let kid = null, flash = null, flashTarget = null, muzzle = null;
const ROOMS = {};
const HUD = $('hud').getContext('2d');
const V3 = new THREE.Vector3();
const V3B = new THREE.Vector3();

function initRenderer() {
  renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(V.RW, V.RH, false);
  renderer.setClearColor(0x05040a, 1);
  rt = new THREE.WebGLRenderTarget(V.RW, V.RH, {
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat, depthBuffer: true, stencilBuffer: false,
  });
  postScene = new THREE.Scene();
  postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  ditherTex = makeDither();
  postMat = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: rt.texture }, tDither: { value: ditherTex },
      uTime: { value: 0 }, uFx: { value: G.fx ? 1 : 0 }, uFade: { value: 1 },
      uRes: { value: new THREE.Vector2(V.RW, V.RH) },
      uLevels: { value: GFX.levels }, uTone: { value: GFX.tone },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform sampler2D tDiffuse, tDither;
      uniform float uTime, uFx, uFade, uLevels, uTone;
      uniform vec2 uRes;
      varying vec2 vUv;
      // 階調補正：暗部を持ち上げて黒つぶれを防ぎ、暗いところほど月明かりの青に寄せる。
      // 明るいところはやわらかく丸める。色数を増やすだけでなく、暗部に階調を割り当てるための処理。
      vec3 grade(vec3 c) {
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        vec3 g = pow(max(c, vec3(0.0)), vec3(0.84));
        float shadow = 1.0 - smoothstep(0.0, 0.5, l);
        g *= mix(vec3(1.0), vec3(0.86, 0.97, 1.16), shadow * 0.6);
        g = g * (1.0 + 0.10 * g) / (1.0 + 0.10 * g * g * 1.6);
        return g;
      }
      void main(){
        vec3 raw = texture2D(tDiffuse, vUv).rgb;
        raw = mix(raw, grade(raw), uTone);
        // 4×4 のバイエル配列。描画ピクセル単位で敷くので、解像度が上がるほど粒は細かくなる
        float d = texture2D(tDither, (mod(floor(vUv * uRes), 4.0) + 0.5) / 4.0).r;
        vec3 q = floor(raw * uLevels + d) / uLevels;
        vec3 c = mix(raw, q, uFx);
        c *= mix(1.0, 0.955, uFx);
        float vig = 1.0 - 0.52 * pow(length((vUv - 0.5) * 1.28), 2.2);
        c *= mix(1.0, vig, uFx);
        gl_FragColor = vec4(c * uFade, 1.0);
      }
    `,
    depthTest: false, depthWrite: false,
  });
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));
  applyQuality(); // 保存してある画質に合わせて、描画の大きさ・HUDの細かさをそろえる
}

function makeDither() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 4;
  const g = c.getContext('2d');
  const m = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const v = Math.round((m[y * 4 + x] + 0.5) / 16 * 255);
    g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, 1, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  return t;
}

/* 頂点を 320x240 の画面グリッドに ならす（PS1の ゆれ） */
function ps1(m) {
  m.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
      vec4 mvPosition = vec4( transformed, 1.0 );
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
      #endif
      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;
      if ( gl_Position.w > 0.0001 ) {
        vec2 ps1Ndc = gl_Position.xy / gl_Position.w;
        vec2 ps1Grid = vec2(320.0, 240.0);
        vec2 ps1Snap = floor((ps1Ndc * 0.5 + 0.5) * ps1Grid) / ps1Grid;
        gl_Position.xy = (ps1Snap * 2.0 - 1.0) * gl_Position.w;
      }
    `);
  };
  return m;
}

/* ===== 画質の切り替え =====
   描画の細かさだけを変える。ゲームの状態・セーブ・当たり判定・HUD/マーカーの座標（320×240）は変わらない。
   HUD は 320×240 の座標系のまま、キャンバスだけ細かくして拡大描画する。 */
function applyQuality() {
  const q = QUALITY[GFX.quality];
  V.RW = q.w; V.RH = q.h;
  if (!renderer) return;
  renderer.setSize(V.RW, V.RH, false);
  rt.setSize(V.RW, V.RH);
  const hud = $('hud');
  hud.width = V.RW; hud.height = V.RH; // 幅・高さを変えると描画状態が初期化される
  HUD.setTransform(V.RW / V.W, 0, 0, V.RH / V.H, 0, 0);
  postMat.uniforms.uRes.value.set(V.RW, V.RH);
  postMat.uniforms.uLevels.value = GFX.levels;
  postMat.uniforms.uTone.value = GFX.tone;
}
function setQuality(name, opt) {
  if (!QUALITY[name]) return false;
  GFX.quality = name; GFX.levels = QUALITY[name].levels; GFX.tone = QUALITY[name].tone;
  applyQuality();
  if (!opt || opt.save !== false) { try { localStorage.setItem('obake-ps1-quality', name); } catch (_) {} }
  return true;
}
// 動きが重いときの自動切替：低めのフレームレートが続いたら「かるい」に戻す（手動で戻せる）
const perf = { acc: 0, n: 0, slow: 0, fps: 60, warm: 3 };
function watchPerformance(dt) {
  if (dt <= 0 || dt > .5) return; // タブ切替などの異常値は無視
  perf.acc += dt; perf.n++;
  if (perf.acc < 1) return;
  perf.fps = perf.n / perf.acc; perf.acc = 0; perf.n = 0;
  if (perf.warm > 0) { perf.warm--; return; } // 起動直後のシェーダー準備で遅いのは数えない
  perf.slow = G.state === 'play' && perf.fps < 24 ? perf.slow + 1 : 0;
  if (G.autoQuality && perf.slow >= 4 && GFX.quality !== 'low') {
    setQuality('low'); perf.slow = 0;
    if (typeof say === 'function') say('がめんを かるく したよ。「ほぞん」は そのままだよ。', 4);
  }
}

function renderScene(scene, cam) {
  renderer.setRenderTarget(rt);
  renderer.clear();
  renderer.render(scene, cam);
  renderer.setRenderTarget(null);
  postMat.uniforms.tDiffuse.value = rt.texture;
  postMat.uniforms.uTime.value = G.t;
  postMat.uniforms.uFx.value = G.fx ? 1 : 0;
  renderer.render(postScene, postCam);
}

/* ===== テクスチャ（すべて その場で 描く低解像度） ===== */
function canvasTex(w, h, draw, rx = 1, ry = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  // 拡大はドットのまま（PS1らしさ）。縮小して見るとき（遠景）はミップマップで、細かい模様のちらつきを抑える
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapNearestFilter;
  t.generateMipmaps = true;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  return t;
}
function noise(g, w, h, n, a, col = '#000') {
  g.fillStyle = col;
  for (let i = 0; i < n; i++) {
    g.globalAlpha = Math.random() * a;
    g.fillRect(Math.random() * w | 0, Math.random() * h | 0, 1, 1);
  }
  g.globalAlpha = 1;
}
function tiled(t, rx, ry) {
  const c = t.clone(); c.needsUpdate = true;
  c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(rx, ry);
  return c;
}
const TEX = {};
// テクスチャ用の小さな道具
const lines = (g, n, w, h, rgbaFn, len, lw) => {
  for (let i = 0; i < n; i++) {
    g.strokeStyle = rgbaFn(); g.lineWidth = lw || 1; g.beginPath();
    const x = rnd(0, w), y = rnd(0, h); g.moveTo(x, y); g.lineTo(x + rnd(len[0], len[1]), y + rnd(-len[2], len[2])); g.stroke();
  }
};
const blotch = (g, x, y, r, rgb, a) => { // ふんわりした しみ・よごれ
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
};
function buildTextures() {
  // --- 木の床（教室・職員室）：板ごとの色むら、木目、節、板のつぎ目、傷 ---
  TEX.wood = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#5a3a24'; g.fillRect(0, 0, w, h);
    const ph = 16;
    for (let y = 0; y < h; y += ph) {
      g.fillStyle = ['#5e3d26', '#553620', '#62412a', '#58391f'][y / ph % 4 | 0]; g.fillRect(0, y, w, ph);
      // 木目：板に そった細い線
      for (let i = 0; i < 14; i++) {
        g.strokeStyle = `rgba(30,15,6,${rnd(.08, .24)})`; g.lineWidth = 1; g.beginPath();
        const yy = y + rnd(2, ph - 2), x0 = rnd(0, w * .6);
        g.moveTo(x0, yy); g.bezierCurveTo(x0 + 18, yy + rnd(-1.5, 1.5), x0 + 36, yy + rnd(-1.5, 1.5), x0 + rnd(30, 70), yy + rnd(-1, 1)); g.stroke();
      }
      g.fillStyle = 'rgba(20,10,4,.6)'; g.fillRect(0, y, w, 1);           // 板のすきま
      g.fillStyle = 'rgba(215,165,105,.11)'; g.fillRect(0, y + 2, w, 1);  // ふちの 反射
      const jx = (y / ph * 37 + 11) % w;                                  // 板の つぎ目
      g.fillStyle = 'rgba(20,10,4,.55)'; g.fillRect(jx, y, 1, ph);
      if ((y / ph) % 3 === 1) { // 節
        const kx = rnd(10, w - 10), ky = y + rnd(5, ph - 5);
        g.fillStyle = 'rgba(25,12,5,.55)'; g.beginPath(); g.ellipse(kx, ky, 3.2, 2, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(25,12,5,.3)'; g.beginPath(); g.ellipse(kx, ky, 6, 3.4, 0, 0, TAU); g.stroke();
      }
    }
    lines(g, 10, w, h, () => `rgba(205,170,125,${rnd(.08, .2)})`, [6, 18, 5], 1); // 傷
    blotch(g, rnd(0, w), rnd(0, h), 22, '15,8,3', .22); blotch(g, rnd(0, w), rnd(0, h), 16, '15,8,3', .18); // よごれ
    noise(g, w, h, 800, .14);
  });
  // --- 廊下・玄関の床：市松のタイル、目地、足あとのよごれ、ひび ---
  TEX.tile = canvasTex(128, 128, (g, w, h) => {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      g.fillStyle = (x + y) % 2 ? '#7f8478' : '#a3a695'; g.fillRect(x * 32, y * 32, 32, 32);
      g.fillStyle = 'rgba(255,255,240,.05)'; g.fillRect(x * 32 + 2, y * 32 + 2, 14, 2);
      g.fillStyle = 'rgba(30,32,28,.38)'; g.fillRect(x * 32, y * 32, 32, 1); g.fillRect(x * 32, y * 32, 1, 32);
      g.fillStyle = 'rgba(30,32,28,.14)'; g.fillRect(x * 32 + 1, y * 32 + 1, 31, 1);
    }
    for (let i = 0; i < 5; i++) blotch(g, rnd(0, w), rnd(0, h), rnd(9, 20), '35,34,26', .22);
    lines(g, 8, w, h, () => `rgba(40,42,36,${rnd(.1, .28)})`, [-12, 12, 8], 1); // ひび・すり傷
    noise(g, w, h, 1100, .13);
  });
  // --- かべ：しっくい。水のしみ、ひび、はがれ ---
  TEX.wall = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#b9b19b'; g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(255,250,230,.07)'); gr.addColorStop(.55, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(45,38,28,.2)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5; i++) blotch(g, rnd(0, w), rnd(10, h), rnd(10, 26), '85,70,45', .16); // 水のしみ
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(70,62,48,${rnd(.04, .16)})`; g.fillRect(rnd(0, w), rnd(0, h), rnd(1, 6), rnd(1, 3)); }
    g.strokeStyle = 'rgba(55,48,38,.4)'; g.lineWidth = 1; g.beginPath(); // ひび
    let cx = rnd(10, w - 10), cy = 0; g.moveTo(cx, cy);
    while (cy < h * .6) { cx += rnd(-5, 5); cy += rnd(4, 9); g.lineTo(cx, cy); } g.stroke();
    g.fillStyle = 'rgba(60,54,44,.18)'; g.fillRect(0, 92, w, 1);
    noise(g, w, h, 650, .1);
  });
  // --- かべの下半分：緑のペンキ。たてのつなぎ目、すり傷、はがれ ---
  TEX.wallGreen = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#475a51'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(20,30,24,.42)'; for (let y = 0; y < h; y += 16) g.fillRect(0, y, w, 1);
    g.fillStyle = 'rgba(160,190,170,.07)'; for (let y = 0; y < h; y += 16) g.fillRect(0, y + 1, w, 1);
    g.fillStyle = 'rgba(15,24,18,.35)'; for (let x = 0; x < w; x += 42) g.fillRect(x, 0, 1, h);
    lines(g, 14, w, h, () => `rgba(170,185,170,${rnd(.08, .2)})`, [5, 16, 3], 1); // すり傷
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(150,160,120,.28)'; g.fillRect(rnd(0, w), rnd(0, h), rnd(2, 5), rnd(1, 3)); } // ペンキの はがれ
    blotch(g, rnd(0, w), h - 6, 30, '10,16,12', .3);
    noise(g, w, h, 700, .16);
  });
  TEX.ceiling = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#8e8b7b'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(40,40,36,.45)'; g.lineWidth = 1;
    for (let x = 0; x <= w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    for (let i = 0; i < 3; i++) blotch(g, rnd(0, w), rnd(0, h), rnd(14, 26), '70,60,40', .22); // 雨もりのしみ
    for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 32) { g.fillStyle = 'rgba(40,40,36,.2)'; for (let i = 0; i < 4; i++) g.fillRect(x + rnd(3, 28), y + rnd(3, 28), 1, 1); }
    noise(g, w, h, 900, .12);
  });
  // --- 体育館の床：板、コートの白線、ニスの照り、くつの すり跡 ---
  TEX.gym = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#936b3e'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) {
      g.fillStyle = ['#966d3f', '#8d6539', '#9d7548', '#92693c'][x / 16 % 4 | 0]; g.fillRect(x, 0, 16, h);
      for (let i = 0; i < 10; i++) { g.strokeStyle = `rgba(60,36,12,${rnd(.06, .16)})`; g.beginPath(); const xx = x + rnd(2, 14), yy = rnd(0, h); g.moveTo(xx, yy); g.lineTo(xx + rnd(-1, 1), yy + rnd(30, 90)); g.stroke(); }
      g.fillStyle = 'rgba(50,30,10,.4)'; g.fillRect(x, 0, 1, h);
      g.fillStyle = 'rgba(255,225,170,.08)'; g.fillRect(x + 2, 0, 1, h);
      g.fillStyle = 'rgba(50,30,10,.35)'; g.fillRect(x, (x * 7 + 40) % h, 16, 1); // 板のつぎ目
    }
    for (let i = 0; i < 14; i++) blotch(g, rnd(0, w), rnd(0, h), rnd(12, 28), '255,235,190', .08); // ニスの照り
    for (let i = 0; i < 18; i++) lines(g, 1, w, h, () => 'rgba(30,18,6,.22)', [6, 22, 3], 2); // くつの すり跡
    g.strokeStyle = 'rgba(235,225,195,.65)'; g.lineWidth = 4;
    g.strokeRect(16, 16, w - 32, h - 32);
    g.beginPath(); g.moveTo(128, 16); g.lineTo(128, h - 16); g.stroke();
    g.beginPath(); g.arc(128, 128, 44, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(20,12,4,.22)'; g.lineWidth = 1; g.strokeRect(14, 14, w - 28, h - 28); // 白線のふち
    noise(g, w, h, 2200, .1);
  });
  // --- 窓：月夜と雨。窓わく、すきま、くもり ---
  TEX.window = canvasTex(128, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#1a2d52'); gr.addColorStop(.6, '#0d1730'); gr.addColorStop(1, '#070b18');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    blotch(g, 92, 32, 26, '170,195,255', .35);                       // 月の ひかり
    g.fillStyle = 'rgba(225,235,255,.75)'; g.beginPath(); g.arc(92, 32, 11, 0, TAU); g.fill();
    for (let i = 0; i < 12; i++) { g.fillStyle = `rgba(190,205,240,${rnd(.2, .6)})`; g.fillRect(rnd(0, w), rnd(0, h * .5), 1, 1); } // 星
    for (let i = 0; i < 60; i++) { // 雨
      g.strokeStyle = `rgba(150,180,230,${rnd(.1, .34)})`; g.beginPath();
      const x = rnd(0, w), y = rnd(0, h); g.moveTo(x, y); g.lineTo(x - 3, y + rnd(5, 16)); g.stroke();
    }
    blotch(g, rnd(10, w - 10), h - 8, 30, '120,140,180', .12);       // くもり
    g.strokeStyle = '#2b2a26'; g.lineWidth = 6; g.strokeRect(2, 2, w - 4, h - 4);
    g.lineWidth = 5; g.beginPath(); g.moveTo(64, 0); g.lineTo(64, h); g.moveTo(0, 64); g.lineTo(w, 64); g.stroke();
    g.strokeStyle = 'rgba(210,205,185,.18)'; g.lineWidth = 1; g.strokeRect(5, 5, w - 10, h - 10);
  });
  // --- 黒板（もとにもどったあと）：チョークの粉と消し跡。文字・数字は従来と同じ内容 ---
  TEX.blackboard = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#20372d'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) blotch(g, rnd(0, w), rnd(0, h), rnd(24, 54), '200,215,200', .045); // けしあと
    g.fillStyle = 'rgba(230,240,220,.07)'; for (let y = 0; y < h; y += 8) g.fillRect(0, y, w, 1);
    g.fillStyle = 'rgba(235,240,220,.72)'; g.font = '18px sans-serif';
    g.fillText('7/18  きょうの めあて', 14, 28);
    g.font = '16px sans-serif'; g.fillStyle = 'rgba(235,240,220,.58)';
    g.fillText('・しゅくだいを わすれずに', 16, 60);
    g.fillStyle = 'rgba(255,226,140,.85)';
    g.fillText('たいいくかんの ばんごう 1ばんめ＝5', 16, 92);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, h - 4, w, 4);
    noise(g, w, h, 500, .14, '#dbe8d8');
  });
  // --- 黒板（らくがき）：おばけの落書き ---
  TEX.boardScribble = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#20372d'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 7; i++) blotch(g, rnd(0, w), rnd(0, h), rnd(24, 50), '200,215,200', .05);
    g.strokeStyle = 'rgba(240,240,255,.8)'; g.lineWidth = 4;
    for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(rnd(0, w), rnd(0, h)); g.bezierCurveTo(rnd(0, w), rnd(0, h), rnd(0, w), rnd(0, h), rnd(0, w), rnd(0, h)); g.stroke(); }
    for (const [x, y] of [[48, 60], [128, 48], [208, 72]]) {
      g.fillStyle = 'rgba(240,240,255,.85)'; g.beginPath(); g.arc(x, y, 22, Math.PI, 0); g.lineTo(x + 22, y + 24); g.lineTo(x - 22, y + 24); g.fill();
      g.fillStyle = '#20372d'; g.fillRect(x - 10, y - 6, 6, 8); g.fillRect(x + 4, y - 6, 6, 8);
    }
    g.fillStyle = 'rgba(255,120,120,.9)'; g.font = '18px sans-serif';
    g.fillText('おばけの がっこう だぞ〜', 28, 116);
    noise(g, w, h, 400, .12, '#dbe8d8');
  });
  TEX.clock = canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#e8e2cc'; g.beginPath(); g.arc(32, 32, 30, 0, TAU); g.fill();
    g.strokeStyle = '#3a3226'; g.lineWidth = 4; g.stroke();
    g.fillStyle = '#3a3226';
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.fillRect(32 + Math.sin(a) * 24 - 2, 32 - Math.cos(a) * 24 - 2, 4, 4); }
    blotch(g, 40, 22, 14, '90,70,40', .14);
  });
  // --- ロッカー：つなぎ目、通気スリット、とって、へこみ、さび ---
  TEX.locker = canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = '#6f7880'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#7d858c'; g.fillRect(2, 2, w - 4, h - 4);
    g.fillStyle = '#4b5258'; g.fillRect(0, 0, w, 4); g.fillRect(0, h - 4, w, 4);
    g.fillStyle = '#3d444a'; for (let y = 12; y < 44; y += 8) g.fillRect(10, y, w - 20, 3);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(8, 6, w - 16, 1); g.fillRect(8, 74, w - 16, 1);
    g.fillStyle = '#2f353a'; g.fillRect(w - 14, 68, 6, 12);
    g.fillStyle = 'rgba(210,215,220,.25)'; g.fillRect(w - 13, 69, 1, 10);
    g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(4, 4, 8, h - 8);
    g.fillStyle = 'rgba(30,34,38,.4)'; g.fillRect(0, 0, 2, h); g.fillRect(w - 2, 0, 2, h);
    blotch(g, rnd(10, w - 10), rnd(30, h - 10), 12, '40,50,60', .24);            // へこみ
    for (let i = 0; i < 4; i++) blotch(g, rnd(4, w - 4), h - rnd(2, 20), rnd(4, 8), '110,64,36', .34); // さび
    lines(g, 6, w, h, () => `rgba(230,235,240,${rnd(.12, .26)})`, [4, 12, 8], 1);
    noise(g, w, h, 320, .16);
  });
  TEX.shoe = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#6d4b2d'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 32) {
      g.fillStyle = '#7a5534'; g.fillRect(x + 2, y + 2, 28, 28);
      g.fillStyle = '#4a3020'; g.fillRect(x + 6, y + 6, 20, 16);
      g.fillStyle = '#2c1c12'; g.fillRect(x + 10, y + 10, 12, 8);
      g.fillStyle = 'rgba(255,230,190,.08)'; g.fillRect(x + 2, y + 2, 28, 2);
      if (((x + y) / 32) % 3 === 0) { g.fillStyle = '#d8d4c8'; g.fillRect(x + 11, y + 12, 10, 4); } // うわばき
    }
    lines(g, 10, w, h, () => `rgba(30,18,10,${rnd(.15, .3)})`, [6, 16, 2], 1);
    noise(g, w, h, 500, .18);
  });
  TEX.door = canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = '#5b3c24'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#3b2414'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = '#6a472b'; g.fillRect(12, 16, w - 24, 40); g.fillRect(12, 68, w - 24, 44);
    g.strokeStyle = 'rgba(20,10,4,.5)'; g.lineWidth = 1; g.strokeRect(12.5, 16.5, w - 25, 39); g.strokeRect(12.5, 68.5, w - 25, 43);
    lines(g, 16, w, h, () => `rgba(30,15,6,${rnd(.1, .25)})`, [-4, 4, 20], 1);
    g.fillStyle = '#d7c48a'; g.fillRect(w - 18, 60, 6, 6);
    noise(g, w, h, 240, .14);
  });
  // --- 舞台の幕：深いひだ、すそのよごれ、ほこり ---
  TEX.curtain = canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = '#6e161c'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x++) {
      const f = Math.sin(x / w * TAU * 4);
      g.fillStyle = `rgba(${f > 0 ? '255,120,120' : '20,0,0'},${Math.abs(f) * .22})`; g.fillRect(x, 0, 1, h);
    }
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(0,0,0,.28)'); gr.addColorStop(.3, 'rgba(0,0,0,0)'); gr.addColorStop(.85, 'rgba(0,0,0,.05)'); gr.addColorStop(1, 'rgba(0,0,0,.45)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    blotch(g, rnd(8, w - 8), h - 6, 22, '25,12,4', .34);
    lines(g, 10, w, h, () => `rgba(255,200,180,${rnd(.04, .1)})`, [-2, 2, 40], 1);
    noise(g, w, h, 350, .12);
  });
  TEX.poster = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#ded6bd'; g.fillRect(0, 0, w, h);
    blotch(g, rnd(10, w - 10), rnd(10, h - 10), 30, '110,90,60', .14);
    g.strokeStyle = 'rgba(120,110,90,.5)'; g.lineWidth = 2; g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = '#c44'; g.beginPath(); g.arc(64, 56, 22, Math.PI, 0); g.fill();
    g.fillStyle = '#222'; g.fillRect(52, 54, 6, 8); g.fillRect(72, 54, 6, 8);
    g.fillStyle = '#4a8'; g.fillRect(32, 88, 64, 6);
    g.fillStyle = '#333'; g.font = '12px sans-serif'; g.fillText('おばけに あったら', 20, 112);
    g.fillStyle = 'rgba(90,80,60,.35)'; g.fillRect(0, 0, 10, 10); // はがれかけた すみ
    noise(g, w, h, 240, .1);
  });
  TEX.paper = canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#d8d0b8'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(70,60,40,.6)'; for (let y = 16; y < 56; y += 10) g.fillRect(10, y, rnd(28, 44), 2);
    g.strokeStyle = 'rgba(120,30,30,.7)'; g.lineWidth = 2; g.strokeRect(4, 4, w - 8, h - 8);
    noise(g, w, h, 100, .1);
  });
  // --- 机の天板：木目と、えんぴつの落書き ---
  TEX.deskTop = canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#9a7344'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 18; i++) { g.strokeStyle = `rgba(60,36,14,${rnd(.1, .26)})`; g.beginPath(); const y = rnd(0, h); g.moveTo(0, y); g.bezierCurveTo(20, y + rnd(-2, 2), 44, y + rnd(-2, 2), w, y + rnd(-1, 1)); g.stroke(); }
    g.strokeStyle = 'rgba(40,40,50,.28)'; g.lineWidth = 1; g.beginPath(); g.moveTo(8, 40); g.lineTo(20, 34); g.lineTo(26, 44); g.stroke(); // らくがき
    blotch(g, rnd(10, 54), rnd(10, 54), 12, '30,20,10', .16);
    g.fillStyle = 'rgba(30,18,8,.4)'; g.fillRect(0, 0, w, 2); g.fillRect(0, h - 2, w, 2);
    noise(g, w, h, 200, .14);
  });
  // ばんごうの 数字を「場面に 描いた 札」（1ばんめは こくばんの テクスチャに ある）。文字は従来と同じ
  const numberNote = (text, bg, ink) => canvasTex(128, 56, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, h - 6, w, 6);
    g.strokeStyle = ink; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2);
    g.fillStyle = ink; g.font = '20px "DotGothic16","MS Gothic",sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  });
  TEX.clockNote = numberNote('2ばんめ＝1', '#e8e0c4', '#3a3020');
  TEX.posterNote = numberNote('3ばんめ＝7', '#ded6bd', '#7a2620');
}

/* ===== マテリアル / メッシュ ===== */
function pm(color, opts) { return ps1(new THREE.MeshPhongMaterial(Object.assign({ color, shininess: 0, flatShading: true }, opts || {}))); }
function tm(map, opts) { return ps1(new THREE.MeshPhongMaterial(Object.assign({ map, shininess: 0, flatShading: true }, opts || {}))); }
function bm(color, opts) { return ps1(new THREE.MeshBasicMaterial(Object.assign({ color }, opts || {}))); }
function box(w, h, d, m, x, y, z, parent) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z); (parent || activeRoom.scene).add(o); return o;
}
function cyc(rt, rb, h, seg, m, x, y, z, parent) {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  o.position.set(x, y, z); (parent || activeRoom.scene).add(o); return o;
}
function sph(r, m, x, y, z, parent) {
  const o = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), m);
  o.position.set(x, y, z); (parent || activeRoom.scene).add(o); return o;
}
function plane(w, h, m, x, y, z, rx, ry, parent) {
  const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  o.position.set(x, y, z); o.rotation.set(rx || 0, ry || 0, 0);
  (parent || activeRoom.scene).add(o); return o;
}
function collideBox(R, x, z, w, d) {
  R.colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
}

/* ===== 音（WebAudioで 合成） ===== */
const AudioSys = { ctx: null, master: null, noiseBuf: null, ambient: null, rain: null, muted: false };
function initAudio() {
  if (AudioSys.ctx || G.muted) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    const ctx = new AC();
    AudioSys.ctx = ctx;
    AudioSys.master = ctx.createGain(); AudioSys.master.gain.value = G.sound ? .22 : 0;
    // 急なびっくり音の音量差をおさえる（マスターのあとにリミッタ）
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -15; limiter.knee.value = 12;
    limiter.ratio.value = 5; limiter.attack.value = .004; limiter.release.value = .19;
    AudioSys.master.connect(limiter); limiter.connect(ctx.destination);
    AudioSys.limiter = limiter;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + .02 * w) / 1.02; d[i] = last * 3.2; }
    AudioSys.noiseBuf = buf;
    // 低い うなり
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), gg = ctx.createGain();
    o1.type = 'sine'; o2.type = 'triangle'; o1.frequency.value = 43; o2.frequency.value = 57;
    gg.gain.value = .028; o1.connect(gg); o2.connect(gg); gg.connect(AudioSys.master);
    o1.start(); o2.start();
    // 雨 / 換気
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    const rg = ctx.createGain(); rg.gain.value = .10;
    src.connect(lp); lp.connect(rg); rg.connect(AudioSys.master); src.start();
    AudioSys.ambient = { o1, o2, gg }; AudioSys.rain = { src, lp, rg };
    if (ctx.state === 'suspended') ctx.resume();
  } catch (_) {}
}
function tone(freq, dur, type = 'sine', vol = .1, slide = 0, delay = 0) {
  const a = AudioSys; if (!a.ctx || a.muted) return;
  const t = a.ctx.currentTime + delay;
  const o = a.ctx.createOscillator(), g = a.ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(Math.max(20, freq), t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g); g.connect(a.master); o.start(t); o.stop(t + dur + .03);
}
function noiseHit(dur, vol, freq, type = 'lowpass') {
  const a = AudioSys; if (!a.ctx || a.muted || !a.noiseBuf) return;
  const t = a.ctx.currentTime;
  const s = a.ctx.createBufferSource(); s.buffer = a.noiseBuf;
  const f = a.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = a.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(a.master); s.start(t); s.stop(t + dur + .02);
}
const SFX = {
  shoot() { noiseHit(.09, .22, 1800, 'bandpass'); tone(300, .08, 'square', .06, -220); },
  empty() { tone(180, .05, 'square', .05); tone(120, .04, 'square', .04, 0, .06); },
  hit() { tone(120, .09, 'square', .10, -60); noiseHit(.05, .10, 2400, 'highpass'); },
  ghost() { tone(150, .5, 'sine', .05, 40); tone(113, .7, 'triangle', .035, -20, .08); },
  hurt() { noiseHit(.25, .25, 380, 'lowpass'); tone(90, .35, 'sawtooth', .10, -40); },
  step() { noiseHit(.05, .10, 260, 'lowpass'); },
  door() { tone(110, .5, 'sawtooth', .035, 35); noiseHit(.4, .10, 500, 'bandpass'); },
  pickup() { [660, 880, 1320].forEach((f, i) => tone(f, .18, 'sine', .06, 0, i * .06)); },
  herb() { [440, 660, 990].forEach((f, i) => tone(f, .2, 'sine', .05, 0, i * .07)); },
  save() { tone(880, .12, 'sine', .045); tone(1320, .16, 'sine', .035, 0, .1); },
  alert() { tone(440, .18, 'square', .06); tone(330, .22, 'square', .05, 0, .16); },
  boss() { noiseHit(.8, .30, 150, 'lowpass'); tone(60, 1.1, 'sawtooth', .12, -18); },
  win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, .35, 'sine', .06, 0, i * .16)); },
  camera() { noiseHit(.11, .05, 780, 'lowpass'); tone(210, .09, 'sine', .022, -55); },
  dial() { tone(320, .05, 'square', .04, -130); tone(470, .04, 'square', .028, 0, .05); },
  locked() { tone(190, .18, 'square', .045, -95); noiseHit(.22, .09, 900, 'bandpass'); tone(115, .13, 'triangle', .05, -40, .17); },
  autoStart() { tone(520, .10, 'sine', .030, 120); tone(780, .08, 'triangle', .024, 0, .07); },
  autoStop() { tone(330, .10, 'triangle', .026, -110); },
  poi() { tone(1180, .045, 'sine', .016); },
  poiOut() { tone(760, .045, 'sine', .013); },
  hint() { tone(880, .10, 'sine', .026); tone(1170, .09, 'sine', .022, 0, .08); },
  whistle() { tone(2300, .7, 'square', .05, 120); tone(2350, .7, 'sine', .04, 80, .02); },
  slam() { noiseHit(.5, .4, 200, 'lowpass'); tone(55, .6, 'sawtooth', .14, -20); },
  unlock() { tone(520, .06, 'square', .05); tone(780, .08, 'square', .05, 0, .08); tone(1040, .2, 'sine', .05, 0, .16); },
  fixed() { [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, .4, 'triangle', .06, 0, i * .12)); },
  splash() { noiseHit(.12, .10, 900, 'bandpass'); tone(520, .1, 'sine', .03, -300); },
};

/* ===== 画面 → 3D の 投影 ===== */
function projectToScreen(x, y, z) {
  V3.set(x, y, z).project(activeCam);
  return { x: (V3.x * .5 + .5) * V.W, y: (-V3.y * .5 + .5) * V.H, ok: V3.z < 1 };
}

/* ===== タイトル画面の 3D ===== */
function buildTitleScene() {
  titleScene = new THREE.Scene();
  titleScene.background = new THREE.Color(0x070a14);
  titleScene.fog = new THREE.FogExp2(0x0a0e1c, .040);
  titleCam = new THREE.PerspectiveCamera(52, 4 / 3, .05, 60);
  titleCam.position.set(0, 2.3, 8);
  titleCam.lookAt(0, 2.0, -4);
  const amb = new THREE.AmbientLight(0x5c6c9c, .82); titleScene.add(amb);
  const moon = new THREE.DirectionalLight(0xaebfff, 1.05); moon.position.set(-6, 10, -10); titleScene.add(moon);
  titleLamp = new THREE.PointLight(0xff6a4a, 1.25, 12); titleLamp.position.set(2.2, 2.4, -2); titleScene.add(titleLamp);
  const gateGlow = new THREE.PointLight(0xffb489, 1.15, 11, 1.4); gateGlow.position.set(0, 2.5, .4); titleScene.add(gateGlow);
  const blueRim = new THREE.PointLight(0x6f8cff, .65, 16, 1.5); blueRim.position.set(-4.5, 4.5, 2.5); titleScene.add(blueRim);
  const facade = new THREE.PointLight(0x40598c, 1.1, 26, 1.1); facade.position.set(0, 6.5, -7.5); titleScene.add(facade);
  const ground = plane(40, 40, pm(0x171a18), 0, 0, -4, -Math.PI / 2, 0, titleScene);
  ground.position.y = 0;
  // 校門
  const gateMat = pm(0x5d615a);
  box(.45, 3, .45, gateMat, -2.3, 1.5, -2.6, titleScene);
  box(.45, 3, .45, gateMat, 2.3, 1.5, -2.6, titleScene);
  box(5.1, .18, .3, gateMat, 0, 3, -2.6, titleScene);
  for (let i = -2; i <= 2; i++) box(.08, 2.2, .08, gateMat, i * .7, 1.25, -2.6, titleScene);
  box(4.7, .07, .07, gateMat, 0, 1.2, -2.6, titleScene);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(2.1, .42, .12), bm(0xb7ad90));
  sign.position.set(0, 2.78, -2.5); titleScene.add(sign);
  // 校舎の シルエット
  box(18, 7, 3, pm(0x1b2334), 0, 3.5, -15, titleScene);
  box(5, 11, 3, pm(0x171e2c), -7, 5.5, -16, titleScene);
  for (let i = 0; i < 8; i++) {
    const lit = i === 3 || i === 6;
    const wm = bm(lit ? 0xe8b76a : 0x28374f);
    box(1, 1.2, .1, wm, -6 + i * 1.7, 4.8 + (i % 2) * 1.5, -13.42, titleScene);
  }
  // 木
  for (const [x, z, s] of [[-6, -1, 1.2], [6.5, -3, 1], [-8, -6, 1.4], [8, -8, 1.1]]) {
    cyc(.15, .2, 2 * s, 5, pm(0x1d241c), x, 1 * s, z, titleScene);
    const crown = cyc(0, 1.4 * s, 3.4 * s, 6, pm(0x141b16), x, 3.4 * s, z, titleScene);
    crown.rotation.y = rnd(0, TAU);
  }
  // おばけ
  titleGhost = buildGhost('ghost');
  titleGhost.position.set(1.9, 1.35, -4.2);
  titleGhost.scale.setScalar(1.15);
  titleScene.add(titleGhost);
  // 雨
  const n = 420, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = rnd(-12, 12); pos[i * 3 + 1] = rnd(0, 10); pos[i * 3 + 2] = rnd(-18, 6); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0x9fb8e8, size: .035, transparent: true, opacity: .45, depthWrite: false });
  titleRain = new THREE.Points(geo, mat); titleScene.add(titleRain);
}
function updateTitle(dt) {
  G.t += 0;
  const t = performance.now() / 1000;
  titleCam.position.x = Math.sin(t * .12) * .35;
  titleCam.position.y = 2.3 + Math.sin(t * .19) * .05;
  titleCam.lookAt(Math.sin(t * .1) * .2, 2.0, -4);
  if (titleGhost) {
    titleGhost.position.y = 1.35 + Math.sin(t * 1.15) * .09;
    titleGhost.position.x = 1.9 + Math.sin(t * .31) * .18;
    titleGhost.rotation.y = Math.sin(t * .24) * .2;
  }
  if (titleLamp) titleLamp.intensity = 1.05 + (Math.sin(t * 13) > .96 ? -.8 : 0);
  if (titleRain) {
    const p = titleRain.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) - dt * 5.2;
      if (y < 0) { y = 10; p.setX(i, rnd(-12, 12)); p.setZ(i, rnd(-18, 6)); }
      p.setY(i, y);
    }
    p.needsUpdate = true;
  }
}

/* ===== キャラクター ===== */
function buildKid() {
  const g = new THREE.Group();
  const skin = pm(0xe0b28c), shirt = pm(0xe8e4d8), navy = pm(0x26304f), red = pm(0xa93232);
  const cap = pm(0xb33a36), hair = pm(0x2a211d), shoe = pm(0x3c3a3a);
  const body = box(.46, .5, .28, shirt, 0, .72, 0, g);
  box(.48, .12, .3, navy, 0, .47, 0, g);
  const head = box(.34, .32, .32, skin, 0, 1.08, 0, g);
  box(.37, .1, .34, hair, 0, 1.19, -.01, g);
  box(.36, .1, .37, cap, 0, 1.26, 0, g);
  box(.2, .04, .14, cap, 0, 1.23, .2, g);
  // 目
  const eyeM = bm(0x1a1614);
  box(.04, .05, .01, eyeM, -.08, 1.09, .166, g);
  box(.04, .05, .01, eyeM, .08, 1.09, .166, g);
  // ランドセル
  const bag = box(.42, .44, .2, red, 0, .76, -.23, g);
  box(.3, .07, .03, bm(0xd7c48a), 0, .76, -.335, g);
  // 脚（付け根で ふる）
  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(-.12, .46, 0); legR.position.set(.12, .46, 0);
  box(.14, .38, .16, navy, 0, -.19, 0, legL);
  box(.15, .09, .21, shoe, 0, -.4, .03, legL);
  box(.14, .38, .16, navy, 0, -.19, 0, legR);
  box(.15, .09, .21, shoe, 0, -.4, .03, legR);
  g.add(legL, legR);
  // 腕
  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.position.set(-.28, .9, 0); armR.position.set(.28, .9, 0);
  box(.12, .4, .14, shirt, 0, -.18, 0, armL);
  box(.12, .1, .13, skin, 0, -.39, 0, armL);
  box(.12, .4, .14, shirt, 0, -.18, 0, armR);
  box(.12, .1, .13, skin, 0, -.39, 0, armR);
  g.add(armL, armR);
  // 水でっぽう（右手）
  const gun = new THREE.Group();
  gun.position.set(0, -.42, .05);
  const gunMat = pm(0x3d596b), gunMat2 = pm(0x82b8cf);
  box(.1, .32, .1, gunMat, 0, .06, 0, gun);
  box(.08, .1, .26, gunMat2, 0, -.04, .1, gun);
  box(.07, .07, .18, gunMat, 0, -.04, -.02, gun);
  box(.05, .2, .05, gunMat, 0, -.16, -.04, gun);
  armR.add(gun);
  g.userData = { legL, legR, armL, armR, gun, body, head, bag };
  g.scale.setScalar(1);
  return g;
}

function ghostMat(color, opacity = .82) {
  return bm(color, { transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, fog: true });
}
function buildGhost(type) {
  const g = new THREE.Group();
  const mats = [];
  const add = (o) => { g.add(o); return o; };
  const mk = (geo, col, op) => { const m = ghostMat(col, op); mats.push(m); return new THREE.Mesh(geo, m); };
  if (type === 'uwabaki') {
    const body = mk(new THREE.BoxGeometry(.5, .26, .72), 0xcfc8d8, .9); body.position.y = .23; add(body);
    const toe = mk(new THREE.BoxGeometry(.48, .18, .28), 0xe4dfe8, .9); toe.position.set(0, .16, .42); add(toe);
    const sole = mk(new THREE.BoxGeometry(.55, .07, .8), 0x6b3d3d, .9); sole.position.y = .07; add(sole);
    for (const x of [-.13, .13]) { const e = mk(new THREE.BoxGeometry(.06, .08, .03), 0x14111a, 1); e.position.set(x, .34, .3); add(e); }
    const mouth = mk(new THREE.BoxGeometry(.18, .04, .02), 0x14111a, 1); mouth.position.set(0, .25, .36); add(mouth);
  } else if (type === 'randoseru') {
    const body = mk(new THREE.BoxGeometry(.55, .6, .3), 0x8f2830, .92); body.position.y = .65; add(body);
    const flap = mk(new THREE.BoxGeometry(.58, .2, .34), 0xa6343c, .95); flap.position.set(0, .88, 0); add(flap);
    const pocket = mk(new THREE.BoxGeometry(.36, .22, .06), 0x6e1c24, .95); pocket.position.set(0, .55, .18); add(pocket);
    for (const x of [-.25, .25]) { const st = mk(new THREE.BoxGeometry(.06, .5, .05), 0x3b1519, .9); st.position.set(x, .72, -.18); add(st); }
    for (const x of [-.12, .12]) { const e = mk(new THREE.BoxGeometry(.07, .1, .03), 0xf2efdc, 1); e.position.set(x, .72, .17); add(e); }
    const mouth = mk(new THREE.BoxGeometry(.2, .05, .03), 0x1a0b0c, 1); mouth.position.set(0, .58, .2); add(mouth);
  } else if (type === 'chalk') {
    const body = mk(new THREE.CylinderGeometry(.16, .2, .9, 6), 0xd9d5c8, .9); body.position.y = .55; add(body);
    const top = mk(new THREE.ConeGeometry(.17, .3, 6), 0xe4e0d2, .9); top.position.y = 1.14; add(top);
    for (const x of [-.08, .08]) { const e = mk(new THREE.BoxGeometry(.04, .06, .02), 0x1c1a17, 1); e.position.set(x, .74, .17); add(e); }
    const mouth = mk(new THREE.BoxGeometry(.11, .03, .02), 0x1c1a17, 1); mouth.position.set(0, .63, .18); add(mouth);
    for (const x of [-.24, .24]) { const a = mk(new THREE.BoxGeometry(.06, .3, .06), 0xd9d5c8, .9); a.position.set(x, .65, 0); a.rotation.z = x < 0 ? .4 : -.4; add(a); }
  } else if (type === 'locker') {
    const body = mk(new THREE.BoxGeometry(1.15, 2.6, .65), 0x66717b, .96); body.position.y = 1.3; add(body);
    for (const x of [-.28, .28]) {
      const d = mk(new THREE.BoxGeometry(.5, 2.3, .05), 0x77838d, .98); d.position.set(x, 1.3, .35); add(d);
      const vent = mk(new THREE.BoxGeometry(.32, .05, .02), 0x333b42, 1); vent.position.set(x, 2.1, .38); add(vent);
      const vent2 = vent.clone(); vent2.position.y = 2.0; add(vent2);
      const handle = mk(new THREE.BoxGeometry(.05, .25, .05), 0xc8b46a, 1); handle.position.set(x + (x < 0 ? .18 : -.18), 1.3, .39); add(handle);
    }
    for (const x of [-.2, .2]) { const e = mk(new THREE.BoxGeometry(.12, .16, .03), 0xffd23f, 1); e.position.set(x, 1.62, .39); add(e); }
    const mouth = mk(new THREE.BoxGeometry(.5, .1, .03), 0x2a1414, 1); mouth.position.set(0, 1.38, .4); add(mouth);
    for (let i = -1; i <= 1; i++) { const c = mk(new THREE.ConeGeometry(.14, .32, 4), 0xc9a43a, 1); c.position.set(i * .26, 2.78, 0); add(c); }
    for (const x of [-.72, .72]) { const a = mk(new THREE.BoxGeometry(.18, .9, .18), 0x66717b, .95); a.position.set(x, 1.25, 0); add(a); }
  } else {
    const body = mk(new THREE.CylinderGeometry(.24, .42, .95, 7), 0xd4d0df, .8); body.position.y = .62; add(body);
    const head = mk(new THREE.SphereGeometry(.29, 8, 6), 0xe2dfe9, .85); head.position.y = 1.2; add(head);
    for (const x of [-.1, .1]) { const e = mk(new THREE.BoxGeometry(.05, .08, .02), 0x17131c, 1); e.position.set(x, 1.22, .27); add(e); }
    const mouth = mk(new THREE.BoxGeometry(.12, .04, .02), 0x17131c, 1); mouth.position.set(0, 1.1, .28); add(mouth);
    for (const x of [-.34, .34]) { const a = mk(new THREE.BoxGeometry(.08, .42, .08), 0xd4d0df, .8); a.position.set(x, .72, 0); a.rotation.z = x < 0 ? .35 : -.35; add(a); }
  }
  g.userData.mats = mats;
  return g;
}

function buildItem(type) {
  const g = new THREE.Group();
  if (type === 'charm') {
    const paper = new THREE.Mesh(new THREE.BoxGeometry(.22, .5, .03), bm(0xf0dfa0, { emissive: 0x7a5a1a }));
    paper.position.y = .3; g.add(paper);
    const seal = new THREE.Mesh(new THREE.BoxGeometry(.14, .1, .04), bm(0xb83a32)); seal.position.set(0, .3, .005); g.add(seal);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(.9, .9), bm(0xffd76a, { transparent: true, opacity: .18, depthWrite: false, side: THREE.DoubleSide }));
    halo.rotation.x = -Math.PI / 2; halo.position.y = .02; g.add(halo); g.userData.halo = halo;
  } else if (type === 'ammo') {
    const b = new THREE.Mesh(new THREE.BoxGeometry(.34, .24, .24), pm(0x2b5f88)); b.position.y = .2; g.add(b);
    const l = new THREE.Mesh(new THREE.BoxGeometry(.2, .06, .01), bm(0xcfe8f5)); l.position.set(0, .22, .126); g.add(l);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(.1, .06, .1), bm(0x9fd8ff)); cap.position.y = .36; g.add(cap);
  } else if (type === 'herb') {
    for (let i = 0; i < 4; i++) {
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(.08, .28, .03), pm(0x3f8a4c));
      leaf.position.y = .22; leaf.rotation.z = (i - 1.5) * .45; leaf.rotation.y = i * 1.2; g.add(leaf);
    }
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(.12, .09, .14, 6), pm(0x8a5a3a)); pot.position.y = .06; g.add(pot);
  } else if (type === 'eraser') {
    const b = new THREE.Mesh(new THREE.BoxGeometry(.3, .07, .12), pm(0x3d4a8a)); b.position.y = .06; g.add(b);
    const f = new THREE.Mesh(new THREE.BoxGeometry(.3, .04, .12), bm(0xd8d4c4)); f.position.y = .005; g.add(f);
  } else if (type === 'key') {
    const r = new THREE.Mesh(new THREE.TorusGeometry(.07, .022, 4, 8), bm(0xe8c45a, { emissive: 0x7a5a1a }));
    r.position.y = .14; g.add(r);
    const s = new THREE.Mesh(new THREE.BoxGeometry(.035, .2, .03), bm(0xe8c45a)); s.position.y = -.01; g.add(s);
    const t = new THREE.Mesh(new THREE.BoxGeometry(.07, .03, .03), bm(0xe8c45a)); t.position.set(.04, -.08, 0); g.add(t);
    g.userData.spin = true;
  } else if (type === 'battery') {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .22, 6), pm(0xc8a43a)); c.position.y = .12; g.add(c);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .07, 6), pm(0x2a2a30)); top.position.y = .2; g.add(top);
  } else if (type === 'whistle') {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .12, 7), bm(0xc8ccd4)); b.rotation.z = Math.PI / 2; b.position.y = .08; g.add(b);
    const m = new THREE.Mesh(new THREE.BoxGeometry(.12, .05, .05), bm(0xaab0ba)); m.position.set(.1, .1, 0); g.add(m);
    const cord = new THREE.Mesh(new THREE.TorusGeometry(.1, .01, 3, 10), pm(0xc83a32)); cord.rotation.x = Math.PI / 2; cord.position.y = .03; g.add(cord);
  } else {
    const p = new THREE.Mesh(new THREE.BoxGeometry(.3, .38, .02), pm(0xd8d0b8)); p.position.y = .22; p.rotation.x = -.25; g.add(p);
  }
  if (type !== 'note' && type !== 'herb') {
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(.7, .7), bm(0xffd76a, { transparent: true, opacity: .16, depthWrite: false, side: THREE.DoubleSide }));
    halo.rotation.x = -Math.PI / 2; halo.position.y = .01; g.add(halo); g.userData.halo = halo;
  }
  return g;
}
