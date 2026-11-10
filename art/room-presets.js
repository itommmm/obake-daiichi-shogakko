/* おばけ第一小学校 — PS1アート制作システム / 5. Room Presets
 * ==========================================================================
 * 役割: 部屋ごとの「素材」「光」「配置」を1ファイルにまとめる。
 *       既存の buildRoom() の実測値を読み取り、色の軸と光の序列だけ差し替える。
 *
 * 色の軸: 冷たい緑灰(90-180°) と 錆びた銅(25-40°) の2本だけ。
 *         紫は影の中だけ(boss だけ10%まで許可)。補色対比は作らない。
 *
 * 使う側:
 *   ART.materials.rooms.classroom()      → {M, extra, textures}  (呼ぶたび新しい実体)
 *   ART.materials.rooms.classroom.M       → 同じ内容のショートカット
 *   ART.lighting.presets.classroom        → 数値プリセット
 *   ART.layout.rooms.classroom(seed)      → ずらした配置の配列
 *
 * 依存: ART.ctx（pixelfx.html が注入する rm / rb / ctex / TEX ...）
 * 読めなくてもゲームは動く（ART 未定義なら何もしない）。
 *
 * 読み込み順: art-direction.js → material-palette.js → model-factory.js
 *            → lighting-presets.js → room-presets.js → pixelfx.html
 * なぜ最後にするか: lighting-presets.js が ART.lighting.presets を
 * 上書きする実装だとroom側の8部屋が消えるため。必ず後ろに置く。
 * ========================================================================== */
