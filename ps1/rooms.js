/* ============================================================
   おばけ第一小学校 PS1版 : 学校の 部屋づくり
   ============================================================ */
'use strict';

function roomBase(id, name, x0, x1, z0, z1, h, theme) {
  theme = theme || {};
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(theme.bg || 0x05050b);
  scene.fog = new THREE.FogExp2(theme.fog || 0x05060c, theme.fogD || .043);
  const R = {
    id, name, scene, bounds: { x0, x1, z0, z1 }, h,
    colliders: [], doors: [], itemDefs: [], enemyDefs: [], cams: [], lights: [], flickers: [],
    spots: [], bossCam: null,
    props: {}, // 演出で動かす小物（comic-horror.js の nudge が使う）
  };
  ROOMS[id] = R;
  scene.add(new THREE.AmbientLight(theme.amb || 0x4d5a7e, theme.ambI == null ? .55 : theme.ambI));
  scene.add(new THREE.HemisphereLight(theme.sky || 0x9aaee0, theme.ground || 0x1d1712, theme.hemiI == null ? .35 : theme.hemiI));
  return R;
}

function roomFloor(R, tex, repX, repY, color) {
  const m = tm(tiled(tex, repX, repY), { color: color || 0xffffff });
  const w = R.bounds.x1 - R.bounds.x0, d = R.bounds.z1 - R.bounds.z0;
  const f = plane(w, d, m, 0, 0, 0, -Math.PI / 2, 0, R.scene);
  f.receiveShadow = false;
  return f;
}
function roomCeiling(R, tex, repX, repY) {
  const m = tm(tiled(tex, repX, repY), { color: 0xb0aa96 });
  const w = R.bounds.x1 - R.bounds.x0, d = R.bounds.z1 - R.bounds.z0;
  return plane(w, d, m, 0, R.h, 0, Math.PI / 2, 0, R.scene);
}
function roomWalls(R, mat, wain) {
  const b = R.bounds, t = .12, h = R.h;
  box(b.x1 - b.x0 + t, h, t, mat, 0, h / 2, b.z0, R.scene);
  box(b.x1 - b.x0 + t, h, t, mat, 0, h / 2, b.z1, R.scene);
  box(t, h, b.z1 - b.z0, mat, b.x0, h / 2, 0, R.scene);
  box(t, h, b.z1 - b.z0, mat, b.x1, h / 2, 0, R.scene);
  if (wain) {
    const y = .55, wh = 1.05, off = .065;
    box(b.x1 - b.x0, wh, .03, wain, 0, y, b.z0 + off, R.scene);
    box(b.x1 - b.x0, wh, .03, wain, 0, y, b.z1 - off, R.scene);
    box(.03, wh, b.z1 - b.z0, wain, b.x0 + off, y, 0, R.scene);
    box(.03, wh, b.z1 - b.z0, wain, b.x1 - off, y, 0, R.scene);
    box(b.x1 - b.x0, .06, .045, pm(0x2f3b34), 0, 1.09, b.z0 + off, R.scene);
    box(b.x1 - b.x0, .06, .045, pm(0x2f3b34), 0, 1.09, b.z1 - off, R.scene);
  }
}
function ceilLamp(R, x, z, color, power, dist) {
  const c = color == null ? 0xffe4b0 : color;
  box(.85, .07, .26, bm(c), x, R.h - .08, z, R.scene);
  const L = new THREE.PointLight(c, power == null ? .55 : power, dist || 11, 1);
  L.position.set(x, R.h - .42, z); R.scene.add(L); R.lights.push(L);
  return L;
}
function windowPanel(R, x, y, z, w, h, ry) {
  plane(w, h, tm(TEX.window, { color: 0xa8c0ff }), x, y, z, 0, ry, R.scene);
  const frame = pm(0x2f302c);
  const acrossZ = Math.abs(Math.sin(ry || 0)) > .5;
  // 窓枠（東西の 壁は z方向、南北の 壁は x方向に のびる）
  if (acrossZ) {
    box(.07, .07, w + .1, frame, x, y + h / 2, z, R.scene);
    box(.07, .07, w + .1, frame, x, y - h / 2, z, R.scene);
    box(.07, h, .07, frame, x, y, z - w / 2, R.scene);
    box(.07, h, .07, frame, x, y, z + w / 2, R.scene);
  } else {
    box(w + .1, .07, .07, frame, x, y + h / 2, z, R.scene);
    box(w + .1, .07, .07, frame, x, y - h / 2, z, R.scene);
    box(.07, h, .07, frame, x - w / 2, y, z, R.scene);
    box(.07, h, .07, frame, x + w / 2, y, z, R.scene);
  }
}
function doorPanel(R, x, z, ry, label) {
  const d = box(1.02, 2.12, .08, tm(TEX.door, { color: 0xd6c4a8 }), x, 1.06, z, R.scene);
  d.rotation.y = ry || 0;
  const top = box(1.16, .09, .1, pm(0x3a2b1d), x, 2.14, z, R.scene);
  top.rotation.y = ry || 0;
  const sign = box(.72, .16, .04, bm(0xd9d2b8), x, 2.32, z, R.scene);
  sign.rotation.y = ry || 0;
}
function addDoor(R, o) { R.doors.push(o); }
function addItemDef(R, o) { R.itemDefs.push(o); }
function addEnemyDef(R, o) { R.enemyDefs.push(o); }
function addCam(R, o) { R.cams.push(o); }
// しらべる ばしょ（なぞとき）。中身は logic.js の SPOTS が きめる
function addSpot(R, o) { R.spots.push(Object.assign({ r: 1.35 }, o)); }

