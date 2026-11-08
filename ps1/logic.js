/* ============================================================
   おばけ第一小学校 PS1版 : ゲームの ルール / 操作 / HUD
   ============================================================ */
'use strict';

let gameCam = null;
let lastCamDef = null;
let fadeEl = null, flashEl = null, pauseVeil = null;
let titleShown = true;

const HP_MAX = 4;
const BOSS_HP = 22;

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
    id: def.id, type: def.type, def, group, boss: !!def.boss,
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
  if (e.boss) { e.speed = .62; e.cd = 1.4; }
  if (G.dead.includes(def.id) || (e.boss && G.bossDead)) { e.dead = true; e.group.visible = false; }
  return e;
}
function spawnItemEntity(R, def) {
  const group = buildItem(def.type);
  group.position.set(def.x, def.y || 0, def.z);
  R.scene.add(group);
  const it = {
    id: def.id, type: def.type, def, group,
    taken: G.taken.includes(def.id),
    hidden: !!def.hidden,
  };
  group.visible = !it.taken && !(it.hidden && !G.bossDead);
  return it;
}
function applyWorldFlags() {
  for (const R of Object.values(ROOMS)) {
    for (const it of R.items || []) {
      it.taken = G.taken.includes(it.id);
      it.group.visible = !it.taken && !(it.hidden && !G.bossDead);
    }
    for (const e of R.enemies || []) {
      const gone = G.dead.includes(e.id) || (e.boss && G.bossDead);
      e.dead = gone; e.group.visible = !gone;
      if (gone && e.boss) { e.awake = false; }
    }
  }
}
function resetWorld() {
  G.hp = HP_MAX; G.ammo = 12; G.herbs = 0; G.charms = 0;
  G.time = 0; G.shots = 0; G.hits = 0; G.damage = 0;
  G.taken = []; G.dead = []; G.bossDead = false; G.bossFight = false; G.boss = null;
  G.msg = ''; G.msgT = 0; G.prompt = ''; G.roomTitle = 0; G.autosave = 0;
  G.invuln = 0; G.hurt = 0; G.flash = 0; G.aiming = false; G.aimT = 0; G.fireCd = 0;
  G.projectiles = []; G.fx3 = []; G.sparks = []; G.tracers = [];
  for (const R of Object.values(ROOMS)) {
    for (const it of R.items || []) { it.taken = false; it.hidden = !!it.def.hidden; it.group.visible = !it.hidden; }
    for (const e of R.enemies || []) {
      e.dead = false; e.hp = e.max; e.awake = false; e.flash = 0; e.windup = 0; e.stagger = 0;
      e.cd = rnd(.4, 1.2); e.atkCd = 0; e.mode = 'idle'; e.timer = 0; e.phase2 = false; e.summoned = false;
      e.x = e.def.x; e.z = e.def.z; e.baseY = e.def.y || 0;
      e.group.visible = true; e.group.position.set(e.x, e.baseY, e.z);
    }
  }
}

/* ===== カメラ ===== */
function makeGameCamera() {
  if (!gameCam) gameCam = new THREE.PerspectiveCamera(55, 4 / 3, .05, 70);
}
function applyCam(c) {
  if (!c) return;
  gameCam.position.set(c.pos[0], c.pos[1], c.pos[2]);
  gameCam.lookAt(c.look[0], c.look[1], c.look[2]);
  gameCam.fov = c.fov || 55; gameCam.aspect = 4 / 3; gameCam.near = .05; gameCam.far = 70;
  gameCam.updateProjectionMatrix();
  activeCam = gameCam;
}
function updateCamera(force) {
  if (!activeRoom) return;
  let c = null;
  if (activeRoom.id === 'gym' && G.bossFight && activeRoom.bossCam) c = activeRoom.bossCam;
  else {
    const p = G.p;
    c = activeRoom.cams.find(o => p.x >= o.zone.x0 && p.x <= o.zone.x1 && p.z >= o.zone.z0 && p.z <= o.zone.z1) || activeRoom.cams[0];
  }
  if (force || c !== lastCamDef) {
    lastCamDef = c; applyCam(c);
    if (!force && G.state === 'play') SFX.camera();
  }
}

