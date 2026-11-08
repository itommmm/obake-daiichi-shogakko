/* PS1版（なぞとき だっしゅつ）の回帰テスト。
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
  const clearKeys = () => { G.keys = Object.create(null); G.touch = Object.create(null); };
  const place = (room, x, z, a) => P.enterRoom(room, { x, z, a: a == null ? Math.PI : a }, true);
  const item = (room, id) => P.ROOMS[room].items.find(i => i.id === id);
  const spot = (room, id) => P.ROOMS[room].spots.find(s => s.id === id);
  const doorTo = (room, target) => P.ROOMS[room].doors.find(d => d.target === target);
  const at = (room, x, z) => { G.state = 'play'; G.trans = null; place(room, x, z); };
  const atSpot = (room, id) => { const s = spot(room, id); at(room, s.x, s.z + .2); return s; };
  const pick = (room, id) => { const it = item(room, id); at(room, it.def.x, it.def.z + .3); G.msgT = 0; P.interact(); return it; };
  const use = (room, id) => { atSpot(room, id); G.msgT = 0; P.interact(); };
  const goThrough = (room, target) => { const d = doorTo(room, target); at(room, d.x, d.z); P.interact(); step(0.9); return d; };

  // --- 初期状態：げんかんで とじこめられて はじまる ---
  P.startNewGame(false);
  P.setMode('modern');
  check('modern controls are the default', G.mode === 'modern' && document.getElementById('stage').classList.contains('mode-modern'));
  check('joystick and look zone exist', !!document.getElementById('joystick') && !!document.getElementById('lookZone'));
  check('new game starts in play', G.state === 'play', G.state);
  check('new game starts in entrance', G.room === 'entrance', G.room);
  check('new game full hp', G.hp === 4, G.hp);
  check('new game empty bag', G.bag.length === 0 && G.fixed.length === 0, { bag: G.bag, fixed: G.fixed });
  check('no water gun any more', typeof P.fire === 'undefined' && G.ammo === undefined);
  check('start position is not blocked', P.blocked(G.p.x, G.p.z) === false, G.p);
  check('objective points to classroom', P.objective().indexOf('2ねん1くみ') >= 0, P.objective());
  clearKeys();

  // --- 旧タンク操作：設定から切り替えた時だけ動作する ---
  P.setMode('tank');
  place('classroom', 2.9, 2.2, Math.PI);
  const z0 = G.p.z;
  G.keys.up = true; step(0.5); G.keys.up = false;
  check('tank forward moves along facing', G.p.z < z0 - 0.25, { z0, z: +G.p.z.toFixed(2) });
  const a0 = G.p.a;
  G.keys.left = true; step(0.3); G.keys.left = false;
  check('tank left turns', G.p.a > a0 + 0.2, G.p.a - a0);
  P.setMode('modern');

  // --- 当たり判定 ---
  check('teacher desk blocks', P.blocked(0, -2.5) === true);
  check('open floor is free', P.blocked(2.6, 0.2) === false);
  check('outside room blocks', P.blocked(0, 4.5) === true);

  // --- げんかんの ドアは あかない ---
  P.startNewGame(false);
  use('entrance', 'gate');
  check('locked-in door refuses', G.state === 'play' && G.msg.indexOf('あかない') >= 0, G.msg);

  // --- 2ねん1くみ：しゅくだい（1回目）→ こくばんけし → こくばん ---
  use('classroom', 'homework');
  check('homework glimpse line', G.msg.indexOf('しゅくだいの ノート') >= 0 && G.msg.indexOf('あとで あとで') >= 0, G.msg);
  check('homework is not taken', !G.bag.some(id => id.indexOf('homework') >= 0) && G.flags.homework === true);
  use('classroom', 'board');
  check('board needs an eraser', G.fixed.length === 0 && G.msg.indexOf('らくがき') >= 0, G.msg);
  check('key hidden before board is cleaned', item('classroom', 'key_staff').group.visible === false);
  pick('classroom', 'eraser');
  check('eraser goes to the bag', G.bag.includes('eraser'), G.bag);
  use('classroom', 'board');
  check('board cleaned restores classroom', G.fixed.includes('classroom'), G.fixed);
  check('classroom ghosts leave', P.ROOMS.classroom.enemies.every(e => e.dead), P.ROOMS.classroom.enemies.map(e => e.dead));
  check('blackboard texture is clean', P.ROOMS.classroom.board.material.map === TEX.blackboard);
  check('key appears after restore', item('classroom', 'key_staff').group.visible === true);
  use('classroom', 'board');
  check('clean board shows first digit', G.msg.indexOf('1ばんめ＝5') >= 0, G.msg);

  // --- しょくいんしつ：かぎ ---
  const staffDoor = doorTo('corridor', 'staff');
  at('corridor', staffDoor.x, staffDoor.z);
  G.bag = G.bag.filter(id => id !== 'key_staff'); G.flags.staffOpen = false;
  P.interact();
  check('staff door locked without key', G.state === 'play' && G.room === 'corridor' && G.msg.indexOf('かぎ') >= 0, { s: G.state, msg: G.msg });
  pick('classroom', 'key_staff');
  check('key in the bag', G.bag.includes('key_staff'));
  goThrough('corridor', 'staff');
  check('key opens staff room', G.room === 'staff' && G.flags.staffOpen === true, { room: G.room, f: G.flags });

  // --- とけい：でんち ---
  use('staff', 'clock');
  check('clock needs a battery', !G.fixed.includes('staff') && G.msg.indexOf('でんち') >= 0, G.msg);
  pick('corridor', 'battery');
  check('battery in the bag', G.bag.includes('battery'));
  use('staff', 'clock');
  check('clock restores staff room', G.fixed.includes('staff') && G.fixed.length === 2, G.fixed);
  check('staff ghosts leave', P.ROOMS.staff.enemies.every(e => e.dead));
  use('staff', 'clock');
  check('clock shows second digit', G.msg.indexOf('2ばんめ＝1') >= 0, G.msg);
  pick('staff', 'whistle');
  check('whistle in the bag', G.bag.includes('whistle'));
  pick('corridor', 'note_corridor');
  check('corridor poster shows third digit', G.msg.indexOf('3ばんめは ７') >= 0, G.msg);

  // --- たいいくかん：ばんごうロック ---
  const gymDoor = doorTo('corridor', 'gym');
  at('corridor', gymDoor.x, gymDoor.z);
  P.interact();
  check('gym door opens the lock', G.state === 'lock' && !document.getElementById('lock').hidden, G.state);
  check('wrong code fails', P.lockTry() === false && G.state === 'lock' && G.flags.gymOpen !== true);
  P.lockSpin(0, 5); P.lockSpin(1, 1); P.lockSpin(2, -3);
  check('dials wrap around', G.lock.digits.join('') === '517', G.lock.digits);
  check('right code opens', P.lockTry() === true && G.flags.gymOpen === true && G.state === 'transition', G.state);
  step(0.9);
  check('gym reached', G.room === 'gym' && G.state === 'play', { room: G.room, s: G.state });
  P.openLock(gymDoor); P.closeLock();
  check('lock can be cancelled', G.state === 'play' && document.getElementById('lock').hidden);

  // --- ロッカーだいおう（たおせない）→ ふえ ---
  // クラシックのボス演出用固定カメラも残す
  P.setMode('tank');
  at('gym', 0, 3.4);
  const boss = P.room().enemies.find(e => e.id === 'g_boss');
  step(0.2);
  check('gym boss wakes up', boss.awake === true && G.bossFight === true, { awake: boss.awake, fight: G.bossFight });
  check('classic boss camera is used', P.camera().position.x > 4, P.camera().position.toArray());
  P.setMode('modern');
  check('modern boss uses follow camera', G.mode === 'modern' && !P.blocked(P.camera().position.x, P.camera().position.z));
  G.bag = G.bag.filter(id => id !== 'whistle');
  use('gym', 'stage');
  check('stage needs the whistle', !G.fixed.includes('gym'), G.fixed);
  G.bag.push('whistle');
  G.invuln = 99;
  use('gym', 'stage');
  check('whistle restores gym', G.fixed.includes('gym') && G.bossDead === true && G.bossFight === false, { f: G.fixed });
  check('boss leaves', boss.dead === true);
  check('all ghosts leave when school is restored', Object.values(P.ROOMS).every(R => R.enemies.every(e => e.dead)));
  check('objective points to the door', P.objective().indexOf('げんかん') >= 0, P.objective());

  // --- セーブ / ロード ---
  G.hp = 2; G.room = 'staff';
  G.p = { x: 1.2, z: 0.4, a: 0.5, walk: 0, moving: 0 };
  P.saveGame();
  const snapBag = G.bag.slice(), snapFixed = G.fixed.slice();
  G.scareSeen = ['test-scare-save']; P.saveGame();
  P.resetWorld();
  check('reset clears progress', G.fixed.length === 0 && G.bag.length === 0);
  check('load restores state', P.loadGame() === true);
  check('load restores room', G.room === 'staff', G.room);
  check('load restores bag', JSON.stringify(G.bag) === JSON.stringify(snapBag), G.bag);
  check('load restores seen scares', G.scareSeen.includes('test-scare-save'));
  check('load restores fixed rooms and safe HP', JSON.stringify(G.fixed) === JSON.stringify(snapFixed) && G.hp === 4, G.fixed);
  check('load restores door flags', G.flags.staffOpen === true && G.flags.gymOpen === true, G.flags);
  check('load keeps ghosts gone', P.ROOMS.corridor.enemies.every(e => e.dead));

  // --- げんかん → エンディング ---
  use('entrance', 'gate');
  check('door opens after restoring all', G.state === 'ending', G.state);
  check('ending does not leave a save', P.hasSave() === false);
  check('ending starts on the first page', G.endStep === 0 && !document.getElementById('intro').hidden, G.endStep);
  step(20);
  check('ending does not auto-advance', G.endStep === 0 && document.getElementById('ending').hidden, G.endStep);
  P.advanceIntro(); P.advanceIntro();
  check('ending shows homework left in the desk', document.getElementById('introLine').textContent.indexOf('しゅくだいが のこっていた') >= 0);
  P.advanceIntro(); P.advanceIntro();
  check('ending punchline', document.getElementById('introLine').textContent.indexOf('あっ！！ わすれた！') >= 0
    && document.getElementById('introLine').classList.contains('punch'));
  P.advanceIntro();
  check('ending panel shows', !document.getElementById('ending').hidden && document.getElementById('intro').hidden);
  check('ending says おしまい', document.querySelector('#ending .big').textContent === 'おしまい');
  check('ending contains dawn and door animation', !!document.querySelector('#ending .dawn-scene .dawn-gate'));

  // --- イントロ：読むスピードを プレイヤーが きめる ---
  P.startNewGame(true);
  check('intro starts at first page', G.state === 'intro' && G.introStep === 0, G.state);
  check('intro says why player came to school', document.getElementById('introLine').textContent.indexOf('しゅくだい') >= 0);
  step(15);
  check('intro does not auto-skip', G.state === 'intro' && G.introStep === 0);
  P.advanceIntro(); P.advanceIntro();
  check('intro reaches the slam', G.introStep === 2 && document.getElementById('introLine').textContent.indexOf('とじこめられた') >= 0);
  P.advanceIntro(); P.advanceIntro();
  check('last intro page has the go button', document.getElementById('introNext').textContent === 'ゲームへ すすむ');
  P.advanceIntro();
  check('intro flows into play', G.state === 'play', G.state);
  check('intro room is entrance', G.room === 'entrance', G.room);
  P.startNewGame(true); P.finishIntro();
  check('intro can be skipped', G.state === 'play');

  // --- おばけの びっくり：ダメージなし・何度でも探索できる ---
  P.startNewGame(false);
  check('comic scare director has ten scripted moments', P.comic.BEATS.length >= 10);
  check('soundtrack cue and scare synthesis available', typeof SFX.comicScare === 'function' && typeof SFX.roomAmbience === 'function');
  place('corridor', 0, 0, Math.PI);
  P.room().enemies.forEach(e => { e.dead = true; e.group.visible = false; });
  const ghost = P.spawnEnemyEntity(P.room(), { id: 't_ghost', type: 'ghost', x: 0, z: -0.9, wake: 99 });
  ghost.awake = true; ghost.cd = 0; P.room().enemies.push(ghost);
  G.hp = 4; G.invuln = 99;
  step(0.7);
  check('ghost winds up before a scare', ghost.windup > 0 || ghost.cd > 0);
  G.invuln = 0; ghost.cd = 0; ghost.stagger = 0;
  step(0.8);
  check('ghost contact never decreases hp', G.hp === 4 && G.state === 'play', { hp:G.hp, state:G.state });
  check('ghost backs off after a scare', ghost.stagger > 0 || ghost.cd > 0);
  P.room().enemies.pop(); ghost.group.removeFromParent();
  G.hp = 1; G.invuln = 0; G.state = 'play';
  P.hurtPlayer();
  check('no deaths even with old-save low hp', G.hp === 1 && G.state === 'play');
  G.herbs = 1; P.useHerb();
  check('leaf grants a calm period', G.herbs === 0 && P.comic.status().safe > 0);
  check('leaf does not change hp', G.hp === 1);
  P.startNewGame(false);
  step(8);
  check('entrance has a scripted nonlethal surprise', G.damage >= 1 && G.hp === 4 && G.state === 'play', { count:G.damage, state:G.state });
  check('one-time entrance scene is remembered', G.scareSeen.includes('entrance-knock'));
  G.herbs = 1;
  P.useHerb();
  check('leaf suppresses consecutive scares', P.comic.scare('ghost') === false);
  P.startNewGame(false);
  G.fixed = []; G.bag = []; G.flags = {};
  P.openInventory();
  check('optional hint shows the eraser route', P.showHint().includes('こくばんけし'));
  P.closeInventory();

  // --- クラシックの固定カメラは引き続き使える ---
  P.startNewGame(false);
  P.setMode('tank');
  place('corridor', 0, 9.4, Math.PI); P.updateCamera(true);
  const southCam = P.camera().position.clone();
  place('corridor', 0, 2.0, Math.PI); P.updateCamera(true);
  const midCam = P.camera().position.clone();
  place('corridor', 0, -6.0, Math.PI); P.updateCamera(true);
  const northCam = P.camera().position.clone();
  check('camera switches by zone', southCam.z !== midCam.z && midCam.z !== northCam.z);
  P.setMode('modern');

  // --- すべての ドアが つながる ---
  for (const rid of Object.keys(P.ROOMS)) {
    for (const door of P.ROOMS[rid].doors) {
      G.state = 'play'; G.trans = null;
      P.enterRoom(rid, { x: door.x, z: door.z, a: 0 }, true);
      P.changeRoom(door);
      step(0.9);
      check(`door ${rid} -> ${door.target}`, G.room === door.target, { rid, target: door.target, room: G.room });
      check(`door ${rid} -> ${door.target} spawn is free`, P.blocked(G.p.x, G.p.z) === false,
        { x: +G.p.x.toFixed(2), z: +G.p.z.toFixed(2) });
    }
  }

  // --- すべての もの / しらべる ばしょ / ドアに とどく ---
  const reach = (x, z, maxR) => {
    for (let r = 0.3; r <= maxR; r += 0.1) {
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
    for (const it of R.items) check(`item ${it.id} reachable`, reach(it.def.x, it.def.z, 1.2), it.id);
    for (const s of R.spots) check(`spot ${s.id} reachable`, reach(s.x, s.z, s.r - .05), s.id);
    for (const door of R.doors) check(`door ${rid}/${door.label} reachable`, reach(door.x, door.z, 1.4), door.label);
  }

  // --- Roblox／Minecraft風の追従カメラと移動 ---
  P.startNewGame(false);
  P.setMode('modern');
  place('classroom', 0, 1.9, Math.PI);
  P.updateCamera(true);
  const beforeCam = P.camera().position.clone();
  const px0 = G.p.x, pz0 = G.p.z;
  G.keys.up = true; step(0.4); G.keys.up = false;
  check('modern up moves relative to camera', Math.hypot(G.p.x - px0, G.p.z - pz0) > 0.2);
  check('camera follows player', P.camera().position.distanceTo(beforeCam) > .15);
  check('modern camera stays in room bounds', !P.blocked(P.camera().position.x, P.camera().position.z));
  const yaw0 = G.camYaw, pitch0 = G.camPitch;
  P.modernControls.rotate(80, -45);
  check('mouse swipe rotates viewpoint', Math.abs(G.camYaw - yaw0) > .2 && G.camPitch < pitch0);
  G.keys.right = true;
  const x0 = G.p.x, zz0 = G.p.z;
  step(0.3); G.keys.right = false;
  check('modern strafe works at rotated camera', Math.hypot(G.p.x-x0, G.p.z-zz0) > .18);
  const stick = P.modernControls.stick(28,-35,100);
  check('virtual stick returns continuous axes', Math.abs(stick.x) > .1 && Math.abs(stick.y) > .1);
  P.modernControls.zeroStick();
  check('virtual stick resets after release', !G.touch.joyX && !G.touch.joyY);
  P.setMode('tank');
  check('legacy fixed camera returned', G.mode === 'tank');
  P.setMode('modern');

  // --- 画面 ---
  check('no shooting buttons', !document.getElementById('tFire') && !document.getElementById('tAim'));
  check('fx toggle element exists', !!document.getElementById('btnFx'));
  check('title has the story line', document.querySelector('#title .sub').textContent.indexOf('わすれものを とりに きたら') >= 0);

  P.startNewGame(false);
  return passed;
};