function populateAllRooms() {
  for (const R of Object.values(ROOMS)) {
    R.enemies = R.enemyDefs.map(def => spawnEnemyEntity(R, def)).filter(Boolean);
    R.items = R.itemDefs.map(def => spawnItemEntity(R, def)).filter(Boolean);
  }
}

/* ============================================================
   2ねん1くみ
   ============================================================ */
function buildClassroom() {
  const R = roomBase('classroom', '2ねん1くみ', -4.5, 4.5, -3.5, 3.5, 3.2, { amb: 0x5a5d72, ambI: .5, fogD: .038 });
  const floor = tm(tiled(TEX.wood, 4, 3)); const wall = tm(tiled(TEX.wall, 4, 1));
  roomFloor(R, TEX.wood, 4, 3); roomCeiling(R, TEX.ceiling, 5, 4);
  roomWalls(R, wall, tm(tiled(TEX.wallGreen, 5, 1)));
  // 黒板
  R.board = plane(4.2, 1.25, tm(TEX.boardScribble), 0, 1.78, -3.43, 0, 0, R.scene);
  box(4.4, 1.38, .08, pm(0x4d3a25), 0, 1.78, -3.48, R.scene);
  box(4.2, .07, .22, pm(0x6a5237), 0, 1.11, -3.38, R.scene);
  // 教卓
  box(1.75, .1, .72, pm(0x6b4828), 0, .85, -2.68, R.scene);
  box(1.5, .78, .58, pm(0x4a311b), 0, .45, -2.68, R.scene);
  collideBox(R, 0, -2.68, 1.75, .72);
  // 机と いす
  const deskMat = tm(TEX.deskTop, { color: 0xd8b888 }), legMat = pm(0x4f4f4f), chairMat = pm(0x3f5b7a);
  for (const [x, z] of [[-1.7, -1.0], [0, -1.0], [1.7, -1.0], [-1.7, .75], [0, .75], [1.7, .75]]) {
    box(.95, .07, .55, deskMat, x, .62, z, R.scene);
    for (const [dx, dz] of [[-.4, -.22], [.4, -.22], [-.4, .22], [.4, .22]]) box(.045, .6, .045, legMat, x + dx, .31, z + dz, R.scene);
    const seat = box(.5, .07, .45, chairMat, x, .42, z + .62, R.scene);
    const back = box(.5, .5, .06, chairMat, x, .67, z + .83, R.scene);
    (R.props.chairs = R.props.chairs || []).push([seat, back]);
    for (const dx of [-.2, .2]) box(.04, .42, .04, legMat, x + dx, .21, z + .62, R.scene);
    for (const dx of [-.2, .2]) box(.04, .42, .04, legMat, x + dx, .21, z + .83, R.scene);
    collideBox(R, x, z, .95, .55);
  }
  // ぼくの つくえ（しゅくだいの ノートが 入っている）
  box(.24, .025, .32, bm(0x3a6ad8), 1.7, .67, .75, R.scene);
  box(.2, .028, .06, bm(0xf0ead8), 1.7, .675, .66, R.scene);
  // 窓（東）
  for (const z of [-1.8, 0, 1.8]) windowPanel(R, 4.40, 1.78, z, 1.45, 1.5, -Math.PI / 2);
  // 掲示物
  plane(.8, 1.05, tm(TEX.poster), -4.42, 1.7, 1.4, 0, Math.PI / 2, R.scene);
  plane(.55, .7, tm(TEX.paper), 4.42, 1.5, -2.5, 0, -Math.PI / 2, R.scene);
  // 蛍光灯
  const L1 = ceilLamp(R, 0, -1.2, 0xffe3b2, .52, 12);
  const L2 = ceilLamp(R, 0, 1.4, 0xffe3b2, .45, 10);
  R.flickers.push({ light: L2, base: .45, ph: 1.7 });
  const moon = new THREE.PointLight(0x8ea6e8, .35, 9, 1); moon.position.set(3.7, 2.2, 1.2); R.scene.add(moon);
  // ドア
  doorPanel(R, 2.95, 3.43, Math.PI);
  addDoor(R, { x: 2.95, z: 3.02, label: 'ろうかへ でる', target: 'corridor', spawn: { x: -1.15, z: 3.0, a: Math.PI / 2 } });
  // カメラ
  addCam(R, { pos: [3.9, 2.9, 3.0], look: [-1.2, .65, -2.2], zone: { x0: -9, x1: 9, z0: -9, z1: .4 } });
  addCam(R, { pos: [3.8, 2.95, 3.25], look: [1.3, .72, .75], fov: 80, zone: { x0: -9, x1: 9, z0: .4, z1: 9 } });
  // もの
  addItemDef(R, { id: 'eraser', type: 'eraser', x: 0, z: -2.68, y: .9, label: 'こくばんけしを とる' });
  addItemDef(R, { id: 'key_staff', type: 'key', x: 2.6, z: -1.9, y: .1, hiddenUntil: 'classroom', label: 'かぎを とる' });
  addItemDef(R, { id: 'herb_class', type: 'herb', x: -3.55, z: 2.55, y: .05, label: 'おまもりの はっぱを とる' });
  // なぞとき
  addSpot(R, { id: 'board', x: -1.3, z: -3.0 });
  addSpot(R, { id: 'homework', x: 1.7, z: .75, r: 1.0 });
  // おばけ
  addEnemyDef(R, { id: 'c_uwabaki', type: 'uwabaki', x: -2.7, z: -1.5, wake: 5.0 });
  addEnemyDef(R, { id: 'c_randoseru', type: 'randoseru', x: 1.9, z: -1.9, wake: 6.5 });
  return R;
}

