/* おばけ第一小学校 — 2D HUD(canvas 2D) と CSS の 色パレット統一モジュール
 * ==========================================================================
 * 役割: pixelfx.html に 2 つ並存していた色パレット（HUD の旧ネオン と CSS の
 *       olive/stone 系）を、olive / stone / copper の 1 本の軸へ寄せて 1 箇所に
 *       まとめる。を提供する 4 つの API:
 *
 *         ART.hud.map        旧ネオン → muted の完全マップ（キーは小文字 hex）
 *         ART.hud.color(c)   色を muted へ変換する関数
 *         ART.hud.tokens     HUD の役割ごとの色（意味トークン）
 *         ART.hud.cssVars    CSS 変数の正本（:root 相当）
 *
 * 依存: なし（Three.js を使わない。外部ライブラリ追加なし。Math.random() 不使用）
 * 読み込み: classic script（<script src="art/hud-palette.js"></script>）。
 *           art-direction.js の後に読む想定だが、順序は問わない。
 *           ART（window.ART）が無ければ no-op で正常終了する。
 *
 * 規範: 色相は「冷たい緑灰（stone/olive）」と「錆びた銅（copper）」の 2 軸。
 *       紫・シアン・飽和ピンク・純白・純黒は新的には使わない。
 * ========================================================================== */