/* ===== 部屋の 出入り ===== */
function enterRoom(id, spawn, silent) {
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
    if (!muzzle) {
      muzzle = new THREE.Mesh(new THREE.SphereGeometry(.075, 5, 4), bm(0xffe6a0, { transparent: true, opacity: .9, depthWrite: false }));
      muzzle.visible = false; kid.userData.gun.add(muzzle); kid.userData.gun.userData.muzzle = muzzle;
    }
    R.scene.add(flash); R.scene.add(flashTarget); flash.target = flashTarget;
  }
  G.bossFight = false; lastCamDef = null;
  updateCamera(true);
  G.roomTitle = 2.4; G.roomTitleText = R.name;
  if (!silent) saveGame();
}
function changeRoom(door) {
  if (G.state !== 'play' || G.trans) return;
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
  const p = G.p;
  const up = inputDown('up'), down = inputDown('down'), left = inputDown('left'), right = inputDown('right');
  const run = !!(G.keys.ShiftLeft || G.keys.ShiftRight);
  let moving = 0;
  if (!G.aiming) {
    if (G.mode === 'tank') {
      if (left) p.a += 2.25 * dt;
      if (right) p.a -= 2.25 * dt;
      let f = (up ? 1 : 0) - (down ? 1 : 0);
      if (f) {
        const sp = (run ? 2.65 : 1.55) * f;
        const nx = p.x + Math.sin(p.a) * sp * dt;
        const nz = p.z + Math.cos(p.a) * sp * dt;
        const before = p.x + p.z;
        tryMove(Math.sin(p.a) * sp * dt, Math.cos(p.a) * sp * dt);
        moving = Math.abs((p.x + p.z) - before) > .0005 ? 1 : 0;
      }
    } else {
      let ix = (right ? 1 : 0) - (left ? 1 : 0);
      let iz = (up ? 1 : 0) - (down ? 1 : 0);
      if (ix || iz) {
        activeCam.getWorldDirection(V3); V3.y = 0; V3.normalize();
        const fx = V3.x, fz = V3.z, rx = -fz, rz = fx;
        let mx = fx * iz + rx * ix, mz = fz * iz + rz * ix;
        const l = Math.hypot(mx, mz) || 1; mx /= l; mz /= l;
        p.a = Math.atan2(mx, mz);
        const sp = run ? 2.65 : 1.55;
        tryMove(mx * sp * dt, mz * sp * dt);
        moving = 1;
      }
    }
  }
  p.moving = moving;
  if (moving) p.walk += dt * (run ? 10 : 7); else p.walk *= Math.max(0, 1 - dt * 8);
  kid.position.set(p.x, 0, p.z); kid.rotation.y = p.a;
  const u = kid.userData;
  const sw = moving ? Math.sin(p.walk) * (run ? .62 : .42) : 0;
  u.legL.rotation.x = sw; u.legR.rotation.x = -sw;
  if (G.aiming) {
    u.armR.rotation.x = -1.42; u.armL.rotation.x = -1.22;
    u.gun.rotation.x = .08; u.gun.visible = true;
  } else {
    u.armR.rotation.x = -sw * .55; u.armL.rotation.x = sw * .55;
    u.gun.visible = false;
  }
  const fx = Math.sin(p.a), fz = Math.cos(p.a);
  flash.position.set(p.x + fx * .12, 1.05, p.z + fz * .12);
  flashTarget.position.set(p.x + fx * 5.2, .38, p.z + fz * 5.2);
  flash.intensity = G.aiming ? 2.7 : 2.0;
  if (moving) {
    G.footT -= dt;
    if (G.footT <= 0) { G.footT = run ? .28 : .42; SFX.step(); }
  } else G.footT = 0;
  if (G.recoil > 0) { G.recoil = Math.max(0, G.recoil - dt * 6); u.gun.position.z = .05 - G.recoil * .09; }
  else u.gun.position.z = .05;
  if (muzzle) {
    muzzle.visible = G.recoil > .04;
    if (muzzle.visible) muzzle.scale.setScalar(.6 + G.recoil * 1.4);
  }
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
      if (d < 1.65) hurtPlayer();
      e.cd = 1.55;
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
function spawnProjectile(e, offsetX) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(.18, 6, 5), pm(0x8c4a35));
  mesh.position.set(e.x + offsetX, 1.45, e.z + .4);
  activeRoom.scene.add(mesh);
  const dx = G.p.x - mesh.position.x, dz = G.p.z - mesh.position.z, d = Math.hypot(dx, dz) || 1;
  G.projectiles.push({ mesh, x: mesh.position.x, z: mesh.position.z, y: 1.45, vx: dx / d * 3.6, vz: dz / d * 3.6, vy: 1.2, t: 0 });
}
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
      SFX.boss(); say('ロッカーだいおうが おきた！', 2.6);
      lastCamDef = null; updateCamera(true);
    }
    return;
  }
  if (e.dead) return;
  if (!e.phase2 && e.hp <= e.max * .5) {
    e.phase2 = true; e.speed *= 1.35;
    SFX.boss(); say('ドアが いっせいに ひらいた！', 2.2);
    G.flash = .7; e.flash = .45;
  }
  e.atkCd -= dt;
  if (e.mode === 'wind') {
    e.timer -= dt; g.position.y += .05;
    setGhostFlash(e, Math.sin(e.t * 30) > 0);
    if (e.timer <= 0) {
      setGhostFlash(e, false);
      if (e.attack === 'throw') {
        spawnProjectile(e, -.5); spawnProjectile(e, 0); spawnProjectile(e, .5);
        SFX.shoot();
      } else if (e.attack === 'charge') {
        e.mode = 'charge'; e.timer = e.phase2 ? .72 : .6; return;
      } else if (e.attack === 'summon') {
        const ids = [e.id + '_s1', e.id + '_s2'];
        ids.forEach((id, i) => {
          if (!activeRoom.enemies.find(o => o.id === id)) {
            const ne = spawnEnemyEntity(activeRoom, { id, type: 'uwabaki', x: e.x + (i ? 1.2 : -1.2), z: e.z + 1.0, wake: 99 });
            if (ne) { ne.awake = true; activeRoom.enemies.push(ne); }
          }
        });
        SFX.boss();
      }
      e.mode = 'idle'; e.cd = e.phase2 ? 1.25 : 1.9;
    }
    return;
  }
  if (e.mode === 'charge') {
    e.timer -= dt;
    e.x += e.vx * dt; e.z += e.vz * dt;
    const b = activeRoom.bounds;
    e.x = clamp(e.x, b.x0 + .7, b.x1 - .7); e.z = clamp(e.z, b.z0 + .7, b.z1 - .7);
    if (d < 1.15 && e.atkCd <= 0) { hurtPlayer(); e.atkCd = 1.1; }
    if (e.timer <= 0) { e.mode = 'idle'; e.cd = e.phase2 ? 1.1 : 1.7; }
    return;
  }
  // idle
  e.cd -= dt;
  if (d > 2.4) {
    const sp = e.speed * (G.state === 'play' ? 1 : 0);
    e.x += dx / d * sp * dt; e.z += dz / d * sp * dt;
  }
  if (d < 1.2 && e.atkCd <= 0) { hurtPlayer(); e.atkCd = 1.2; }
  if (e.cd <= 0) {
    if (e.phase2 && !e.summoned) {
      e.summoned = true; e.mode = 'wind'; e.attack = 'summon'; e.timer = .9;
      say('なかまを よんだ！', 1.6);
    } else if (Math.random() < .48) {
      e.mode = 'wind'; e.attack = 'charge'; e.timer = e.phase2 ? .62 : .85;
      e.vx = dx / d * (e.phase2 ? 6.6 : 5.2); e.vz = dz / d * (e.phase2 ? 6.6 : 5.2);
      SFX.alert(); say('くるぞ！', 1.1);
    } else {
      e.mode = 'wind'; e.attack = 'throw'; e.timer = e.phase2 ? .72 : .95;
      SFX.alert();
    }
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
function updateProjectiles(dt) {
  for (const p of G.projectiles) {
    p.t += dt; p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt; p.vy -= 5.2 * dt;
    if (p.y < .18) { p.y = .18; p.vy = Math.abs(p.vy) * .35; }
    p.mesh.position.set(p.x, p.y, p.z);
    if (dist2(p.x, p.z, G.p.x, G.p.z) < .4 && p.y < 1.15) { hurtPlayer(); p.t = 99; }
    if (p.t > 3.6) p.t = 99;
  }
  for (const p of G.projectiles) if (p.t > 90) { p.mesh.removeFromParent(); p.mesh.geometry.dispose(); }
  G.projectiles = G.projectiles.filter(p => p.t <= 90);
}

/* ===== 攻撃 ===== */
function findTarget(range, minDot) {
  if (!activeRoom) return null;
  const p = G.p, fx = Math.sin(p.a), fz = Math.cos(p.a);
  let best = null, bestScore = 1e9;
  for (const e of activeRoom.enemies) {
    if (e.dead || (!e.awake && !e.boss)) continue;
    const dx = e.group.position.x - p.x, dz = e.group.position.z - p.z, d = Math.hypot(dx, dz);
    if (d < .15 || d > range) continue;
    const dot = (dx * fx + dz * fz) / d;
    if (dot < minDot) continue;
    const score = d - dot * 1.8 + (e.boss ? -1.2 : 0);
    if (score < bestScore) { bestScore = score; best = e; }
  }
  return best;
}
function spawnTracer(x0, y0, z0, x1, y1, z1) {
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1)]);
  const mat = new THREE.LineBasicMaterial({ color: 0xc8ecff, transparent: true, opacity: .75 });
  const line = new THREE.Line(geo, mat); activeRoom.scene.add(line);
  G.tracers = G.tracers || []; G.tracers.push({ line, t: .09 });
}
function updateTracers(dt) {
  for (const t of G.tracers || []) { t.t -= dt; t.line.material.opacity = Math.max(0, t.t / .09) * .75; }
  for (const t of G.tracers || []) if (t.t <= 0) { t.line.removeFromParent(); t.line.geometry.dispose(); t.line.material.dispose(); }
  G.tracers = (G.tracers || []).filter(t => t.t > 0);
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
function damageEnemy(e, d) {
  if (!e || e.dead) return;
  e.hp -= d; e.flash = .16; e.stagger = .16;
  if (e.boss) {
    G.flash = Math.max(G.flash, .09);
    addSparks(e.group.position.x, 1.45, e.group.position.z, '#ffcf6a', 5);
  } else {
    addSparks(e.group.position.x, .8, e.group.position.z, '#cfe8ff', 6);
  }
  spawnParticles(e.group.position.x, e.boss ? 1.5 : .8, e.group.position.z, e.boss ? 0xffc85a : 0xbfe6ff, e.boss ? 8 : 5);
  SFX.hit();
  if (e.hp <= 0) { if (e.boss) killBoss(e); else killGhost(e); }
}
function killGhost(e) {
  if (e.dead) return;
  e.dead = true; e.group.visible = false;
  spawnParticles(e.x, .7, e.z, 0xd8d4e8, 12);
  addSparks(e.x, .8, e.z, '#e8e2ff', 10);
  if (!G.dead.includes(e.id)) G.dead.push(e.id);
  SFX.ghost();
  saveGame();
}
function killBoss(e) {
  if (e.dead) return;
  e.dead = true; e.awake = false; e.group.visible = false;
  G.bossDead = true; G.bossFight = false; G.boss = null;
  G.flash = 1;
  for (let i = 0; i < 4; i++) setTimeout(() => {
    if (!activeRoom || activeRoom.id !== 'gym') return;
    spawnParticles(e.x + rnd(-1, 1), rnd(.4, 2.2), e.z + rnd(-1, 1), [0xffc85a, 0xff7a6a, 0xd8d4ff][i % 3], 10);
    SFX.boom ? SFX.boom() : SFX.boss();
  }, i * 130);
  if (!G.dead.includes(e.id)) G.dead.push(e.id);
  const charm = activeRoom.items.find(it => it.id === 'charm_gym');
  if (charm) { charm.hidden = false; charm.group.visible = !charm.taken; }
  say('ロッカーだいおうは しずまった。おふだが おちている。', 3.2);
  SFX.win(); saveGame();
  lastCamDef = null; updateCamera(true);
}
function fire() {
  if (G.state !== 'play' || G.trans || G.fireCd > 0) return;
  if (G.ammo <= 0) { SFX.empty(); say('みずが でない！ たまを さがそう。', 1.8); G.fireCd = .45; return; }
  G.ammo--; G.shots++; G.fireCd = .42; G.recoil = 1;
  SFX.shoot();
  const p = G.p, fx = Math.sin(p.a), fz = Math.cos(p.a);
  const mz = { x: p.x + fx * .35, y: 1.02, z: p.z + fz * .35 };
  const target = findTarget(10.5, G.aiming ? .55 : .72);
  let tx, ty, tz;
  if (target) {
    tx = target.group.position.x; tz = target.group.position.z;
    ty = target.boss ? 1.45 : .8;
    damageEnemy(target, 1); G.hits++;
  } else {
    tx = p.x + fx * 7; tz = p.z + fz * 7; ty = 1.0;
    spawnParticles(tx, ty, tz, 0x9fdcff, 4); SFX.splash();
  }
  spawnTracer(mz.x, mz.y, mz.z, tx, ty, tz);
  if (target) addSparks(tx, ty, tz, '#c8ecff', 6);
}

/* ===== ダメージ ===== */
function hurtPlayer() {
  if (G.state !== 'play' || G.invuln > 0) return;
  G.hp--; G.invuln = 1.35; G.hurt = .65; G.damage++;
  SFX.hurt();
  say(G.hp <= 1 ? 'もう たおれそうだ…' : 'いたっ！', 1.5);
  if (G.hp <= 0) die();
}
function die() {
  if (G.state === 'dead') return;
  G.hp = 0; G.state = 'dead'; G.deadT = 0;
  G.aiming = false; G.keys = Object.create(null);
  SFX.boss();
  setTimeout(showGameOver, 900);
}
function showGameOver() {
  if (G.state !== 'dead') return;
  $('overText').textContent = G.charms >= 1 ? `おふだを ${G.charms}まい あつめたところで、おばけに つかまった…` : 'おばけに つかまってしまった…';
  $('over').hidden = false;
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
function pickupItem(it) {
  if (!it || it.taken) return;
  if (it.type === 'note') { say(it.def.text, 5); return; }
  it.taken = true;
  if (!G.taken.includes(it.id)) G.taken.push(it.id);
  it.group.visible = false;
  SFX.pickup();
  if (it.type === 'charm') {
    G.charms++;
    say(G.charms >= 3 ? 'おふだ 3まい そろった！ げんかんへ いそごう。' : `おふだを てに いれた（${G.charms}/3）`, 2.6);
    if (G.charms >= 3) SFX.win();
  } else if (it.type === 'ammo') {
    G.ammo += it.def.amount || 6;
    say(`みずの たま +${it.def.amount || 6}`, 1.5);
  } else if (it.type === 'herb') {
    G.herbs++;
    say('やくそうを てに いれた。', 1.5);
  }
  saveGame();
}
function interact() {
  if (G.state !== 'play' || G.trans) return;
  const it = nearestItem();
  if (it) { pickupItem(it); return; }
  const door = nearestDoor();
  if (door) {
    if (door.locked) { say(door.locked, 2); return; }
    changeRoom(door); return;
  }
  if (activeRoom.gate && activeRoom.gateSpot && dist2(G.p.x, G.p.z, activeRoom.gateSpot.x, activeRoom.gateSpot.z) < 1.5) {
    if (G.charms >= 3) finishGame();
    else say('校門は おふだで ふういんされている。おふだを 3まい あつめよう。', 3);
    return;
  }
  say('なにも ない。', 1.2);
}
function useHerb() {
  if (G.state !== 'play' && G.state !== 'inventory') return;
  if (G.herbs <= 0) { say('やくそうを もっていない。', 1.6); return; }
  if (G.hp >= G.maxHp) { say('たいりょくは げんきだ。', 1.4); return; }
  G.herbs--; G.hp = Math.min(G.maxHp, G.hp + 2);
  SFX.herb(); say('やくそうを つかった。たいりょくが かいふくした。', 2);
  saveGame(); updateInvUI();
}

/* ===== セーブ ===== */
function saveGame() {
  if (G.state === 'title' || G.state === 'ending') return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      v: 1, room: G.room, x: G.p.x, z: G.p.z, a: G.p.a,
      hp: G.hp, ammo: G.ammo, herbs: G.herbs, charms: G.charms, time: G.time,
      shots: G.shots, hits: G.hits, damage: G.damage,
      taken: G.taken, dead: G.dead, bossDead: G.bossDead,
    }));
    G.autosave = 1.5; SFX.save();
  } catch (_) {}
  updateContinueUI();
}
function hasSave() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return !!(s && s.v === 1); } catch (_) { return false; }
}
function loadGame() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (_) {}
  if (!s || s.v !== 1) return false;
  resetWorld();
  G.hp = clamp(s.hp == null ? HP_MAX : s.hp, 1, HP_MAX);
  G.ammo = s.ammo == null ? 12 : s.ammo;
  G.herbs = s.herbs || 0; G.charms = s.charms || 0; G.time = s.time || 0;
  G.shots = s.shots || 0; G.hits = s.hits || 0; G.damage = s.damage || 0;
  G.taken = Array.isArray(s.taken) ? s.taken.slice() : [];
  G.dead = Array.isArray(s.dead) ? s.dead.slice() : [];
  G.bossDead = !!s.bossDead;
  applyWorldFlags();
  const room = ROOMS[s.room] ? s.room : 'classroom';
  enterRoom(room, { x: s.x == null ? 2.9 : s.x, z: s.z == null ? 2.2 : s.z, a: s.a == null ? Math.PI : s.a }, true);
  G.state = 'play'; G.deadT = 0;
  $('title').hidden = true; $('intro').hidden = true; $('over').hidden = true; $('ending').hidden = true; $('inv').hidden = true;
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
const INTRO_LINES = [
  [0, 'あめの よる。\nわすれものを とりに きた。'],
  [1.5, '2ねん1くみで チャイムが！\nランドセルが うごいてる！？'],
  [3.4, 'がっこうが おばけに！？\nおふだ 3まいで しずめよう。'],
  [5.4, 'みずでっぽうで まもろう。\nげんかんへ いこう。'],
];
function startNewGame(withIntro) {
  initAudio();
  resetWorld();
  hideAllOverlays();
  G.time = 0; G.state = withIntro ? 'intro' : 'play';
  G.introT = 0; G.introStep = -1;
  $('title').hidden = true; titleShown = false;
  enterRoom('classroom', { x: 2.9, z: 2.2, a: Math.PI }, true);
  fadeEl.style.opacity = '0';
  if (withIntro) {
    $('intro').hidden = false; $('introLine').textContent = INTRO_LINES[0][1];
    $('introLine').style.opacity = '1';
  } else {
    $('intro').hidden = true;
    G.roomTitle = 2.4; G.roomTitleText = '2ねん1くみ';
  }
  updateContinueUI(); updateInvUI();
  saveGame();
}
function finishIntro() {
  $('intro').hidden = true;
  G.state = 'play';
  G.roomTitle = 2.6; G.roomTitleText = '2ねん1くみ';
  say('3まいの おふだを さがそう。', 2.4);
}
function updateIntro(dt) {
  G.introT += dt;
  let idx = 0;
  for (let i = 0; i < INTRO_LINES.length; i++) if (G.introT >= INTRO_LINES[i][0]) idx = i;
  if (idx !== G.introStep) {
    G.introStep = idx;
    $('introLine').style.opacity = '0';
    setTimeout(() => { $('introLine').textContent = INTRO_LINES[idx][1]; $('introLine').style.opacity = '1'; }, 120);
  }
  if (G.introT > 7.2) finishIntro();
}
function finishGame() {
  G.state = 'ending';
  G.aiming = false; G.keys = Object.create(null);
  $('ending').hidden = false;
  $('endTime').textContent = fmtTime(G.time);
  $('endShots').textContent = G.shots;
  $('endHp').textContent = G.hp;
  SFX.win();
  try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
  updateContinueUI();
}
function retry() {
  $('over').hidden = true;
  if (!loadGame()) startNewGame(false);
}
function toTitle() {
  G.state = 'title'; G.aiming = false; G.keys = Object.create(null); G.touch = Object.create(null);
  hideAllOverlays();
  $('title').hidden = false; titleShown = true;
  pauseVeil.style.opacity = '0'; fadeEl.style.opacity = '0';
  updateContinueUI();
}
function hideAllOverlays() {
  for (const id of ['intro', 'inv', 'over', 'ending']) { const el = $(id); if (el) el.hidden = true; }
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
  if (!activeRoom || G.state === 'title' || G.state === 'intro' || G.state === 'ending') return;
  const R = activeRoom;
  // 部屋名
  hudText(R.name, 9, 8, 9, 'rgba(232,225,207,.85)');
  // おふだ
  hudText(`おふだ ${G.charms}/3`, 311, 8, 9, G.charms >= 3 ? '#ffd76a' : '#d8cfae', 'right');
  // 体力
  const hpColor = G.hp <= 1 ? '#ff5a4a' : G.hp === 2 ? '#ffb24a' : '#d84a3a';
  HUD.font = '13px "DotGothic16",monospace'; HUD.textAlign = 'left'; HUD.textBaseline = 'top';
  HUD.fillStyle = hpColor;
  let hearts = '';
  for (let i = 0; i < G.maxHp; i++) hearts += i < G.hp ? '♥' : '♡';
  HUD.fillText(hearts, 9, 216);
  // 水 / やくそう
  hudText(`みず ${G.ammo}`, 311, 216, 10, G.ammo <= 2 ? '#ff8a6a' : '#cfe8f5', 'right');
  hudText(`やくそう ${G.herbs}`, 311, 202, 8, '#a9d8a0', 'right');
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
  // オートセーブ
  if (G.autosave > 0) hudText('オートセーブ', 160, 30, 8, 'rgba(200,192,170,.8)', 'center');
  // ねらい
  if (G.aiming && G.target && !G.target.dead) {
    const pos = blockPos(G.target);
    if (pos.ok) {
      const s = clamp(14 - Math.min(10, dist2(G.p.x, G.p.z, G.target.group.position.x, G.target.group.position.z) * .4), 6, 14);
      HUD.strokeStyle = G.target.boss ? '#ffcf6a' : '#dff1ff'; HUD.lineWidth = 1;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        HUD.beginPath();
        HUD.moveTo(pos.x + sx * s, pos.y + sy * s - sy * 4);
        HUD.lineTo(pos.x + sx * s, pos.y + sy * s);
        HUD.lineTo(pos.x + sx * s - sx * 4, pos.y + sy * s);
        HUD.stroke();
      }
    }
  }
  // ボス HP
  if (G.bossFight && G.boss && !G.boss.dead) {
    const w = 150, x = 85, y = 22;
    hudPanel(x - 5, y - 5, w + 10, 16);
    HUD.fillStyle = '#7a201c'; HUD.fillRect(x, y + 3, w, 4);
    HUD.fillStyle = '#d8493a'; HUD.fillRect(x, y + 3, w * clamp(G.boss.hp / G.boss.max, 0, 1), 4);
    hudText('ロッカーだいおう', 160, y - 9, 8, '#e8d8c0', 'center');
  }
  // 低体力の 赤
  if (G.hp <= 1 && G.state === 'play') {
    const a = .10 + .05 * Math.sin(performance.now() / 260);
    const gr = HUD.createRadialGradient(160, 120, 50, 160, 120, 190);
    gr.addColorStop(0, 'rgba(120,10,10,0)'); gr.addColorStop(1, `rgba(150,12,12,${a})`);
    HUD.fillStyle = gr; HUD.fillRect(0, 0, 320, 240);
  }
  // 火花
  for (const s of G.sparks) {
    HUD.globalAlpha = clamp(1 - s.t / s.life, 0, 1);
    HUD.fillStyle = s.c; HUD.fillRect(s.x | 0, s.y | 0, 2, 2);
  }
  HUD.globalAlpha = 1;
}
function blockPos(e) {
  return projectToScreen(e.group.position.x, e.group.position.y + (e.boss ? 1.5 : .8), e.group.position.z);
}
function updateSparks(dt) {
  for (const s of G.sparks) { s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 150 * dt; }
  G.sparks = G.sparks.filter(s => s.t < s.life);
}
function updatePrompt() {
  const it = nearestItem();
  if (it) { G.prompt = `[E] ${it.def.label || 'しらべる'}`; return; }
  const door = nearestDoor();
  if (door) { G.prompt = `[E] ${door.label}`; return; }
  if (activeRoom.gate && activeRoom.gateSpot && dist2(G.p.x, G.p.z, activeRoom.gateSpot.x, activeRoom.gateSpot.z) < 1.5) {
    G.prompt = G.charms >= 3 ? '[E] 校門を あける' : '[E] 校門を しらべる'; return;
  }
  G.prompt = '';
}

