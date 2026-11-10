/* おばけ第一小学校 — PS1アート制作システム / 3. Model Factory
 * ==========================================================================
 * 役割: 手作業モデリングなしで「その物」と分かる形をコードで組む。
 *       1モデル = シルエット記号 + 顔 + 動く部位。
 *
 * 今回の実装: ランドセルのおばけ（randoseru）のみ。
 *   - 3段テーパーの本体
 *   - フタ（P.flap は ANIM が回すので名前・構造を維持）
 *   - 肩ベルト・側面ポケット・取っ手・留め具・縫い目・名札
 *   - 角の欠け（決定論的）
 *
 * 契約: ANIM.randoseru が P.mouth.scale.y と P.flap.rotation.x を使う。
 *       P.arms も sync3D が使う。どれも消さない。
 * ========================================================================== */
(function (global) {
  'use strict';

  const ART = global.ART;
  if (!ART) return;

  const P = ART.PALETTE;

  /* ---- テーパー（上下で断面が変わる箱） --------------------------------
   * BoxGeometry の頂点を y に応じて拡縮する。頂点は面ごとに複製されているので
   * computeVertexNormals() でフラットな法線になる（flatShading と相性が良い）。 */
  function taper(c, key, wTop, dTop, wBot, dBot, h) {
    return c.geo(key, () => {
      const g = new c.THREE.BoxGeometry(1, 1, 1);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const t = p.getY(i) + 0.5; // 0=下 1=上
        p.setX(i, p.getX(i) * (wBot + (wTop - wBot) * t));
        p.setZ(i, p.getZ(i) * (dBot + (dTop - dBot) * t));
        p.setY(i, (t - 0.5) * h);
      }
      g.computeVertexNormals();
      return g;
    });
  }

  /* ---- ランドセル ------------------------------------------------------ */
  ART.models.randoseru = function () {
    const c = ART.ctx;
    if (!c || !c.add) return null;
    const { THREE, add, RB, BOX, CYL, geo, face, arms } = c;
    const M = ART.materials.randoseru();
    if (!M) return null;

    const g = new THREE.Group();
    const P2 = {};
    const a = ART.asym('randoseru', { scale: 1 });
    const w = ART.wear('randoseru');

    /* 1. 本体: 下→中→上 の3段。上が少し窄まり、肩の丸みを作る。 */
    add(g, taper(c, 'rdBodyLo', 1.72, 1.00, 1.62, 0.92, 0.60), M.leather, 0, -0.70, 0);
    add(g, taper(c, 'rdBodyMd', 1.78, 1.02, 1.72, 1.00, 0.60), M.leather, 0, -0.10, 0);
    add(g, taper(c, 'rdBodyHi', 1.62, 0.90, 1.78, 1.02, 0.40), M.leatherDark, 0, 0.40, 0);
    /* 底の縁（暗い帯） */
    add(g, RB(1.56, 0.14, 0.90, 0.03), M.edge, 0, -0.98, 0, 0, 0, 0);
    /* 底の摩耗（前寄りに薄い擦れ） */
    add(g, RB(1.10, 0.03, 0.16, 0.01), M.stitch, 0, -1.04, 0.34, 0.06, 0, 0.02);

    /* 2. 角の欠け: 1–2 箇所だけ。左右で大きさを変える（非対称）。 */
    const chip = 0.16 + a.buckle;
    add(g, BOX, M.edge, -0.80, -0.86, 0.30, 0.1, 0.2, 0.42, chip, 0.10, 0.14);
    add(g, BOX, M.edge, 0.83, -0.80, -0.28, -0.1, -0.3, -0.30, chip * 0.7, 0.09, 0.12);
    add(g, RB(0.20, 0.06, 0.20, 0.02), M.edge, 0.70, 0.58, 0.30, 0.2, 0.3, -0.35);
    /* 擦れて色落ちした面（淡い面が 3 箇所。暗所での輪郭の手掛かり） */
    add(g, RB(0.30, 0.05, 0.10, 0.02), M.worn, -0.42, -0.90, 0.46, 0, 0.12, 0.06);
    add(g, RB(0.18, 0.04, 0.08, 0.02), M.worn, 0.30, 0.30, 0.52, 0, -0.2, 0.1);
    add(g, RB(0.10, 0.04, 0.16, 0.02), M.worn, -0.86, -0.05, 0.22, 0, 0.2, 0.04);

    /* 3. 側面ポケット（シルエット記号）。左右で寸法を変える。 */
    for (const sd of [-1, 1]) {
      const k = sd < 0 ? a.strapL : a.strapR;
      add(g, RB(0.16, 0.50 * k, 0.52, 0.05), M.leatherDark, sd * 0.87, -0.24, 0.10, 0, sd * 0.03, 0);
      add(g, RB(0.05, 0.09, 0.44, 0.02), M.stitch, sd * 0.95, -0.04, 0.10);
    }

    /* 4. 肩ベルト（背面）と側面の留めベルト。 */
    for (const sd of [-1, 1]) {
      const k = sd < 0 ? a.strapR : a.strapL; // 左右差を交差させる
      add(g, RB(0.18, 1.05 * k, 0.09, 0.03), M.edge,
          sd * 0.53, -0.12, -0.52, 0.06, sd * 0.12, a.strapTilt);
      add(g, RB(0.10, 0.72, 0.16, 0.03), M.edge,
          sd * 0.87, -0.08, 0.20, 0, sd * 0.04, sd * 0.02);
      /* 留め具（金属） */
      add(g, RB(0.12, 0.10, 0.06, 0.01), M.copper, sd * 0.87, 0.30, 0.28);
    }

    /* 5. 取っ手: 上に立つ半リング。遠目でも「ランドセル」と分かる記号。 */
    add(g, geo('rdHandle', () => new THREE.TorusGeometry(0.15, 0.032, 4, 10, Math.PI)),
        M.copper, 0, 0.60, -0.06, 0, 0, 0);
    for (const sd of [-1, 1]) add(g, RB(0.08, 0.05, 0.08, 0.01), M.copper, sd * 0.14, 0.61, -0.06);

    /* 6. フタ: P.flap は ANIM が rotation.x を上書きする。子に初期の傾きを持たせる。 */
    P2.flap = new THREE.Group();
    P2.flap.position.set(0, 0.60, 0.47);
    g.add(P2.flap);
    add(P2.flap, RB(1.64, 1.00, 0.14, 0.06), M.flap, 0, -0.50, 0.01, -0.04, 0, 0);
    add(P2.flap, RB(1.50, 0.06, 0.16, 0.02), M.edge, 0, -0.98, 0.02);
    /* 縫い目（左右で高さを少し変える） */
    add(P2.flap, RB(0.045, 0.86, 0.02, 0.01), M.stitch, -0.62, -0.50, 0.085);
    add(P2.flap, RB(0.045, 0.86, 0.02, 0.01), M.stitch, 0.62, -0.47, 0.085);
    /* 名札（薄い紙。暗い画面で唯一の明部） */
    add(P2.flap, RB(0.28, 0.13, 0.02, 0.01), M.tag, 0, -0.26, 0.085, 0, 0, 0.035);
    /* 留め具と座金 */
    add(P2.flap, RB(0.26, 0.20, 0.10, 0.03), M.copper, 0, -0.86, 0.10);
    add(P2.flap, BOX, M.metal, 0, -0.86, 0.16, 0, 0, 0, 0.10, 0.06, 0.03);
    /* フタの下の舌（開いたときの内側） */
    add(P2.flap, RB(0.16, 0.30, 0.06, 0.02), M.leatherDark, 0, -1.04, -0.02);

    /* 7. 顔: 眼窩の深さと左右差が恐怖の主成分。
     *   左目を 0.9 倍にし、眉に「にやり」のasserの骨を足す（ゴーグルに見せない）。
     *   口は既存の歪んだ形状をそのまま使う。 */
    face(g, { y: 0.46, z: 0.63, ex: 0.36, es: 0.155, eL: 0.90, eR: 1.0 });
    add(g, BOX, M.edge, -0.34, 0.585, 0.60, 0, 0, 0.16, 0.24, 0.045, 0.05);
    add(g, BOX, M.edge, 0.35, 0.575, 0.60, 0, 0, -0.12, 0.22, 0.04, 0.05);
    P2.mouth = face(g, { my: -0.52, mz: 0.52, mw: 0.50, mh: 0.28, tongue: 1 });

    /* 8. 腕（既存のチューブ腕を再利用） */
    P2.arms = arms(g, -0.10, 0.86);

    /* 全体の傾きは sync3D が上書きするので、ここでは触らない。 */
    return { g, P: P2 };
  };

  /* 予算の実測用（検証ツールから呼べる） */
  ART.models.measure = function (obj) {
    let meshes = 0, tris = 0;
    obj.traverse((o) => {
      if (!o.isMesh) return;
      meshes++;
      const g = o.geometry;
      if (g && g.attributes.position) tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    });
    return { meshes, triangles: Math.round(tris) };
  };
})(typeof window !== 'undefined' ? window : this);

