/* おばけ第一小学校 — PS1アート制作システム / 3. Model Factory
 * ==========================================================================
 * 役割: 手作業モデリングなしで「その物」と分かる形をコードで組む。
 *       1モデル = シルエット記号 + 顔 + 動く部位。
 *
 * 今回の実装: ランドセロのおばけ（randoseru）。
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

  /* ---- ランドセロ ------------------------------------------------------ */
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

    /* 5. 取っ手: 上に立つ半リング。遠目でも「ランドセロ」と分かる記号。 */
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

  /* 共有マテリアル集は他の模型からも使うので公開する。
     ※ kit() が定義されているこの IIFE の中で公開すること
        （前の IIFE で公開すると kit が未定義で ReferenceError になり、
          model-factory.js 全体が読み込まれなくなる）。 */
  ART.modelKit = kit;

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

/* ==========================================================================
 * 3. Model Factory ─ 教室 wave の残り 13 種（文具・楽器・什器・ボス）
 * --------------------------------------------------------------------------
 * 方針: 1モデル = シルエット記号 + 顔 + 動く部位。
 *   「箱＋顔」にしない。遠目で「それは何？」と分かる記号を 1 つ以上置く。
 *     ふでたて＝ケージの桟と外へ開いたペン / はさみ＝刃と欠けた輪 /
 *     シート＝波打つ縁と下から覗く穴 / うわばき＝伏せたバケツの縁と垂れたタオル /
 *     とびばこ＝段状の蓋と留め具 / たいこ＝胴と皮の破れ /
 *     シンバル＝へこんだ金属 / 三角＝折れ曲がった枠 /
 *     リコーダー＝口径の段差 / タンバリン＝欠けた INX 字金具 /
 *     けんハモ＝抜けた鍵 / ロッカー＝へこんだ扉 / こうしゃ＝割れた窓と傾いた鐘
 *
 * 契約（ANIM と sync3D が掴む「P」の名前・型・構造は変えない）:
 *   pencup     P.pens[4]（Group 配列）/ P.mouth / P.arms
 *   scissors   P.blades[2] / P.eyes[2]（Group 配列）
 *   sheet      P.body / P.dark（Material。ANIM が opacity を書く）
 *   uwabaki    P.mouth
 *   tobibako   P.mouth / P.arms
 *   taiko      P.sticks[2]（Group 配列）/ P.mouth
 *   cymbal     P.f / P.b（Group）/ P.mouth
 *   triangle   P.beat（Group）/ P.mouth
 *   recorder   P.r（Group）
 *   tambourine P.ring（Group）/ P.mouth
 *   kenhamo    P.mouth / P.arms
 *   locker     P.inner（Mesh）/ P.top / P.bot（Group）/ P.arms
 *   kousha     P.body / P.inner / P.mt / P.mb / P.tongue / P.h1 / P.h2 /
 *              P.bell / P.mouthG（Group）/ P.eyes[2]（Group 配列）/
 *              P.wins（Material 配列。ANIM が窓ごとに色を書くので共有しない）
 *
 * 決定論: Math.random() は使わない。左右差＝ART.asym / 劣化＝ART.wear。
 * 寸法: 旧実装（pixelfx.html の MODEL）の bounding box から ±8% 以内。
 * ========================================================================== */