/* ============================================================
   2かい ろうか
   ============================================================ */
function buildCorridor() {
  const R = roomBase('corridor', '2かい ろうか', -1.7, 1.7, -11, 11, 3.2, { amb: 0x4b5473, ambI: .46, fogD: .05 });
  roomFloor(R, TEX.tile, 2, 13); roomCeiling(R, TEX.ceiling, 2, 15);
  roomWalls(R, tm(tiled(TEX.wall, 2, 1)), tm(tiled(TEX.wallGreen, 2, 1)));
  // 窓（西）
  for (const z of [-8, -4, 0, 4, 8]) windowPanel(R, -1.60, 1.82, z, 1.45, 1.52, Math.PI / 2);
  // ロッカー（東）
  const lockerMat = tm(TEX.locker);
  for (let z = -9.6; z <= 9.4; z += 1.15) {
    if (Math.abs(z + 3) < .9 || Math.abs(z - 5) < .9) continue;
    const locker = box(.55, 1.45, .34, lockerMat, 1.42, .74, z, R.scene);
    (R.props.lockers = R.props.lockers || []).push({ z: Math.round(z * 100) / 100, mesh: locker });
    box(.57, .05, .36, pm(0x3e444a), 1.42, 1.48, z, R.scene);
    collideBox(R, 1.42, z, .55, .34);
  }
  // 掲示板
  plane(1.1, .9, tm(TEX.poster), 1.63, 1.65, -7.4, 0, -Math.PI / 2, R.scene);
  // 3ばんめ＝7 の 札（掲示の そばに 貼ってある。ロッカーの さぎょうを 避けて 置く）
  plane(.55, .24, tm(TEX.posterNote), 1.61, 1.5, -7.78, 0, -Math.PI / 2, R.scene);
  // 消火器
  cyc(.09, .09, .5, 7, pm(0xa33a31), -1.45, .25, 6.8, R.scene);
  // 天井の 明かり（1本は ちらつく）
  const a = ceilLamp(R, 0, -7.6, 0xd8e4bd, .42, 9);
  const b = ceilLamp(R, 0, -2.4, 0xd8e4bd, .36, 8);
  const c = ceilLamp(R, 0, 2.4, 0xd8e4bd, .38, 8);
  const d = ceilLamp(R, 0, 7.4, 0xd8e4bd, .40, 8);
  R.flickers.push({ light: b, base: .36, ph: 0.4 }, { light: d, base: .40, ph: 2.1 });
  // ドア
  doorPanel(R, -1.64, 3, Math.PI / 2); addDoor(R, { x: -1.22, z: 3, label: '2ねん1くみへ', target: 'classroom', spawn: { x: 2.55, z: 2.65, a: Math.PI } });
  doorPanel(R, 1.64, -3, -Math.PI / 2); addDoor(R, { x: 1.22, z: -3, label: 'しょくいんしつへ', target: 'staff', spawn: { x: -2.3, z: 2.45, a: Math.PI }, lock: 'key' });
  doorPanel(R, 1.64, 5, -Math.PI / 2); addDoor(R, { x: 1.22, z: 5, label: 'たいいくかんへ', target: 'gym', spawn: { x: 0, z: 7.5, a: Math.PI }, lock: 'code' });
  box(.06, .22, .16, bm(0x2a2e34), 1.6, 1.2, 5.65, R.scene); // ばんごうロック
  box(.03, .05, .1, bm(0x9fe88a), 1.57, 1.26, 5.65, R.scene);
  doorPanel(R, 0, 10.94, Math.PI); addDoor(R, { x: 0, z: 10.55, label: 'げんかんへ', target: 'entrance', spawn: { x: 1.6, z: 2.0, a: Math.PI } });
  // カメラ（3つの 固定アングル）
  addCam(R, { pos: [0, 2.78, 3.2], look: [0, .55, -4.6], zone: { x0: -9, x1: 9, z0: -99, z1: 0 } });
  addCam(R, { pos: [0, 2.78, 9.8], look: [0, .55, 3.1], zone: { x0: -9, x1: 9, z0: 0, z1: 7.4 } });
  addCam(R, { pos: [0, 2.95, 10.95], look: [0, .5, 8.7], fov: 70, zone: { x0: -9, x1: 9, z0: 7.4, z1: 99 } });
  // もの
  addItemDef(R, { id: 'battery', type: 'battery', x: 1.1, z: -8.4, y: .05, label: 'でんちを とる' });
  addItemDef(R, { id: 'herb_corridor', type: 'herb', x: -1.1, z: 8.2, y: .05, label: 'おまもりの はっぱを とる' });
  addItemDef(R, { id: 'note_corridor', type: 'note', x: 1.2, z: -7.2, y: .1, label: 'けいじばんを よむ', text: 'ポスターに おばけの らくがき。「たいいくかんの ばんごう、3ばんめは ７ だよ〜」' });
  addEnemyDef(R, { id: 'h_ghost', type: 'ghost', x: 0, z: -8.6, wake: 6.0 });
  addEnemyDef(R, { id: 'h_randoseru', type: 'randoseru', x: -.75, z: 6.6, wake: 6.0 });
  return R;
}

