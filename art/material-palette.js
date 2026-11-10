/* おばけ第一小学校 — PS1アート制作システム / 2. Material Palette
 * ==========================================================================
 * 役割: 「素材」を名前で呼べるようにする。色は art-direction.js の PALETTE だけ。
 *       テクスチャは canvas で決定論的に生成する（Math.random を使わない）。
 *
 * 使う側:
 *   ART.materials.classroom()   → {M:{plaster,floor,wood,...}, textures:{...}}
 *   ART.materials.randoseru()   → {leather,flap,edge,copper,metal,stitch,...}
 *
 * 依存: ART.ctx（pixelfx.html が注入する rm / rb / mstd / ctex / TEX ...）
 * ========================================================================== */
(function (global) {
  'use strict';

  const ART = global.ART;
  if (!ART) return;

  const P = ART.PALETTE;
  const T = ART.TOKENS;

  /* ---- 決定論的な乱数（同じ seed なら毎回同じテクスチャ） ---- */
  function rng(seed) {
    let i = 0;
    return function () {
      i += 1;
      return ART.hash(seed + ':' + i);
    };
  }
  function rgba(r, g, b, a) {
    return 'rgba(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ',' + a + ')';
  }

  /* ---- 教室のテクスチャ（キャッシュ） ---------------------------------- */
  let cache = null;
  function textures(c) {
    if (cache) return cache;
    const ctex = c.ctex;
    const out = {};

    /* 床板: 暗く、継ぎ目と汚れの勾配。橙寄りを排除。 */
    out.floor = ctex(256, 256, (g, w, h) => {
      const r = rng('floor');
      const pal = P.FLOOR_WOOD;
      g.fillStyle = pal[0];
      g.fillRect(0, 0, w, h);
      const planks = 8, pw = w / planks;
      for (let i = 0; i < planks; i++) {
        let y = -r() * h * 0.4;
        while (y < h) {
          const L = h * (0.22 + r() * 0.38);
          g.fillStyle = pal[Math.floor(r() * pal.length) % pal.length];
          g.fillRect(i * pw, y, pw, L);
          for (let k = 0; k < 11; k++) {
            const dark = r() < 0.6;
            g.strokeStyle = dark ? rgba(28, 18, 10, (0.05 + r() * 0.07).toFixed(3))
                                 : rgba(130, 108, 84, (0.04 + r() * 0.06).toFixed(3));
            g.lineWidth = 1 + r() * 1.6;
            const x0 = i * pw + r() * pw;
            g.beginPath();
            g.moveTo(x0, y);
            g.bezierCurveTo(x0 + (r() - 0.5) * 6, y + L * 0.3,
                            x0 + (r() - 0.5) * 6, y + L * 0.7,
                            x0 + (r() - 0.5) * 4, y + L);
            g.stroke();
          }
          if (r() < 0.18) {
            g.fillStyle = rgba(30, 16, 8, 0.34);
            g.beginPath();
            g.ellipse(i * pw + pw * (0.3 + r() * 0.4), y + L * (0.2 + r() * 0.6),
                      2 + r() * 4, 6 + r() * 8, 0, 0, 7);
            g.fill();
          }
          g.fillStyle = rgba(0, 0, 0, 0.46);
          g.fillRect(i * pw, y + L - 2, pw, 2);
          g.fillStyle = rgba(0, 0, 0, 0.12);
          g.fillRect(i * pw, y, pw, 3);
          y += L;
        }
        g.fillStyle = rgba(0, 0, 0, 0.5);
        g.fillRect(i * pw, 0, 2, h);
        g.fillStyle = rgba(180, 160, 130, 0.05);
        g.fillRect(i * pw + 2, 0, 1, h);
      }
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(1, 'rgba(0,0,0,.20)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    }, { rep: 1 });

    /* 漆喰: 紫を排除した冷たい灰緑。下端に汚れ。 */
    out.plaster = ctex(256, 256, (g, w, h) => {
      const r = rng('plaster');
      g.fillStyle = P.PLASTER;
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 3600; i++) {
        const v = Math.floor(r() * 255);
        g.fillStyle = rgba(v, v, v, 0.05);
        g.fillRect(r() * w, r() * h, 2, 2);
      }
      for (let i = 0; i < 7; i++) {
        const x = r() * w, y = r() * h;
        const rad = g.createRadialGradient(x, y, 0, x, y, 20 + r() * 70);
        rad.addColorStop(0, 'rgba(66,70,60,.07)');
        rad.addColorStop(1, 'rgba(66,70,60,0)');
        g.fillStyle = rad;
        g.fillRect(0, 0, w, h);
      }
      /* ひび割れ 1 本（修理の跡ではなく経年） */
      g.strokeStyle = 'rgba(40,44,38,.28)';
      g.lineWidth = 1;
      g.beginPath();
      let x = w * (0.2 + r() * 0.6), y = 0;
      g.moveTo(x, y);
      while (y < h * 0.7) {
        y += 8 + r() * 14;
        x += (r() - 0.5) * 10;
        g.lineTo(x, y);
      }
      g.stroke();
      const gr = g.createLinearGradient(0, h * 0.7, 0, h);
      gr.addColorStop(0, 'rgba(18,20,16,0)');
      gr.addColorStop(1, 'rgba(18,20,16,.34)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    }, { rep: 1 });

    /* 机の天板: 明るすぎない木。落書きではなく「使われた傷」。 */
    out.desk = ctex(256, 256, (g, w, h) => {
      const r = rng('desk');
      g.fillStyle = P.WOOD_WARM;
      g.fillRect(0, 0, w, h);
      for (let k = 0; k < 80; k++) {
        const dark = r() < 0.55;
        g.strokeStyle = dark ? rgba(56, 34, 20, (0.05 + r() * 0.09).toFixed(3))
                             : rgba(200, 168, 122, (0.04 + r() * 0.07).toFixed(3));
        g.lineWidth = 1 + r() * 2.4;
        const y = r() * h;
        g.beginPath();
        g.moveTo(0, y);
        g.bezierCurveTo(w * 0.3, y + (r() - 0.5) * 12,
                        w * 0.6, y + (r() - 0.5) * 12,
                        w, y + (r() - 0.5) * 8);
        g.stroke();
      }
      /* コップの輪染み 1 つ（部屋に 1 つの付着） */
      const cx = w * 0.72, cy = h * 0.3;
      g.strokeStyle = 'rgba(46,30,18,.34)';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(cx, cy, 17, 0, 7);
      g.stroke();
      g.fillStyle = 'rgba(46,30,18,.06)';
      g.beginPath();
      g.arc(cx, cy, 17, 0, 7);
      g.fill();
      /* 小口の傷 */
      for (let i = 0; i < 9; i++) {
        g.strokeStyle = rgba(40, 26, 16, 0.18 + r() * 0.14);
        g.lineWidth = 1;
        const x = r() * w, y = r() * h;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (r() - 0.5) * 26, y + (r() - 0.5) * 4);
        g.stroke();
      }
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, 'rgba(255,240,210,.05)');
      gr.addColorStop(1, 'rgba(0,0,0,.16)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    }, { rep: 1 });

    /* 漆喰は壁・天井で共有する。1 枚stretched だと大面積が単色に見えるので、
       繰り返して質感を残す（天井の単色占有率を下げる）。 */
    out.plaster.repeat.set(3, 4);

    /* 腰板・黒板枠: 縦板。下端に欠け。 */
    out.wain = ctex(256, 256, (g, w, h) => {
      const r = rng('wain');
      g.fillStyle = P.WOOD_DARK;
      g.fillRect(0, 0, w, h);
      const n = 4, pw = w / n;
      for (let i = 0; i < n; i++) {
        g.fillStyle = i % 2 ? '#61432f' : '#573b2a';
        g.fillRect(i * pw + 1, 0, pw - 2, h);
        for (let k = 0; k < 24; k++) {
          g.strokeStyle = rgba(30, 20, 12, 0.05 + r() * 0.07);
          g.lineWidth = 1 + r() * 2;
          const x = i * pw + r() * pw;
          g.beginPath();
          g.moveTo(x, 0);
          g.bezierCurveTo(x + (r() - 0.5) * 6, h * 0.35,
                          x + (r() - 0.5) * 6, h * 0.7, x + (r() - 0.5) * 4, h);
          g.stroke();
        }
        g.fillStyle = 'rgba(0,0,0,.34)';
        g.fillRect(i * pw, 0, 1, h);
      }
      /* 下端の欠け・汚れ */
      for (let i = 0; i < 12; i++) {
        g.fillStyle = rgba(20, 16, 12, 0.20 + r() * 0.25);
        g.fillRect(r() * w, h - 4 - r() * 16, 3 + r() * 12, 4 + r() * 12);
      }
      const gr = g.createLinearGradient(0, h * 0.6, 0, h);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(1, 'rgba(0,0,0,.30)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    }, { rep: 1 });

    /* ロッカー: 鈍い金属・縦傷・錆だれ。 */
    out.locker = ctex(512, 512, (g, w, h) => {
      const r = rng('locker');
      g.fillStyle = P.METAL;
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 220; i++) {
        g.strokeStyle = rgba(r() < 0.5 ? 255 : 40, r() < 0.5 ? 255 : 44, r() < 0.5 ? 255 : 48, 0.05 + r() * 0.10);
        g.lineWidth = 1;
        const x = r() * w, y = r() * h;
        if (r() < 0.7) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 70, y); g.stroke(); }
        else { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + (r() - 0.5) * 40); g.stroke(); }
      }
      /* 錆だれ（下方向へ） */
      for (let i = 0; i < 9; i++) {
        const x = r() * w, y = h * (0.55 + r() * 0.4);
        const rad = g.createRadialGradient(x, y, 0, x, y, 8 + r() * 26);
        rad.addColorStop(0, 'rgba(104,54,24,.42)');
        rad.addColorStop(1, 'rgba(104,54,24,0)');
        g.fillStyle = rad;
        g.fillRect(0, 0, w, h);
        g.fillStyle = 'rgba(96,50,22,.20)';
        g.fillRect(x - 1, y, 2 + r() * 2, 20 + r() * 60);
      }
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, 'rgba(255,255,255,.05)');
      gr.addColorStop(1, 'rgba(0,0,0,.22)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    }, { rep: 1 });

    cache = out;
    return cache;
  }

  /* ---- 教室の素材セット ------------------------------------------------ */
  ART.materials.classroom = function () {
    const c = ART.ctx;
    if (!c || !c.rm) return null;
    const tx = textures(c);
    const THREE = c.THREE;
    const M = {};

    M.plaster = c.rm('#ffffff', 0.94, 0, { map: tx.plaster });
    M.ceiling = c.rm('#ffffff', 0.96, 0, { map: tx.plaster, color: new THREE.Color(P.CEILING) });
    M.floor = c.rm('#ffffff', 0.94, 0, { map: tx.floor, envMapIntensity: 0.18 });
    M.wood = c.rm('#ffffff', 0.62, 0, { map: tx.desk });
    M.dark = c.rm('#242824', 0.80, 0);
    M.wain = c.rm('#ffffff', 0.70, 0, { map: tx.wain });
    M.base = c.rm(P.BASEBOARD, 0.80, 0);
    M.housing = c.rm('#4a4f4c', 0.64, 0.18);
    M.locker = c.rm('#ffffff', 0.62, 0.30, { map: tx.locker });
    M.frame = c.rm('#b9b5a8', 0.56, 0.10);
    M.sill = c.rm('#9a958a', 0.72, 0);
    M.curtain = c.rm('#c9c2aa', 0.97, 0, { bumpMap: c.TEX.bump, bumpScale: 0.012 });
    M.metal = c.rm(P.METAL, 0.48, 0.20);
    M.repair = c.rm('#8a7052', 0.82, 0);

    return { M, textures: tx };
  };

  /* ---- ランドセルの素材セット ------------------------------------------ */
  ART.materials.randoseru = function () {
    const c = ART.ctx;
    if (!c || !c.mstd) return null;
    const THREE = c.THREE;
    /* 既定の emissive .20 は影を浅くするので、素材ごとに設計する。
     * 革は 0.09（シルエットを残す最低限）。目だけ後で 0.26。 */
    const warm = new THREE.Color('#2a1a18');
    const cold = new THREE.Color('#1d2320');
    const mk = (col, rough, metal, emis, ei, extra) => c.mstd(col, rough, metal,
      Object.assign({ emissive: emis, emissiveIntensity: ei }, extra || {}));

    return {
      /* 主人公は暗い房间里でも「シルエット」で読めなければならない。
         影を潰さない範囲で emissive を持ち上げ、フタだけ 1 段明るくして
         「蓋の線」を読ませる。 */
      leather: mk('#a8564f', 0.64, 0, warm, 0.13, { bumpMap: c.TEX.bump, bumpScale: 0.03 }),
      leatherDark: mk(P.BLOOD_DARK, 0.72, 0, warm, 0.09, { bumpMap: c.TEX.bump, bumpScale: 0.02 }),
      flap: mk('#b06055', 0.58, 0, warm, 0.14, { bumpMap: c.TEX.bump, bumpScale: 0.02 }),
      edge: mk(P.BLOOD_EDGE, 0.84, 0, cold, 0.06),
      copper: mk(P.COPPER, 0.42, 0.22, warm, 0.10),
      metal: mk(P.METAL, 0.38, 0.30, cold, 0.05),
      stitch: mk('#3a2a22', 0.92, 0, cold, 0.03),
      tag: mk(P.PAPER, 0.88, 0, cold, 0.06),
      /* 擦れて色落ちした部分。暗い部屋で「古びた」の手掛かりになる淡い面。 */
      worn: mk('#8d8270', 0.86, 0, cold, 0.05),
      rubber: mk(P.RUBBER, 0.96, 0, cold, 0.02),
    };
  };

  /* 参考: 未使用時のフォールバック（ART があるが素材が無い場合） */
  ART.materials.ready = function () {
    return !!(ART.ctx && ART.ctx.rm && ART.ctx.mstd);
  };
})(typeof window !== 'undefined' ? window : this);
