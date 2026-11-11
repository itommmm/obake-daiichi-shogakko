/* ============================================================
   おばけ第一小学校 PS1版 : なぞとき だっしゅつの ルール / 操作 / HUD
   ながれ：げんかんで とじこめられる → 3つの へやを もとに もどす → ドアが あく
   ============================================================ */
'use strict';

let gameCam = null;
let lastCamDef = null;
let fadeEl = null, flashEl = null, pauseVeil = null;
let titleShown = true;

const HP_MAX = 4;
const BOSS_HP = 1;
const FIX_ROOMS = ['classroom', 'staff', 'gym'];
const GYM_CODE = [5, 1, 7];
const ITEM_NAMES = { eraser: 'こくばんけし', key_staff: 'しょくいんしつの かぎ', battery: 'でんち', whistle: 'ふえ' };
const START = { room: 'entrance', x: 0, z: -2.4, a: 0 };

/* ===== もの / おばけの 生成 ===== */
function enemyMax(type) {
  return type === 'uwabaki' ? 1 : type === 'randoseru' ? 2 : type === 'chalk' ? 1 : type === 'locker' ? BOSS_HP : 2;
}
function spawnEnemyEntity(R, def) {
  if (!def) return null;
  const group = buildGhost(def.type);
  group.position.set(def.x, def.y || 0, def.z);
  R.scene.add(group);
  const e = {
    id: def.id, type: def.type, def, group, boss: !!def.boss, roomId: R.id,
    hp: enemyMax(def.type), max: enemyMax(def.type),
    x: def.x, z: def.z, baseY: def.y || 0,
    t: rnd(0, 9), phase: rnd(0, TAU),
    awake: false, dead: false, flash: 0, stagger: 0,
    windup: 0, cd: rnd(.4, 1.2), atkCd: 0,
    speed: def.type === 'uwabaki' ? 1.15 : def.type === 'randoseru' ? .72 : def.type === 'chalk' ? .8 : .62,
    wake: def.wake == null ? 6 : def.wake,
    mode: 'idle', timer: 0, phase2: false, summoned: false,
    vx: 0, vz: 0,
  };
  if (e.boss) { e.speed = .40; e.cd = 2.6; }
  if (enemyGone(e)) { e.dead = true; e.group.visible = false; }
  return e;
}
function spawnItemEntity(R, def) {
  const group = buildItem(def.type);
  group.position.set(def.x, def.y || 0, def.z);
  R.scene.add(group);
  const it = {
    id: def.id, type: def.type, def, group,
    taken: G.taken.includes(def.id),
  };
  group.visible = itemVisible(it);
  return it;
}
// へやが もとに もどると、その へやの おばけは いなくなる。ぜんぶ もどれば 学校じゅう いなくなる
function enemyGone(e) {
  return G.dead.includes(e.id) || G.fixed.includes(e.roomId) || G.fixed.length >= FIX_ROOMS.length || (e.boss && G.bossDead);
}
function itemVisible(it) {
  return !it.taken && (!it.def.hiddenUntil || G.fixed.includes(it.def.hiddenUntil));
}
function applyWorldFlags() {
  for (const R of Object.values(ROOMS)) {
    for (const it of R.items || []) {
      it.taken = G.taken.includes(it.id);
      it.group.visible = itemVisible(it);
    }
    for (const e of R.enemies || []) {
      const gone = enemyGone(e);
      e.dead = gone; e.group.visible = !gone;
      if (gone && e.boss) { e.awake = false; }
    }
  }
  applyRoomLooks();
}
// もとに もどった へやの 見た目（こくばん・とけい・明かり）
function applyRoomLooks() {
  const C = ROOMS.classroom, S = ROOMS.staff;
  if (C && C.board) { C.board.material.map = G.fixed.includes('classroom') ? TEX.blackboard : TEX.boardScribble; C.board.material.needsUpdate = true; }
  for (const R of Object.values(ROOMS)) {
    if (R.baseLight == null) R.baseLight = R.lights.map(L => L.intensity);
    const on = G.fixed.includes(R.id) || G.fixed.length >= FIX_ROOMS.length;
    R.lights.forEach((L, i) => { L.intensity = R.baseLight[i] * (on ? 1.45 : 1); });
    R.calm = on;
  }
  if (S && S.clockHands && !G.fixed.includes('staff')) S.clockHands[0].rotation.z = 0;
}
function resetWorld() {
  G.hp = HP_MAX; G.herbs = 0;
  G.time = 0; G.damage = 0;
  G.bag = []; G.fixed = []; G.flags = {}; G.lock = null;
  G.taken = []; G.dead = []; G.bossDead = false; G.bossFight = false; G.boss = null;
  G.msg = ''; G.msgT = 0; G.prompt = ''; G.roomTitle = 0; G.autosave = 0;
  G.invuln = 0; G.hurt = 0; G.flash = 0;
  G.projectiles = []; G.fx3 = []; G.sparks = [];
  for (const R of Object.values(ROOMS)) {
    for (const it of R.items || []) { it.taken = false; it.group.visible = itemVisible(it); }
    for (const e of R.enemies || []) {
      e.dead = false; e.hp = e.max; e.awake = false; e.flash = 0; e.windup = 0; e.stagger = 0;
      e.cd = rnd(.4, 1.2); e.atkCd = 0; e.mode = 'idle'; e.timer = 0; e.phase2 = false; e.summoned = false;
      e.x = e.def.x; e.z = e.def.z; e.baseY = e.def.y || 0;
      e.group.visible = true; e.group.position.set(e.x, e.baseY, e.z);
    }
  }
  applyRoomLooks();
  ComicHorror.reset();
  AdventureUI.suspend();
}

/* ===== 固定カメラ ===== */
function makeGameCamera() {
  if (!gameCam) gameCam = new THREE.PerspectiveCamera(55, 4 / 3, .05, 70);
}
function applyCam(c) {
  if (!c) return;
  gameCam.position.set(c.pos[0], c.pos[1], c.pos[2]);
  gameCam.lookAt(c.look[0], c.look[1], c.look[2]);
  gameCam.fov = c.fov || 55; gameCam.aspect = 4 / 3;
  gameCam.near = .05; gameCam.far = 70;
  gameCam.updateProjectionMatrix();
  activeCam = gameCam;
}
// どちらの操作モードもPS1版本来の固定カメラを使用。
// 広い廊下では決められた区画の境界でだけカメラを切り替える。
function updateCamera(force) {
  if (!activeRoom) return;
  let c;
  if (activeRoom.id === 'gym' && G.bossFight && activeRoom.bossCam) c = activeRoom.bossCam;
  else {
    const p = G.p;
    c = activeRoom.cams.find(o =>
      p.x >= o.zone.x0 && p.x <= o.zone.x1 &&
      p.z >= o.zone.z0 && p.z <= o.zone.z1) || activeRoom.cams[0];
  }
  if (force || c !== lastCamDef) {
    lastCamDef = c;
    applyCam(c);
    if (!force && G.state === 'play') SFX.camera();
  }
}

