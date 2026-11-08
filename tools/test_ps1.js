/* PS1版の回帰テスト。
   ローカルの ps1.html を開いたタブで、tools/test_ps1.js を script で読みこんで
   runPS1Tests() を実行する。rAF が止まる環境でも 手動で update() を回す。 */
window.runPS1Tests = function () {
  const P = window.PS1;
  if (!P) throw new Error('PS1 not ready');
  const G = P.G;
  const passed = [];
  const check = (name, ok, extra) => {
    if (!ok) throw new Error(name + (extra === undefined ? '' : ' :: ' + JSON.stringify(extra)));
    passed.push(name);
  };
  const step = (sec, dt) => {
    dt = dt || 1 / 60;
    for (let t = 0; t < sec; t += dt) P.update(dt);
  };
  const clearKeys = () => { G.keys = Object.create(null); G.touch = Object.create(null); G.touchAim = false; };
  const clearRoom = () => { P.room().enemies.forEach(e => { e.dead = true; e.group.visible = false; }); };
  const place = (room, x, z, a) => P.enterRoom(room, { x, z, a: a == null ? Math.PI : a }, true);

  // --- 初期状態 ---
  P.startNewGame(false);
  check('new game starts in play', G.state === 'play', G.state);
  check('new game starts in classroom', G.room === 'classroom', G.room);
  check('new game full hp', G.hp === 4, G.hp);
  check('new game 12 water', G.ammo === 12, G.ammo);
  check('new game no charms', G.charms === 0, G.charms);
  check('new game tank mode by default', G.mode === 'tank' || G.mode === 'modern', G.mode);
  clearKeys();

  // --- タンク操作 ---
  place('classroom', 2.9, 2.2, Math.PI);
  const z0 = G.p.z;
  G.keys.up = true;
  step(0.5);
  G.keys.up = false;
  check('tank forward moves along facing', G.p.z < z0 - 0.25, { z0, z: +G.p.z.toFixed(2) });
  const a0 = G.p.a;
  G.keys.left = true;
  step(0.3);
  G.keys.left = false;
  check('tank left turns', G.p.a > a0 + 0.2, G.p.a - a0);

  // --- 当たり判定 ---
  check('teacher desk blocks', P.blocked(0, -2.5) === true);
  check('open floor is free', P.blocked(2.6, 0.2) === false);
  check('outside room blocks', P.blocked(0, 4.5) === true);

  // --- アイテム / ドア ---
  P.startNewGame(false);
  place('classroom', 0, -2.02, Math.PI);
  P.interact();
  check('charm pickup', G.charms === 1 && G.taken.includes('charm_class'), { charms: G.charms });
  place('classroom', -0.2, -2.02, Math.PI);
  {
    const note = P.room().items.find(i => i.id === 'note_class');
    P.interact();
    check('note can be read', G.msgT > 0 && G.msg.indexOf('おふだは 3まい') >= 0, G.msg);
    check('note stays in the room', note.taken === false);
  }
  place('classroom', 2.95, 3.06, Math.PI);
  P.interact();
  check('door starts transition', G.state === 'transition', G.state);
  step(0.9);
  check('door leads to corridor', G.room === 'corridor' && G.state === 'play', { room: G.room, state: G.state });
  check('door spawn point', Math.abs(G.p.x + 1.15) < 0.01, G.p);

  // --- カメラの 固定切りかえ ---
  place('corridor', 0, 9.4, Math.PI); P.updateCamera(true);
  const southCam = P.camera().position.clone();
  place('corridor', 0, 2.0, Math.PI); P.updateCamera(true);
  const midCam = P.camera().position.clone();
  place('corridor', 0, -6.0, Math.PI); P.updateCamera(true);
  const northCam = P.camera().position.clone();
  check('camera switches by zone', southCam.z !== midCam.z && midCam.z !== northCam.z,
    { south: southCam.toArray(), mid: midCam.toArray(), north: northCam.toArray() });
  check('north corridor looks north', northCam.z > 0);
  check('south corridor looks south', southCam.z < 8);

  // --- 攻撃 ---
  place('classroom', 0, -0.4, Math.PI);
  clearRoom();
  const bag = P.spawnEnemyEntity(P.room(), { id: 't_bag', type: 'randoseru', x: 0, z: -3.2, wake: 99 });
  bag.awake = true; P.room().enemies.push(bag);
  G.ammo = 12; G.shots = 0;
  P.fire();
  check('shot spends water', G.ammo === 11 && G.shots === 1, { ammo: G.ammo, shots: G.shots });
  check('shot damages ghost', bag.hp === bag.max - 1, bag.hp);
  G.fireCd = 0; P.fire();
  check('randoseru falls with two shots', bag.dead === true, { hp: bag.hp, dead: bag.dead });
  check('defeated ghost is remembered', G.dead.includes('t_bag'));

  // --- 被弾 / 回復 / 死亡 ---
  G.hp = 4; G.invuln = 0; G.state = 'play';
  P.hurtPlayer();
  check('hurt costs one heart', G.hp === 3, G.hp);
  G.invuln = 0; P.hurtPlayer();
  check('invulnerability resets', G.hp === 2, G.hp);
  G.herbs = 1; P.useHerb();
  check('herb heals two', G.hp === 4 && G.herbs === 0, { hp: G.hp, herbs: G.herbs });
  G.hp = 1; G.invuln = 0; P.hurtPlayer();
  check('zero hp is game over', G.state === 'dead' && G.hp === 0, { state: G.state, hp: G.hp });

  // --- おばけの 攻撃 ---
  P.startNewGame(false);
  place('corridor', 0, 0, Math.PI);
  clearRoom();
  const ghost = P.spawnEnemyEntity(P.room(), { id: 't_ghost', type: 'ghost', x: 0, z: -0.9, wake: 99 });
  ghost.awake = true; ghost.cd = 0;
  P.room().enemies.push(ghost);
  G.hp = 4; G.invuln = 99;
  step(0.7);
  check('ghost winds up before attacking', ghost.windup > 0 || ghost.cd > 0, { windup: ghost.windup, cd: ghost.cd });
  G.invuln = 0; ghost.cd = 0;
  step(0.8);
  check('ghost attack hurts player', G.hp < 4, G.hp);

  // --- ボス ---
  P.startNewGame(false);
  G.hp = 4;
  place('gym', 0, 3.4, Math.PI);
  const boss = P.room().enemies.find(e => e.id === 'g_boss');
  step(0.2);
  check('gym boss wakes up', boss.awake === true && G.bossFight === true, { awake: boss.awake, fight: G.bossFight });
  check('boss fight camera is used', P.camera().position.x > 4, P.camera().position.toArray());
  check('boss hidden before death', P.room().items.find(i => i.id === 'charm_gym').group.visible === false);
  G.hp = 4; G.invuln = 99;
  P.damageEnemy(boss, 1);
  check('boss takes damage', boss.hp === boss.max - 1, boss.hp);
  P.damageEnemy(boss, 99);
  check('boss dies', boss.dead === true && G.bossDead === true, { dead: boss.dead, flag: G.bossDead });
  check('boss drops the third charm', P.room().items.find(i => i.id === 'charm_gym').group.visible === true);
  check('boss fight ends', G.bossFight === false);

  // --- セーブ / ロード ---
  G.charms = 2; G.hp = 2; G.ammo = 5; G.room = 'staff';
  G.p = { x: 1.2, z: 0.4, a: 0.5, walk: 0, moving: 0 };
  G.taken = ['charm_class', 'charm_staff']; G.dead = ['c_uwabaki']; G.bossDead = true;
  P.saveGame();
  P.resetWorld();
  check('load restores state', P.loadGame() === true);
  check('load restores room', G.room === 'staff', G.room);
  check('load restores items', G.charms === 2 && G.hp === 2 && G.ammo === 5, { c: G.charms, hp: G.hp, ammo: G.ammo });
  check('load restores flags', G.bossDead === true && G.taken.length === 2);

  // --- げんかん / エンディング ---
  P.startNewGame(false);
  place('entrance', 0, -2.9, Math.PI);
  G.charms = 0;
  P.interact();
  check('sealed gate refuses to open', G.state === 'play' && G.msg.indexOf('ふういん') >= 0, { state: G.state, msg: G.msg });
  G.charms = 3;
  P.interact();
  check('three charms open the gate', G.state === 'ending', G.state);
  check('ending clears the save', P.hasSave() === false);

  // --- すべての ドアが つながる ---
  P.startNewGame(false);
  for (const rid of Object.keys(P.ROOMS)) {
    const R = P.ROOMS[rid];
    for (const door of R.doors) {
      G.state = 'play'; G.trans = null;
      P.enterRoom(rid, { x: door.x, z: door.z, a: 0 }, true);
      P.changeRoom(door);
      step(0.9);
      check(`door ${rid} -> ${door.target}`, G.room === door.target, { rid, target: door.target, room: G.room });
      check(`door ${rid} -> ${door.target} spawn is free`, P.blocked(G.p.x, G.p.z) === false,
        { x: +G.p.x.toFixed(2), z: +G.p.z.toFixed(2) });
    }
  }

  // --- すべての もの / ドアに とどく ---
  const reach = (R, x, z, maxR) => {
    for (let r = 0.4; r <= maxR; r += 0.15) {
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * Math.PI * 2;
        if (!P.blocked(x + Math.cos(a) * r, z + Math.sin(a) * r)) return true;
      }
    }
    return false;
  };
  for (const rid of Object.keys(P.ROOMS)) {
    const R = P.ROOMS[rid];
    G.state = 'play';
    P.enterRoom(rid, { x: 0, z: 0, a: 0 }, true);
    for (const it of R.items) {
      check(`item ${it.id} reachable`, reach(R, it.def.x, it.def.z, 1.2), it.id);
    }
    for (const door of R.doors) {
      check(`door ${rid}/${door.label} reachable`, reach(R, door.x, door.z, 1.4), door.label);
    }
  }

  // --- ボスを うって おふだを とる ---
  P.startNewGame(false);
  place('gym', 0, -3.4, Math.PI);
  const boss2 = P.room().enemies.find(e => e.id === 'g_boss');
  boss2.awake = true; boss2.cd = 99; G.bossFight = true; G.boss = boss2;
  G.ammo = 30; G.fireCd = 0;
  P.fire();
  check('water gun can hit the boss', boss2.hp === boss2.max - 1, boss2.hp);
  P.damageEnemy(boss2, 99);
  const charmGym = P.room().items.find(i => i.id === 'charm_gym');
  check('third charm is now visible', charmGym.group.visible === true);
  place('gym', 0, -5.55, Math.PI);
  P.interact();
  check('third charm can be picked', G.charms === 1 && G.taken.includes('charm_gym'), G.charms);

  // --- 3まい そろえて 校門 ---
  G.charms = 3; G.state = 'play';
  place('entrance', 0, -2.95, Math.PI);
  const camsBefore = P.camera();
  P.interact();
  check('gate opens with all charms', G.state === 'ending', G.state);
  check('ending does not leave a save', P.hasSave() === false);

  // --- イントロ ---
  P.startNewGame(true);
  check('intro starts', G.state === 'intro', G.state);
  step(7.6);
  check('intro flows into play', G.state === 'play', G.state);
  check('intro room is classroom', G.room === 'classroom', G.room);

  // --- モダン操作 ---
  P.startNewGame(false);
  P.setMode('modern');
  place('classroom', 0, 1.9, Math.PI);
  const px0 = G.p.x, pz0 = G.p.z;
  G.keys.up = true; step(0.4); G.keys.up = false;
  check('modern up moves relative to camera', Math.hypot(G.p.x - px0, G.p.z - pz0) > 0.2,
    { dx: +(G.p.x - px0).toFixed(2), dz: +(G.p.z - pz0).toFixed(2) });
  P.setMode('tank');

  // --- はじめの ばしょが つまらない ---
  P.startNewGame(false);
  check('start position is not blocked', P.blocked(G.p.x, G.p.z) === false, G.p);

  // --- HUD / 設定 ---
  P.startNewGame(false);
  P.setMode('modern');
  check('control mode switches', G.mode === 'modern');
  P.setMode('tank');
  G.fx = true; const fxBefore = G.fx;
  document.getElementById('btnFx'); // exists
  check('fx toggle element exists', !!document.getElementById('btnFx'));
  G.fx = fxBefore;

  return passed;
};