/* ============================================================
   しょくいんしつ
   ============================================================ */
function buildStaffroom() {
  const R = roomBase('staff', 'しょくいんしつ', -4, 4, -3, 3, 3.2, { amb: 0x55506a, ambI: .44, fogD: .05 });
  roomFloor(R, TEX.wood, 4, 3); roomCeiling(R, TEX.ceiling, 4, 3);
  roomWalls(R, tm(tiled(TEX.wall, 4, 1)), tm(tiled(TEX.wallGreen, 4, 1)));
  // 机
  const deskMat = pm(0x6b4b2b), topMat = tm(TEX.deskTop, { color: 0xe0c8a0 });
  for (const [x, z] of [[-2.1, .3], [0, .3], [2.1, .3]]) {
    box(1.35, .08, .7, topMat, x, .72, z, R.scene);
    box(1.2, .64, .58, deskMat, x, .36, z, R.scene);
    collideBox(R, x, z, 1.35, .7);
  }
  // 書類・電話
  for (const [x, z] of [[-2.1, .3], [2.1, .3]]) box(.32, .04, .24, pm(0xd8d0b8), x, .79, z + .08, R.scene);
  box(.22, .14, .18, pm(0x2c2c32), 0, .83, .3, R.scene);
  // ロッカー / 戸棚
  box(1.3, 2.05, .48, tm(TEX.locker), 2.8, 1.03, -2.62, R.scene);
  collideBox(R, 2.8, -2.62, 1.3, .48);
  box(1.34, .06, .5, pm(0x3a3f44), 2.8, 2.08, -2.62, R.scene);
  // 棚
  const shelf = pm(0x5a3e25);
  box(.45, 2.15, 2.1, shelf, -3.65, 1.08, -1.15, R.scene);
  collideBox(R, -3.65, -1.15, .45, 2.1);
  for (let y = .35; y < 2; y += .55) box(.5, .05, 2.0, pm(0x3f2b19), -3.62, y, -1.15, R.scene);
  // ポット・カップ
  cyc(.11, .13, .3, 7, pm(0x9a9a90), -3.2, .9, 1.55, R.scene);
  for (let i = 0; i < 3; i++) cyc(.05, .05, .09, 6, pm(0xd8d4c4), -1.4 + i * .16, .78, -.1, R.scene);
  // 窓
  windowPanel(R, 3.90, 1.8, 0, 1.4, 1.5, -Math.PI / 2);
  windowPanel(R, 3.90, 1.8, -1.6, 1.1, 1.5, -Math.PI / 2);
  // 掲示
  plane(1.2, .8, tm(TEX.poster), 0, 1.75, -2.94, 0, 0, R.scene);
  // とまった とけい
  plane(.6, .6, tm(TEX.clock), -2.1, 2.2, -2.93, 0, 0, R.scene);
  // 2ばんめ＝1 の 札（とけいの うら）
  plane(.7, .31, tm(TEX.clockNote), -2.1, 1.74, -2.90, 0, 0, R.scene);
  const handM = bm(0x241c14);
  R.clockHands = [box(.03, .22, .02, handM, -2.1, 2.2, -2.91, R.scene), box(.03, .15, .02, handM, -2.1, 2.2, -2.905, R.scene)];
  for (const h of R.clockHands) h.geometry.translate(0, h === R.clockHands[0] ? .1 : .065, 0);
  R.clockHands[1].rotation.z = -1.9;
  plane(.5, .7, tm(TEX.paper), -4.42, 1.5, .8, 0, Math.PI / 2, R.scene);
  // 明かり
  const L = ceilLamp(R, 0, 0, 0xe8e0b8, .55, 11);
  R.flickers.push({ light: L, base: .55, ph: 2.8 });
  const blue = new THREE.PointLight(0x8aa6e8, .3, 8, 1); blue.position.set(3.7, 2.1, 0); R.scene.add(blue);
  // ドア
  doorPanel(R, -2.4, 2.94, Math.PI); addDoor(R, { x: -2.4, z: 2.56, label: 'ろうかへ もどる', target: 'corridor', spawn: { x: 1.05, z: -3, a: -Math.PI / 2 } });
  // カメラ
  addCam(R, { pos: [3.72, 2.78, 2.62], look: [-.65, .6, -.8], zone: { x0: -9, x1: 9, z0: -9, z1: 9 } });
  // もの
  addItemDef(R, { id: 'whistle', type: 'whistle', x: 2.8, z: -2.2, y: .05, label: 'ふえを とる' });
  addItemDef(R, { id: 'note_staff', type: 'note', x: .5, z: -2.6, y: .1, label: 'メモを よむ', text: 'せんせいの メモ「たいいくかんの ばんごうは、わすれないように 3つの ばしょに わけて かいた」' });
  addSpot(R, { id: 'clock', x: -2.1, z: -2.45 });
  addEnemyDef(R, { id: 's_chalk', type: 'chalk', x: 2.1, z: -1.7, wake: 6.2 });
  addEnemyDef(R, { id: 's_ghost', type: 'ghost', x: -2.7, z: -1.4, wake: 5.5 });
  return R;
}

