/* おばけ第一小学校 — PS1アート制作システム / 5. Geometry
 * ==========================================================================
 * 役割: 低ポリの「面取り箱」を 1 個のジオメトリで作る。
 *
 * なぜ必要か:
 *   `RoundedBoxGeometry(w,h,d,1,r)` は 1 箱 108 三角形（面ごとに 3x3 分割）。
 *   シーン内の箱が 100 個超あると 1 万三角形が箱だけで消費される。
 *   199X のローポリでは角を 45° で「面取り」すれば十分読める。
 *
 * 面取り箱:
 *   面 6 枚（12三角形）＋ 稜 12 本（24三角形）＋ 頂点 8 個（8三角形）＝ 44 三角形
 *   頂点 24 個。`RoundedBoxGeometry` の 108 三角形に対して 1/2.5。
 *
 * 巻き方向は「中心から外向き」で自動修正するので、面の裏返しが起きない。
 * UV は面ごとの箱投影（BoxGeometry と同じ 0..1 的一生）なので、既存テクスチャがそのまま使える。
 * ========================================================================== */
(function (global) {
  'use strict';

  const ART = global.ART;
  if (!ART) return;

  /**
   * 面取り箱を作る。
   * @param {THREE} THREE
   * @param {number} w 幅
   * @param {number} h 高さ
   * @param {number} d 奥行
   * @param {number} r 面取りの深さ（0 で完全な箱）
   */
  ART.chamferBox = function (THREE, w, h, d, r) {
    const hw = w / 2, hh = h / 2, hd = d / 2;
    const rad = Math.max(0, Math.min(r || 0, Math.min(w, h, d) * 0.45));
    const ex = Math.max(0, hw - rad), ey = Math.max(0, hh - rad), ez = Math.max(0, hd - rad);

    const pos = [];
    const v = (x, y, z) => { pos.push(x, y, z); return pos.length / 3 - 1; };

    /* 8 隅 × 3 頂点（A=X面の隅 / B=Y面の隅 / D=Z面の隅） */
    const C = {};
    const id = (sx, sy, sz) => (sx > 0 ? 1 : 0) * 4 + (sy > 0 ? 1 : 0) * 2 + (sz > 0 ? 1 : 0);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      C[id(sx, sy, sz)] = {
        A: v(sx * hw, sy * ey, sz * ez),
        B: v(sx * ex, sy * hh, sz * ez),
        D: v(sx * ex, sy * ey, sz * hd),
      };
    }
    const g = (sx, sy, sz) => C[id(sx, sy, sz)];

    const tris = [];
    const quad = (a, b, c, d) => { tris.push([a, b, c], [a, c, d]); };

    /* 面 6 枚 */
    for (const sx of [-1, 1]) {
      const q = [g(sx, -1, -1), g(sx, 1, -1), g(sx, 1, 1), g(sx, -1, 1)];
      quad(q[0].A, q[1].A, q[2].A, q[3].A);
    }
    for (const sy of [-1, 1]) {
      const q = [g(-1, sy, 1), g(1, sy, 1), g(1, sy, -1), g(-1, sy, -1)];
      quad(q[0].B, q[1].B, q[2].B, q[3].B);
    }
    for (const sz of [-1, 1]) {
      const q = [g(1, -1, sz), g(1, 1, sz), g(-1, 1, sz), g(-1, -1, sz)];
      quad(q[0].D, q[1].D, q[2].D, q[3].D);
    }
    /* 稜 12 本 */
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {   // Z 方向
      const a = g(sx, sy, -1), b = g(sx, sy, 1);
      quad(a.D, b.D, b.B, a.B);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {   // Y 方向
      const a = g(sx, -1, sz), b = g(sx, 1, sz);
      quad(a.A, b.A, b.D, a.D);
    }
    for (const sy of [-1, 1]) for (const sz of [-1, 1]) {   // X 方向
      const a = g(-1, sy, sz), b = g(1, sy, sz);
      quad(a.B, b.B, b.A, a.A);
    }
    /* 頂点 8 個 */
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const c = g(sx, sy, sz);
      tris.push([c.A, c.B, c.D]);
    }

    /* 巻き方向の自動修正（面中心から外向きを向く） */
    const idx = [];
    for (const t of tris) {
      const p = t.map((i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]);
      const e1 = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]];
      const e2 = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]];
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const cx = (p[0][0] + p[1][0] + p[2][0]) / 3;
      const cy = (p[0][1] + p[1][1] + p[2][1]) / 3;
      const cz = (p[0][2] + p[1][2] + p[2][2]) / 3;
      if (n[0] * cx + n[1] * cy + n[2] * cz < 0) idx.push(t[0], t[2], t[1]);
      else idx.push(t[0], t[1], t[2]);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);

    /* UV は箱投影（BoxGeometry と同じ 0..1） */
    const p = geo.attributes.position;
    const uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
      let u, v;
      if (ax >= ay && ax >= az) { u = (z / hd) * 0.5 + 0.5; v = (y / hh) * 0.5 + 0.5; }
      else if (ay >= az) { u = (x / hw) * 0.5 + 0.5; v = (z / hd) * 0.5 + 0.5; }
      else { u = (x / hw) * 0.5 + 0.5; v = (y / hh) * 0.5 + 0.5; }
      uv[i * 2] = u; uv[i * 2 + 1] = v;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));

    /* 面ごとに分割して法線を flattening（flatShading と明記しない環境でも正 Pearls するため） */
    const flat = geo.toNonIndexed();
    flat.computeVertexNormals();
    geo.dispose();
    return flat;
  };
})(typeof window !== 'undefined' ? window : this);
