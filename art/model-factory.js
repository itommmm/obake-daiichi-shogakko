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
