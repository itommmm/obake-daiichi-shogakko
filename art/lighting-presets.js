/* おばけ第一小学校 — PS1アート制作システム / 4. Lighting Presets
 * ==========================================================================
 * 役割: 部屋ごとの「光の序列」を数値で固定し、既存の光源に適用する。
 *       光源の数は増やさない（シェーダー再コンパイルを避ける）。
 *
 * 序列: key(moon) → fill(hemi) → practical(fl1/fl2) → accent(auraL) → fx
 *
 * 使い方:
 *   ART.lighting.apply('classroom')   // buildRoom の最後で1回
 *   ART.lighting.tint(place)          // update3D が毎フレーム参照
 *
 * 数値の正本は art/room-presets.js の ART.lighting.presets。
 * 这里是「適用側」だけをここに置く。
 * ========================================================================== */
(function (global) {
  'use strict';

  const ART = global.ART;
  if (!ART) return;

  /* ---- 適用（プリセットは room-presets.js が登録する） ------------------ */
  function preset(place) {
    const reg = ART.lighting.presets || {};
    return reg[place] || null;
  }

  ART.lighting.classroom = function () {
    return preset('classroom');
  };

  ART.lighting.tint = function (place) {
    const p = preset(place);
    return p && p.tint ? p.tint : [0.87, 0.91, 0.75];
  };

  ART.lighting.apply = function (place) {
    const c = ART.ctx;
    const p = preset(place);
    if (!c || !p) return null;

    const scene = c.scene;
    const grade = c.grade;

    if (scene && scene.fog) {
      scene.fog.color.set(p.fog.color);
      scene.fog.density = p.fog.density;
      if (scene.background && scene.background.isColor) {
        scene.background.copy(scene.fog.color).multiplyScalar(p.background);
      }
    }

    const hemi = c.hemi, moon = c.moon, fl1 = c.fl1, fl2 = c.fl2;
    if (hemi) {
      hemi.color.set(p.hemi.sky);
      hemi.groundColor.set(p.hemi.ground);
      hemi.userData.base = p.hemi.intensity;
      hemi.intensity = p.hemi.intensity;
    }
    if (moon) {
      moon.color.set(p.moon.color);
      moon.userData.base = p.moon.intensity;
      moon.intensity = p.moon.intensity;
    }
    for (const [light, cfg] of [[fl1, p.fl1], [fl2, p.fl2]]) {
      if (!light) continue;
      light.color.set(cfg.color);
      light.userData.base = cfg.intensity;
      light.intensity = cfg.intensity;
      if (cfg.distance != null) light.distance = cfg.distance;
    }

    if (grade && grade.uniforms) {
      if (grade.uniforms.uExposure) grade.uniforms.uExposure.value = p.exposure;
      if (grade.uniforms.uVig) grade.uniforms.uVig.value = p.vignette;
      if (grade.uniforms.uGrain) grade.uniforms.uGrain.value = p.grain;
      if (grade.uniforms.uContrast) grade.uniforms.uContrast.value = p.contrast == null ? 1.0 : p.contrast;
      /* uTint は update3D が毎フレーム書くので、ここでは触らない（tint() を参照） */
    }

    /* 窓から差す光の帯: 画面下に光だまりを作らない */
    const rays = c.RAYS || [];
    for (const m of rays) {
      if (!m.material) continue;
      m.material.opacity = p.rays.opacity;
      m.material.color.set(p.rays.color);
    }

    /* 蛍光灯ごとの明るさ（update3D が userData.k を掛ける） */
    (c.FLUOR || []).forEach((m, i) => {
      if (!m || !m.userData) return;
      m.userData.k = p.fluor[i] == null ? 1 : p.fluor[i];
    });

    return p;
  };
})(typeof window !== 'undefined' ? window : this);