(function (global) {
  'use strict';

  const ART = global.ART;
  if (!ART) return; // ART が読めていなければ何もしない

  /* ======================================================================
   * 1. 旧ネオン → muted の完全マップ
   * ----------------------------------------------------------------------
   * キーは小文字の hex、値は 6 桁 hex。
   * 先頭 20 個は pixelfx.html の HORROR_HUD_COLOR とまったく同じ値
   * （既存の muted 値は変更しない）。以降は「HUD の直書きネオン」の追加分。
   * ==================================================================== */
  const MAP = {
    /* ---- 既存 20 色（pixelfx.html: HORROR_HUD_COLOR と同一。変更しない） ---- */
    '#5fe3ff': '#a5bdb2', // シアン → 冷たい緑灰
    '#ff5fb8': '#b38b83', // ピンク → くすんだ銅赤
    '#ffd23f': '#c6b78d', // 金 → 淡い金（accent の正本）
    '#a65cff': '#a3a398', // 紫 → 石灰色
    '#e8dcff': '#ccd0bd', // 藤白 → 生成り
    '#ffd1ec': '#cbb1a9', // 薄桃 → くすんだ生成り
    '#cfe9ff': '#c3cbbb', // 淡青 → 淡い石
    '#9fefff': '#b9cfc1', // シアン白 → 淡い緑灰
    '#ff4fb0': '#b59188', // ピンク → 銅の肌
    '#b47cff': '#a09a8a', // 紫 → くすんだ石
    '#e0a8ff': '#b6aa9b', // 藤 → くすんだ生成り
    '#ff8fd0': '#c9a39e', // ピンク → 淡い銅
    '#4dff9a': '#9ab5a0', // 緑 → オリーブ灰
    '#9fd8ff': '#b2c9c0', // 淡青 → 緑灰
    '#7a3dff': '#8a9080', // 紫 → 暗い石
    '#fff': '#e2e5d2', // 純白 → 生成り
    '#ffffff': '#e2e5d2', // 純白 → 生成り
    '#ff5f5f': '#c19686', // 赤（危険）→ 銅の赤
    '#ff8fc8': '#c9a5a0', // ピンク → 淡い銅
    '#ffe96b': '#d0c394', // 金 → 淡い金

    /* ---- 追加：HUD に直書きのまま残っていた旧ネオン -------------------
     * pixelfx.html の行番号メモ：
     *   1430 名札の枠 / 1431 名札タグ   1509 エンディング枠   1510 名札タグ
     *   1518 ノート                     1521 エンディング背景 1522 窓の光
     *   1530 朝の教室                   1533 せんせいの名札  2252 画面外矢印
     *   2255 画面外ヒントの文字         2278/2281/2285 イントロ 2293 クリア
     *   2294 クリアのラベル             2296 吹き出しの枠
     *   1683 ルート選択の枠             1685 標的リング        1688 ギミックリング
     * ------------------------------------------------------------------ */
    '#2a5ad8': '#4a6668', // 名札タグ（青）→ 暗い石緑
    '#3a8a5a': '#4d6b52', // せんせいの名札（緑）→ オリーブ
    '#2f6fd6': '#55655f', // ノート表紙（青）→ 石
    '#1d4da0': '#37443f', // ノートの背（濃青）→ 濃石
    '#1a1a2a': '#333c36', // ノートの字（墨）→ 淡墨
    '#0b0820': '#141a17', // エンディング背景（紫黒）→ 墨
    '#2a2030': '#39423b', // 「おしまい」の字（紫黒）→ 石墨
    '#2f5a3c': '#3f5c45', // 朝の窓（緑）→ オリーブ
    '#8a6a40': '#7d6547', // 朝の木枠（銅）→ くすんだ銅
    '#fff3dc': '#e8e2d0', // 朝の空（生成り）→ chalk
    '#fff6b0': '#d8cba0', // 「✦」（淡い金）→ 淡い金
    '#ffe9a8': '#d0c394', // イントロの操作ヒント（淡い金）→ 淡い金（#ffe96b と統一）
    '#9a8cc0': '#8a9080', // クリア画面の未達ラベル（紫）→ 暗い石
    '#bfe8ff': '#c3cbbb', // 飛沫・三角ベルの文字（淡青）→ 淡い石
    '#c8ffb0': '#c3cbbb', // リコーダーの文字（淡緑）→ 淡い石
    '#ffb0e0': '#cbb1a9', // タンバリンの文字（桃）→ くすんだ生成り
    '#9fd0ff': '#b2c9c0', // ケンの文字（淡青）→ 緑灰
    '#ff8a5a': '#c9a39e', // 太鼓の文字（橙）→ 淡い銅
    '#9dffc8': '#b9cfc1', // 爆発の煙（淡緑）→ 淡い緑灰
    '#c9ba8f': '#c6b78d', // HUD の accent → accent の正本 #c6b78d に統一
    '#e7e7d7': '#e2e5d2', // HUD の value → 生成り #e2e5d2 に統一
    '#adb7a4': '#adb7a4', // HUD の label（正本。変更なし）
    '#d1a695': '#c19686', // HUD の warn → 危険色の #c19686 系に寄せる
    '#11191c': '#161d1c', // 文字の縁取り（暗墨）→ ART.PALETTE.INK
    '#000': '#101614', // 矢印の輪郭（純黒）→ 極暗の緑灰
    '#000000': '#101614',

    /* ---- rgba 相当 -----------------------------------------------------
     * rgba() は color() が rgb 三部だけを muted に落とす。狙いの色（紫/青/
     * 純白）を_hex_ として持っておくと、背景・輪郭が確実に olive/stone 軸に
     * 乗る（フォールバックに任せない）。
     * ------------------------------------------------------------------ */
    '#0e0820': '#141a17', // rgba(14,8,32,.86) / rgba(14,8,32,.82)
    '#060310': '#141a17', // rgba(6,3,16,…) フェード
    '#080414': '#141a17', // rgba(8,4,20,.5) / rgba(8,4,20,.9)
    '#281e3c': '#1a201c', // rgba(40,30,60,.75)
    '#a0b4ff': '#c3cbbb', // rgba(160,180,255,.10) 窓から差す光
    '#a0dcff': '#c3cbbb', // rgba(160,220,255,.8) 飛沫のリング
    '#c8dcff': '#c3cbbb', // rgba(200,220,255,…) レールの光条
  };

  /* ======================================================================
   * 2. HUD の意味トークン
   * ----------------------------------------------------------------------
   * drawHUD がハードコードしている
   *   label='#adb7a4', value='#e7e7d7', warn='#d1a695', accent='#c9ba8f'
   * を置き換えられるようにする。全部 olive / stone / copper の軸。
   * 純白・純黒は使わない。
   * ==================================================================== */
  const TOKENS = {
    /* 文字 */
    label: '#adb7a4', // ラベル（淡いオリーブ灰）
    value: '#e2e5d2', // 値（生成り。#fff の muted と同じ値）
    warn: '#c19686', // 警告・危険（銅の赤。#ff5f5f の muted と同じ値）
    accent: '#c6b78d', // アクセント（淡い金。#ffd23f の muted と同じ値）

    /* 面（パネル） */
    panel: 'rgba(11,17,15,.78)', // ステータス帯の背景
    panelBorder: 'rgba(147,160,139,.65)', // ステータス帯の枠
    accentBar: '#a8b39c', // ステータス帯左上アクセントバー
    dim: 'rgba(134,147,132,.42)', // 仕切り線
    ink: '#161d1c', // 文字の縁取り（暗墨）

    /* ゲームプレイ上の目印（muted でも互いを混同しないこと） */
    hitRing: '#c6b78d', // 標的リング（accent 系・淡い金 h≈44°）
    hint: '#c19686', // 画面外ヒント矢印（warn 系・銅の赤 h≈16°・明度0.64）
    boss: '#aa897c', // ボス HP バー
    card: '#4a6668', // カード／名札（石緑）

    /* 補助 */
    danger: '#c19686', // 危険表示（矢印の点滅など）
    cardAlt: '#4d6b52', // 名札の別種（せんせい）
    reticle: '#bad1cb', // 照準（通常）
    reticleHot: '#c99086', // 照準（enemy 上）
    white: '#e2e5d2', // 白の代わりに使う生成り
  };

  /* ======================================================================
   * 3. CSS 変数の正本
   * ----------------------------------------------------------------------
   * pixelfx.html の :root（146-152行）で生效している実値。
   * 変数名 --violet だけは紫のまま。値は紫にせず neutral（stone/灰緑）に
   * してあるので、名称だけ旧ネオン時代の名残。ここでも変えない。
   * ==================================================================== */
  const CSS_VARS = {
    '--night': '#080e11',
    '--panel': '#111b1e',
    '--violet': '#758f91', // 名称は紫のまま。値は灰緑（stone）
    '--cyan': '#b7c9c6', // 名称はシアンのまま。値は淡い緑灰
    '--pink': '#bd7f77', // 名称はピンクのまま。値はくすんだ銅
    '--gold': '#d2b68b', // 名称は金のまま。値は淡い金
    '--chalk': '#e3e1d7',
    '--ink': '#141b20',
    /* 199X のコンソール筐体に合わせ、角張ったゴシックへ寄せる（明朝は 3D と合わない） */
    '--display': '"Hiragino Kaku Gothic ProN","Hiragino Sans","Noto Sans JP",sans-serif',
    '--body': '"Hiragino Kaku Gothic ProN","Hiragino Sans","Noto Sans JP",sans-serif',
    '--line': '#5d6f6d',
    '--line2': '#8fa39c',
    '--chamfer': '12px',
  };

  /* 要素スコープの CSS 変数（:root ではなく個別セレクタで定義） */
  const CSS_VARS_SCOPED = {
    '.sk': { '--cd': '0' }, // スキルのクールダウン角度
    '#sLight': { '--glow': '#a8bdb5' }, // ライトのglow
    '#sBell': { '--glow': '#bba47b' }, // チャイムのglow
    '#sSp': { '--glow': '#9e8990' }, // スペシャルのglow
  };

  /* 旧 :root（22-34行）の実値。記録用。統合には使わない。 */
  const CSS_VARS_LEGACY = {
    '--night': '#0d0a1f',
    '--panel': 'rgba(22,12,44,.82)',
    '--violet': '#a65cff',
    '--cyan': '#5fe3ff',
    '--pink': '#ff5fb8',
    '--gold': '#ffd23f',
    '--chalk': '#f4f1ff',
    '--ink': '#1a0b25',
    '--display': '"Dela Gothic One","Zen Maru Gothic","Hiragino Maru Gothic ProN",sans-serif',
    '--body': '"Zen Maru Gothic","Hiragino Maru Gothic ProN","Hiragino Sans",sans-serif',
  };

  /* ======================================================================
   * 4. 色の変換
   * ----------------------------------------------------------------------
   * 三角関数は使わない。HSL を自前計算して
   *   ・彩度を 0.35 以下に落とす
   *   ・色相を olive / stone / copper の 1 本の軸へ寄せる
   * ことで、未知の色も olive/stone 軸へ寄せる。
   * ==================================================================== */

  /* 彩度の上限（art-direction.js の TOKENS.satCap と同じ 0.35） */
  const SAT_CAP = 0.35;
  /* 寄せる先の色相（度数）。stone=冷たい緑灰 / olive=オリーブ / copper=錆びた銅 */
  const HUE_AXES = [165, 95, 30];

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function hexToRgb(hex) {
    const h = hex.charAt(0) === '#' ? hex.slice(1) : hex;
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }

  function rgbToHex(r, g, b) {
    const p = (n) => {
      const s = clamp(Math.round(n), 0, 255).toString(16);
      return s.length < 2 ? '0' + s : s;
    };
    return '#' + p(r) + p(g) + p(b);
  }

  /* '#abc' / '#AABBCC' を 6 桁小文字へ。解釈できなければ null */
  function normalizeHex(s) {
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(s)) return null;
    const h = s.slice(1);
    if (h.length === 3) {
      return '#' + h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    return '#' + h;
  }

  /* hex → [h, s, l]（h は 0-360、s/l は 0-1） */
  function hexToHsl(hex) {
    const rgb = hexToRgb(hex);
    const r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    const l = (max + min) / 2;
    let s = 0;
    if (d > 0) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = 60 * (((g - b) / d) % 6);
      else if (max === g) h = 60 * ((b - r) / d + 2);
      else h = 60 * ((r - g) / d + 4);
      if (h < 0) h += 360;
    }
    return [h, s, l];
  }

  /* [h, s, l] → hex */
  function hslToHex(h, s, l) {
    const hh = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (hh < 60) { r = c; g = x; }
    else if (hh < 120) { r = x; g = c; }
    else if (hh < 180) { g = c; b = x; }
    else if (hh < 240) { g = x; b = c; }
    else if (hh < 300) { r = x; b = c; }
    else { r = c; b = x; }
    return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
  }

  /* 色相の循環距離 */
  function hueDist(a, b) {
    return Math.abs(((a - b + 540) % 360) - 180);
  }

  /* h から target へ k の割合で寄せる */
  function pullHue(h, target, k) {
    const diff = ((target - h + 540) % 360) - 180;
    return ((h + diff * k) % 360 + 360) % 360;
  }

  /* olive / stone / copper のうちいちばん近い軸の色相 */
  function nearestAxis(h) {
    let best = HUE_AXES[0], bd = Infinity;
    for (let i = 0; i < HUE_AXES.length; i++) {
      const d = hueDist(h, HUE_AXES[i]);
      if (d < bd) { bd = d; best = HUE_AXES[i]; }
    }
    return best;
  }

  /* マップに無い色を olive/stone 軸へ寄せる（フォールバック） */
  function muteHex(hex) {
    const hsl = hexToHsl(hex);
    let h = hsl[0], s = hsl[1], l = hsl[2];
    if (s < 0.02) return hex; // ほぼ無彩色はそのまま
    const over = s > SAT_CAP;
    if (over) s = SAT_CAP;
    h = pullHue(h, nearestAxis(h), over ? 1 : 0.6);
    let out = hslToHex(h, s, l);
    /* 8bit 丸め誤差で彩度が 0.35 を僅かに超えることがあるので、 クランプし直す */
    for (let i = 0; i < 3; i++) {
      const back = hexToHsl(out);
      if (back[1] <= SAT_CAP + 1e-6) break;
      s = s * (SAT_CAP / back[1]);
      out = hslToHex(h, s, l);
    }
    return out;
  }

  /* '255' / '255.0' を 0-255 の整数へ */
  function toByte(v) {
    const n = parseFloat(v);
    if (isNaN(n)) return null;
    return clamp(Math.round(n), 0, 255);
  }

  /* 変換本体
   *   '#ffd23f'            → マップの値（無ければ olive/stone へ寄せる）
   *   'rgba(14,8,32,.86)'  → alpha を保ったまま rgb だけ muted に
   *   undefined / 非文字列 → そのまま返す
   */
  function color(c) {
    if (typeof c !== 'string') return c;
    const raw = c.trim();
    if (!raw) return c;
    const s = raw.toLowerCase();

    /* rgba(...) / rgb(...) */
    const m = /^rgba?\s*\(([^)]*)\)$/.exec(s);
    if (m) {
      const parts = m[1].split(/[,/\s]+/).filter(function (x) { return x.length > 0; });
      if (parts.length < 3) return c;
      const r = toByte(parts[0]), g = toByte(parts[1]), b = toByte(parts[2]);
      if (r === null || g === null || b === null) return c;
      const hex = rgbToHex(r, g, b);
      const muted = MAP[hex] || muteHex(hex);
      const mc = hexToRgb(muted);
      if (parts.length >= 4) {
        const a = parseFloat(parts[3]);
        if (!isNaN(a)) {
          return 'rgba(' + mc[0] + ',' + mc[1] + ',' + mc[2] + ',' + parts[3] + ')';
        }
      }
      return 'rgb(' + mc[0] + ',' + mc[1] + ',' + mc[2] + ')';
    }

    /* #rgb / #rrggbb / #rrggbbaa */
    if (s.charAt(0) === '#') {
      const hex = normalizeHex(s);
      if (hex) return MAP[hex] || muteHex(hex);
      const m8 = /^#([0-9a-f]{8})$/.exec(s);
      if (m8) {
        const rgbHex = '#' + m8[1].slice(0, 6);
        const a = parseInt(m8[1].slice(6, 8), 16) / 255;
        const muted = MAP[rgbHex] || muteHex(rgbHex);
        const mc = hexToRgb(muted);
        return 'rgba(' + mc[0] + ',' + mc[1] + ',' + mc[2] + ',' + Math.round(a * 1000) / 1000 + ')';
      }
      return c;
    }

    /* 名前色など、解釈できないものはそのまま（勝手に変えない） */
    return c;
  }

  /* CSS 変数を対象の要素（既定は :root）へ当てる */
  function applyCssVars(target) {
    const el = target || (global.document && global.document.documentElement);
    if (!el || !el.style || !el.style.setProperty) return false;
    for (const key in CSS_VARS) {
      if (Object.prototype.hasOwnProperty.call(CSS_VARS, key)) {
        el.style.setProperty(key, CSS_VARS[key]);
      }
    }
    return true;
  }

  /* ---- 公開 ---------------------------------------------------------- */
  ART.hud = ART.hud || {};
  ART.hud.version = '1.0.0';
  ART.hud.map = MAP;
  ART.hud.tokens = TOKENS;
  ART.hud.cssVars = CSS_VARS;
  ART.hud.cssVarsScoped = CSS_VARS_SCOPED;
  ART.hud.cssVarsLegacy = CSS_VARS_LEGACY;
  ART.hud.color = color;
  ART.hud.applyCssVars = applyCssVars;

  if (global.console && console.info) {
    console.info('[ART] hud-palette ' + ART.hud.version + ' loaded');
  }
/* ブラウザでは window、それ以外（node 等）では globalThis を見る。
 * どちらにも ART が無ければ先頭で no-op して正常終了する。 */
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