/* ============================================================
   たいいくかん
   ============================================================ */
function buildGym() {
  const R = roomBase('gym', 'たいいくかん', -7, 7, -9, 9, 7, { amb: 0x414965, ambI: .40, fogD: .035, bg: 0x04050a });
  roomFloor(R, TEX.gym, 3, 5); roomCeiling(R, TEX.ceiling, 10, 12);
  roomWalls(R, tm(tiled(TEX.wall, 6, 2)), tm(tiled(TEX.wallGreen, 7, 1)));
  // 舞台
  box(10, .7, 2.5, pm(0x6b4527), 0, .35, -7.75, R.scene);
  box(10.1, .08, 2.6, pm(0x8a5c34), 0, .74, -7.75, R.scene);
  collideBox(R, 0, -7.75, 10, 2.5);
  // 幕
  R.props.curtains = [
    box(1.2, 5.8, .25, tm(tiled(TEX.curtain, 2, 1)), -4.5, 3.3, -8.55, R.scene),
    box(1.2, 5.8, .25, tm(tiled(TEX.curtain, 2, 1)), 4.5, 3.3, -8.55, R.scene),
  ];
  box(10.2, .55, .3, tm(tiled(TEX.curtain, 6, 1)), 0, 6.15, -8.55, R.scene);
  box(10, 4.6, .18, pm(0x1c1a22), 0, 3.1, -8.68, R.scene);
  // バスケットゴール
  for (const x of [-5.9, 5.9]) {
    box(.08, 1.4, .08, pm(0x5c5c5c), x, 3.5, -1, R.scene);
    box(.9, .65, .08, pm(0xd8d4c4), x, 4.05, -.9, R.scene);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.24, .025, 5, 10), pm(0xa14a2c));
    ring.position.set(x, 3.68, -.74); ring.rotation.x = Math.PI / 2; R.scene.add(ring);
  }
  // 観客席のかわりに 長いす
  for (const x of [-6.35, 6.35]) for (let z = 1; z <= 5; z += 1.2) {
    box(.7, .1, .9, pm(0x4a5a6a), x, .5, z, R.scene);
    box(.7, .45, .12, pm(0x3b4854), x, .25, z, R.scene);
    collideBox(R, x, z, .7, .9);
  }
  // ステージの すみに しまってある 長机
  box(2.3, .08, .7, pm(0x6b4b2b), -4.2, .78, -5.7, R.scene);
  box(.1, .75, .1, pm(0x4b4b4b), -5.2, .4, -5.7, R.scene);
  box(.1, .75, .1, pm(0x4b4b4b), -3.2, .4, -5.7, R.scene);
  // 明かり
  const L1 = ceilLamp(R, -4, -2, 0xdce8d0, .55, 14);
  const L2 = ceilLamp(R, 4, -2, 0xdce8d0, .50, 14);
  const L3 = ceilLamp(R, 0, 5, 0xdce8d0, .45, 13);
  R.flickers.push({ light: L2, base: .50, ph: 1.2 });
  const red = new THREE.PointLight(0xff4a3a, .35, 8, 1); red.position.set(0, 3, 8); R.scene.add(red);
  const stageL = new THREE.PointLight(0xffc189, .85, 13, 1); stageL.position.set(0, 3.4, -5.4); R.scene.add(stageL);
  // ドア
  doorPanel(R, 0, 8.94, Math.PI); addDoor(R, { x: 0, z: 8.54, label: 'ろうかへ もどる', target: 'corridor', spawn: { x: 1.05, z: 5, a: -Math.PI / 2 } });
  // カメラ
  addCam(R, { pos: [6.4, 4.4, 8.4], look: [-1.5, 1.4, 3.0], zone: { x0: -9, x1: 9, z0: 6.2, z1: 99 } });
  addCam(R, { pos: [6.35, 5.0, 7.35], look: [0, 1.05, -1.5], zone: { x0: -9, x1: 9, z0: 3, z1: 6.2 } });
  addCam(R, { pos: [0, 5.05, 4.3], look: [0, 1.1, -5.2], zone: { x0: -9, x1: 9, z0: -99, z1: 3 } });
  R.bossCam = { pos: [6.35, 5.0, 7.35], look: [0, 1.05, -1.5] };
  // もの
  addItemDef(R, { id: 'herb_gym', type: 'herb', x: -5.4, z: 2.2, y: .05, label: 'おまもりの はっぱを とる' });
  addSpot(R, { id: 'stage', x: 0, z: -5.9, r: 1.6 });
  // おばけ
  addEnemyDef(R, { id: 'g_uwabaki1', type: 'uwabaki', x: -4.4, z: -1.2, wake: 8.0 });
  addEnemyDef(R, { id: 'g_uwabaki2', type: 'uwabaki', x: 4.4, z: 1.2, wake: 8.0 });
  addEnemyDef(R, { id: 'g_boss', type: 'locker', x: 0, z: -6.2, y: .05, boss: true, wake: 99 });
  return R;
}