(function (global) {
  'use strict';
  const ART = global.ART;
  if (!ART) return;
  const PAL = ART.PALETTE;

  /* 共有マテリアル集（wood / metal / dark / paper ...）。他の模型と同じ物を使う。 */
  const kitOf = (c) => (typeof ART.modelKit === 'function') ? ART.modelKit(c) : null;

  /* 縁の欠け位置（wear.chipCorner → xz 平面の角度）。決定論。 */
  const CHIP_A = { lb: -Math.PI * 0.75, rb: -Math.PI * 0.25, lt: Math.PI * 0.75, rt: Math.PI * 0.25 };
  const chipAng = (w, seed) => (w.chipCorner === 'none')
      ? ART.range(seed + 'ChipA', 0, Math.PI * 2)
      : CHIP_A[w.chipCorner];

  /* ---- ふでたて（ペン立て） --------------------------------------------- */
  ART.models.pencup = function () {
    const c = ART.ctx; if (!c || !c.add) return null;
    const { add, BOX, CYL, CONE, geo, face, arms } = c;
    const M = kitOf(c); if (!M) return null;
    const g = new c.THREE.Group(), P = {};
    const a = ART.asym('pencup', { scale: 1 });
    const w = ART.wear('pencup');

    /* 1. 中の暗がり（ケージの向こう。顔だけが覗く） */
    add(g, CYL, M.dark, 0, -0.14, 0, 0, 0, 0, 0.545, 1.02, 0.545);

    /* 2. ケージの桟 10 本。「ふでたて」の最初の記号。 */
    for (let i = 0; i < 10; i++) {
      const ang = i / 10 * Math.PI * 2;
      add(g, BOX, M.metal, Math.cos(ang) * 0.585, -0.14, Math.sin(ang) * 0.585,
          0, -ang, 0, 0.05, 1.06, 0.05);
    }

    /* 3. 底の輪（摩耗した縁） */
    add(g, CYL, M.metalDark, 0, -0.87, 0, 0, 0, 0, 0.60, 0.06, 0.60);

    /* 4. 口のリング。縁の 1 箇所だけへこむ（欠け）。 */
    add(g, geo('mfPencupRim', () => new c.THREE.TorusGeometry(0.60, 0.045, 6, 22)),
        M.metal, 0, 0.44, 0, Math.PI / 2, 0, 0);
    add(g, CYL, M.dark, 0, 0.42, 0, 0, 0, 0, 0.555, 0.02, 0.555);
    const ca = chipAng(w, 'pencup');
    add(g, BOX, M.metalDark, Math.cos(ca) * 0.60, 0.44, Math.sin(ca) * 0.60,
        0, -ca, 0.22, 0.11, 0.10, 0.09);

    /* 5. ペンの束。4 本が外へ開いて見えるのが第 2 の記号。
     *    ANIM が pens[i].rotation.x を書くので、傾けは rotation.z 側に入れる。 */
    const penCols = ['#8d4438', '#4a6668', '#4f6a4a', '#8a6a3c'];
    P.pens = [];
    for (let i = 0; i < 4; i++) {
      const p = new c.THREE.Group();
      p.position.set(-0.30 + i * 0.20, 0.44, (i % 2 ? 0.15 : -0.15));
      p.rotation.z = (i - 1.5) * 0.20 * (i % 2 ? a.strapL : a.strapR);
      g.add(p);
      const len = 0.90 * (i % 2 ? a.strapR : a.strapL);
      add(p, CYL, c.mstd(penCols[i], 0.35, 0), 0, len * 0.5, 0, 0, 0, 0, 0.07, len, 0.07);
      add(p, CYL, M.metal, 0, 0.05, 0, 0, 0, 0, 0.075, 0.09, 0.075);      // フェルール
      add(p, CONE, c.mstd('#c8b08a', 0.60, 0), 0, len + 0.05, 0, 0, 0, 0, 0.14, 0.18, 0.14);
      add(p, CONE, M.ink, 0, len + 0.17, 0, 0, 0, 0, 0.05, 0.07, 0.05);    // 芯
      P.pens.push(p);
    }

    /* 6. 底の屑（消しゴムのかけら）。摩耗は縁と 1〜2 箇所。 */
    for (let i = 0; i < 3; i++) {
      const s = 'pencupCrumb' + i;
      add(g, BOX, M.used, ART.range(s + 'x', -0.42, 0.42), -0.83,
          ART.range(s + 'z', -0.42, 0.42), 0, ART.range(s + 'r', 0, 3), 0, 0.07, 0.03, 0.05);
    }

    /* 7. 顔と腕（mouth と arms は ANIM / sync3D の契約） */
    P.mouth = face(g, { y: 0.08, z: 0.62, ex: 0.24, es: 0.13, my: -0.25, mw: 0.34, mh: 0.15,
      eL: a.eyeL, eR: a.eyeR });
    P.arms = arms(g, -0.1, 0.62);
    return { g, P };
  };

  /* ---- はさみ ----------------------------------------------------------- */
  ART.models.scissors = function () {
    const c = ART.ctx; if (!c || !c.add) return null;
    const { add, BOX, CYL, geo, face } = c;
    const M = kitOf(c); if (!M) return null;
    const g = new c.THREE.Group(), P = {};
    const a = ART.asym('scissors', { scale: 1 });
    const w = ART.wear('scissors');

    /* 刃（細く尖った形）。ANIM が rotation.z を書くので、根元は原点のまま。 */
    const bl = geo('mfBlade', () => {
      const s = new c.THREE.Shape();
      s.moveTo(-0.09, 0); s.lineTo(0.09, 0); s.lineTo(0, 1.18); s.closePath();
      return new c.THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 1 });
    });

    /* 握りの輪。片方だけ欠ける（欠けは 1 箇所だけ）。 */
    const ring = geo('mfRing', () => new c.THREE.TorusGeometry(0.24, 0.07, 8, 24));
    const ringBroken = geo('mfRingBroken', () => new c.THREE.TorusGeometry(0.24, 0.07, 8, 18, Math.PI * 1.45));

    P.blades = [];
    for (const sd of [-1, 1]) {
      const b = new c.THREE.Group();
      g.add(b);
      add(b, bl, M.metal, 0, 0, sd * 0.03);
      /* 腹（支点から握りへ伸びる腹） */
      const dx = sd * 0.30, dy = -0.55;
      add(b, BOX, M.metal, dx * 0.5, dy * 0.5, 0, 0, 0, Math.atan2(-dx, dy), 0.055, Math.hypot(dx, dy), 0.05);
      /* 輪。片方は途切れている */
      if (sd < 0) add(b, ringBroken, M.red, sd * 0.30, -0.55, 0);
      else add(b, ring, M.red, sd * 0.30, -0.55, 0);
      /* 刃の先の欠け（摩耗は 1 箇所） */
      if (w.chipCorner === 'none' || w.chipCorner[0] === (sd < 0 ? 'l' : 'r')) {
        add(b, BOX, M.dark, sd * 0.045, 0.98, sd * 0.03, 0, 0, sd * 0.4, 0.07, 0.10, 0.06);
      }
      P.blades.push(b);
    }

    /* 支点（そこだけ錆びている） */
    add(g, CYL, M.metal, 0, 0, 0.05, Math.PI / 2, 0, 0, 0.08, 0.14, 0.08);
    add(g, CYL, M.metalDark, 0, 0, 0.105, Math.PI / 2, 0, 0, 0.035, 0.03, 0.035);
    add(g, BOX, M.ink, 0, 0, 0.122, 0, 0, 0.6, 0.055, 0.012, 0.012);

    /* 目。ANIM が回転させるので、元は原点に置き、x だけでずらす。 */
    P.eyes = [];
    for (const sd of [-1, 1]) {
      const e = new c.THREE.Group();
      g.add(e);
      face(e, { x: sd * 0.30, y: -0.55, z: 0.06, ex: 0, es: 0.13, eL: a.eyeL, eR: a.eyeR });
      P.eyes.push(e);
    }
    return { g, P };
  };

  /* ---- シート（塵のシート） -------------------------------------------- */
  ART.models.sheet = function () {
    const c = ART.ctx; if (!c || !c.add) return null;
    const { add, BOX, SPH, geo } = c;
    const M = kitOf(c); if (!M) return null;
    const g = new c.THREE.Group(), P = {};
    const w = ART.wear('sheet');

    /* 1. 布本体。裾が波打つ（切れ目の縁が記号）。 */
    const lg = geo('mfSheet', () => {
      const pts = [];
      for (let i = 0; i <= 16; i++) {
        const ang = i / 16 * Math.PI / 2;
        pts.push(new c.THREE.Vector2(Math.sin(ang) * 0.75, 0.2 + Math.cos(ang) * 0.75));
      }
      pts.push(new c.THREE.Vector2(0.78, -0.2), new c.THREE.Vector2(0.84, -0.6), new c.THREE.Vector2(0.95, -0.9));
      const l = new c.THREE.LatheGeometry(pts, 32);
      const p = l.attributes.position;
      for (let i = 0; i < p.count; i++) {
        if (p.getY(i) < -0.85) {
          const ang = Math.atan2(p.getZ(i), p.getX(i));
          p.setY(i, p.getY(i) + Math.sin(ang * 6) * 0.09);
        }
      }
      l.computeVertexNormals();
      return l;
    });

    /* ANIM が P.body.opacity を書き換えるので Material のまま公開する。 */
    P.body = c.mstd('#cdd2c8', 0.85, 0, {
      transparent: true, opacity: 0.9,
      emissive: new c.THREE.Color('#8aa0a0'), emissiveIntensity: 0.22,
      side: c.THREE.DoubleSide,
    });
    add(g, lg, P.body, 0, 0, 0);

    /* 2. 下から覗く穴（目 2 つ・口 1 つ・裂け目 1 つ）。 */
    P.dark = c.mbasic(0.01, 0, 0.02, { transparent: true });
    for (const sd of [-1, 1]) add(g, SPH, P.dark, sd * 0.25, 0.3, 0.66, 0, 0, 0, 0.12, 0.18, 0.06).castShadow = false;
    add(g, SPH, P.dark, 0, -0.08, 0.72, 0, 0, 0, 0.13, 0.17, 0.06).castShadow = false;
    add(g, SPH, P.dark, -0.58, -0.30, 0.44, 0, 0.3, 0, 0.10, 0.13, 0.05).castShadow = false;

    /* 3. 引っかかれて持ち上げられた角（縁の記号）。 */
    const hook = chipAng(w, 'sheet');
    add(g, BOX, P.body, Math.cos(hook) * 0.58, 0.58, Math.sin(hook) * 0.58,
        0.5, -hook, 0.35, 0.22, 0.05, 0.20).castShadow = false;

    return { g, P };
  };

  /* ---- うわばき（上履き） ----------------------------------------------- */
  ART.models.uwabaki = function () {
    const c = ART.ctx; if (!c || !c.add) return null;
    const { add, RB, BOX, PLANE, face } = c;
    const M = kitOf(c); if (!M) return null;
    const g = new c.THREE.Group(), P = {};
    const a = ART.asym('uwabaki', { scale: 1 });
    const w = ART.wear('uwabaki');
    const blue = c.mstd(ART.hash('uwabaki') < 0.5 ? '#4a6668' : '#7a4a44', 0.45, 0);

    /* 1. 底（ゴム） */
    add(g, RB(0.95, 0.18, 1.90, 0.08), M.rubber, 0, -0.62, 0);
    /* 2. 胴（伏せたバケツの身） */
    add(g, RB(0.86, 0.62, 1.70, 0.24), M.used, 0, -0.24, -0.05);
    /* 3. つま先（色つき。旧実装と同じ決定論） */
    add(g, RB(0.90, 0.50, 0.62, 0.20), blue, 0, -0.30, 0.66);

    /* 4. バケツの口（縁の記号）: 4 枚の細い枠で「開いた口」を作る。
     *    つま先より上に上げるので、正面からでも「開いた口」が見える。 */
    const rimY = 0.14, rimZ = -0.30, rw = 0.66, rd = 0.80;
    add(g, BOX, M.metalDark, 0, rimY, rimZ - rd / 2, 0, 0, 0, rw, 0.09, 0.05);
    add(g, BOX, M.metalDark, 0, rimY, rimZ + rd / 2, 0, 0, 0, rw, 0.09, 0.05);
    add(g, BOX, M.metalDark, -rw / 2, rimY, rimZ, 0, 0, 0, 0.05, 0.09, rd);
    add(g, BOX, M.metalDark, rw / 2, rimY, rimZ, 0, 0, 0, 0.05, 0.09, rd);
    add(g, RB(0.62, 0.08, 0.75, 0.04), M.dark, 0, rimY, rimZ);

    /* 5. つま先と胴の縫い目（うわばきの縫い目）＋ 甲のストラップとバックル。 */
    add(g, BOX, M.dark, 0, -0.04, 0.36, 0, 0, 0, 0.86, 0.04, 0.06);
    add(g, BOX, M.dark, 0, 0.02, 0.44, 0, 0, 0, 0.80, 0.09, 0.13);
    add(g, BOX, M.brass, 0.27, 0.03, 0.44, 0, 0, 0, 0.12, 0.11, 0.15);

    /* 6. 垂れたタオル（つま先に掛かる布）。正面からでも読める位置。 */
    const tSide = (w.chipCorner === 'lt' || w.chipCorner === 'lb') ? -1 : 1;
    add(g, BOX, M.paper, tSide * 0.30, -0.28, 0.985, 0, 0, tSide * 0.10, 0.18, 0.42, 0.05);
    add(g, BOX, M.paper, tSide * 0.32, -0.56, 0.965, 0, 0, tSide * 0.16, 0.14, 0.22, 0.04);
    /* タオル紐（帯がずれてる） */
    add(g, BOX, M.wear, tSide * 0.44, 0.10, -0.14, 0, 0, tSide * 0.2, 0.08, 0.06, 0.32);

    /* 6. つま先のへこみ（摩耗） */
    add(g, BOX, M.dark, 0.18, -0.12, 0.92, 0, 0.2, 0.35, 0.16, 0.10, 0.06);
    /* 7. 踵のタブと名札 */
    add(g, RB(0.88, 0.14, 0.12, 0.04), blue, 0, -0.05, 0.18);
    add(g, PLANE, c.mstd('#ffffff', 0.6, 0, { map: c.TEX.plate('2-1') }), 0, -0.22, -0.91, 0, Math.PI, 0, 0.5, 0.19, 1);

    /* 8. 顔 */
    P.mouth = face(g, { y: 0.0, z: 0.93, ex: 0.24, es: 0.12, my: -0.30, mz: 0.98, mw: 0.30, mh: 0.10,
      eL: a.eyeL, eR: a.eyeR });
    return { g, P };
  };

  /* ---- とびばこ（跳び箱） ----------------------------------------------- */
  ART.models.tobibako = function () {
    const c = ART.ctx; if (!c || !c.add) return null;
    const { add, RB, BOX, face, arms } = c;
    const M = kitOf(c); if (!M) return null;
    const g = new c.THREE.Group(), P = {};
    const a = ART.asym('tobibako', { scale: 1 });
    const w = ART.wear('tobibako');

    /* 1. 段状の胴（上へ行くほど細くなる跳び箱の段差） */
    for (let i = 0; i < 4; i++) {
      const bw = 1.90 + i * 0.08;
      const bd = 1.10 + i * 0.04;
      add(g, RB(bw, 0.34, bd, 0.03), M.wood, 0, 0.26 - i * 0.36, 0);
      /* 段の継ぎ目（影の線） */
      if (i > 0) add(g, BOX, M.woodDark, 0, 0.07 - (i - 1) * 0.36, 0, 0, 0, 0, bw - 0.08, 0.02, bd - 0.06);
    }

    /* 2. 段状の蓋（上が丸い看板）＋滑り止めのゴム */
    add(g, RB(1.96, 0.36, 1.10, 0.15), M.woodDark, 0, 0.60, 0);
    for (let i = 0; i < 4; i++) {
      add(g, BOX, M.rubber, -0.60 + i * 0.40, 0.785, 0, 0, 0, 0, 0.26, 0.02, 0.80);
    }
    /* 角の欠け（摩耗は縁 1〜2 箇所） */
    const ca = chipAng(w, 'tobibako');
    add(g, BOX, M.woodDark, Math.cos(ca) * 0.94, 0.74, Math.sin(ca) * 0.50,
        0, -ca, 0.25, 0.18, 0.12, 0.16);

    /* 3. 留め具（金属の掛け金）: 「段状の蓋」の次の記号。 */
    add(g, RB(0.84, 0.28, 0.05, 0.12), M.dark, 0, -0.10, 0.585);
    add(g, BOX, M.metal, 0.10, -0.10, 0.615, 0, 0, 0, 0.26, 0.14, 0.04);
    add(g, BOX, M.metal, -0.14, -0.10, 0.60, 0, 0, 0.2, 0.10, 0.06, 0.05);

    /* 4. 両端の取っ手（へこみ） */
    for (const sd of [-1, 1]) {
      add(g, BOX, M.dark, sd * 1.04, -0.28, 0, 0, 0, 0, 0.05, 0.16, 0.46);
    }

    /* 5. 顔 */
    P.mouth = face(g, { y: 0.28, z: 0.56, ex: 0.40, es: 0.14, my: -0.06, mz: 0.63, mw: 0.36, mh: 0.13,
      eL: a.eyeL, eR: a.eyeR });
    P.arms = arms(g, 0.1, 1.08);
    return { g, P };
  };

  /* ---- たいこ（太鼓） --------------------------------------------------- */
  ART.models.taiko = function () {
    const c = ART.ctx; if (!c || !c.add) return null;
    const { add, BOX, CYL, SPH, geo, face } = c;
    const M = kitOf(c); if (!M) return null;
    const g = new c.THREE.Group(), P = {};
    const a = ART.asym('taiko', { scale: 1 });
    const w = ART.wear('taiko');

    /* 1. 胴（朱塗り。軸は z） */
    add(g, CYL, M.red, 0, 0, 0, Math.PI / 2, 0, 0, 0.86, 0.95, 0.86);

    /* 2. 皮（前後の鼓面）と金口の輪 */
    for (const z of [0.49, -0.49]) {
      add(g, CYL, M.paper, 0, 0, z, Math.PI / 2, 0, 0, 0.80, 0.02, 0.80);
      add(g, geo('mfTaikoRim', () => new c.THREE.TorusGeometry(0.84, 0.06, 7, 26)), M.brass, 0, 0, z);
    }

    /* 2b. 皮を留める木札（前面の輪） */
    for (let i = 0; i < 12; i++) {
      const ang = i / 12 * Math.PI * 2;
      add(g, BOX, M.wood, Math.cos(ang) * 0.74, Math.sin(ang) * 0.74, 0.505,
          0, 0, ang, 0.09, 0.05, 0.04);
    }

    /* 3. 革の締め（胴を一周する 8 本） */
    for (let i = 0; i < 8; i++) {
      const ang = i / 8 * Math.PI * 2 + 0.2;
      add(g, BOX, M.dark, Math.cos(ang) * 0.885, Math.sin(ang) * 0.885, 0,
          0, 0, ang, 0.07, 0.05, 0.92);
    }

    /* 4. 釘（10 個。球は使わず円柱で済ませる） */
    for (let i = 0; i < 10; i++) {
      const ang = i / 10 * Math.PI * 2;
      add(g, CYL, M.brass, Math.cos(ang) * 0.87, Math.sin(ang) * 0.87, 0,
          0, 0, ang - Math.PI / 2, 0.05, 0.05, 0.05);
    }

    /* 5. 皮の破れ（記号）。ギザギザの裂け目 + めくれ上がる皮。 */
    const tear = [[-0.34, 0.16, 0.28], [0.02, 0.24, -0.24], [0.36, 0.04, 0.32]];
    for (const [tx, ty, rot] of tear) {
      add(g, BOX, M.dark, tx, ty, 0.495, 0, 0, rot, 0.055, 0.30, 0.02).castShadow = false;
    }
    add(g, BOX, M.paper, 0.24, -0.32, 0.505, 0.5, 0.2, 0.45, 0.24, 0.20, 0.015).castShadow = false;
    /* 鼓面の汚れ（摩耗は 1 箇所） */
    add(g, BOX, M.wear, -0.42, -0.34, 0.503, 0, 0, 0.22, 0.30, 0.18, 0.02).castShadow = false;

    /* 6. ばち（ANIM が sticks[i].rotation.x を書く） */
    P.sticks = [];
    for (const sd of [-1, 1]) {
      const st = new c.THREE.Group();
      st.position.set(sd * 0.75, 0.75, 0.55);
      g.add(st);
      add(st, CYL, M.wood, 0, 0.35, 0, 0, 0, 0, 0.03, 0.70, 0.03);
      add(st, SPH, M.used, 0, 0.72, 0, 0, 0, 0, 0.11);
      P.sticks.push(st);
    }

    /* 7. 顔 */
    P.mouth = face(g, { y: 0.22, z: 0.52, ex: 0.30, es: 0.15, my: -0.15, mw: 0.42, mh: 0.15,
      eL: a.eyeL, eR: a.eyeR });
    return { g, P };
  };

  /* ---- シンバル --------------------------------------------------------- */
  ART.models.cymbal = function () {
    const c = ART.ctx; if (!c || !c.add) return null;
    const { add, BOX, geo, face } = c;
    const M = kitOf(c); if (!M) return null;
    const g = new c.THREE.Group(), P = {};
    const a = ART.asym('cymbal', { scale: 1 });
    const w = ART.wear('cymbal');
    const gold = c.mstd(PAL.COPPER, 0.18, 1, { bumpMap: c.TEX.brush, bumpScale: 0.004 });

    /* へこんだ金属（記号）: 中心のベルが立ち上がっている皿型。
     *   回転体で作り、縁へ厚度を落とす。 */
    const dg = geo('mfCymbal', () => new c.THREE.LatheGeometry([
      new c.THREE.Vector2(0.001, 0.075),
      new c.THREE.Vector2(0.10, 0.072),
      new c.THREE.Vector2(0.16, 0.052),
      new c.THREE.Vector2(0.34, 0.028),
      new c.THREE.Vector2(0.63, -0.006),
      new c.THREE.Vector2(0.95, -0.058),
    ], 14));
    const rimRing = geo('mfCymbalRim', () => new c.THREE.TorusGeometry(0.94, 0.025, 4, 14));

    /* 2 枚。ANIM が position.z を書いてすれ違わせる。
     *   手前（P.f）はベルを正面へ向ける ─ これが「シンバル」の記号。 */
    P.f = new c.THREE.Group(); P.b = new c.THREE.Group();
    g.add(P.f, P.b);
    add(P.f, dg, gold, 0, 0, 0, Math.PI / 2, 0, 0);
    add(P.b, dg, gold, 0, 0, 0, -Math.PI / 2, 0, 0);

    for (const grp of [P.f, P.b]) {
      /* 革の輪（吊り紐） */
      add(grp, BOX, M.dark, 0, 0, grp === P.f ? -0.08 : 0.08, 0, 0, 0, 0.30, 0.12, 0.06);
      /* 金属の縁（摩耗した部分。表から見て明るい輪になる） */
      add(grp, rimRing, M.brass, 0, 0, grp === P.f ? -0.058 : 0.058, 0, 0, 0);
    }
    /* ひび（手前の一枚だけ。凹んだ金属の証拠。ベルには掛けない） */
    add(P.f, BOX, M.dark, 0.36, 0.40, 0.062, 0, 0, 0.62, 0.03, 0.52, 0.02).castShadow = false;
    add(P.f, BOX, M.dark, 0.31, 0.06, 0.062, 0, 0, 0.5, 0.03, 0.26, 0.02).castShadow = false;

    /* 吊り革が下へ垂れている（シルエットの記号） */
    add(P.f, geo('mfCymbalStrap', () => new c.THREE.TorusGeometry(0.11, 0.022, 4, 12, Math.PI)),
        M.dark, 0.10, -0.16, -0.10, 0, 0, 0.3);

    /* 顔は前のシンバルに直書き（ANIM が mouth.scale.y を書く） */
    face(P.f, { y: 0.3, z: 0.08, ex: 0.3, es: 0.14, eL: a.eyeL, eR: a.eyeR });
    P.mouth = face(P.f, { my: -0.30, mz: 0.09, mw: 0.36, mh: 0.12 });
    return { g, P };
  };

  /* ---- 三角定規（三角缶） ----------------------------------------------- */
  ART.models.triangle = function () {
    const c = ART.ctx; if (!c || !c.add) return null;
    const { add, BOX, CYL, face } = c;
    const M = kitOf(c); if (!M) return null;
    const g = new c.THREE.Group(), P = {};
    const a = ART.asym('triangle', { scale: 1 });
    const w = ART.wear('triangle');

    /* 1. 金属の枠。3 辺のうち左の辺は折れ曲がっている（記号）。 */
    const seg = (ax, ay, bx, by, mat, r) => {
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      const len = Math.hypot(bx - ax, by - ay);
      add(g, CYL, mat, mx, my, 0, 0, 0, Math.atan2(by - ay, bx - ax) - Math.PI / 2, r, len, r);
    };
    seg(0, 0.95, -0.50, 0.14, M.metal, 0.045);        // 上 → 折れ目
    seg(-0.44, 0.10, -0.85, -0.60, M.metal, 0.045);  // 折れ目 → 左下（ずれている）
    seg(-0.85, -0.60, 0.85, -0.60, M.metal, 0.045);  // 底辺
    seg(0.85, -0.60, 0, 0.95, M.metal, 0.038);       // 右辺（短い）
    /* 折れ目の割れ（摩耗 1 箇所） */
    add(g, BOX, M.dark, -0.47, 0.12, 0, 0, 0, 0.35, 0.09, 0.10, 0.09);

    /* 2. 吊り紐。切れて垂れている。 */
    add(g, CYL, M.dark, 0.03, 1.22, 0, 0, 0, 0.08, 0.015, 0.54, 0.015);
    add(g, BOX, M.wear, 0.10, 1.49, 0, 0, 0, 0.35, 0.04, 0.06, 0.03);

    /* 3. 鳴らす棒（ANIM が beat.rotation.z を書く） */
    P.beat = new c.THREE.Group();
    P.beat.position.set(0.6, 0.1, 0.2);
    g.add(P.beat);
    add(P.beat, CYL, M.metal, 0, 0.30, 0, 0, 0, 0, 0.025, 0.80, 0.025);
    add(P.beat, CYL, M.dark, 0, 0.72, 0, 0, 0, 0, 0.035, 0.08, 0.035);

    /* 4. 顔（枠の内側） */
    P.mouth = face(g, { y: -0.05, z: 0.06, ex: 0.2, es: 0.12, my: -0.28, mw: 0.20, mh: 0.08,
      eL: a.eyeL, eR: a.eyeR });
    return { g, P };
  };

  /* ---- リコーダー ------------------------------------------------------- */
  ART.models.recorder = function () {
    const c = ART.ctx; if (!c || !c.add) return null;
    const { add, BOX, CYL, CONE, geo, face } = c;
    const M = kitOf(c); if (!M) return null;
    const g = new c.THREE.Group(), P = {};
    const a = ART.asym('recorder', { scale: 1 });
    const w = ART.wear('recorder');

    /* ANIM が rotation.z を書くので、筒はグループごと傾ける。 */
    P.r = new c.THREE.Group();
    P.r.rotation.z = 0.45;
    g.add(P.r);

    /* 1. 口径の段差（記号）: 下管 → 段 → 上管。 */
    add(P.r, CYL, M.paper, 0, -0.42, 0, 0, 0, 0, 0.15, 0.95, 0.15);
    add(P.r, CYL, M.brass, 0, 0.10, 0, 0, 0, 0, 0.185, 0.09, 0.185);
    add(P.r, CYL, M.paper, 0, 0.455, 0, 0, 0, 0, 0.15, 0.62, 0.15);

    /* 2. 吹き口（窓のある木栓） */
    add(P.r, BOX, M.wood, 0, 0.86, 0.01, 0, 0, 0, 0.17, 0.14, 0.11);
    add(P.r, BOX, M.dark, 0, 0.88, 0.06, 0, 0, 0, 0.035, 0.05, 0.02);
    add(P.r, CONE, M.wood, 0, 1.06, 0, 0, 0, 0, 0.22, 0.18, 0.22);
    add(P.r, CYL, M.brass, 0, 1.17, 0, 0, 0, 0, 0.10, 0.06, 0.10);

    /* 3. ベル（口の広がった先。縁が欠けている） */
    add(P.r, geo('mfRecBell', () => new c.THREE.CylinderGeometry(0.15, 0.24, 0.3, 24)), M.paper, 0, -1.04, 0);
    const ca = chipAng(w, 'recorder');
    add(P.r, BOX, M.dark, Math.cos(ca) * 0.22, -1.16, Math.sin(ca) * 0.22, 0, -ca, 0.3, 0.09, 0.08, 0.09);

    /* 3. ベルの飾り輪（段の所にも 1 個） */
    add(P.r, CYL, M.brass, 0, -0.72, 0, 0, 0, 0, 0.165, 0.05, 0.165);
    add(P.r, CYL, M.brass, 0, -0.30, 0, 0, 0, 0, 0.165, 0.04, 0.165);

    /* 4. 指穴 7 つ（球を使わず円板で済ませる） */
    for (let i = 0; i < 7; i++) {
      add(P.r, CYL, M.dark, 0, 0.45 - i * 0.16, 0.152, Math.PI / 2, 0, 0, 0.035, 0.02, 0.035).castShadow = false;
    }

    /* 5. 摩耗: 段の所のへこみ */
    add(P.r, BOX, M.wear, 0.16, 0.02, 0.06, 0, 0.3, 0, 0.07, 0.14, 0.10);

    /* 6. 顔（筒の前面） */
    face(P.r, { y: 0.72, z: 0.15, ex: 0.09, es: 0.08, eL: a.eyeL, eR: a.eyeR });
    return { g, P };
  };

  /* ---- タンバリン ------------------------------------------------------- */
  ART.models.tambourine = function () {
    const c = ART.ctx; if (!c || !c.add) return null;
    const { add, BOX, CYL, geo, face } = c;
    const M = kitOf(c); if (!M) return null;
    const g = new c.THREE.Group(), P = {};
    const a = ART.asym('tambourine', { scale: 1 });

    /* ANIM が ring.rotation.z を書くので、輪まわりは全部この中へ。 */
    P.ring = new c.THREE.Group();
    g.add(P.ring);

    /* 1. 木輪（筒の中空） */
    add(P.ring, geo('mfTambHoop', () => new c.THREE.CylinderGeometry(0.86, 0.86, 0.28, 24, 1, true)),
        M.woodDark, 0, 0, 0, Math.PI / 2, 0, 0);

    /* 2. 皮（丸い板。専用の 16 角形にして「円」に読ませる。
     *    金具が覗くよう少し小さくする。 */
    add(P.ring, geo('mfTambSkin', () => new c.THREE.CylinderGeometry(0.77, 0.77, 0.02, 16)),
        M.paper, 0, 0, 0.12, Math.PI / 2, 0, 0);

    /* 3. INX 字の金具。6 枠のうち 1 枠は空、1 枠は片方だけ（金具が欠けた証拠）。 */
    const gold = c.mstd('#b08a46', 0.28, 0.45);
    const emptySlot = Math.floor(ART.hash('tambEmpty') * 6);
    const halfSlot = (emptySlot + 3) % 6;
    for (let i = 0; i < 6; i++) {
      const ang = i / 6 * Math.PI * 2;
      if (i === emptySlot) {
        /* 空の枠（縁だけ残す） */
        add(P.ring, BOX, M.dark, Math.cos(ang) * 0.88, Math.sin(ang) * 0.88, 0,
            0, 0, ang, 0.16, 0.16, 0.10);
        continue;
      }
      /* 金具は正面を向く円板（平たい輪が並んでいるように見える） */
      const sides = (i === halfSlot) ? [0.05] : [-0.05, 0.05];
      for (const dz of sides) {
        add(P.ring, CYL, gold, Math.cos(ang) * 0.88, Math.sin(ang) * 0.88, dz,
            Math.PI / 2, 0, ang, 0.14, 0.02, 0.14);
      }
    }

    /* 4. 皮の傷（こすれと裂け目） */
    add(P.ring, BOX, M.wear, 0.30, 0.22, 0.135, 0, 0, 0.5, 0.26, 0.14, 0.02).castShadow = false;
    add(P.ring, BOX, M.dark, -0.44, -0.16, 0.135, 0, 0, -0.3, 0.04, 0.24, 0.02).castShadow = false;

    /* 5. 顔（皮の上） */
    face(g, { y: 0.2, z: 0.15, ex: 0.25, es: 0.13, eL: a.eyeL, eR: a.eyeR });
    P.mouth = face(g, { my: -0.15, mz: 0.15, mw: 0.30, mh: 0.11 });
    return { g, P };
  };

  /* ---- けんハモ（鍵盤ハーモニカ） --------------------------------------- */
  ART.models.kenhamo = function () {
    const c = ART.ctx; if (!c || !c.add) return null;
    const { add, BOX, CYL, geo, face, arms } = c;
    const M = kitOf(c); if (!M) return null;
    const g = new c.THREE.Group(), P = {};
    const a = ART.asym('kenhamo', { scale: 1 });
    const w = ART.wear('kenhamo');
    const body = c.mstd('#3f5c6e', 0.35, 0);

    /* 1. 胴（平たい金属箱） */
    add(g, c.RB(1.90, 0.55, 0.60, 0.12), body, 0, 0, 0);

    /* 2. 鍵盤。12 個の白鍵のうち 1 個が抜けている（記号）。 */
    const kb = new c.THREE.Group();
    kb.position.set(0, 0.29, 0);
    kb.rotation.x = -0.5;
    g.add(kb);
    add(kb, BOX, M.woodDark, 0, 0, 0, 0, 0, 0, 1.60, 0.04, 0.40);
    const pulled = 4 + (w.chipCorner === 'none' ? 0 : 1);
    for (let i = 0; i < 12; i++) {
      const x = -0.70 + i * 0.128;
      const out = (i === pulled);
      add(kb, BOX, out ? M.wear : M.used, x, out ? 0.09 : 0.03, out ? 0.13 : 0.09,
          out ? -0.5 : 0, 0, 0, 0.115, 0.05, 0.26);
    }
    for (const i of [0, 1, 3, 4, 5, 7, 8, 10]) {
      const x = -0.70 + i * 0.128 + 0.064;
      add(kb, BOX, M.dark, x, 0.06, 0.02, 0, 0, 0, 0.075, 0.05, 0.20);
    }
    /* リードの梳（Comb） */
    for (let i = 0; i < 5; i++) {
      add(kb, BOX, M.brass, 0.76 + i * 0.012, 0.045, 0.02, 0, 0, 0, 0.006, 0.03, 0.26);
    }

    /* 3. ホース（首）。管が折れ曲がっている。 */
    add(g, geo('mfKenHose', () => new c.THREE.TubeGeometry(new c.THREE.CatmullRomCurve3([
      new c.THREE.Vector3(-0.95, 0, 0), new c.THREE.Vector3(-1.40, 0.3, 0.2),
      new c.THREE.Vector3(-1.20, 0.9, 0.3), new c.THREE.Vector3(-0.70, 1.0, 0.2),
    ]), 14, 0.06, 6)), M.glass, 0, 0, 0);
    add(g, CYL, M.used, -0.65, 1.0, 0.2, 0, 0, Math.PI / 2, 0.07, 0.18, 0.07);

    /* 4. 摩耗: 蓋のひびと擦れ */
    add(g, BOX, M.dark, 0.60, 0.24, 0.29, 0, 0.2, 0.4, 0.30, 0.06, 0.04);
    add(g, BOX, M.wear, -0.44, 0.20, 0.30, 0, 0, 0.1, 0.34, 0.10, 0.03);

    /* 5. 顔（胴の前面） */
    face(g, { y: 0.02, z: 0.31, ex: 0.30, es: 0.12, eL: a.eyeL, eR: a.eyeR });
    P.mouth = face(g, { my: -0.12, mz: 0.31, mw: 0.30, mh: 0.08 });

    /* 6. 腕（ANIM / sync3D が回すので、名前は契約。胴から僅かに覗く） */
    P.arms = arms(g, -0.26, 0.60);
    return { g, P };
  };

  /* ---- ロッカー --------------------------------------------------------- */
  ART.models.locker = function () {
    const c = ART.ctx; if (!c || !c.add) return null;
    const { add, RB, BOX, PLANE, CONE, geo, face, arms } = c;
    const M = kitOf(c); if (!M) return null;
    const g = new c.THREE.Group(), P = {};
    const a = ART.asym('locker', { scale: 1 });

    /* 1. 箱 */
    add(g, RB(1.6, 2.0, 1.0, 0.04), M.metal, 0, 0, 0);

    /* 2. 扉（へこんでいる = 記号）。外枠 4 枚 ＋ へこんだ 1 枚。 */
    add(g, BOX, M.metalDark, 0, 0, 0.505, 0, 0, 0, 1.44, 1.84, 0.01);
    add(g, BOX, M.metal, 0, 0, 0.515, 0, 0, 0, 1.38, 1.78, 0.01);
    add(g, BOX, M.metal, 0, 0.86, 0.528, 0, 0, 0, 1.38, 0.06, 0.02);
    add(g, BOX, M.metal, 0, -0.86, 0.528, 0, 0, 0, 1.38, 0.06, 0.02);
    add(g, BOX, M.metal, -0.66, 0, 0.528, 0, 0, 0, 0.06, 1.78, 0.02);
    add(g, BOX, M.metal, 0.66, 0, 0.528, 0, 0, 0, 0.06, 1.78, 0.02);
    /* へこんだ 1 枚（右上）。摩耗は縁と 1〜2 箇所。 */
    add(g, BOX, M.metalDark, 0.44, 0.34, 0.535, 0, 0, -0.20, 0.44, 0.50, 0.03);
    add(g, BOX, M.metal, 0.44, 0.34, 0.552, 0, 0, -0.20, 0.30, 0.36, 0.02);

    /* 3. 通気口（4 枚） */
    for (let i = 0; i < 4; i++) add(g, BOX, M.dark, 0, 0.82 - i * 0.07, 0.53, 0, 0, 0, 1.0, 0.035, 0.02);

    /* 4. 顔（三角の目 2 つ ＋ 中に牙のある口） */
    const pink = c.mbasic(1.23, 0.77, 0.57);
    const tri = geo('mfLockTri', () => {
      const s = new c.THREE.Shape();
      s.moveTo(0, 0); s.lineTo(0.42, 0.18); s.lineTo(0.36, -0.12); s.closePath();
      return new c.THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: false });
    });
    for (const sd of [-1, 1]) {
      const t = add(g, tri, pink, sd * 0.12, 0.55, 0.52);
      t.scale.x = sd; t.castShadow = false;
    }

    add(g, BOX, M.dark, 0, -0.25, 0.5, 0, 0, 0, 1.0, 0.75, 0.06);
    P.inner = add(g, PLANE, c.mbasic(1.15, 0.34, 0.52), 0, -0.25, 0.535, 0, 0, 0, 0.92, 0.66, 1);
    P.inner.castShadow = false;

    /* 上下の牙（ANIM が top.position.y / bot.position.y を書く） */
    const teeth = c.mstd('#f6f3ea', 0.35, 0);
    P.top = new c.THREE.Group(); P.bot = new c.THREE.Group();
    g.add(P.top, P.bot);
    for (let i = 0; i < 6; i++) {
      const x = -0.4 + i * 0.16;
      add(P.top, CONE, teeth, x, 0.04, 0.56, Math.PI, 0, 0, 0.15, 0.22, 0.08);
      add(P.bot, CONE, teeth, x, -0.54, 0.56, 0, 0, 0, 0.14, 0.20, 0.08);
    }

    /* 5. 中に挟まったプリントと名札 */
    for (let i = 0; i < 4; i++) {
      add(g, PLANE, c.mstd('#ffffff', 0.9, 0, { map: c.TEX.test, side: c.THREE.DoubleSide }),
          -0.5 + i * 0.34, -0.78 + (i % 2) * 0.1, 0.542, 0, 0, (i - 1.5) * 0.22, 0.28, 0.34, 1);
    }
    add(g, PLANE, c.mstd('#ffffff', 0.6, 0, { map: c.TEX.plate('2-1') }), 0.5, 0.32, 0.542, 0, 0, 0, 0.34, 0.13, 1);
    add(g, BOX, M.metalDark, 0.62, -0.02, 0.55, 0, 0, 0, 0.06, 0.24, 0.04);

    /* 6. 腕 */
    P.arms = arms(g, -0.2, 0.84, 1.3);
    return { g, P };
  };

  /* ---- こうしゃ（ボス: 校舎） -------------------------------------------- */
  ART.models.kousha = function () {
    const c = ART.ctx; if (!c || !c.add) return null;
    const { add, RB, BOX, PLANE, CONE, CYL, SPH, geo, face, arms } = c;
    const M = kitOf(c); if (!M) return null;
    const g = new c.THREE.Group(), P = {};
    const a = ART.asym('kousha', { scale: 1 });

    const wall = c.mstd('#ffffff', 0.85, 0, { map: c.TEX.plaster, color: new c.THREE.Color('#c2bcc6') });
    const roof = c.mstd('#4a3a5a', 0.55, 0.20);
    const dk = c.mstd('#120818', 0.8, 0);
    const frame = c.mstd('#8a86a0', 0.5, 0.4);

    P.body = new c.THREE.Group();
    g.add(P.body);

    /* 1. 壁と屋根 */
    add(P.body, RB(3.2, 1.6, 0.6, 0.04), wall, 0, -0.2, 0);
    add(P.body, BOX, roof, 0, 0.63, 0, 0, 0, 0, 3.34, 0.07, 0.7);
    add(P.body, BOX, frame, 0, -0.34, 0.31, 0, 0, 0, 3.2, 0.03, 0.02);
    add(P.body, BOX, frame, 0, 0.12, 0.31, 0, 0, 0, 3.2, 0.03, 0.02);

    /* 2. 窓 20 枚。1 枚 1 枚の材質（ANIM が窓ごとに色を書くので共有しない）。 */
    P.wins = [];
    let wi = 0;
    for (let r = 0; r < 3; r++) for (let cc = 0; cc < 8; cc++) {
      const x = -1.35 + cc * 0.386, y = 0.32 - r * 0.44;
      if (r === 0 && (cc === 2 || cc === 5)) continue;
      if (r === 2 && (cc === 3 || cc === 4)) continue;
      add(P.body, BOX, frame, x, y, 0.305, 0, 0, 0, 0.27, 0.27, 0.01).castShadow = false;
      const m = c.mbasic(0.42, 0.30, 0.62);
      m.userData.k = ART.range('koushaWin' + wi, 0, 6);
      const pane = add(P.body, PLANE, m, x, y, 0.312, 0, 0, 0, 0.23, 0.23, 1);
      pane.castShadow = false;
      P.wins.push(m);
      /* 割れた窓（記号）: 3 枚だけひびを入れる */
      if (wi === 4 || wi === 11 || wi === 17) {
        add(P.body, BOX, dk, x - 0.04, y, 0.318, 0, 0, 0.5, 0.02, 0.24, 0.01).castShadow = false;
        add(P.body, BOX, dk, x + 0.03, y + 0.01, 0.318, 0, 0, -0.7, 0.02, 0.18, 0.01).castShadow = false;
      }
      wi++;
    }

    /* 3. 壁を突き抜けた大ひび */
    for (let i = 0; i < 6; i++) {
      add(P.body, BOX, dk, -0.86 + (i % 2 ? 0.08 : -0.06), 0.42 - i * 0.22, 0.315,
          0, 0, (i % 2 ? 0.22 : -0.18), 0.05, 0.26, 0.02).castShadow = false;
    }

    /* 4. 目（三角の目 2 つ。瞳孔は userData.pu で ANIM に掴まれる） */
    P.eyes = [];
    const pink = c.mbasic(1.23, 0.77, 0.57);
    const tri = geo('mfKouTri', () => {
      const sh = new c.THREE.Shape();
      sh.moveTo(-0.2, 0.05); sh.lineTo(0.26, 0.16); sh.lineTo(0.22, -0.16); sh.lineTo(-0.16, -0.14); sh.closePath();
      return new c.THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: false });
    });
    for (const sd of [-1, 1]) {
      const eg = new c.THREE.Group();
      eg.position.set(sd * 0.58, 0.3, 0.31);
      P.body.add(eg);
      add(eg, BOX, dk, 0, 0, -0.01, 0, 0, 0, 0.6, 0.42, 0.02);
      const t = add(eg, tri, pink, 0, 0, 0);
      t.scale.set(sd * -1.1, 1.1, 1); t.castShadow = false;
      const pu = add(eg, SPH, dk, 0, -0.02, 0.05, 0, 0, 0, 0.06, 0.09, 0.02);
      eg.userData.pu = pu;
      P.eyes.push(eg);
    }

    /* 5. 口（腹の底に開いた大穴。ANIM が inner / mt / mb / tongue を動かす） */
    P.mouthG = new c.THREE.Group();
    P.mouthG.position.set(0, -0.72, 0.3);
    P.body.add(P.mouthG);
    add(P.mouthG, BOX, dk, 0, 0, -0.02, 0, 0, 0, 0.86, 0.5, 0.06);
    P.inner = add(P.mouthG, PLANE, c.mbasic(1.15, 0.34, 0.52), 0, 0, 0.015, 0, 0, 0, 0.8, 0.42, 1);
    P.inner.castShadow = false;
    const teeth = c.mstd('#f6f3ea', 0.35, 0);
    P.mt = new c.THREE.Group(); P.mb = new c.THREE.Group();
    P.mouthG.add(P.mt, P.mb);
    for (let i = 0; i < 6; i++) {
      const x = -0.33 + i * 0.132;
      add(P.mt, CONE, teeth, x, 0.17, 0.04, Math.PI, 0, 0, 0.12, 0.18, 0.07);
      add(P.mb, CONE, teeth, x, -0.17, 0.04, 0, 0, 0, 0.11, 0.16, 0.07);
    }
    P.tongue = new c.THREE.Group();
    P.mouthG.add(P.tongue);
    add(P.tongue, RB(0.34, 0.07, 1, 0.03), M.red, 0, -0.12, 0.5);
    P.tongue.scale.z = 0.001;

    /* 6. 時計塔。屋根が曲がり、鐘も傾いている（記号）。 */
    add(P.body, RB(0.56, 0.62, 0.5, 0.03), wall, 0, 0.95, 0);
    add(P.body, CONE, roof, 0, 1.45, 0, 0, Math.PI / 4, 0, 0.9, 0.36, 0.9);
    add(P.body, CYL, c.mstd('#ffffff', 0.4, 0, { map: c.TEX.clock, emissive: new c.THREE.Color('#ffd88a'), emissiveIntensity: 0.25 }),
        0, 1.02, 0.26, Math.PI / 2, 0, 0, 0.18, 0.02, 0.18);
    /* 時計のひび */
    add(P.body, BOX, dk, 0.04, 1.05, 0.275, 0, 0, 0.6, 0.02, 0.20, 0.01).castShadow = false;

    P.h1 = new c.THREE.Group(); P.h2 = new c.THREE.Group();
    P.h1.position.set(0, 1.02, 0.285); P.h2.position.set(0, 1.02, 0.29);
    P.body.add(P.h1, P.h2);
    add(P.h1, BOX, dk, 0, 0.06, 0, 0, 0, 0, 0.02, 0.12, 0.01);
    add(P.h2, BOX, M.red, 0, 0.08, 0, 0, 0, 0, 0.012, 0.16, 0.01);

    /* 鐘（ANIM が bell.rotation.z を書くので、傾きは子の方に入れる） */
    P.bell = new c.THREE.Group();
    P.bell.position.set(0, 1.3, 0.2);
    P.body.add(P.bell);
    add(P.bell, CONE, c.mstd('#c8a24e', 0.25, 1), 0.03, -0.08, 0, 0, 0, 0.30, 0.16, 0.14, 0.16);
    add(P.bell, SPH, c.mstd('#c8a24e', 0.25, 1), 0.03, -0.15, 0, 0, 0, 0, 0.03);

    /* 7. 柱の脚（怒ると立ち上がる） */
    for (const x of [-1.3, -0.6, 0.6, 1.3]) add(g, CYL, roof, x, -1.3, 0, 0, 0, 0, 0.09, 0.6, 0.09);

    /* 8. 腕 */
    P.arms = arms(g, -0.3, 1.55, 2.6);
    return { g, P };
  };
})(typeof window !== 'undefined' ? window : this);