/* ==========================================================================
 * 4. 教室 wave の残り 3 種 + 「箱／球＋顔」だった模型
 * --------------------------------------------------------------------------
 * 方針: 1モデル = シルエット記号 + 顔 + 動く部位。
 *   - 感情や装飾ではなく「その物の記号」（板の穴・腿の折れ・スリーブ・軸・折れ目）
 *   - 摩耗は縁と 1〜2 箇所。左右で.Non対称
 *   - 動く部位の名前（P.mouth / P.flap / P.paper / P.ball / P.bub / P.arms）は契約
 * ========================================================================== */
(function (global) {
  'use strict';
  const ART = global.ART;
  if (!ART) return;
  const P = ART.PALETTE;

  /* 共有マテリアル（敵ごとに作り直さない。emissive は既定値を使う） */
  function kit(c) {
    const mstd = c.mstd;
    return {
      wood: mstd('#9a6b45', 0.60, 0, { map: c.TEX.woodS }),
      woodDark: mstd('#5d4232', 0.74, 0),
      woodRepair: mstd('#7a5c3e', 0.80, 0),
      metal: mstd('#7d8688', 0.50, 0.20),
      metalDark: mstd('#4d5658', 0.55, 0.25),
      dark: mstd('#2b2f2b', 0.72, 0),
      paper: mstd(P.PAPER, 0.90, 0, { side: THREE_SIDE() }),
      ink: mstd('#333a33', 0.92, 0),
      wear: mstd('#8d8270', 0.86, 0),
      used: mstd('#8e8f84', 0.94, 0),
      rubber: mstd('#cfd0c4', 0.90, 0, { bumpMap: ctxBump(), bumpScale: 0.01 }),
      brass: mstd('#8a6a3c', 0.42, 0.20),
      cork: mstd('#8a6a44', 0.85, 0),
      glass: mstd('#b9c9c4', 0.06, 0, { transparent: true, opacity: 0.32, envMapIntensity: 1.4, depthWrite: false }),
      liquid: mstd('#4f6a4a', 0.30, 0, { transparent: true, opacity: 0.55 }),
      red: mstd('#8d4438', 0.80, 0),
    };
  }
  /* THREE.Side を引かなくても動くように、art 側では定数を持たない */
  function THREE_SIDE() { return (ART.ctx && ART.ctx.THREE) ? ART.ctx.THREE.DoubleSide : 2; }
  function ctxBump() { return (ART.ctx && ART.ctx.TEX) ? ART.ctx.TEX.bump : null; }

  /* ---- いす ------------------------------------------------------------ */
  ART.models.isu = function () {
    const c = ART.ctx; if (!c || !c.add) return null;
    const { add, RB, BOX, CYL, face, arms } = c;
    const K = kit(c), g = new c.THREE.Group(), P = {};
    const a = ART.asym('isu', { scale: 1 });
    /* 座面 */
    add(g, RB(1.40, 0.14, 1.10, 0.05), K.wood, 0, -0.05, 0);
    add(g, RB(1.24, 0.06, 0.96, 0.02), K.woodDark, 0, -0.14, 0);
    add(g, RB(0.42, 0.04, 0.28, 0.01), K.wear, 0.34, 0.02, 0.28, 0, 0, 0.14, 0.02);
    /* 背もたれ: 2 枚板 + 笠木。片隅が欠けている */
    add(g, RB(1.36, 0.30, 0.10, 0.04), K.wood, 0, 0.72, -0.36);
    add(g, RB(1.30, 0.26, 0.08, 0.03), K.wood, 0, 0.30, -0.36);
    add(g, RB(1.36, 0.08, 0.12, 0.03), K.woodDark, 0, 0.90, -0.36);
    add(g, RB(0.22, 0.10, 0.08, 0.02), K.woodDark, -0.60, 0.86, -0.31, 0, 0.3, 0.26, 0.02);
    add(g, RB(0.18, 0.12, 0.02, 0.01), K.wear, 0.42, 0.46, -0.30);
    /* 脚: 1 本だけ曲がっている */
    for (const sx of [-0.58, 0.58]) for (const sz of [-0.45, 0.45]) {
      const bent = (sx < 0 && sz > 0);
      add(g, CYL, K.metal, sx + (bent ? 0.06 : 0), -0.58 + (bent ? -0.04 : 0), sz, 0, 0, bent ? 0.10 : 0, 0.05, 1.0, 0.05);
    }
    add(g, CYL, K.metal, -0.58, 0.30, -0.37, 0, 0, 0, 0.045, 0.75, 0.045);
    add(g, CYL, K.metal, 0.58, 0.30, -0.37, 0, 0, 0, 0.045, 0.75, 0.045);
    /* 顔（背もたれの正面） */
    face(g, { y: 0.60, z: -0.28, ex: 0.28, es: 0.14, eL: 0.88, eR: 1.0 });
    P.mouth = face(g, { my: 0.36, mz: -0.28, mw: 0.38, mh: 0.13 });
    P.arms = arms(g, 0.05, 0.72);
    g.rotation.z = a.leanZ * 0.6;
    return { g, P };
  };

  /* ---- つくえ ---------------------------------------------------------- */
  ART.models.tsukue = function () {
    const c = ART.ctx; if (!c || !c.add) return null;
    const { add, RB, BOX, CYL, PLANE, face, arms } = c;
    const K = kit(c), g = new c.THREE.Group(), P = {};
    const a = ART.asym('tsukue', { scale: 1 });
    /* 天板と縁 */
    add(g, RB(2.20, 0.12, 1.20, 0.04), K.wood, 0, 0.66, 0);
    add(g, RB(2.24, 0.05, 1.24, 0.02), K.dark, 0, 0.58, 0);
    /* 蓋（少し浮いている） */
    add(g, RB(2.10, 0.06, 1.10, 0.03), K.wood, 0, 0.74, -0.04, 0, 0, -0.035);
    add(g, BOX, K.dark, 0.60, 0.775, 0.20, 0, 0, -0.035, 0.04, 0.02, 0.70);
    add(g, RB(0.50, 0.02, 0.30, 0.01), K.wear, -0.55, 0.73, 0.25, 0, 0.2, 0.05);
    /* 前板（幕板）と箱 */
    add(g, RB(1.90, 0.58, 1.00, 0.04), K.dark, 0, 0.30, 0);
    add(g, RB(1.94, 0.06, 0.06, 0.02), K.metal, 0, 0.52, 0.48);
    /* 脚: 1 本だけ直しの色 */
    for (const sx of [-0.95, 0.95]) for (const sz of [-0.5, 0.5]) {
      const fix = (sx > 0 && sz > 0);
      add(g, CYL, fix ? K.woodRepair : K.metal, sx, -0.35, sz, 0, 0, 0, 0.05, 1.3, 0.05);
    }
    /* 積み就是把本 */
    add(g, RB(0.80, 0.10, 0.55, 0.02), K.dark, 0.50, 0.75, -0.20, 0, 0.2, 0);
    /* 顔（前板） */
    face(g, { y: 0.42, z: 0.52, ex: 0.42, es: 0.15, eL: 0.86, eR: 1.0 });
    P.mouth = face(g, { my: 0.22, mz: 0.52, mw: 0.60, mh: 0.14 });
    P.arms = arms(g, 0.30, 1.12);
    /* テスト用紙（ANIM が回すので名前と初期位置を維持） */
    P.paper = add(g, PLANE, mstdPaper(c), 0.55, 1.15, 0.2, -0.3, 0, 0.2, 0.45, 0.56, 1);
    g.rotation.z = a.leanZ * 0.5;
    return { g, P };
  };
  function mstdPaper(c) {
    return c.mstd('#ffffff', 0.9, 0, { map: c.TEX.test, side: c.THREE.DoubleSide });
  }

  /* ---- けしゴム ------------------------------------------------------- */
  ART.models.keshigomu = function () {
    const c = ART.ctx; if (!c || !c.add) return null;
    const { add, RB, BOX, face, arms } = c;
    const K = kit(c), g = new c.THREE.Group(), P = {};
    const a = ART.asym('keshigomu', { scale: 1 });
    const sl = c.mstd('#ffffff', 0.60, 0, { map: c.TEX.sleeve });
    /* ゴム本体 */
    add(g, RB(1.90, 1.00, 0.95, 0.16), K.rubber, 0, 0.06, 0);
    add(g, RB(0.55, 0.92, 0.88, 0.14), K.used, -0.66, 0.04, 0.02);
    /* 紙スリーブ（帯）と折れ目 */
    add(g, RB(1.34, 1.26, 1.02, 0.04), sl, 0.25, 0, 0);
    add(g, RB(1.36, 0.06, 1.04, 0.02), K.wear, 0.25, 0.62, 0);
    /* 角の減りと底の汚れ */
    add(g, BOX, K.used, 0.92, 0.52, 0.44, 0, 0.2, 0.30, 0.22, 0.10, 0.12);
    add(g, RB(1.50, 0.04, 0.80, 0.01), K.used, 0, -0.45, 0);
    /* 顔（スリーブの上） */
    face(g, { x: 0.25, y: 0.30, z: 0.52, ex: 0.20, es: 0.13, eL: 0.90, eR: 1.0 });
    P.mouth = face(g, { x: 0.25, my: -0.12, mz: 0.52, mw: 0.34, mh: 0.13 });
    P.arms = arms(g, 0, 0.96);
    g.rotation.z = a.leanZ * 0.8;
    return { g, P };
  };

  /* ---- ボール --------------------------------------------------------- */
  ART.models.ball = function () {
    const c = ART.ctx; if (!c || !c.add) return null;
    const { add, SPH, face } = c;
    const K = kit(c), g = new c.THREE.Group(), P = {};
    const skin = c.mstd('#ffffff', 0.72, 0, { map: c.TEX.ball, bumpMap: c.TEX.bump, bumpScale: 0.03 });
    P.ball = add(g, SPH, skin, 0, 0, 0, 0, 0, 0, 0.90, 0.88, 0.90);
    /* 擦れ面（使用の跡） */
    add(g, SPH, K.wear, 0.28, -0.28, 0.42, 0, 0, 0.6, 0.34, 0.20, 0.10);
    add(g, SPH, K.wear, -0.34, 0.30, 0.30, 0, 0.4, -0.5, 0.24, 0.12, 0.08);
    face(g, { y: 0.20, z: 0.87, ex: 0.30, es: 0.14, eL: 0.88, eR: 1.0 });
    P.mouth = face(g, { my: -0.20, mz: 0.86, mw: 0.36, mh: 0.14, tongue: 1 });
    return { g, P };
  };

  /* ---- フラスコン ----------------------------------------------------- */
  ART.models.flask = function () {
    const c = ART.ctx; if (!c || !c.add) return null;
    const { add, SPH, CYL, BOX, face } = c;
    const K = kit(c), g = new c.THREE.Group(), P = {};
    /* 液体（level が見える） */
    add(g, SPH, K.liquid, 0, -0.02, 0, 0, 0, 0, 0.46, 0.30, 0.46).castShadow = false;
    /* 瓶本体 */
    add(g, SPH, K.glass, 0, 0.12, 0, 0, 0, 0, 0.52, 0.42, 0.52);
    add(g, CYL, K.glass, 0, 0.95, 0, 0, 0, 0, 0.18, 0.75, 0.18);
    add(g, CYL, K.glass, 0, 1.30, 0, 0, 0, 0, 0.20, 0.14, 0.20);
    /*  cork（欠けあり） */
    add(g, CYL, K.cork, 0, 1.40, 0, 0, 0, 0, 0.21, 0.16, 0.21);
    add(g, BOX, K.cork, 0.12, 1.46, 0.10, 0, 0.4, 0.30, 0.10, 0.06, 0.08);
    /* ラベル */
    add(g, CYL, K.paper, 0, 0.22, 0, 0, 0, 0, 0.53, 0.22, 0.53);
    /* 泡（ANIM が動かすので配列で持つ） */
    P.bub = [];
    for (let i = 0; i < 4; i++) {
      const s = 'flask' + i;
      P.bub.push(add(g, SPH, c.mbasic(0.45, 0.62, 0.42),
        ART.range(s + 'x', -0.22, 0.22), 0, ART.range(s + 'z', -0.18, 0.18), 0, 0, 0, 0.05));
    }
    face(g, { y: 0.34, z: 0.60, ex: 0.20, es: 0.12, eL: 0.90, eR: 1.0 });
    P.mouth = face(g, { my: 0.08, mz: 0.60, mw: 0.26, mh: 0.10 });
    return { g, P };
  };

  /* ---- ちきゅうぎごろう ------------------------------------------------ */
  ART.models.globe = function () {
    const c = ART.ctx; if (!c || !c.add) return null;
    const { add, SPH, CYL, geo, face } = c;
    const K = kit(c), g = new c.THREE.Group(), P = {};
    const gm = c.mstd('#ffffff', 0.40, 0, { map: c.TEX.globe });
    P.ball = add(g, SPH, gm, 0, 0, 0, 0, 0, 0, 0.85);
    add(g, geo('globeRing', () => new c.THREE.TorusGeometry(1, 0.035, 6, 28)), K.brass, 0, 0, 0, 0, Math.PI / 2, -0.9);
    /* 軸（傾いている） */
    add(g, CYL, K.brass, 0, 0, 0, 0, 0, 0.22, 0.035, 1.9, 0.035);
    /* 台 */
    add(g, CYL, K.woodDark, 0, -1.02, 0, 0, 0, 0, 0.42, 0.12, 0.42);
    add(g, CYL, K.woodRepair, 0, -0.88, 0, 0, 0, 0, 0.16, 0.22, 0.16);
    /* 打った傷 */
    add(g, SPH, K.wear, 0.42, 0.28, 0.42, 0, 0.6, 0.5, 0.16, 0.10, 0.06);
    face(g, { y: -0.05, z: 0.82, ex: 0.30, es: 0.15, eL: 0.88, eR: 1.0 });
    P.mouth = face(g, { my: -0.30, mz: 0.80, mw: 0.38, mh: 0.13 });
    return { g, P };
  };

  /* ---- テストようし --------------------------------------------------- */
  ART.models.paper = function () {
    const c = ART.ctx; if (!c || !c.add) return null;
    const { add, PLANE, BOX, face } = c;
    const K = kit(c), g = new c.THREE.Group(), P = {};
    /* 折れ目 dimensionality のついた紙 */
    add(g, PLANE, K.paper, 0, 0.32, 0, 0, 0, 0.22, 0.90, 0.64, 1);
    add(g, PLANE, K.paper, 0.02, 0, 0.02, 0, 0, -0.50, 0.90, 0.64, 1);
    /* 破れた角と丸の点 */
    add(g, BOX, K.paper, 0.42, 0.30, 0.02, 0, 0.3, 0.40, 0.18, 0.14, 0.01);
    add(g, BOX, K.red, -0.26, 0.30, 0.03, 0, 0, 0.22, 0.16, 0.16, 0.01);
    /* 罫線 */
    for (let i = 0; i < 3; i++) add(g, BOX, K.ink, -0.05, 0.10 + i * 0.16, 0.03, 0, 0, 0.22, 0.70, 0.012, 0.01);
    face(g, { y: 0.12, z: 0.14, ex: 0.20, es: 0.09, eL: 0.88, eR: 1.0 });
    return { g, P };
  };

  /* ---- ペンペン ------------------------------------------------------- */
  ART.models.pen = function () {
    const c = ART.ctx; if (!c || !c.add) return null;
    const { add, CYL, CONE, BOX, face } = c;
    const K = kit(c), g = new c.THREE.Group(), P = {};
    const body = c.mstd(ART.hash('penBody') < 0.5 ? '#4a6668' : '#7a4a44', 0.34, 0);
    add(g, CYL, body, 0, 0.12, 0, 0, 0, 0, 0.18, 1.30, 0.18);
    add(g, CONE, c.mstd('#c8b08a', 0.60, 0), 0, -0.72, 0, 0, 0, 0, 0.34, 0.34, 0.34);
    add(g, CYL, K.dark, 0, -0.42, 0, 0, 0, 0, 0.185, 0.22, 0.185);
    add(g, CYL, K.metal, 0, 0.72, 0, 0, 0, 0, 0.19, 0.10, 0.19);
    add(g, BOX, K.metal, 0.20, 0.40, 0, 0, 0, 0.06, 0.05, 0.30);
    face(g, { y: 0.42, z: 0.18, ex: 0.09, es: 0.08, eL: 0.90, eR: 1.0 });
    return { g, P };
  };
})(typeof window !== 'undefined' ? window : this);