/* ============================================================
   げんかん
   ============================================================ */
function buildEntrance() {
  const R = roomBase('entrance', 'げんかん', -5, 5, -4, 4, 3.5, { amb: 0x46506e, ambI: .42, fogD: .05, bg: 0x04050b });
  roomFloor(R, TEX.tile, 4, 4); roomCeiling(R, TEX.ceiling, 6, 5);
  roomWalls(R, tm(tiled(TEX.wall, 5, 1)), tm(tiled(TEX.wallGreen, 5, 1)));
  // 下駄箱
  for (const x of [-4.35, 4.35]) {
    box(.62, 2.3, 3.8, tm(tiled(TEX.shoe, 2, 3)), x, 1.15, .3, R.scene);
    box(.66, .06, 3.9, pm(0x3f2b1a), x, 2.3, .3, R.scene);
    collideBox(R, x, .3, .62, 3.8);
  }
  // 校門（ガラス戸）
  plane(3.4, 2.7, tm(TEX.window, { color: 0xa8c0ff }), 0, 1.6, -3.90, 0, 0, R.scene);
  box(3.6, .12, .2, pm(0x5b6468), 0, 2.99, -3.88, R.scene);
  box(.12, 2.9, .2, pm(0x5b6468), -1.78, 1.45, -3.88, R.scene);
  box(.12, 2.9, .2, pm(0x5b6468), 1.78, 1.45, -3.88, R.scene);
  for (const x of [-.6, .6]) box(.08, 2.7, .12, pm(0x5b6468), x, 1.55, -3.86, R.scene);
  // 看板
  box(2.2, .34, .08, bm(0xc9c0a6), 0, 3.25, -3.9, R.scene);
  // 傘立て・靴
  cyc(.16, .18, .5, 7, pm(0x3f5b6a), -4.0, .25, 3.1, R.scene);
  for (let i = 0; i < 3; i++) box(.28, .1, .18, pm(0x2a2a30), 2.8 + i * .34, .05, 3.0, R.scene);
  // 天井の 明かり
  const L1 = ceilLamp(R, 0, 0, 0xe8dfb8, .45, 10);
  const L2 = ceilLamp(R, 0, 2.6, 0xe8dfb8, .36, 9);
  R.flickers.push({ light: L1, base: .45, ph: .7 });
  const moon = new THREE.PointLight(0x8ea6e8, .5, 9, 1); moon.position.set(0, 2.2, -3.2); R.scene.add(moon);
  // ドア
  doorPanel(R, 2.8, 3.94, Math.PI); addDoor(R, { x: 2.8, z: 3.52, label: 'ろうかへ もどる', target: 'corridor', spawn: { x: 0, z: 10.2, a: Math.PI } });
  // カメラ
  addCam(R, { pos: [4.4, 2.7, 3.8], look: [-.6, .9, -2.6], zone: { x0: -9, x1: 9, z0: -9, z1: 9 } });
  // もの
  addItemDef(R, { id: 'note_entrance', type: 'note', x: -3.9, z: -1.2, y: .1, label: 'はりがみを よむ', text: 'げたばこの はりがみ「おばけが あばれた へやを もとに もどすと、がっこうが めを さます」' });
  addSpot(R, { id: 'gate', x: 0, z: -3.25, r: 1.5 });
  return R;
}

/* ============================================================
   全室
   ============================================================ */
function buildRooms() {
  buildClassroom();
  buildCorridor();
  buildStaffroom();
  buildGym();
  buildEntrance();
}