(function (global) {
  'use strict';

  const ART = global.ART;
  if (!ART) return;

  const ASYM = ART.ASYM;

  /* ---- 部屋の寸法（pixelfx.html の ROOMS/buildRoom から写した固定値） ------
   * なぜ写すか:  配置をずらすには元の座標が要る。ROOMS は pixelfx の
   * ローカルなので ART 側から読めない。値がずれると当たり判定が壊れるので
   * ここは手で固定し、コメントで元を明記する。 */
  const DIM = {
    classroom: { hw: 2.7, ch: 2.9, back: -5.02 },   // zb .85  → zD(.85)-.12
    boss:      { hw: 2.7, ch: 2.9, back: -5.02 },
    science:   { hw: 2.7, ch: 2.9, back: -5.22 },   // zb .9
    hallway:   { hw: 1.7, ch: 2.7, back: -13.62 },  // zb 3, per 11.2
    getabako:  { hw: 12.0, ch: 2.9, back: -4.42 },  // zb .7, per 3.2
    gym:       { hw: 4.6, ch: 6.0, back: -6.82 },   // zb 1.3
    yard:      { hw: 20.0, ch: 20.0, back: -13.62 },
    bossyard:  { hw: 20.0, ch: 20.0, back: -13.62 },
  };

  /* ---- 色ヘルパ --------------------------------------------------------
   * HSL→HEX。彩度と明度の上限を数値で守るため、派生色はこの関数で作る。 */
  function hsl(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r, g, b;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    const t = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return '#' + t(r) + t(g) + t(b);
  }

  /* ---- 決定論の微振動 --------------------------------------------------
   * ASYM の範囲内に収める。seed が違えば結果が違うが、同じ seed なら毎回同じ。 */
  function off(seed, max) { return ART.sign(seed + 's') * ART.range(seed + 'r', max * 0.35, max); }
  function rot(seed, max) { return ART.sign(seed + 's') * ART.range(seed + 'r', max * 0.3, max); }

  /* ---- 体育館の床テクスチャ -------------------------------------------
   * 既存 TEX.gymFloor は原色のコート線（黄/水色）と明るい木で彩度が高い。
   * 軸に収めるため暗木 + 灰青/鈍い黄土のコート線を作り直す。 */
  let gymTex = null;
  function gymFloorTex(c) {
    if (gymTex) return gymTex;
    if (!c.ctex) return null;
    const H = (s) => ART.hash('gym:' + s);
    const pal = ['#4a3a2c', '#544230', '#43342a', '#5a4634', '#4e3d2f'];
    gymTex = c.ctex(512, 512, (g, w, h) => {
      const n = 18, pw = w / n;
      for (let i = 0; i < n; i++) {
        g.fillStyle = pal[Math.floor(H('p' + i) * pal.length) % pal.length];
        g.fillRect(i * pw, 0, pw, h);
        for (let k = 0; k < 10; k++) {
          const x0 = i * pw + H('x' + i + k) * pw;
          g.strokeStyle = 'rgba(28,20,13,' + (0.05 + H('a' + i + k) * 0.08).toFixed(3) + ')';
          g.lineWidth = 1 + H('w' + i + k) * 2;
          g.beginPath();
          g.moveTo(x0, 0);
          g.bezierCurveTo(x0 + (H('b' + i + k) - 0.5) * 6, h * 0.35,
                          x0 + (H('c' + i + k) - 0.5) * 6, h * 0.7,
                          x0 + (H('d' + i + k) - 0.5) * 4, h);
          g.stroke();
        }
        g.fillStyle = 'rgba(0,0,0,.42)';
        g.fillRect(i * pw, 0, 2, h);
      }
      /* コート線: 原色を落として灰青と鈍い黄土にする */
      g.strokeStyle = 'rgba(122,140,146,.50)'; g.lineWidth = 9;
      g.strokeRect(w * 0.08, h * 0.06, w * 0.84, h * 0.88);
      g.beginPath(); g.moveTo(w * 0.08, h * 0.5); g.lineTo(w * 0.92, h * 0.5); g.stroke();
      g.beginPath(); g.arc(w / 2, h / 2, w * 0.12, 0, 7); g.stroke();
      g.strokeStyle = 'rgba(146,132,92,.38)'; g.lineWidth = 7;
      g.strokeRect(w * 0.18, h * 0.12, w * 0.64, h * 0.76);
    }, { rep: 1 });
    return gymTex;
  }

  /* ---- テクスチャの解決 ------------------------------------------------
   * ART.materials.classroom() が作る textures.{floor,plaster,desk,wain,locker}
   * と、pixelfx の TEX.{woodS,lino,tiles,yard,bump,sky} を使い回す。
   * 既存 TEX.plaster(#8a86a6) は紫なので使わない。 */
  let TX = null;
  function textures(c) {
    if (TX) return TX;
    const base = ART.materials.classroom ? ART.materials.classroom() : null;
    TX = { plaster: null, floor: null, desk: null, wain: null, locker: null };
    if (base && base.textures) Object.assign(TX, base.textures);
    const t = c.TEX || {};
    TX.wood = t.woodS; TX.lino = t.lino; TX.tiles = t.tiles;
    TX.yard = t.yard; TX.bump = t.bump; TX.sky = t.sky; TX.schoolWin = t.schoolWin;
    TX.gym = gymFloorTex(c);
    return TX;
  }

  /* ---- 部屋ごとの素材仕様 --------------------------------------------
   * [色, 粗さ, 金属度, オプション]
   * 壁は粗さ .9 以上・ほぼ平坦、天井は壁より暗く粗く、床は envMapIntensity .2 以下、
   * 金属は metalness .2 以下。材質の_maps_ は全部 rm/rb で作る（破棄追跡のため）。 */
  const SPEC = {
    /* 教室: 灰緑 + 錆茶。壁は漆喰の寒色をそのまま使い、天井だけ沈める。 */
    classroom: {
      M: {
        plaster:  ['#ffffff', .94, 0, { map: 'plaster' }],
        ceiling:  ['#535c52', .97, 0, { map: 'plaster' }],
        floor:    ['#ffffff', .95, 0, { map: 'floor', envMapIntensity: .16 }],
        wood:     ['#ffffff', .68, 0, { map: 'desk' }],
        dark:     ['#242a26', .82, 0],
        wain:     ['#ffffff', .74, 0, { map: 'wain' }],
        base:     ['#2e2620', .84, 0],
        housing:  ['#525852', .70, .12],
        locker:   ['#ffffff', .64, .18, { map: 'locker' }],
        frame:    ['#7f8a84', .58, .10],
        sill:     ['#8c8676', .74, 0],
        curtain:  ['#a89f88', .97, 0, { bumpMap: 'bump', bumpScale: .012 }],
        metal:    ['#8e989a', .50, .18],
        repair:   ['#7d6a52', .84, 0],
      },
      extra: {
        glass: ['#93a6b4', .06, 0, { transparent: true, opacity: .12, envMapIntensity: 1.4, depthWrite: false }],
      },
      lists: {
        chalk: [['#d8d5c4', .8, 0], ['#cbc7b2', .8, 0], ['#bda79c', .8, 0], ['#a9bcbd', .8, 0], ['#c3b493', .8, 0]],
      },
    },

    /* boss: 同じ教室だが影にだけ赤紫を10%残す。天井と腰板で紫を効かせる。 */
    boss: {
      M: {
        plaster:  ['#cbc4d0', .94, 0, { map: 'plaster' }],
        ceiling:  ['#463a4c', .97, 0, { map: 'plaster' }],
        floor:    ['#d8d2c6', .95, 0, { map: 'floor', envMapIntensity: .16 }],
        wood:     ['#dcd6cc', .70, 0, { map: 'desk' }],
        dark:     ['#2a212c', .82, 0],
        wain:     ['#d4d2cc', .74, 0, { map: 'wain' }],
        base:     ['#2b2229', .84, 0],
        housing:  ['#5a4f60', .70, .12],
        locker:   ['#e6dfe8', .64, .18, { map: 'locker' }],
        frame:    ['#8a8494', .58, .10],
        sill:     ['#8f8896', .74, 0],
        curtain:  ['#9c8f96', .97, 0, { bumpMap: 'bump', bumpScale: .012 }],
        metal:    ['#8a8692', .50, .18],
        repair:   ['#6a5a6e', .84, 0],
      },
      extra: {
        glass: ['#93a6b4', .06, 0, { transparent: true, opacity: .12, envMapIntensity: 1.4, depthWrite: false }],
      },
      lists: {
        chalk: [['#d8d5c4', .8, 0], ['#cbc7b2', .8, 0], ['#bda79c', .8, 0], ['#a9bcbd', .8, 0], ['#c3b493', .8, 0]],
      },
    },

    /* 廊下: 青灰 + 緑灰。床は緑系リノ、丁ixtures 壁は寒色へ寄せる。 */
    hallway: {
      M: {
        plaster:  ['#b8c4c8', .95, 0, { map: 'plaster' }],
        ceiling:  ['#3e4c4e', .97, 0, { map: 'plaster' }],
        floor:    ['#ffffff', .55, 0, { map: 'lino', envMapIntensity: .18 }],
        wood:     ['#a89e8c', .70, 0, { map: 'wood' }],
        dark:     ['#212a2c', .82, 0],
        wain:     ['#a89e8c', .74, 0, { map: 'wood' }],
        base:     ['#262e2e', .84, 0],
        housing:  ['#4e5a5e', .70, .12],
        locker:   ['#ffffff', .64, .18, { map: 'locker' }],
        frame:    ['#79868c', .58, .10],
        sill:     ['#828b8c', .74, 0],
        curtain:  ['#8f9691', .97, 0, { bumpMap: 'bump', bumpScale: .012 }],
        metal:    ['#8a9498', .50, .18],
        repair:   ['#6f7168', .84, 0],
      },
      extra: {
        glass:     ['#93a6b4', .06, 0, { transparent: true, opacity: .12, envMapIntensity: 1.4, depthWrite: false }],
        doorGlass: ['#2a3a44', .10, 0, { envMapIntensity: 1.4 }],
        door:      ['#8a7460', .62, 0, { map: 'wood' }],
        ext:       ['#7a4038', .38, .10],
      },
    },

    /* 科学室: 青緑 + 銅。タイル床は寒色へ、試薬瓶は彩度を落とす。 */
    science: {
      M: {
        plaster:  ['#b2ccc4', .95, 0, { map: 'plaster' }],
        ceiling:  ['#37474a', .97, 0, { map: 'plaster' }],
        floor:    ['#7f9a96', .40, 0, { map: 'tiles', envMapIntensity: .18 }],
        wood:     ['#b8a488', .70, 0, { map: 'wood' }],
        dark:     ['#1e2626', .82, 0],
        wain:     ['#b8a488', .74, 0, { map: 'wood' }],
        base:     ['#232b29', .84, 0],
        housing:  ['#4c5a58', .70, .12],
        locker:   ['#ffffff', .64, .18, { map: 'locker' }],
        frame:    ['#7a8a86', .58, .10],
        sill:     ['#858f88', .74, 0],
        curtain:  ['#93a09a', .97, 0, { bumpMap: 'bump', bumpScale: .012 }],
        metal:    ['#8c989a', .50, .18],
        repair:   ['#6d7168', .84, 0],
      },
      extra: {
        glass:  ['#93a6b4', .06, 0, { transparent: true, opacity: .12, envMapIntensity: 1.4, depthWrite: false }],
        tube:   ['#a8bcc0', .08, 0, { transparent: true, opacity: .14, envMapIntensity: 1.4, depthWrite: false }],
        top:    ['#1a1e20', .28, 0, { envMapIntensity: .8 }],
        cabinet:['#3a4244', .62, .10],
      },
      lists: {
        bottles:[
          { basic: [.35, .55, .42], opts: {} },
          { basic: [.42, .45, .62], opts: {} },
          { basic: [.50, .45, .38], opts: {} },
          { basic: [.38, .52, .55], opts: {} },
          { basic: [.45, .42, .58], opts: {} },
        ],
      },
    },

    /* 下駄箱: 茶灰。壁も床も床板も茶に寄せ、鮮青/鮮赤の靴だけ別素材で落とす。 */
    getabako: {
      M: {
        plaster:  ['#bfa184', .95, 0, { map: 'plaster' }],
        ceiling:  ['#4a4644', .97, 0, { map: 'plaster' }],
        floor:    ['#8a7c68', .45, 0, { map: 'tiles', envMapIntensity: .18 }],
        wood:     ['#c0a184', .70, 0, { map: 'wood' }],
        dark:     ['#24201c', .82, 0],
        wain:     ['#c0a184', .74, 0, { map: 'wood' }],
        base:     ['#282420', .84, 0],
        housing:  ['#585048', .70, .12],
        locker:   ['#ffffff', .64, .18, { map: 'locker' }],
        frame:    ['#847c70', .58, .10],
        sill:     ['#8b8377', .74, 0],
        curtain:  ['#9a9184', .97, 0, { bumpMap: 'bump', bumpScale: .012 }],
        metal:    ['#938f88', .50, .18],
        repair:   ['#786a56', .84, 0],
      },
      extra: {
        glass:  ['#93a6b4', .06, 0, { transparent: true, opacity: .12, envMapIntensity: 1.4, depthWrite: false }],
        inner:  ['#221e20', .85, 0],
        shoeW:  ['#c2bdb0', .70, 0],
        shoeA:  ['#4a5a68', .50, 0],
        shoeB:  ['#6e4a3a', .50, 0],
      },
    },

    /* 体育館: 暗木 + 灰青。床は作り直した暗木、原色のコート線は消す。 */
    gym: {
      M: {
        plaster:  ['#96a8a4', .95, 0, { map: 'plaster' }],
        ceiling:  ['#2f3c3e', .97, 0, { map: 'plaster' }],
        floor:    ['#ffffff', .50, 0, { map: 'gym', envMapIntensity: .16 }],
        wood:     ['#a88e68', .68, 0, { map: 'wood' }],
        dark:     ['#1c2526', .82, 0],
        wain:     ['#a88e68', .74, 0, { map: 'wood' }],
        base:     ['#20282a', .84, 0],
        housing:  ['#4a585a', .70, .12],
        locker:   ['#ffffff', .64, .18, { map: 'locker' }],
        frame:    ['#6b7c80', .58, .10],
        sill:     ['#788584', .74, 0],
        curtain:  ['#8e8b86', .97, 0, { bumpMap: 'bump', bumpScale: .012 }],
        metal:    ['#8a9494', .50, .18],
        repair:   ['#6b6658', .84, 0],
      },
      extra: {
        glass:    ['#93a6b4', .06, 0, { transparent: true, opacity: .12, envMapIntensity: 1.4, depthWrite: false }],
        curtain:  ['#6a3a34', .85, 0, { bumpMap: 'bump', bumpScale: .01, side: 'double' }],
        seat:     ['#4a3a3c', .70, 0],
        pad:      ['#38543f', .85, 0, { bumpMap: 'bump', bumpScale: .02 }],
        hoop:     ['#7a5638', .42, .18],
        backdrop: ['#242c33', .90, 0, { map: 'sky' }],
        piano:    ['#101418', .14, .18, { envMapIntensity: 1 }],
      },
    },

    /* 運動場: 青灰 + 土。外壁は校舎の暗い青灰へ。 */
    yard: {
      M: {
        plaster:  ['#8ea2a4', .95, 0, { map: 'plaster' }],
        ceiling:  ['#2b3a3c', .97, 0, { map: 'plaster' }],
        floor:    ['#7e7466', .92, 0, { map: 'yard', envMapIntensity: .14 }],
        wood:     ['#a08a6a', .72, 0, { map: 'wood' }],
        dark:     ['#1c2220', .82, 0],
        wain:     ['#a08a6a', .74, 0, { map: 'wood' }],
        base:     ['#242a26', .84, 0],
        housing:  ['#4c5454', .70, .12],
        locker:   ['#ffffff', .64, .18, { map: 'locker' }],
        frame:    ['#6f8084', .58, .10],
        sill:     ['#7f888c', .74, 0],
        curtain:  ['#8a9294', .97, 0, { bumpMap: 'bump', bumpScale: .012 }],
        metal:    ['#8a9294', .50, .18],
        repair:   ['#6a6a5e', .84, 0],
      },
      extra: {
        glass:     ['#93a6b4', .06, 0, { transparent: true, opacity: .12, envMapIntensity: 1.4, depthWrite: false }],
        trunk:     ['#33291f', .90, 0],
        leaf:      ['#1b2b21', .85, 0],
        bar:       ['#8e969c', .32, .18],
        pole:      ['#7c8286', .60, .16],
        schoolWall:['#202830', .90, 0],
        schoolWin: { basic: [1.15, 1.00, .80], opts: { map: 'schoolWin' } },
        sky:       { basic: [.26, .31, .40], opts: { map: 'sky', side: 'back', fog: false } },
      },
      lists: {
        /* タイヤ4色は原色（赤黄青緑）をやめて、軸の上の4色相に散らす */
        tires: [
          [hsl(24, .30, .28), .60, 0],
          [hsl(78, .18, .26), .60, 0],
          [hsl(200, .14, .26), .60, 0],
          [hsl(158, .20, .24), .60, 0],
        ],
      },
    },

    /* bossyard: 暗赤紫 + 土。夜空のピンクは紫寄りの紺へ落とす。 */
    bossyard: {
      M: {
        plaster:  ['#a89cb4', .95, 0, { map: 'plaster' }],
        ceiling:  ['#3a3444', .97, 0, { map: 'plaster' }],
        floor:    ['#6e6a62', .92, 0, { map: 'yard', envMapIntensity: .14 }],
        wood:     ['#96806c', .72, 0, { map: 'wood' }],
        dark:     ['#1e1a22', .82, 0],
        wain:     ['#96806c', .74, 0, { map: 'wood' }],
        base:     ['#26222a', .84, 0],
        housing:  ['#4a4450', .70, .12],
        locker:   ['#ffffff', .64, .18, { map: 'locker' }],
        frame:    ['#6e6878', .58, .10],
        sill:     ['#77717e', .74, 0],
        curtain:  ['#847c8a', .97, 0, { bumpMap: 'bump', bumpScale: .012 }],
        metal:    ['#86828e', .50, .18],
        repair:   ['#685a62', .84, 0],
      },
      extra: {
        glass:      ['#93a6b4', .06, 0, { transparent: true, opacity: .12, envMapIntensity: 1.4, depthWrite: false }],
        trunk:      ['#2e2620', .90, 0],
        leaf:       ['#1a2520', .85, 0],
        bar:        ['#7e7684', .32, .18],
        pole:       ['#6e6a76', .60, .16],
        schoolWall: ['#241f30', .90, 0],
        sky:        { basic: [.30, .20, .34], opts: { map: 'sky', side: 'back', fog: false } },
      },
      lists: {
        tires: [
          [hsl(18, .26, .24), .60, 0],
          [hsl(70, .16, .22), .60, 0],
          [hsl(196, .12, .24), .60, 0],
          [hsl(150, .18, .22), .60, 0],
        ],
      },
    },
  };

  /* ---- 素材の実体化 ----------------------------------------------------
   * rm / rb で作る（roomMats に入れて破棄追跡させる）。
   * 部屋ごとに毎回作り直す。使い回しはしない。 */
  function resolveOpts(o, tx, THREE) {
    const out = Object.assign({}, o || {});
    if (out.map) { const t = tx[out.map]; if (t) out.map = t; else delete out.map; }
    if (out.bumpMap) { const t = tx[out.bumpMap]; if (t) out.bumpMap = t; else delete out.bumpMap; }
    if (out.side === 'back') out.side = THREE.BackSide;
    else if (out.side === 'front') out.side = THREE.FrontSide;
    else if (out.side === 'double') out.side = THREE.DoubleSide;
    return out;
  }

  function buildRoomMats(place) {
    const c = ART.ctx;
    if (!c || !c.rm || !c.rb) return null;
    const spec = SPEC[place];
    if (!spec) return null;
    const THREE = c.THREE;
    const tx = textures(c);
    const M = {};
    for (const k of Object.keys(spec.M)) {
      const s = spec.M[k];
      M[k] = c.rm(s[0], s[1], s[2], resolveOpts(s[3], tx, THREE));
    }
    const extra = {};
    for (const k of Object.keys(spec.extra || {})) {
      const one = spec.extra[k];
      if (one && one.basic) { extra[k] = c.rb(one.basic[0], one.basic[1], one.basic[2], resolveOpts(one.opts, tx, THREE)); continue; }
      extra[k] = c.rm(one[0], one[1], one[2], resolveOpts(one[3], tx, THREE));
    }
    for (const k of Object.keys(spec.lists || {})) {
      extra[k] = spec.lists[k].map((one) => {
        if (one && one.basic) return c.rb(one.basic[0], one.basic[1], one.basic[2], resolveOpts(one.opts, tx, THREE));
        return c.rm(one[0], one[1], one[2], resolveOpts(one[3], tx, THREE));
      });
    }
    return { M, extra, textures: tx };
  }

  ART.materials.rooms = ART.materials.rooms || {};
  for (const place of Object.keys(SPEC)) {
    const fn = function (p) { return buildRoomMats(p || place); };
    /* ART.materials.rooms.classroom.M 形式でも呼べるようにする（仕様どおりの形） */
    Object.defineProperty(fn, 'M', { get: function () { const s = buildRoomMats(place); return s ? s.M : null; } });
    fn.spec = SPEC[place];
    ART.materials.rooms[place] = fn;
  }
  ART.materials.room = function (place) { return buildRoomMats(place); };

  /* ==========================================================================
   * ライティング
   * 数値は buildRoom 末尾の適用後（hemi .74 / moon .70 / fl1 .76 / fl2 .70）を
   * 基準に、意図的に下げた値。全部を一律に暗くせず、部屋ごとに序列差を出す。
   *   classroom  hemi .12 / moon 1.19 / fl1 .319 / fl2 .294 / fog .063
   *   boss      hemi .12 / moon 1.19 / fl1 .167 / fl2 .154 / fog .082
   *   hallway   hemi .12 / moon 1.19 / fl1 .418 / fl2 .385 / fog .082
   *   science   hemi .12 / moon 1.19 / fl1 .319 / fl2 .294 / fog .063
   *   getabako  hemi .12 / moon  .70 / fl1 .380 / fl2 .350 / fog .063
   *   gym       hemi .12 / moon  .98 / fl1 .836 / fl2 .770 / fog .046
   *   yard      hemi .19 / moon  .98 / fl1 0    / fl2 0    / fog .033
   *   bossyard  hemi .19 / moon  .98 / fl1 0    / fl2 0    / fog .029
   * 光源の数は増やさない。色と強さだけを変える。
   * ========================================================================== */
  ART.lighting.presets = {
    /* 教室: 暖色の蛍光灯 + 寒色の月。既存の基準値から動かさない。 */
    classroom: {
      exposure: 0.93,
      contrast: 1.06,
      tint: [0.88, 0.90, 0.80],
      vignette: 1.30,
      grain: 0.026,
      fog: { color: '#121814', density: 0.058 },
      background: 0.52,
      hemi: { sky: '#39414a', ground: '#0e1113', intensity: 0.12 },
      moon: { color: '#93a49b', intensity: 1.05 },
      fl1: { color: '#c9b391', intensity: 0.49, distance: 8.5 },
      fl2: { color: '#8ea39a', intensity: 0.30, distance: 7.5 },
      rays: { opacity: 0.5, color: '#0b1120' },
      fluor: [1.0, 0.90, 0.55, 0.78],
    },

    /* boss: 影にだけ赤紫を残す。紫は key と fill に置き、面の広い所には置かない。 */
    boss: {
      exposure: 0.83,
      contrast: 1.12,
      tint: [0.86, 0.83, 0.88],
      vignette: 1.44,
      grain: 0.030,
      fog: { color: '#1a1018', density: 0.068 },
      background: 0.46,
      hemi: { sky: '#463050', ground: '#120a12', intensity: 0.11 },
      moon: { color: '#9d92d8', intensity: 0.96 },
      fl1: { color: '#c9956c', intensity: 0.28, distance: 8.0 },
      fl2: { color: '#8a9cb4', intensity: 0.20, distance: 7.0 },
      rays: { opacity: 0.42, color: '#160f26' },
      fluor: [0.92, 0.78, 0.45, 0.62],
    },

    /* 廊下: 奥长大。密度を上げて奥を消し、蛍光灯は寒色寄りに寄せる。 */
    hallway: {
      exposure: 0.88,
      contrast: 1.06,
      tint: [0.86, 0.92, 0.84],
      vignette: 1.36,
      grain: 0.028,
      fog: { color: '#0e1418', density: 0.070 },
      background: 0.48,
      hemi: { sky: '#37464a', ground: '#0b0f10', intensity: 0.11 },
      moon: { color: '#8fa2a8', intensity: 0.94 },
      fl1: { color: '#c0b092', intensity: 0.43, distance: 9.0 },
      fl2: { color: '#7d9490', intensity: 0.29, distance: 8.0 },
      rays: { opacity: 0.55, color: '#0a1016' },
      fluor: [1.0, 0.95, 0.85, 0.60, 0.92, 0.88, 1.0, 0.75, 0.55, 0.90, 0.93, 0.86, 0.70],
    },

    /* 科学室: 暖色の蛍光灯と寒色の作業灯を並べる。 */
    science: {
      exposure: 0.88,
      contrast: 1.06,
      tint: [0.86, 0.93, 0.86],
      vignette: 1.32,
      grain: 0.026,
      fog: { color: '#0c1618', density: 0.058 },
      background: 0.50,
      hemi: { sky: '#2c4a48', ground: '#0a1010', intensity: 0.11 },
      moon: { color: '#8fb0a4', intensity: 0.98 },
      fl1: { color: '#c2a98d', intensity: 0.43, distance: 8.0 },
      fl2: { color: '#7f9c9e', intensity: 0.30, distance: 7.0 },
      rays: { opacity: 0.48, color: '#08120f' },
      fluor: [1.0, 0.92, 0.50, 0.70],
    },

    /* 下駄箱: 幅24m。霧を薄くして奥行きを保つ。 */
    getabako: {
      exposure: 0.93,
      contrast: 1.08,
      tint: [0.90, 0.89, 0.82],
      vignette: 1.24,
      grain: 0.026,
      fog: { color: '#12110b', density: 0.046 },
      background: 0.56,
      /* 幅 24m の広い空間。上部（大空間）が真黒にならないよう fill を少し足す */
      hemi: { sky: '#4a4030', ground: '#0f0d0a', intensity: 0.17 },
      moon: { color: '#8f9a8e', intensity: 0.68 },
      fl1: { color: '#bfa07c', intensity: 0.43, distance: 9.5 },
      fl2: { color: '#87917f', intensity: 0.27, distance: 7.5 },
      rays: { opacity: 0.40, color: '#0d0f0b' },
      fluor: [1.0, 0.90, 0.80, 0.55, 0.95, 0.88, 1.0, 0.72, 0.93, 0.85, 0.90, 0.66],
    },

    /* 体育館: 舞台照明。紫と緑のスポットを使えるので key だけを寒色にし、
     * practical を紫/緑の対にして軸(土+灰青)にはみ出させない。 */
    gym: {
      exposure: 0.92,
      contrast: 1.04,
      tint: [0.87, 0.92, 0.82],
      vignette: 1.34,
      grain: 0.024,
      fog: { color: '#101318', density: 0.040 },
      background: 0.50,
      hemi: { sky: '#2c3a40', ground: '#15120f', intensity: 0.11 },
      moon: { color: '#9aa8b4', intensity: 0.90 },
      fl1: { color: '#8f7fb8', intensity: 0.90, distance: 12.0 },
      fl2: { color: '#6f9c86', intensity: 0.60, distance: 12.0 },
      rays: { opacity: 0.62, color: '#0a0f14' },
      fluor: [1.0, 0.85, 0.95, 0.60, 0.90, 1.0, 0.75, 0.88, 0.70],
    },

    /* 運動場: 屋外。蛍光灯は落とし、月と半球光で形だけ作る。 */
    yard: {
      exposure: 0.94,
      contrast: 1.02,
      tint: [0.86, 0.92, 0.86],
      vignette: 1.24,
      grain: 0.022,
      fog: { color: '#0a1014', density: 0.026 },
      background: 0.70,
      hemi: { sky: '#3a4a4e', ground: '#12100c', intensity: 0.19 },
      moon: { color: '#b9c6c8', intensity: 1.32 },
      fl1: { color: '#c9b391', intensity: 0.00, distance: 9.0 },
      fl2: { color: '#8ea39a', intensity: 0.00, distance: 9.0 },
      rays: { opacity: 0.35, color: '#0b1220' },
      fluor: [],
    },

    /* bossyard: 夜空は紫。(key を紫へ寄せ、地平の土は残す) */
    bossyard: {
      exposure: 0.88,
      contrast: 1.06,
      tint: [0.86, 0.84, 0.90],
      vignette: 1.40,
      grain: 0.028,
      fog: { color: '#16101a', density: 0.024 },
      background: 0.62,
      hemi: { sky: '#4a3050', ground: '#150e12', intensity: 0.18 },
      moon: { color: '#a89cc8', intensity: 1.12 },
      fl1: { color: '#c9956c', intensity: 0.00, distance: 9.0 },
      fl2: { color: '#8ea39a', intensity: 0.00, distance: 9.0 },
      rays: { opacity: 0.40, color: '#150f20' },
      fluor: [],
    },
  };

  /* ==========================================================================
   * 配置の非対称化
   * 既存の完全グリッドを壊しすぎない量でずらす。
   * ずれの量は ASYM 之内（位置 2-6cm / 什物 ±1.5° / 机 ±4° / ポスター ±2.5°）。
   * 当たり判定と敵の導線は変えないので、中心座標は元のまま。
   * ========================================================================== */

  /* 教室と boss は同じ部屋。机は ART.classroomDesks() をそのまま使う（重複実装しない）。 */
  function layoutClassroom(seed, tag) {
    const d = DIM.classroom;
    const t = tag + ':' + seed;
    const lockers = [], posters = [], chalk = [], fluor = [], tests = [];
    for (let i = 0; i < 4; i++) {
      const s = t + ':lk' + i;
      lockers.push({ x: d.hw - .21 + off(s + 'x', ASYM.propOffset), z: -1.25 - i * .4 + off(s + 'z', ASYM.propOffset), rotY: rot(s + 'r', ASYM.propRotY), w: .42, h: 1.25, d: .38 });
    }
    for (let i = 0; i < 2; i++) {
      const s = t + ':ps' + i;
      posters.push({ x: (i ? 1.35 : -1.35) + off(s + 'x', ASYM.propOffset), y: 2.45, z: d.back + .03, rotZ: rot(s + 'r', ASYM.posterTilt), w: .9, h: .56 });
    }
    for (let i = 0; i < 5; i++) {
      const s = t + ':ck' + i;
      chalk.push({ x: -1 + i * .15 + off(s + 'x', .01), y: .955, z: d.back + .12, rotY: rot(s + 'r', ASYM.propRotY) });
    }
    for (let i = 0; i < 4; i++) {
      const s = t + ':fl' + i;
      fluor.push({ x: (i % 2 ? .95 : -.95) + off(s + 'x', .04), y: d.ch, z: (i < 2 ? -1.8 : -3.6) + off(s + 'z', .04), len: 1.2, rotY: rot(s + 'r', ASYM.propRotY) });
    }
    tests.push({ x: -2.0, y: .725, z: -2.1, rotZ: rot(t + ':t0', ASYM.posterTilt) });
    tests.push({ x: 2.10, y: .725, z: -3.0, rotZ: rot(t + ':t1', ASYM.posterTilt) });
    return {
      desks: ART.classroomDesks ? ART.classroomDesks() : [],
      lockers, posters, chalk, fluor, tests,
      board:   { x: 0, y: 1.55, z: d.back + .03, w: 3.3, h: 1.35 },
      clock:   { x: 0, y: 2.5, z: d.back + .05 },
      door:    { x: d.hw - .03, z: -3.9, w: .95, h: 2.05 },
      cork:    { x: d.hw - .04, y: 1.75, z: -2.4, w: 1.2, h: .62 },
      homework:{ x: -1.95, y: .84, z: -3.05, rotY: .55, rotZ: -.35 },
      wain:    { x: d.hw - .02, y: .43, z: (1.2 + d.back) / 2 },
    };
  }

  function layoutHallway(seed) {
    const d = DIM.hallway;
    const doors = [], plates = [], posters = [], ext = [], fluor = [], windows = [];
    for (let k = 0; k < 13; k++) {
      const z = 9.6 - k * 2.8;
      const s = 'hall:' + seed + ':' + k;
      doors.push({ x: d.hw - .03 + off(s + 'x', .04), z: z + off(s + 'z', .05), rotY: rot(s + 'r', ASYM.propRotY), w: 1.0, h: 2.05 });
      plates.push({ x: d.hw - .25, y: 2.35, z: z + .6, rotY: rot(s + 'p', ASYM.propRotY), w: .42, h: .16 });
      posters.push({ x: d.hw - .04, y: 1.5, z: z - .85, rotZ: rot(s + 'q', ASYM.posterTilt), w: .6, h: .38 });
      if (k % 2 === 0) ext.push({ x: d.hw - .12, y: .21, z: z - 1.4, rotY: rot(s + 'e', ASYM.propRotY) });
      fluor.push({ x: 0, y: d.ch, z: z + .3, len: 1.2, rotY: rot(s + 'f', ASYM.propRotY) });
    }
    for (let k = 0; k < 13; k++) {
      const z0 = 10.2 - k * 2.8;
      windows.push({ z0, z1: z0 - 1.6, y0: .95, y1: 2.2, ray: (z0 < 1 && z0 > -12) });
    }
    return { doors, plates, posters, ext, fluor, windows, wain: { x: d.hw - .02, y: .45 } };
  }

  function layoutScience(seed) {
    const d = DIM.science;
    const benches = [], fluor = [], bottles = [], windows = [];
    for (let i = 0; i < 4; i++) {
      const s = 'sci:' + seed + ':bn' + i;
      benches.push({ x: (i % 2 ? 1.75 : -1.75) + off(s + 'x', .05), z: (i < 2 ? -2.5 : -3.9) + off(s + 'z', .05), rotY: rot(s + 'r', ASYM.propRotY), w: 1.5, h: .82, d: .8 });
    }
    for (let i = 0; i < 4; i++) {
      const s = 'sci:' + seed + ':fl' + i;
      fluor.push({ x: (i % 2 ? .95 : -.95) + off(s + 'x', .04), y: d.ch, z: (i < 2 ? -1.8 : -3.6) + off(s + 'z', .04), len: 1.2, rotY: rot(s + 'r', ASYM.propRotY) });
    }
    /* 試薬瓶: 元コードの並びを保ったまま位置だけ微振動 */
    for (const y of [.55, 1.05, 1.55]) {
      for (let x = -1.65; x < 1.7; x += .22) {
        const s = 'sci:' + seed + ':bt' + x.toFixed(2) + y;
        bottles.push({ x: x + off(s + 'x', .01), y: y + .09, z: d.back + .24, ci: Math.floor(Math.abs(Math.sin(x * 7 + y * 3)) * 5) % 5 });
      }
    }
    for (let i = 0; i < 3; i++) {
      const z0 = [-1.0, -2.35, -3.7][i];
      windows.push({ z0, z1: z0 - 1.0, y0: .95, y1: 2.35, ray: true });
    }
    return {
      benches, fluor, bottles, windows,
      shelf:    { x: 0, y: 1.1, z: d.back + .2, w: 3.6, h: 1.9, d: .35, rows: [.55, 1.05, 1.55, 2.0] },
      poster:   { x: 0, y: 2.45, z: d.back + .05, w: 1.2, h: .62 },
      periodic: { x: d.hw - .04, y: 1.7, z: -2.6, w: 1.3, h: .8 },
    };
  }

  function layoutGetabako(seed) {
    const d = DIM.getabako;
    const L = d.hw + 3.2 + 3;   // 元コードの L = halfW + per + 3
    const sz = d.back + .25;
    const lockers = [], shoes = [], posters = [], fluor = [];
    for (let k = 0; k < 23; k++) {
      const x = -L + k * 1.6;
      const s = 'geta:' + seed + ':lk' + k;
      lockers.push({ x: x + .8 + off(s + 'x', .04), z: sz + off(s + 'z', .03), rotY: rot(s + 'r', ASYM.propRotY), w: 1.5, h: 1.7, d: .36 });
      for (let c = 0; c < 4; c++) {
        for (let r = 1; r < 5; r++) {
          if ((c * 7 + r * 3) % 3 === 0) continue;      // 元の空きマスをそのまま保つ
          const cx = x + .05 + c * .375 + .19, cy = .2 + r * .34;
          const ci = (c + r) % 2;
          for (const sd of [-1, 1]) {
            shoes.push({ x: cx + sd * .06, y: cy, z: sz + .06, zToe: sz + .18, ci });
          }
        }
      }
    }
    for (let k = 0; k < 23; k += 2) {
      const x = -L + .8 + k * 1.6;
      const s = 'geta:' + seed + ':ps' + k;
      posters.push({ x: x + off(s + 'x', .04), y: 2.35, z: d.back + .02, rotZ: rot(s + 'r', ASYM.posterTilt), w: .9, h: .5 });
    }
    for (let k = 0; k < 12; k++) {
      const s = 'geta:' + seed + ':fl' + k;
      fluor.push({ x: -L + k * 3.2 + off(s + 'x', .05), y: d.ch, z: -2.2, len: 1.2, rotY: rot(s + 'r', ASYM.propRotY) });
    }
    return { lockers, shoes, posters, fluor, slatY: .02, slatW: .2, slatD: 1.0, slatStep: .25, slatFrom: -L };
  }

  function layoutGym(seed) {
    const d = DIM.gym;
    const seats = [], fluor = [], windows = [], ghosts = [], spots = [], stands = [], hoops = [];
    for (const z of [-1.6, -2.4, -3.2, -4.0]) {
      for (const x of [-3.9, -3.3, -2.7, 2.7, 3.3, 3.9]) {
        const s = 'gym:' + seed + ':st' + x + '_' + z;
        seats.push({ x: x + off(s + 'x', .04), z: z + off(s + 'z', .04), rotY: rot(s + 'r', ASYM.propRotY), w: .42, d: .4 });
      }
    }
    for (let k = 0; k < 3; k++) {
      for (const x of [-2, 0, 2]) {
        const s = 'gym:' + seed + ':fl' + k + '_' + x;
        fluor.push({ x: x + off(s + 'x', .04), y: d.ch, z: -.8 - k * 2.2 + off(s + 'z', .04), rotY: rot(s + 'r', ASYM.propRotY) });
      }
    }
    for (let k = 0; k < 4; k++) {
      const z0 = -.4 - k * 1.6;
      windows.push({ z0, z1: z0 - 1.0, y0: 3.5, y1: 5.2, ray: true });
    }
    const gz = [[0, .55, 1], [-.9, .38, 0], [.9, .38, 0], [2.0, .38, 0]];
    gz.forEach((g, i) => {
      const s = 'gym:' + seed + ':gh' + i;
      ghosts.push({ x: g[0] + off(s + 'x', .04), z: d.back + (g[2] ? 1.35 : .85) + off(s + 'z', .04), scale: g[1], conductor: !!g[2] });
    });
    for (let i = 0; i < 3; i++) {
      const s = 'gym:' + seed + ':sp' + i;
      spots.push({ x: -2.5 + i * 2.5 + off(s + 'x', .05), y: d.ch - .4, z: d.back + 3 + off(s + 'z', .05) });
    }
    for (const x of [-.9, .9, 2.0]) {
      const s = 'gym:' + seed + ':ms' + x;
      stands.push({ x: x + off(s + 'x', .04), z: d.back + 1.1 + off(s + 'z', .04), rotY: rot(s + 'r', ASYM.propRotY) });
    }
    for (const sd of [-1, 1]) hoops.push({ x: sd * (d.hw - .6), y: 3.3, z: -3.2 });
    return {
      seats, fluor, windows, ghosts, spots, stands, hoops,
      piano:    { x: -2.2, z: d.back + .85 },
      curtains: [{ x: -2.75, y: 2.75, z: d.back + .3 }, { x: 2.75, y: 2.75, z: d.back + .3 }],
      stage:    { x: 0, y: .52, z: d.back + .8, w: d.hw * 2, h: 1.05, d: 1.6 },
    };
  }

  function layoutYard(seed, tag) {
    const trees = [], tires = [], bars = [], poles = [];
    for (let k = 0; k < 9; k++) {
      const z = 11.2 - k * 10;
      for (const x of [-11, -8.5, 8.5, 11.5]) {
        const s = tag + ':' + seed + ':tr' + x + '_' + k;
        const zt = z + ((x * 3) % 4);
        trees.push({ x: x + off(s + 'x', .06), z: zt + off(s + 'z', .06), rotY: rot(s + 'r', ASYM.propRotY), r: .18, h: 2.4 });
      }
      for (let i = 0; i < 4; i++) {
        const s = tag + ':' + seed + ':ti' + k + '_' + i;
        tires.push({ x: -4.6 + off(s + 'x', .04), y: .12, z: z - i * .9 + off(s + 'z', .04), rotY: rot(s + 'r', ASYM.propRotY), ci: i });
      }
      for (const dz of [3, 5]) {
        const s = tag + ':' + seed + ':ba' + k + '_' + dz;
        bars.push({ x: 5.2 + off(s + 'x', .04), y: .65, z: z - dz + off(s + 'z', .04), rotY: rot(s + 'r', ASYM.propRotY) });
      }
      for (let i = 0; i < 5; i++) {
        const s = tag + ':' + seed + ':po' + k + '_' + i;
        poles.push({ x: 14 + off(s + 'x', .05), y: .55, z: z - i * 2 + off(s + 'z', .05), rotY: rot(s + 'r', ASYM.propRotY) });
      }
    }
    const out = { trees, tires, bars, poles };
    if (tag === 'yard') {
      out.school = { wall: { x: 0, y: 4.5, z: -62, w: 56, h: 9, d: 8 }, tower: { x: 0, y: 7, z: -58, w: 6, h: 14, d: 6 }, win: { x: 0, y: 4.2, z: -57.9, w: 50, h: 7 }, clock: { x: 0, y: 11.5, z: -54.9 } };
    }
    return out;
  }

  ART.layout.rooms = ART.layout.rooms || {};
  ART.layout.rooms.classroom = function (seed) { return layoutClassroom(seed || 'classroom', 'classroom'); };
  ART.layout.rooms.boss = function (seed) { return layoutClassroom(seed || 'boss', 'boss'); };
  ART.layout.rooms.hallway = layoutHallway;
  ART.layout.rooms.science = layoutScience;
  ART.layout.rooms.getabako = layoutGetabako;
  ART.layout.rooms.gym = layoutGym;
  ART.layout.rooms.yard = function (seed) { return layoutYard(seed || 'yard', 'yard'); };
  ART.layout.rooms.bossyard = function (seed) { return layoutYard(seed || 'bossyard', 'bossyard'); };

  if (global.console && console.info) {
    console.info('[ART] room-presets loaded: ' + Object.keys(SPEC).length + ' rooms');
  }
})(typeof window !== 'undefined' ? window : this);