/* ===== 部屋の 出入り ===== */
function enterRoom(id, spawn, silent) {
  AdventureUI.suspend();
  const R = ROOMS[id] || ROOMS.classroom;
  G.room = R.id;
  activeRoom = R;
  G.p.x = spawn.x; G.p.z = spawn.z; G.p.a = spawn.a == null ? Math.PI : spawn.a;
  G.p.walk = 0; G.p.moving = 0;
  G.projectiles = []; G.fx3 = []; G.sparks = [];
  G.prompt = '';
  if (kid) {
    R.scene.add(kid);
    kid.position.set(G.p.x, 0, G.p.z); kid.rotation.y = G.p.a;
    kid.userData.gun.visible = false; // みずでっぽうは もっていない
    R.scene.add(flash); R.scene.add(flashTarget); flash.target = flashTarget;
  }
  G.bossFight = false; lastCamDef = null;
  updateCamera(true);
  ComicHorror.enter(id);
  G.roomTitle = 2.4; G.roomTitleText = R.name;
  if (!silent) saveGame();
}
function changeRoom(door) {
  if (G.state !== 'play' || G.trans) return;
  AdventureUI.suspend();
  G.trans = { t: 0, door, switched: false };
  G.state = 'transition';
  fadeEl.style.opacity = '1';
  SFX.door();
}
function updateTransition(dt) {
  const tr = G.trans; if (!tr) return;
  tr.t += dt;
  if (!tr.switched && tr.t >= .28) {
    tr.switched = true;
    enterRoom(tr.door.target, tr.door.spawn, true);
  }
  if (tr.t >= .62) {
    G.trans = null; G.state = 'play'; fadeEl.style.opacity = '0';
    lastCamDef = null; updateCamera(true);
  }
}

/* ===== プレイヤー ===== */
function blocked(x, z) {
  const R = activeRoom; if (!R) return true;
  const r = .24;
  const b = R.bounds;
  if (x < b.x0 + r || x > b.x1 - r || z < b.z0 + r || z > b.z1 - r) return true;
  for (const c of R.colliders) {
    if (x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r) return true;
  }
  return false;
}
function tryMove(dx, dz) {
  const p = G.p;
  if (!blocked(p.x + dx, p.z)) p.x += dx;
  if (!blocked(p.x, p.z + dz)) p.z += dz;
}
function inputDown(name) {
  if (G.keys[name]) return true;
  const map = { up: 'up', down: 'down', left: 'left', right: 'right' };
  return !!G.touch[map[name]];
}
function updatePlayer(dt) {
  if (!activeRoom || G.state !== 'play') return;
  const autoMoved = AdventureUI.autoStep(dt);
  if (G.state !== 'play') return;
  const p = G.p;
  const up = inputDown('up'), down = inputDown('down'), left = inputDown('left'), right = inputDown('right');
  const joyX = G.touch.joyX || 0, joyY = G.touch.joyY || 0;
  const run = !!(G.keys.ShiftLeft || G.keys.ShiftRight) ||
    (G.mode === 'modern' && Math.hypot(joyX, joyY) > .92);
  let moving = autoMoved ? 1 : 0;
  if (G.mode === 'tank') {
    // クラシック：左右で向きを変え、前後で移動。
    if (left) p.a += 2.25 * dt;
    if (right) p.a -= 2.25 * dt;
    const f = (up ? 1 : 0) - (down ? 1 : 0);
    if (f) {
      const sp = (run ? 2.65 : 1.55) * f;
      const beforeX = p.x, beforeZ = p.z;
      tryMove(Math.sin(p.a) * sp * dt, Math.cos(p.a) * sp * dt);
      moving = Math.hypot(p.x - beforeX, p.z - beforeZ) > .0005 ? 1 : 0;
    }
  } else {
    // スティック／WASD：画面の上下左右に合わせて直接移動。
    // 一度倒したらカメラが切り替わっても「離すまで」同じ世界方向を維持する。
    // カメラのアングルに依存させず、画面内の左右は常にX軸の左右に固定する。
    // 全固定カメラは北向きに統一してあるので、部屋の移動でも方向が反転しない。
    let ix = (right ? 1 : 0) - (left ? 1 : 0) + joyX;
    let iz = (up ? 1 : 0) - (down ? 1 : 0) - joyY;
    const length = Math.hypot(ix, iz);
    if (length > .12) {
      const strength = Math.min(1, length);
      // カメラ切り替えに無関係な世界座標。右が +X、上が -Z。
      const mx = ix / length;
      const mz = -iz / length;
      const beforeX = p.x, beforeZ = p.z;
      const speed = (run ? 2.8 : 1.9) * strength;
      tryMove(mx * speed * dt, mz * speed * dt);
      moving = Math.hypot(p.x - beforeX, p.z - beforeZ) > .0005 ? 1 : 0;
      if (moving) p.a = Math.atan2(mx, mz);
    }
  }
  p.moving = moving;
  if (moving) p.walk += dt * (run ? 10 : 7); else p.walk *= Math.max(0, 1 - dt * 8);
  kid.position.set(p.x, 0, p.z); kid.rotation.y = p.a;
  const u = kid.userData;
  const sw = moving ? Math.sin(p.walk) * (run ? .62 : .42) : 0;
  u.legL.rotation.x = sw; u.legR.rotation.x = -sw;
  u.armR.rotation.x = -sw * .55; u.armL.rotation.x = sw * .55;
  u.gun.visible = false;
  const fx = Math.sin(p.a), fz = Math.cos(p.a);
  flash.position.set(p.x + fx * .12, 1.05, p.z + fz * .12);
  flashTarget.position.set(p.x + fx * 5.2, .38, p.z + fz * 5.2);
  flash.intensity = 2.0;
  if (moving) {
    G.footT -= dt;
    if (G.footT <= 0) { G.footT = run ? .28 : .42; SFX.step(); }
  } else G.footT = 0;
  updateCamera(false);
}