/* ===== 明かりの ちらつき ===== */
function updateRoomFx() {
  if (!activeRoom) return;
  const t = performance.now() / 1000;
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
  G.state = 'inventory'; G.aiming = false; G.keys = Object.create(null); G.touch = Object.create(null);
  $('inv').hidden = false; pauseVeil.style.opacity = '1';
  updateInvUI();
}
function closeInventory() {
  if (G.state !== 'inventory') return;
  $('inv').hidden = true; pauseVeil.style.opacity = '0';
  G.state = 'play';
}
function updateInvUI() {
  $('invHp').textContent = '♥'.repeat(Math.max(0, G.hp)) + '♡'.repeat(Math.max(0, G.maxHp - G.hp));
  $('invAmmo').textContent = G.ammo;
  $('invHerb').textContent = G.herbs;
  $('invCharm').textContent = `${G.charms} / 3`;
  $('invRoom').textContent = (ROOMS[G.room] || {}).name || '？';
  $('invTime').textContent = fmtTime(G.time);
  $('invObjective').textContent = G.charms >= 3 ? 'げんかんの 校門へ。' : '3まいの おふだを さがそう。';
  $('btnControl').textContent = G.mode === 'tank' ? 'タンク（ホラー風）' : 'モダン（カメラ基準）';
  $('btnSound').textContent = G.sound ? 'オン' : 'オフ';
  $('btnFx').textContent = G.fx ? 'オン' : 'オフ';
  $('btnHerb').disabled = !(G.herbs > 0 && G.hp < G.maxHp);
  $('btnMode').textContent = `そうさ：${G.mode === 'tank' ? 'タンク' : 'モダン'}`;
  $('btnTitleSound').textContent = `おと：${G.sound ? 'オン' : 'オフ'}`;
  $('tMute').textContent = G.sound ? '♪' : '×';
}
function setMode(mode) {
  G.mode = mode;
  try { localStorage.setItem('obake-ps1-mode', mode); } catch (_) {}
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
    if (G.state === 'title') {
      if (['Enter', 'Space', 'KeyE', 'KeyJ'].includes(c)) startNewGame(true);
      return;
    }
    if (G.state === 'intro') {
      if (['Enter', 'Space', 'KeyE', 'KeyJ'].includes(c)) finishIntro();
      return;
    }
    if (G.state === 'inventory') {
      if (['Escape', 'KeyI', 'Tab'].includes(c)) closeInventory();
      if (c === 'KeyH') useHerb();
      return;
    }
    if (G.state === 'dead') { if (c === 'Enter') retry(); return; }
    if (G.state === 'ending') return;
    if (G.state !== 'play') return;
    const k = keyName(c);
    if (k) G.keys[k] = true;
    if (c === 'ShiftLeft' || c === 'ShiftRight') G.keys[c] = true;
    if (c === 'KeyE') interact();
    else if (c === 'KeyJ' || c === 'Enter') fire();
    else if (c === 'KeyI' || c === 'Escape' || c === 'Tab') openInventory();
    else if (c === 'KeyH') useHerb();
    else if (c === 'KeyM') toggleSound();
    else if (c === 'Space') G.keys.Space = true;
  });
  addEventListener('keyup', e => {
    const k = keyName(e.code);
    if (k) G.keys[k] = false;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') G.keys[e.code] = false;
    if (e.code === 'Space') G.keys.Space = false;
  });
  addEventListener('blur', () => { G.keys = Object.create(null); G.touch = Object.create(null); G.touchAim = false; });

  const stage = $('stage');
  stage.addEventListener('contextmenu', e => e.preventDefault());
  stage.addEventListener('mousedown', e => {
    if (G.state !== 'play') return;
    if (e.button === 2) { G.mouseAim = true; e.preventDefault(); }
    else if (e.button === 0) fire();
  });
  addEventListener('mouseup', e => { if (e.button === 2) G.mouseAim = false; });

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
  bindHold('tAim', () => { G.touchAim = true; $('tAim').classList.add('on'); }, () => { G.touchAim = false; $('tAim').classList.remove('on'); });
  $('tFire').addEventListener('pointerdown', e => { e.preventDefault(); fire(); });
  $('tAct').addEventListener('pointerdown', e => { e.preventDefault(); interact(); });
  $('tItem').addEventListener('pointerdown', e => { e.preventDefault(); openInventory(); });
  $('tMute').addEventListener('pointerdown', e => { e.preventDefault(); toggleSound(); });

  $('btnNew').addEventListener('click', () => startNewGame(true));
  $('btnContinue').addEventListener('click', () => { if (!loadGame()) startNewGame(true); });
  $('btnMode').addEventListener('click', () => setMode(G.mode === 'tank' ? 'modern' : 'tank'));
  $('btnTitleSound').addEventListener('click', () => { initAudio(); toggleSound(); });
  $('btnResume').addEventListener('click', closeInventory);
  $('btnHerb').addEventListener('click', useHerb);
  $('btnInvTitle').addEventListener('click', () => { $('inv').hidden = true; pauseVeil.style.opacity = '0'; toTitle(); });
  $('btnControl').addEventListener('click', () => setMode(G.mode === 'tank' ? 'modern' : 'tank'));
  $('btnSound').addEventListener('click', toggleSound);
  $('btnFx').addEventListener('click', toggleFx);
  $('btnRetry').addEventListener('click', retry);
  $('btnOverTitle').addEventListener('click', () => { $('over').hidden = true; toTitle(); });
  $('btnEndAgain').addEventListener('click', () => { $('ending').hidden = true; toTitle(); startNewGame(false); });
  $('btnEndTitle').addEventListener('click', () => { $('ending').hidden = true; toTitle(); });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      G.keys = Object.create(null); G.touch = Object.create(null); G.touchAim = false;
      if (AudioSys.ctx && AudioSys.ctx.state === 'running') AudioSys.ctx.suspend();
    } else if (AudioSys.ctx && AudioSys.ctx.state === 'suspended') AudioSys.ctx.resume();
  });
}

