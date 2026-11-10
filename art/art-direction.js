/* おばけ第一小学校 — PS1アート制作システム / 1. Art Direction
 * ==========================================================================
 * 役割: 色・非対称・劣化・光の「規範となる数値」を1箇所に置く。
 *      絵を描くコードはここに書かない（art-direction.js は THREE に依存しない）。
 *
 * 規範: docs/PS1_ART_DIRECTION.md
 * 監査: docs/PS1_ART_AUDIT.md
 *
 * 読み込み順: art-direction.js → material-palette.js → model-factory.js → lighting-presets.js
 *            → pixelfx.html の本体スクリプト（クラシックスクリプト。ビルド不要）
 *
 * このファイルが読めなくてもゲームは動く（各モジュールは ART 未定義なら何もしない）。
 * ========================================================================== */
(function (global) {
  'use strict';

  const VERSION = '1.0.0';

  /* ---- トークン ---------------------------------------------------------
   * 数値は規範。ここを変えると全部屋・全モデルに波及するので、
   * 変更するときは docs/PS1_ART_DIRECTION.md も同時に直す。 */
  const TOKENS = {
    version: VERSION,

    // 画面全体
    exposure: 0.86,          // grade.uExposure（現行 .92 より沈める）
    contrast: 1.12,          // grade.uContrast（暗部を潰さないための表示空間のS字）
    tint: [0.88, 0.90, 0.80],// grade.uTint
    vignette: 1.30,
    grain: 0.026,

    // 彩度・明度の上限（パレットを破ったら console.warn する）
    satCap: 0.35,
    texSatCap: 0.38,   // テクスチャ側（画像そのもの）も同じ軸へ
    lumaCap: 0.78,
    satCapShadowViolet: 0.55, // boss 部屋のみ

    // キャラの自発光（現行は一律 .20。影が浅くなる原因）
    emissiveFloor: 0.11,
    emissiveEye: 0.26,

    // 光の帯（窓から差す god ray）— 画面下に光だまりを作らない
    godRayOpacity: 0.5,
    godRayColor: '#0b1120',

    // 面積比（参考値。実装で強制はしない）
    area: { dark: 0.6, mid: 0.3, light: 0.1 },

    // モデルの予算（1体あたり）
    budget: { triangles: 420, meshes: 26 },
  };

  /* ---- パレット ---------------------------------------------------------
   * 色相は「冷たい緑灰」と「錆びた銅」の2軸。紫は影の中だけ。 */
  const PALETTE = {
    NIGHT:       '#070d0f',
    FOG_COOL:    '#101820',
    FOG_WARM:    '#121814',

    STONE:       '#788a86',
    STONE_DARK:  '#4a5754',
    PLASTER:     '#8d968c',
    CEILING:     '#61665e',

    FLOOR_WOOD:  ['#4e3a2c', '#573f30', '#463327', '#5d4535', '#513c2e'],
    WOOD_WARM:   '#9a6b45',
    WOOD_DARK:   '#6b4a33',
    BASEBOARD:   '#2e2620',

    CHALK:       '#d8d5c4',
    PAPER:       '#c6bfa9',
    COPPER:      '#a9865c',
    METAL:       '#8e989a',
    METAL_DARK:  '#5b6567',

    BLOOD:       '#8d3440',
    BLOOD_DARK:  '#5c2029',
    BLOOD_EDGE:  '#3d151c',
    RUBBER:      '#232b29',
    GLASS:       '#93a6b4',
    EYE:         '#c9cbb4',
    INK:         '#161d1c',
  };

  /* ---- 非対称（決定論的） ----------------------------------------------
   * 範囲は規範。seed から必ず同じ値が出る。 */
  const ASYM = {
    propRotY:     0.026,  // 配置物 ±1.5°
    deskRotY:     0.070,  // 机 ±4°
    propOffset:   0.06,   // 位置ずれ 最大6cm
    posterTilt:   0.044,  // ポスター ±2.5°
    charLean:     0.052,  // キャラ 1.5–3.0°
    eyeRatio:     [0.86, 1.0],
    eyeOffsetY:   0.10,   // 上下 ±10%
    strapDelta:   0.06,   // 付属品 ±6%
    strapAngle:   0.052,  // ±3°
  };

  /* ---- 劣化 -------------------------------------------------------------
   * 「汚れ」ではなく「使われた形」。 */
  const WEAR = {
    edgeDarken:   1.32,   // 縁は 1.32 倍暗い
    grimeLow:     0.12,   // 下端25%を12%暗く
    grimeBand:    0.25,
    scuffAlpha:   0.18,
    chipsPerProp: [1, 2], // 1モデル1–2箇所
    stainsPerRoom: 2,     // 1部屋2種まで
    repairsPerRoom: 1,    // 修理の跡1箇所
  };

  /* ---- 決定論ハッシュ（FNV-1a） ----------------------------------------
   * Math.random() は使わない。同じ部屋・同じ敵は毎回同じように歪む。 */
  function hash(seed) {
    let h = 2166136261 >>> 0;
    const s = String(seed);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    h ^= h >>> 13;
    h = Math.imul(h, 1274126177) >>> 0;
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const range = (seed, min, max) => min + (max - min) * hash(seed);
  const pick = (seed, arr) => arr[Math.floor(hash(seed) * arr.length) % arr.length];
  const sign = (seed) => (hash(seed) < 0.5 ? -1 : 1);

  /* ---- 彩度クランプ（3D と HUD の断裂を止める唯一の関数） --------------
   * すべてのマテリアルがこの関数を经过する。色相は残し、彩度だけ落とす。
   * HDR（値が 1 を超える発光色）は光そのものなので触らない。 */
  function clampSaturation(color, cap) {
    if (!color) return color;
    const max = Math.max(color.r, color.g, color.b);
    if (max > 1.02) return color;           // 発光・ブルーム用の HDR 値はそのまま
    const c = cap == null ? TOKENS.satCap : cap;
    const hsl = { h: 0, s: 0, l: 0 };
    color.getHSL(hsl);
    if (hsl.s > c) color.setHSL(hsl.h, c, hsl.l);
    return color;
  }

  /* ---- テクスチャの彩度クランプ ----------------------------------------
   * マテリアルの色だけ整えても、canvas 生成のテクスチャ（青の袖・ピンクの
   * 板・原色の靴）は彩度が高いまま残る。テクスチャも同じ 1 軸へ寄せる。 */
  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    let h = 0, s = 0;
    if (mx !== mn) {
      const d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  }
  function hsl2rgb(h, s, l) {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = (t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
  }
  /* テクスチャも「冷たい緑灰」と「錆びた銅」の 2 軸へ寄せる。
   * 彩度だけ下げても、青（袖・ノート）や紫（夜空）が残るため、色相も軸へ寄せる。 */
  const TEX_HUE_AXES = [35, 100, 165];
  function pullHueAxis(h, k) {
    let best = TEX_HUE_AXES[0], bd = Infinity;
    for (let i = 0; i < TEX_HUE_AXES.length; i++) {
      const d = Math.abs(((h - TEX_HUE_AXES[i] + 540) % 360) - 180);
      if (d < bd) { bd = d; best = TEX_HUE_AXES[i]; }
    }
    const diff = ((best - h + 540) % 360) - 180;
    return ((h + diff * k) % 360 + 360) % 360;
  }
  function desaturateTexture(g, w, h, cap) {
    const c = cap == null ? TOKENS.texSatCap : cap;
    try {
      const img = g.getImageData(0, 0, w, h), a = img.data;
      for (let i = 0; i < a.length; i += 4) {
        if (a[i + 3] === 0) continue;
        const hsl = rgb2hsl(a[i], a[i + 1], a[i + 2]);
        if (hsl[1] <= c) continue;
        const rgb = hsl2rgb(pullHueAxis(hsl[0], 0.8), c, hsl[2]);
        a[i] = rgb[0]; a[i + 1] = rgb[1]; a[i + 2] = rgb[2];
      }
      g.putImageData(img, 0, 0);
    } catch (e) { /* 読めない canvas（tainted等）は元のまま */ }
  }

  /* ---- 非対称・劣化の生成 ---------------------------------------------- */
  function asym(seed, opts) {
    const o = opts || {};
    const k = o.scale == null ? 1 : o.scale;
    return {
      leanZ: sign(seed + 'lz') * range(seed + 'lz2', ASYM.charLean * 0.55, ASYM.charLean) * k,
      rotY: sign(seed + 'ry') * range(seed + 'ry2', ASYM.propRotY * 0.4, ASYM.propRotY) * k,
      dx: sign(seed + 'dx') * range(seed + 'dx2', ASYM.propOffset * 0.3, ASYM.propOffset) * k,
      dz: sign(seed + 'dz') * range(seed + 'dz2', ASYM.propOffset * 0.3, ASYM.propOffset) * k,
      eyeL: range(seed + 'eL', ASYM.eyeRatio[0], 1),
      eyeR: range(seed + 'eR', ASYM.eyeRatio[0], 1),
      eyeY: range(seed + 'eY', -ASYM.eyeOffsetY, ASYM.eyeOffsetY),
      strapL: 1 + sign(seed + 'sL') * range(seed + 'sL2', 0.01, ASYM.strapDelta) * k,
      strapR: 1 + sign(seed + 'sR') * range(seed + 'sR2', 0.01, ASYM.strapDelta) * k,
      strapTilt: sign(seed + 'st') * range(seed + 'st2', 0.01, ASYM.strapAngle) * k,
      buckle: sign(seed + 'bk') * range(seed + 'bk2', 0.01, 0.05),
    };
  }

  function wear(seed, opts) {
    const o = opts || {};
    return {
      chipCorner: pick(seed + 'chip', ['lb', 'rb', 'lt', 'rt', 'none']),
      edgeDark: o.edgeDark == null ? WEAR.edgeDarken : o.edgeDark,
      grime: range(seed + 'gr', WEAR.grimeLow * 0.5, WEAR.grimeLow),
      scuff: range(seed + 'sc', WEAR.scuffAlpha * 0.5, WEAR.scuffAlpha),
      stain: pick(seed + 'st', ['chalk', 'water', 'none']),
      repair: range(seed + 'rp', 0, 1) > 0.55,
    };
  }

  /* ---- 教室の配置（非対称な机・ポスター・照明） ------------------------ */
  function classroomDesks() {
    // 既存: x=-2.05/+2.05, z=-2.1/-3.0/-3.9 の完全グリッド
    const base = [
      [-2.05, -2.10], [2.05, -2.10],
      [-2.05, -3.00], [2.05, -3.00],
      [-2.05, -3.90], [2.05, -3.90],
    ];
    return base.map(([x, z], i) => {
      const s = 'desk' + i;
      const a = asym(s, { scale: 1.6 });
      // 1台は廊下側へ引かれ、1台は椅子が無い（「使われた形」）
      const pulled = i === 4;
      return {
        x: x + a.dx + (pulled ? 0.16 : 0),
        z: z + a.dz + (pulled ? 0.22 : 0),
        rotY: a.rotY * 2.1,
        missingChair: i === 2,
        seed: s,
      };
    });
  }

  const api = {
    version: VERSION,
    TOKENS,
    PALETTE,
    ASYM,
    WEAR,
    hash,
    range,
    pick,
    sign,
    asym,
    wear,
    classroomDesks,
    clampSaturation,
    desaturateTexture,

    /* 依存注入。pixelfx.html 側から1回だけ呼ぶ。
     * 注入されていない部品を使うモジュールは、その機能だけ no-op になる。 */
    ctx: null,
    /* 名前空間は読み込み時に用意する（art/*.js は init より先に読まれるため） */
    models: {},
    materials: {},
    lighting: {},
    layout: {},
    init(ctx) {
      api.ctx = ctx || null;
      // 二次創作をしやすくするための入口（既存のヘルパーをそのまま使う）
      api.models = api.models || {};
      api.materials = api.materials || {};
      api.lighting = api.lighting || {};
      api.layout = api.layout || {};
      /* 配置の入口を 1 つに揃える（room-presets.js が layout.rooms を足す） */
      api.layout.classroomDesks = api.classroomDesks;
      return api;
    },
    ready() {
      return !!(api.ctx && api.ctx.THREE);
    },
  };

  global.ART = api;
  if (global.console && console.info) {
    console.info('[ART] art-direction ' + VERSION + ' loaded');
  }
})(typeof window !== 'undefined' ? window : this);