/* ===== おばけ ===== */
function setGhostFlash(e, on) {
  const mats = e.group.userData.mats || [];
  for (const m of mats) {
    if (on) { if (!m.userData.base) m.userData.base = m.color.clone(); m.color.setRGB(1.6, .35, .3); }
    else if (m.userData.base) m.color.copy(m.userData.base);
  }
}
function updateGhost(e, dt) {
  const g = e.group;
  const dx = G.p.x - e.x, dz = G.p.z - e.z, d = Math.hypot(dx, dz) || .001;
  g.position.x = e.x; g.position.z = e.z;
  g.position.y = e.baseY + Math.sin(e.t * 2 + e.phase) * .055;
  g.rotation.y = Math.atan2(dx, dz);
  if (e.flash > 0) { e.flash -= dt; setGhostFlash(e, e.flash > 0); }
  if (!e.awake) {
    if (d < e.wake && d < 10) {
      e.awake = true;
      if (Math.random() < .5) SFX.ghost();
    } else {
      e.x = e.def.x + Math.sin(e.t * .4 + e.phase) * .25;
      return;
    }
  }
  if (e.stagger > 0) { e.stagger -= dt; return; }
  if (e.windup > 0) {
    e.windup -= dt;
    g.position.y += .08;
    setGhostFlash(e, true);
    if (e.windup <= 0) {
      setGhostFlash(e, false);
      if (d < 1.65) {
        hurtPlayer(e.type);
        e.stagger = 2.9; // おどかしたら すこし うしろに とびのく
        const b = activeRoom.bounds;
        e.x = clamp(e.x - dx / d * 1.55, b.x0 + .4, b.x1 - .4);
        e.z = clamp(e.z - dz / d * 1.55, b.z0 + .4, b.z1 - .4);
      }
      e.cd = 4.2;
    }
    return;
  }
  e.cd -= dt; e.atkCd -= dt;
  if (d < 1.25 && e.cd <= 0) {
    e.windup = .55; SFX.alert();
  } else if (d < 8.5 && d > 1.0) {
    const sp = e.speed * (G.state === 'play' ? 1 : 0);
    e.x += dx / d * sp * dt; e.z += dz / d * sp * dt;
    const b = activeRoom.bounds;
    e.x = clamp(e.x, b.x0 + .35, b.x1 - .35);
    e.z = clamp(e.z, b.z0 + .35, b.z1 - .35);
  }
}
// ロッカーだいおう：たおせない。ゆっくり おいかけて、ときどき とっしん（よこに よければ かわせる）
function updateBoss(e, dt) {
  const g = e.group;
  const dx = G.p.x - e.x, dz = G.p.z - e.z, d = Math.hypot(dx, dz) || .001;
  g.position.x = e.x; g.position.z = e.z;
  g.position.y = e.baseY + Math.sin(e.t * 1.5) * .04;
  g.rotation.y = Math.atan2(dx, dz);
  if (e.flash > 0) { e.flash -= dt; setGhostFlash(e, e.flash > 0); }
  if (!e.awake) {
    if (G.room === 'gym' && G.p.z < 4.2 && !G.bossDead) {
      e.awake = true; G.bossFight = true; G.boss = e;
      SFX.comicScare('locker'); say('ロッカーだいおうが おどりだした！ ステージで なにか できないかな？', 3);
      lastCamDef = null; updateCamera(true);
    }
    return;
  }
  if (e.dead) return;
  e.atkCd -= dt;
  if (e.mode === 'wind') {
    e.timer -= dt; g.position.y += .05;
    setGhostFlash(e, Math.sin(e.t * 30) > 0);
    if (e.timer <= 0) { setGhostFlash(e, false); e.mode = 'charge'; e.timer = .6; }
    return;
  }
  if (e.mode === 'charge') {
    e.timer -= dt;
    e.x += e.vx * dt; e.z += e.vz * dt;
    const b = activeRoom.bounds;
    e.x = clamp(e.x, b.x0 + .7, b.x1 - .7); e.z = clamp(e.z, b.z0 + .7, b.z1 - .7);
    if (d < 1.15 && e.atkCd <= 0) { hurtPlayer('locker'); e.atkCd = 3.5; }
    if (e.timer <= 0) { e.mode = 'idle'; e.cd = 4.2; }
    return;
  }
  e.cd -= dt;
  if (d > 2.4) {
    const sp = e.speed * (G.state === 'play' ? 1 : 0);
    e.x += dx / d * sp * dt; e.z += dz / d * sp * dt;
  }
  if (d < 1.2 && e.atkCd <= 0) { hurtPlayer('locker'); e.atkCd = 3.5; }
  if (e.cd <= 0) {
    e.mode = 'wind'; e.timer = .95;
    e.vx = dx / d * 2.6; e.vz = dz / d * 2.6;
    SFX.comicScare('boing'); say('ロッカーだいおう、ズッコケ とっしん！', 1.7);
  }
}
function updateEnemies(dt) {
  if (!activeRoom) return;
  for (const e of activeRoom.enemies) {
    if (e.dead) continue;
    e.t += dt;
    if (e.boss) updateBoss(e, dt); else updateGhost(e, dt);
  }
}
function spawnParticles(x, y, z, color, n) {
  if (!activeRoom) return;
  const geo = new THREE.BoxGeometry(.07, .07, .07);
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geo, bm(color, { transparent: true, opacity: .9 }));
    m.position.set(x + rnd(-.15, .15), y + rnd(-.15, .15), z + rnd(-.15, .15));
    activeRoom.scene.add(m);
    G.fx3.push({ mesh: m, vx: rnd(-2.2, 2.2), vy: rnd(.6, 3), vz: rnd(-2.2, 2.2), t: 0, life: rnd(.35, .7) });
  }
}
function updateParticles(dt) {
  for (const p of G.fx3) {
    p.t += dt; p.vy -= 7 * dt;
    p.mesh.position.x += p.vx * dt; p.mesh.position.y += p.vy * dt; p.mesh.position.z += p.vz * dt;
    if (p.mesh.position.y < .04) { p.mesh.position.y = .04; p.vy *= -.3; p.vx *= .7; p.vz *= .7; }
    p.mesh.material.opacity = Math.max(0, 1 - p.t / p.life);
    p.mesh.rotation.x += dt * 8; p.mesh.rotation.y += dt * 6;
  }
  for (const p of G.fx3) if (p.t >= p.life) { p.mesh.removeFromParent(); }
  G.fx3 = G.fx3.filter(p => p.t < p.life);
}
function addSparks(x, y, z, color, n) {
  const s = projectToScreen(x, y, z);
  for (let i = 0; i < n; i++) {
    G.sparks.push({ x: s.x, y: s.y, vx: rnd(-60, 60), vy: rnd(-70, 10), t: 0, life: rnd(.2, .5), c: color });
  }
}

/* ===== ダメージ ===== */
// おばけは驚かせるだけ。接触してもHPは減らない。
// PS1版には「死亡」「GAME OVER」は存在しない（セーブ形式も変わらない）。
function hurtPlayer(kind = 'ghost') {
  if (G.state !== 'play' || G.invuln > 0) return;
  if (ComicHorror.scare(kind)) G.hurt = G.fx ? .20 : 0;
}