/* ===== ループ ===== */
function update(dt) {
  if (G.state === 'title') return;
  if (G.state === 'intro') { updateIntro(dt); updateRoomFx(); return; }
  if (G.state === 'ending') { return; }
  if (G.state === 'dead') { G.deadT += dt; updateParticles(dt); updateSparks(dt); return; }
  if (G.state === 'inventory') { updateRoomFx(); return; }
  if (G.state === 'transition') { updateTransition(dt); updateRoomFx(); updateParticles(dt); updateSparks(dt); return; }
  if (G.state !== 'play') return;

  G.time += dt;
  G.aiming = !!(G.keys.Space || G.touchAim || G.mouseAim);
  if (G.aiming) G.aimT += dt; else G.aimT = 0;
  G.fireCd = Math.max(0, G.fireCd - dt);
  G.invuln = Math.max(0, G.invuln - dt);
  G.hurt = Math.max(0, G.hurt - dt * 1.6);
  G.flash = Math.max(0, G.flash - dt * 2.6);
  G.msgT = Math.max(0, G.msgT - dt);
  G.roomTitle = Math.max(0, G.roomTitle - dt);
  G.autosave = Math.max(0, G.autosave - dt);
  updatePlayer(dt);
  updateEnemies(dt);
  updateProjectiles(dt);
  updateTracers(dt);
  updateParticles(dt);
  updateSparks(dt);
  updateRoomFx();
  G.target = G.aiming ? findTarget(10.5, .5) : null;
  updatePrompt();
  if (G.hp <= 1) {
    G.heartT -= dt;
    if (G.heartT <= 0) { G.heartT = 1.15; tone(62, .25, 'sine', .07); tone(52, .3, 'sine', .06, 0, .24); }
  }
  flashEl.style.opacity = String(Math.max(G.hurt * .9, G.flash * .55));
  flashEl.style.background = G.flash > G.hurt ? '#d8c58a' : '#b42424';
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
    G, ROOMS, startNewGame, loadGame, saveGame, hasSave, resetWorld,
    enterRoom, changeRoom, updateTransition, interact, pickupItem, useHerb, fire,
    hurtPlayer, damageEnemy, killGhost, killBoss, findTarget, updateCamera,
    update, updatePlayer, updateEnemies, updateBoss, updateProjectiles, nearestItem, nearestDoor,
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