/* ==========================================================================
 * 統合メモ（pixelfx.html 側で使う人へ）
 * --------------------------------------------------------------------------
 * 1) 素材
 *    const RM = ART.materials.rooms[place]();   // {M, extra, textures}
 *    M は buildRoom が使う既存キーと同じ14本。呼び出しごとに新しい実体。
 *    extra は「既存コードがインラインで rm/rb していた素材」の差し替え口:
 *      全室   glass   窓ガラス（opacity .12）
 *      教室   chalk   黒板のチョーク5色
 *      廊下   door / doorGlass / ext  （扉・扉ガラス・消火器）
 *      科学室 bottles / tube / top / cabinet
 *      下駄箱 shoeW / shoeA / shoeB / inner   （鮮青・鮮赤の靴を落とす）
 *      体育館 curtain / seat / pad / hoop / backdrop / piano
 *      運動場 trunk / leaf / bar / pole / schoolWall / schoolWin / sky / tires[4]
 *      bossyard 同じ（sky はピンク夜空を紫紺へ）
 *    TEX.plaster(#8a86a6) は使わない。壁は ART.materials.classroom() の
 *    textures.plaster(#8d968c) を使う。
 *
 * 2) 光
 *    ART.lighting.presets[place] を apply が読む実装に書き換える。
 *    既存 apply は hemi/moon/fl1/fl2 の userData.base を preset の intensity で
 *    上書きするので、update3D の毎フレーム計算はそのまま効く。
 *    注意: pixelfx は wave 開始時に uExposure=.95 を書き戻す。buildRoom の
 *    直後に apply(place) を呼ぶ（書き戻しの後）。
 *
 * 3) 配置
 *    ART.layout.rooms[place](seed) は「中心座標は元のまま・角度と数cmだけ
 *    ずらした」配列を返す。seed は部屋+進行度で安定させる。
 *    例: ART.layout.rooms.classroom('wave' + waveIdx)
 *    classroom/boss の机は既存 ART.classroomDesks() をそのまま使う。
 * ========================================================================== */