/* ===== 調べる / とる ===== */
function nearestItem() {
  if (!activeRoom) return null;
  let best = null, bd = 1.25;
  for (const it of activeRoom.items || []) {
    if (it.taken || !it.group.visible) continue;
    const d = dist2(G.p.x, G.p.z, it.def.x, it.def.z);
    if (d < bd) { bd = d; best = it; }
  }
  return best;
}
function nearestDoor() {
  if (!activeRoom) return null;
  let best = null, bd = 1.45;
  for (const d of activeRoom.doors || []) {
    const dd = dist2(G.p.x, G.p.z, d.x, d.z);
    if (dd < bd) { bd = dd; best = d; }
  }
  return best;
}
function nearestSpot() {
  if (!activeRoom) return null;
  let best = null, bd = 99;
  for (const sp of activeRoom.spots || []) {
    const d = dist2(G.p.x, G.p.z, sp.x, sp.z);
    if (d < sp.r && d < bd) { bd = d; best = sp; }
  }
  return best;
}
const has = id => G.bag.includes(id);
function pickupItem(it) {
  if (!it || it.taken) return;
  if (it.type === 'note') { SFX.comicScare('paper'); say(it.def.text, 5); return; }
  it.taken = true;
  if (!G.taken.includes(it.id)) G.taken.push(it.id);
  it.group.visible = false;
  SFX.pickup();
  if (it.type === 'herb') {
    G.herbs++;
    say('おまもりの はっぱを てに いれた！', 1.8);
  } else {
    if (!G.bag.includes(it.id)) G.bag.push(it.id);
    const hint = {
      eraser: 'こくばんけしを てに いれた。',
      key_staff: 'しょくいんしつの かぎを てに いれた！',
      battery: 'でんちを てに いれた。なにかに つかえそう。',
      whistle: 'ふえを てに いれた。たいいくの せんせいの ふえだ。',
    }[it.id] || `${ITEM_NAMES[it.id] || it.id}を てに いれた。`;
    say(hint, 2.4);
  }
  saveGame(); updateInvUI();
}
// へやを もとに もどす
function restoreRoom(id, text) {
  if (G.fixed.includes(id)) return;
  G.fixed.push(id);
  if (id === 'gym') { G.bossDead = true; G.bossFight = false; G.boss = null; }
  if (activeRoom) {
    for (const e of activeRoom.enemies) if (!e.dead && enemyGone(e)) {
      spawnParticles(e.x, .8, e.z, 0xe8e2ff, 10);
    }
  }
  applyWorldFlags();
  G.flash = G.fx ? .35 : 0; ComicHorror.solve(id);
  const n = G.fixed.length;
  say(n >= FIX_ROOMS.length
    ? `${text} がっこうが ぜんぶ もとに もどった！ げんかんへ！`
    : `${text}（もどした ${n}/${FIX_ROOMS.length}）`, 4);
  lastCamDef = null; updateCamera(true);
  saveGame(); updateInvUI();
}
const SPOTS = {
  board: {
    label: () => G.fixed.includes('classroom') ? 'こくばんを よむ' : 'こくばんを しらべる',
    act() {
      if (G.fixed.includes('classroom')) return say('こくばん「たいいくかんの ばんごう 1ばんめ＝5」', 3);
      if (!has('eraser')) { SFX.comicScare('chalk'); return say('らくがきで いっぱい。こくばんけしが あれば…', 3); }
      restoreRoom('classroom', 'らくがきを けした！ 2ねん1くみが もとに もどった！');
    },
  },
  homework: {
    label: () => 'ぼくの つくえを しらべる',
    act() {
      if (!G.flags.homework) ComicHorror.scare('book','homework-prank');
      G.flags.homework = true;
      say('しゅくだいの ノートだ。…いまは それどころじゃない！ あとで あとで！', 3.6);
    },
  },
  clock: {
    label: () => G.fixed.includes('staff') ? 'とけいを しらべる' : 'とまった とけいを しらべる',
    act() {
      if (G.fixed.includes('staff')) return say('とけいの うらに「たいいくかんの ばんごう 2ばんめ＝1」', 3);
      if (!has('battery')) {
        SFX.clockTick();
        return say(G.flags.clockMoved ? 'さっき ピクッと うごいたのに…。でんちが ぬかれているみたい。' : 'とけている。でんちが ぬかれているみたい。', 3);
      }
      restoreRoom('staff', 'でんちを いれた！ とけいが うごいた！ しょくいんしつが もとに もどった！');
    },
  },
  stage: {
    label: () => G.fixed.includes('gym') ? 'ステージを しらべる' : (has('whistle') ? 'ふえを ふく' : 'ステージを しらべる'),
    act() {
      if (G.fixed.includes('gym')) return say('ステージは しずかだ。', 1.6);
      if (!has('whistle')) return say('おばけたちが さわいでいる。なにか ひつようだ。', 3);
      SFX.whistle();
      restoreRoom('gym', 'ピーーッ！ おばけたちが せいれつして しずかに なった！');
    },
  },
  gate: {
    label: () => G.fixed.length >= FIX_ROOMS.length ? 'ドアを あける' : 'ドアを しらべる',
    act() {
      if (G.fixed.length >= FIX_ROOMS.length) return finishGame();
      SFX.comicScare('knock');
      say('あかない！ おばけの ちからで とじられている。', 3.4);
    },
  },
};
Object.assign(SPOTS, Discoveries.spots); // 任意の小さな発見（discoveries.js）
function tryDoor(door) {
  if (door.lock === 'key' && !G.flags.staffOpen) {
    if (!has('key_staff')) { SFX.locked(); say('しょくいんしつは かぎが かかっている。', 2); return; }
    G.flags.staffOpen = true; SFX.unlock(); say('かぎで あけた！', 1.6); saveGame();
  }
  if (door.lock === 'code' && !G.flags.gymOpen) { openLock(door); return; }
  changeRoom(door);
}
function interact() {
  if (G.state !== 'play' || G.trans) return;
  const it = nearestItem();
  if (it) { pickupItem(it); return; }
  const sp = nearestSpot();
  if (sp && SPOTS[sp.id]) { SPOTS[sp.id].act(); return; }
  const door = nearestDoor();
  if (door) { tryDoor(door); return; }
  say('なにも ない。', 1.2);
}

/* ===== ばんごうロック ===== */
function openLock(door) {
  AdventureUI.suspend();
  ModernControls.release(); // マウスロックを解除し、暗証番号ボタンを操作可能に
  G.state = 'lock'; G.keys = Object.create(null); G.touch = Object.create(null);
  G.lock = { door, digits: [0, 0, 0], col: 0 };
  $('lock').hidden = false; pauseVeil.style.opacity = '1';
  updateLockUI();
}
function closeLock() {
  if (G.state !== 'lock') return;
  $('lock').hidden = true; pauseVeil.style.opacity = '0';
  G.state = 'play'; G.lock = null;
}
function lockSpin(col, d) {
  if (!G.lock) return;
  G.lock.col = col;
  G.lock.digits[col] = (G.lock.digits[col] + d + 10) % 10;
  SFX.dial(); updateLockUI();
}
function lockTry() {
  if (!G.lock) return false;
  const ok = G.lock.digits.every((v, i) => v === GYM_CODE[i]);
  if (!ok) { SFX.empty(); $('lockMsg').textContent = 'ちがうみたいだ…'; return false; }
  const door = G.lock.door;
  G.flags.gymOpen = true; SFX.unlock();
  closeLock(); say('カチッ！ ひらいた！', 1.6); saveGame();
  changeRoom(door);
  return true;
}
function updateLockUI() {
  if (!G.lock) return;
  G.lock.digits.forEach((v, i) => {
    const el = $('lockD' + i); el.textContent = v; el.classList.toggle('on', i === G.lock.col);
  });
  $('lockMsg').textContent = 'たいいくかんの ばんごうロック';
}

function useHerb() {
  if (G.state !== 'play' && G.state !== 'inventory') return;
  if (G.herbs <= 0) { say('おまもりの はっぱを もっていない。', 1.6); return; }
  G.herbs--;
  ComicHorror.calm(); // 12秒間はびっくり演出が来ない
  SFX.herb();
  say('はっぱで ほっと ひといき！ つぎは '+objective(), 4);
  saveGame(); updateInvUI();
}
// ヒントは 文字列を 返すだけの 純粋関数。表示先は adventure-ui の ヒントパネルに 統一する。
function showHint() {
  const fixed = id => G.fixed.includes(id);
  let hint;
  if (!fixed('classroom')) hint=has('eraser')
    ? 'こくばんを こくばんけしで けそう。'
    : '2ねん1くみにある こくばんけしを さがしてみよう。';
  else if (!fixed('staff')) hint=!has('key_staff')
    ? 'こくばんを きれいにすると、かぎが あらわれるよ。'
    : !has('battery') ? 'ろうかの おくに でんちが あるよ。'
    : 'しょくいんしつの とけいに でんちを いれよう。';
  else if (!G.flags.gymOpen) hint='ばんごうは こくばんの 5、とけいの 1、ろうかの 7。5・1・7！';
  else if (!fixed('gym')) hint=has('whistle')
    ? 'たいいくかんの ステージで ふえを ふこう！'
    : 'しょくいんしつに せんせいの ふえが あるよ。';
  else hint='げんかんの ドアを しらべよう！';
  return hint;
}

/* ===== セーブ ===== */
function saveGame() {
  if (G.state === 'title' || G.state === 'ending') return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      v: 2, room: G.room, x: G.p.x, z: G.p.z, a: G.p.a,
      hp: G.hp, herbs: G.herbs, time: G.time, damage: G.damage,
      bag: G.bag, fixed: G.fixed, flags: G.flags,
      taken: G.taken, dead: G.dead, scareSeen: G.scareSeen,
    }));
    G.autosave = 1.5; SFX.save();
  } catch (_) {}
  updateContinueUI();
}
function hasSave() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return !!(s && s.v === 2); } catch (_) { return false; }
}
function loadGame() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (_) {}
  if (!s || s.v !== 2) return false;
  resetWorld();
  G.hp = HP_MAX; // 旧セーブも死なないルールで再開
  G.herbs = s.herbs || 0; G.time = s.time || 0; G.damage = s.damage || 0;
  const arr = v => Array.isArray(v) ? v.slice() : [];
  G.taken = arr(s.taken); G.dead = arr(s.dead); G.bag = arr(s.bag);
  G.scareSeen = arr(s.scareSeen);
  G.fixed = arr(s.fixed).filter(id => FIX_ROOMS.includes(id));
  G.flags = s.flags && typeof s.flags === 'object' ? Object.assign({}, s.flags) : {};
  G.bossDead = G.fixed.includes('gym');
  applyWorldFlags();
  const room = ROOMS[s.room] ? s.room : START.room;
  enterRoom(room, { x: s.x == null ? START.x : s.x, z: s.z == null ? START.z : s.z, a: s.a == null ? START.a : s.a }, true);
  G.state = 'play';
  hideAllOverlays();
  $('title').hidden = true;
  titleShown = false;
  pauseVeil.style.opacity = '0';
  fadeEl.style.opacity = '0';
  lastCamDef = null; updateCamera(true);
  say('つづきから はじめた。', 1.8);
  updateContinueUI(); updateInvUI();
  return true;
}
function updateContinueUI() {
  const ok = hasSave();
  const b = $('btnContinue');
  if (b) b.disabled = !ok;
  const h = $('continueHint');
  if (h) h.textContent = ok ? 'セーブデータが あります' : 'セーブデータなし';
}

/* ===== はじめ / おわり ===== */
// 小学2年生が じぶんの はやさで よめるように、ボタン（つぎへ）で 1まいずつ すすむ
const INTRO_LINES = [
  'あめの よる。\n「あっ！ しゅくだい、\nつくえに わすれた！」',
  'あした 出す しゅくだいの ノート。\nとりに いこう。',
  'げんかんに 入った とたん――\nバタン！\n「ドアが しまった！ とじこめられた！？」',
  '「…えっ！？ なにか うごいてる！？」\nがっこうが、おばけに のっとられている。',
  '「がっこうを もとに もどせば\nでられるかも！」',
];
const SLAM_PAGE = 2;
const END_LINES = [
  'がっこうが… ひかってる！\n「ぜんぶ もとに もどった！ やったー！」',
  'ガチャッ。\n「ドアも あいた！ さて、かえろっと！」',
  '……\nよるの 2ねん1くみ。\nつくえの なかに、しゅくだいが のこっていた。',
  'つぎの あさ。\nせんせい「しゅくだいは？」',
  '「あっ！！ わすれた！」',
];
const PUNCH_PAGE = END_LINES.length - 1;
function startNewGame(withIntro) {
  initAudio();
  resetWorld();
  hideAllOverlays();
  G.time = 0; G.state = withIntro ? 'intro' : 'play';
  G.introT = 0; G.introStep = 0;
  $('title').hidden = true; titleShown = false;
  enterRoom(START.room, { x: START.x, z: START.z, a: START.a }, true);
  fadeEl.style.opacity = '0';
  if (withIntro) {
    $('intro').hidden = false; showIntroStep();
  } else {
    $('intro').hidden = true;
    G.roomTitle = 2.4; G.roomTitleText = ROOMS[START.room].name;
  }
  updateContinueUI(); updateInvUI();
  saveGame();
}
function finishIntro() {
  if (G.state !== 'intro') return;
  $('intro').hidden = true;
  G.state = 'play';
  G.roomTitle = 2.6; G.roomTitleText = ROOMS[START.room].name;
  say('ドアが あかない…。がっこうを もとに もどそう！ まずは 2ねん1くみへ。', 3.4);
}
function showIntroStep() {
  const ending = G.state === 'ending';
  const lines = ending ? END_LINES : INTRO_LINES;
  const n = ending ? G.endStep : G.introStep;
  const line = $('introLine');
  line.textContent = lines[n];
  line.classList.toggle('punch', ending && n === PUNCH_PAGE);
  $('introNext').textContent = n === lines.length - 1 ? (ending ? 'おしまい ▶' : 'ゲームへ すすむ') : 'つぎへ ▶';
  if (!ending && n === SLAM_PAGE) { SFX.slam(); $('intro').classList.add('shake'); setTimeout(() => $('intro').classList.remove('shake'), 500); }
  if (ending && n === PUNCH_PAGE) SFX.alert();
}
// オープニングも エンディングも、ボタンで 1まいずつ すすむ（じどうで おわらせない）
function advanceIntro() {
  if (G.state === 'intro') {
    if (G.introStep + 1 >= INTRO_LINES.length) finishIntro();
    else { G.introStep++; showIntroStep(); }
  } else if (G.state === 'ending' && $('ending').hidden) {
    if (G.endStep + 1 >= END_LINES.length) showEndPanel();
    else { G.endStep++; showIntroStep(); }
  }
}
function updateIntro(dt) { G.introT += dt; }
// エンディング：もどった → かえる → つくえの しゅくだい → つぎの あさ「あっ！！ わすれた！」→ おしまい
function finishGame() {
  AdventureUI.suspend();
  ModernControls.release(); // エンディングのボタンをクリックできるように
  G.state = 'ending'; G.endT = 0; G.endStep = 0;
  G.keys = Object.create(null);
  try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
  updateContinueUI();
  ComicHorror.clearVisual();
  // 脱出後は不気味なうなりを消して、エンディングのメロディを残す
  if (AudioSys.ctx && AudioSys.ambient && AudioSys.rain) {
    AudioSys.ambient.gg.gain.setTargetAtTime(.001, AudioSys.ctx.currentTime, .45);
    AudioSys.rain.rg.gain.setTargetAtTime(.018, AudioSys.ctx.currentTime, .6);
  }
  SFX.win();
  $('intro').hidden = false; $('intro').classList.add('morning');
  showIntroStep();
}
function updateEnding(dt) { G.endT += dt; }
function showEndPanel() {
  if (G.state !== 'ending' || !$('ending').hidden) return;
  $('intro').hidden = true; $('intro').classList.remove('morning'); $('introLine').classList.remove('punch');
  $('ending').hidden = false;
  $('endTime').textContent = fmtTime(G.time);
  $('endHurt').textContent = G.damage;
  $('endHp').textContent = G.herbs;
}
function toTitle() {
  AdventureUI.suspend();
  ModernControls.release();
  ComicHorror.clearVisual();
  G.state = 'title'; G.lock = null; G.keys = Object.create(null); G.touch = Object.create(null);
  hideAllOverlays();
  $('title').hidden = false; titleShown = true;
  pauseVeil.style.opacity = '0'; fadeEl.style.opacity = '0';
  updateContinueUI();
}
function hideAllOverlays() {
  for (const id of ['intro', 'inv', 'ending', 'lock']) { const el = $(id); if (el) el.hidden = true; }
  $('intro').classList.remove('morning'); $('introLine').classList.remove('punch');
}

/* ===== HUD ===== */
function fmtTime(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
function say(text, dur) { G.msg = text; G.msgT = dur == null ? 2.4 : dur; }
function wrapText(text, maxChars) {
  const out = [];
  for (const line of String(text).split('\n')) {
    let s = '';
    for (const ch of line) {
      if (s.length >= maxChars) { out.push(s); s = ''; }
      s += ch;
    }
    out.push(s);
  }
  return out;
}
function hudText(s, x, y, size, color, align) {
  HUD.font = `${size || 10}px "DotGothic16","MS Gothic",monospace`;
  HUD.textAlign = align || 'left';
  HUD.textBaseline = 'top';
  HUD.fillStyle = color || '#e8e1cf';
  HUD.fillText(String(s), x, y);
}
function hudPanel(x, y, w, h) {
  HUD.fillStyle = 'rgba(4,3,8,.78)'; HUD.fillRect(x, y, w, h);
  HUD.strokeStyle = 'rgba(220,212,194,.35)'; HUD.lineWidth = 1;
  HUD.strokeRect(x + .5, y + .5, w - 1, h - 1);
}
function drawHUD() {
  HUD.clearRect(0, 0, V.W, V.H);
  if (!activeRoom || G.state === 'title' || G.state === 'intro' || G.state === 'ending' || G.state === 'lock') return;
  const R = activeRoom;
  // 部屋名
  hudText(R.name, 9, 58, 9, 'rgba(232,225,207,.85)'); // 上部のヒント／かばんと重ねない
  // もどした へや（3つの 小さな 枠：未補修＝輪郭／補修済み＝塗り）
  {
    const size = 9, gap = 4, n = FIX_ROOMS.length;
    const x0 = 311 - (n * size + (n - 1) * gap);
    hudText('へや', x0 - 5, 9, 7, 'rgba(216,207,174,.7)', 'right');
    for (let i = 0; i < n; i++) {
      const x = x0 + i * (size + gap), y = 8;
      const done = G.fixed.includes(FIX_ROOMS[i]);
      HUD.fillStyle = done ? '#ffd76a' : 'rgba(232,225,207,.10)';
      HUD.fillRect(x, y, size, size);
      HUD.strokeStyle = done ? '#fff0c0' : 'rgba(232,225,207,.55)';
      HUD.lineWidth = 1;
      HUD.strokeRect(x + .5, y + .5, size - 1, size - 1);
    }
  }
  // 「びっくり 回数」「はっぱ」は かばん・結果画面と かぶるので HUD には 出さない。
  // プロンプト
  if (G.prompt && G.msgT <= 0) {
    hudPanel(38, 202, 244, 20);
    hudText(G.prompt, 160, 207, 9, '#e8e1cf', 'center');
  }
  // メッセージ
  if (G.msgT > 0 && G.msg) {
    const lines = wrapText(G.msg, 28).slice(0, 3);
    const h = 13 + lines.length * 12;
    hudPanel(18, 221 - h, 284, h);
    lines.forEach((l, i) => hudText(l, 160, 226 - h + i * 12, 9, '#f0e9d6', 'center'));
  }
  // 部屋名の カード
  if (G.roomTitle > 0) {
    const a = Math.min(1, G.roomTitle / .5);
    HUD.globalAlpha = a;
    HUD.fillStyle = 'rgba(4,3,8,.62)'; HUD.fillRect(0, 78, 320, 34);
    hudText(G.roomTitleText, 160, 88, 15, '#efe7d2', 'center');
    HUD.globalAlpha = 1;
  }
  // 赤い瀕死演出は使用しない。  // 火花
  for (const s of G.sparks) {
    HUD.globalAlpha = clamp(1 - s.t / s.life, 0, 1);
    HUD.fillStyle = s.c; HUD.fillRect(s.x | 0, s.y | 0, 2, 2);
  }
  HUD.globalAlpha = 1;
}
function updateSparks(dt) {
  for (const s of G.sparks) { s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 150 * dt; }
  G.sparks = G.sparks.filter(s => s.t < s.life);
}
let lastPromptText = '', lastActText = '';
function updatePrompt() {
  const it = nearestItem(), sp = nearestSpot(), door = nearestDoor();
  let text = '';
  if (it) text = it.def.label || 'しらべる';
  else if (sp && SPOTS[sp.id]) text = SPOTS[sp.id].label();
  else if (door) text = door.label;
  // [E] は キーボードを 使った ときだけ。タッチ端末に キー表示を 出さない。
  const prompt = text ? (G.keyboard ? '[E] ' + text : text) : '';
  if (prompt !== lastPromptText) { lastPromptText = prompt; G.prompt = prompt; }
  const action = $('tAct');
  const near = !!(it || (sp && SPOTS[sp.id]) || door);
  action.classList.toggle('ready', near);
  const actText = near ? 'しらべる！' : 'しらべる';
  if (actText !== lastActText) { lastActText = actText; action.textContent = actText; }
}

/* ===== 明かりの ちらつき ===== */
function updateRoomFx() {
  if (!activeRoom) return;
  const t = performance.now() / 1000;
  if (activeRoom.clockHands && G.fixed.includes('staff')) activeRoom.clockHands[0].rotation.z = -t * 1.2;
  for (const it of activeRoom.items || []) {
    if (it.group.userData.spin) it.group.rotation.y = t * 1.6;
    if (it.group.userData.halo) it.group.userData.halo.material.opacity = .1 + .08 * Math.sin(t * 3);
  }
  if (activeRoom.calm) return; // もとに もどった へやは ちらつかない
  for (const f of activeRoom.flickers || []) {
    const blink = (Math.sin(t * 12 + f.ph) > .982 || Math.sin(t * .7 + f.ph) > .995) ? .18 : 1;
    f.light.intensity = f.base * (.72 + .28 * (.5 + .5 * Math.sin(t * 5 + f.ph))) * blink;
  }
}

/* ===== 入力 ===== */
function keyName(code) {
  if (code === 'ArrowUp' || code === 'KeyW') return 'up';
  if (code === 'ArrowDown' || code === 'KeyS') return 'down';
  if (code === 'ArrowLeft' || code === 'KeyA') return 'left';
  if (code === 'ArrowRight' || code === 'KeyD') return 'right';
  return null;
}
function openInventory() {
  if (G.state !== 'play') return;
  AdventureUI.suspend();
  ModernControls.release();
  G.state = 'inventory'; G.keys = Object.create(null); G.touch = Object.create(null);
  $('inv').hidden = false; pauseVeil.style.opacity = '1';
  updateInvUI();
}
function closeInventory() {
  if (G.state !== 'inventory') return;
  $('inv').hidden = true; pauseVeil.style.opacity = '0';
  G.state = 'play';
}
function updateInvUI() {
  $('invHp').textContent = G.damage+'かい';
  $('invBag').textContent = G.bag.length ? G.bag.map(id => ITEM_NAMES[id] || id).join('・') : 'なし';
  $('invHerb').textContent = G.herbs;
  $('invFixed').textContent = `${G.fixed.length} / ${FIX_ROOMS.length}`;
  $('invRoom').textContent = (ROOMS[G.room] || {}).name || '？';
  $('invTime').textContent = fmtTime(G.time);
  $('invObjective').textContent = objective();
  $('btnControl').textContent = G.mode === 'modern' ? 'スティック移動（おすすめ）' : 'クラシック（タンク）';
  $('btnSound').textContent = G.sound ? 'オン' : 'オフ';
  $('btnFx').textContent = G.fx ? 'オン' : 'オフ';
  $('btnHerb').disabled = G.herbs <= 0;
  $('btnMode').textContent = `そうさ：${G.mode === 'modern' ? 'スティック' : 'クラシック'}`;
  $('btnTitleSound').textContent = `おと：${G.sound ? 'オン' : 'オフ'}`;
  $('tMute').textContent = G.sound ? '♪' : '×';
}
function objective() {
  const f = id => G.fixed.includes(id);
  if (G.fixed.length >= FIX_ROOMS.length) return 'げんかんの ドアへ！';
  if (!f('classroom')) return has('eraser') ? 'こくばんの らくがきを けそう。' : '2ねん1くみの こくばんを もとに もどそう。';
  if (!f('staff')) return !G.flags.staffOpen && !has('key_staff') ? 'しょくいんしつの かぎを さがそう。' : 'しょくいんしつの とけいを うごかそう。';
  return G.flags.gymOpen ? 'たいいくかんの おばけを しずかに させよう。' : 'たいいくかんの ばんごうを あつめよう（3けた）。';
}
function setMode(mode) {
  if (mode !== 'tank' && mode !== 'modern') return;
  ModernControls.release();
  G.keys = Object.create(null); G.touch = Object.create(null);
  G.mode = mode;
  lastCamDef = null;
  $('stage').classList.toggle('mode-modern',mode === 'modern');
  try { localStorage.setItem('obake-ps1-controls-v4', mode); } catch (_) {}
  updateCamera(true);
  updateInvUI();
}
function toggleSound() {
  G.sound = !G.sound;
  if (AudioSys.master) AudioSys.master.gain.value = G.sound ? .22 : 0;
  updateInvUI();
}
function toggleFx() {
  G.fx = !G.fx;
  try { localStorage.setItem('obake-ps1-fx', G.fx ? '1' : '0'); } catch (_) {}
  updateInvUI();
}
function bindInput() {
  addEventListener('keydown', e => {
    const c = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(c)) e.preventDefault();
    if (e.repeat) return;
    // キーボード操作を 1回でも したら [E] のような キー表示を出す（タッチ端末では出さない）
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD',
      'KeyE', 'KeyJ', 'KeyI', 'KeyH', 'KeyM', 'Enter', 'Space', 'Tab', 'Escape'].includes(c)) G.keyboard = true;
    if (G.state === 'title') {
      if (['Enter', 'Space', 'KeyE', 'KeyJ'].includes(c)) startNewGame(true);
      return;
    }
    if (G.state === 'intro') {
      if (c === 'Escape') finishIntro();
      else if (['Enter', 'Space', 'KeyE', 'KeyJ', 'ArrowRight'].includes(c)) advanceIntro();
      return;
    }
    if (G.state === 'inspect') {
      if (c === 'Escape' || c === 'Backspace') AdventureUI.closePanel(false);
      return;
    }
    if (G.state === 'inventory') {
      if (['Escape', 'KeyI', 'Tab'].includes(c)) closeInventory();
      if (c === 'KeyH') useHerb();
      return;
    }
    if (G.state === 'lock') {
      const L = G.lock; if (!L) return;
      if (c === 'Escape' || c === 'Tab') closeLock();
      else if (c === 'ArrowLeft' || c === 'KeyA') { L.col = (L.col + 2) % 3; updateLockUI(); }
      else if (c === 'ArrowRight' || c === 'KeyD') { L.col = (L.col + 1) % 3; updateLockUI(); }
      else if (c === 'ArrowUp' || c === 'KeyW') lockSpin(L.col, 1);
      else if (c === 'ArrowDown' || c === 'KeyS') lockSpin(L.col, -1);
      else if (/^Digit\d$/.test(c)) { L.digits[L.col] = +c.slice(5); L.col = Math.min(2, L.col + 1); SFX.dial(); updateLockUI(); }
      else if (c === 'Enter' || c === 'KeyE' || c === 'Space') lockTry();
      return;
    }
    if (G.state === 'ending') { if (c === 'Escape') showEndPanel(); else if (['Enter', 'Space', 'KeyE', 'KeyJ', 'ArrowRight'].includes(c)) advanceIntro(); return; }
    if (G.state !== 'play') return;
    const k = keyName(c);
    if (k) G.keys[k] = true;
    if (c === 'ShiftLeft' || c === 'ShiftRight') G.keys[c] = true;
    if (c === 'KeyE' || c === 'Enter' || c === 'Space' || c === 'KeyJ') interact();
    else if (c === 'KeyI' || c === 'Escape' || c === 'Tab') openInventory();
    else if (c === 'KeyH') useHerb();
    else if (c === 'KeyM') toggleSound();
  });
  addEventListener('keyup', e => {
    const k = keyName(e.code);
    if (k) G.keys[k] = false;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') G.keys[e.code] = false;
  });
  addEventListener('blur', () => { G.keys = Object.create(null); G.touch = Object.create(null); });

  const stage = $('stage');
  stage.addEventListener('contextmenu', e => e.preventDefault());
  ModernControls.bind();
  AdventureUI.bind();

  const bindHold = (id, on, off) => {
    const el = $(id);
    el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture && el.setPointerCapture(e.pointerId); on(); });
    const end = e => { e.preventDefault(); off(); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
  };
  bindHold('tUp', () => G.touch.up = true, () => G.touch.up = false);
  bindHold('tDown', () => G.touch.down = true, () => G.touch.down = false);
  bindHold('tLeft', () => G.touch.left = true, () => G.touch.left = false);
  bindHold('tRight', () => G.touch.right = true, () => G.touch.right = false);
  $('tAct').addEventListener('pointerdown', e => { e.preventDefault(); interact(); });
  $('tItem').addEventListener('pointerdown', e => { e.preventDefault(); openInventory(); });
  $('tMute').addEventListener('pointerdown', e => { e.preventDefault(); toggleSound(); });

  $('introNext').addEventListener('click', advanceIntro);
  $('introSkip').addEventListener('click', () => { if (G.state === 'ending') showEndPanel(); else finishIntro(); });
  $('intro').addEventListener('pointerdown', e => {
    if (e.target === $('intro') || e.target === $('introLine')) advanceIntro();
  });
  $('btnNew').addEventListener('click', () => startNewGame(true));
  $('btnContinue').addEventListener('click', () => { if (!loadGame()) startNewGame(true); });
  $('btnMode').addEventListener('click', () => setMode(G.mode === 'tank' ? 'modern' : 'tank'));
  $('btnTitleSound').addEventListener('click', () => { initAudio(); toggleSound(); });
  $('btnResume').addEventListener('click', closeInventory);
  $('btnHerb').addEventListener('click', useHerb);
  $('btnHint').addEventListener('click', () => AdventureUI.showHintPanel());
  $('btnInvTitle').addEventListener('click', () => { $('inv').hidden = true; pauseVeil.style.opacity = '0'; toTitle(); });
  $('btnControl').addEventListener('click', () => setMode(G.mode === 'tank' ? 'modern' : 'tank'));
  $('btnSound').addEventListener('click', toggleSound);
  $('btnFx').addEventListener('click', toggleFx);
  for (let i = 0; i < 3; i++) {
    $('lockU' + i).addEventListener('click', () => lockSpin(i, 1));
    $('lockN' + i).addEventListener('click', () => lockSpin(i, -1));
  }
  $('btnLockOk').addEventListener('click', lockTry);
  $('btnLockCancel').addEventListener('click', closeLock);
  $('btnEndAgain').addEventListener('click', () => { $('ending').hidden = true; toTitle(); startNewGame(false); });
  $('btnEndTitle').addEventListener('click', () => { $('ending').hidden = true; toTitle(); });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      G.keys = Object.create(null); G.touch = Object.create(null);
      if (AudioSys.ctx && AudioSys.ctx.state === 'running') AudioSys.ctx.suspend();
    } else if (AudioSys.ctx && AudioSys.ctx.state === 'suspended') AudioSys.ctx.resume();
  });
}

/* ===== ループ ===== */
function update(dt) {
  // 拡大画面・かばん・暗証番号・場面転換のあいだは、予兆を取り消す（戻ったときに急に起こさない）
  if (G.state !== 'play') ComicHorror.abortPending();
  if (G.state === 'title') return;
  if (G.state === 'intro') { updateIntro(dt); updateRoomFx(); return; }
  if (G.state === 'ending') { updateEnding(dt); return; }
  if (G.state === 'lock') { updateRoomFx(); return; }
  if (G.state === 'inventory') { updateRoomFx(); return; }
  if (G.state === 'transition') { updateTransition(dt); updateRoomFx(); updateParticles(dt); updateSparks(dt); return; }
  if (G.state !== 'play') return;

  G.time += dt;
  G.invuln = Math.max(0, G.invuln - dt);
  G.hurt = Math.max(0, G.hurt - dt * 1.6);
  G.flash = Math.max(0, G.flash - dt * 2.6);
  G.msgT = Math.max(0, G.msgT - dt);
  G.roomTitle = Math.max(0, G.roomTitle - dt);
  G.autosave = Math.max(0, G.autosave - dt);
  updatePlayer(dt);
  updateEnemies(dt);
  updateParticles(dt);
  updateSparks(dt);
  updateRoomFx();
  updatePrompt();
  AdventureUI.refresh(dt);
  ComicHorror.tick(dt);
  if (G.hp <= 1) {
    G.heartT -= dt;
    if (G.heartT <= 0) { G.heartT = 1.15; tone(62, .25, 'sine', .07); tone(52, .3, 'sine', .06, 0, .24); }
  }
  flashEl.style.opacity = String(Math.max(G.hurt * .9, G.flash * .55));
  flashEl.style.background = G.flash > G.hurt ? '#ffe7aa' : '#c5a9eb';
}
function loop(now) {
  const dt = Math.min(.05, Math.max(0, (now - loop.last) / 1000 || 0));
  loop.last = now;
  G.t += dt;
  if (G.state === 'title') {
    updateTitle(dt);
    renderScene(titleScene, titleCam);
  } else {
    update(dt);
    if (G.state === 'title') renderScene(titleScene, titleCam);
    else renderScene(activeRoom ? activeRoom.scene : titleScene, activeRoom ? gameCam : titleCam);
  }
  drawHUD();
  requestAnimationFrame(loop);
}
loop.last = performance.now();

/* ===== 起動 ===== */
function init() {
  if (!window.THREE) {
    $('title').querySelector('.sub').textContent = '3Dを よみこめませんでした';
    return;
  }
  fadeEl = $('fade'); flashEl = $('flash'); pauseVeil = $('pauseVeil');
  makeGameCamera();
  initRenderer();
  buildTextures();
  buildTitleScene();
  kid = buildKid();
  flash = new THREE.SpotLight(0xffdca0, 2.0, 15, .46, .55, 1);
  flashTarget = new THREE.Object3D();
  buildRooms();
  Discoveries.build();
  populateAllRooms();
  applyWorldFlags();
  bindInput();
  updateContinueUI();
  updateInvUI();
  setMode(G.mode);
  G.state = 'title';
  $('title').hidden = false;
  requestAnimationFrame(loop);
  window.PS1 = {
    G, ROOMS, startNewGame, advanceIntro, finishIntro, loadGame, saveGame, hasSave, resetWorld,
    enterRoom, changeRoom, updateTransition, interact, pickupItem, useHerb,
    hurtPlayer, updateCamera, restoreRoom, openLock, closeLock, lockSpin, lockTry, showEndPanel,
    comic: ComicHorror, modernControls: ModernControls, adventureUI: AdventureUI, showHint,
    update, updatePlayer, updateEnemies, updateBoss, nearestItem, nearestDoor, nearestSpot, objective,
    FIX_ROOMS, GYM_CODE, SPOTS,
    blocked, tryMove, setMode, openInventory, closeInventory, finishGame,
    camera: () => activeCam, gameCam: () => gameCam, room: () => activeRoom,
    spawnEnemyEntity, spawnItemEntity, applyWorldFlags, updateInvUI, drawHUD,
    projectToScreen, fmtTime,
    three: () => ({ renderer, scene: activeRoom && activeRoom.scene, cam: gameCam, rt, postScene, postCam }),
    capture: (opts) => {
      const sc = G.state === 'title' ? titleScene : (activeRoom ? activeRoom.scene : titleScene);
      const ca = G.state === 'title' ? titleCam : (activeRoom ? gameCam : titleCam);
      if (opts && opts.post === false) {
        renderer.setRenderTarget(null);
        renderer.clear();
        renderer.render(sc, ca);
      } else renderScene(sc, ca);
      drawHUD();
      return $('gl').toDataURL('image/png');
    },
  };
}

if (document.readyState === 'loading') addEventListener('DOMContentLoaded', init);
else init();
