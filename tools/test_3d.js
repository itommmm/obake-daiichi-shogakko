/* Load this file in a local index.html browser tab, then run runGameplayTests().
   Uses real gameplay functions and Three.js, without changing production globals. */
window.runGameplayTests = function () {
  const passed = [];
  const check = (name, ok) => { if (!ok) throw new Error(name); passed.push(name); };
  newGame(false);
  $('title').hidden = true;
  state = 'play';
  showHUD(true);
  if (innerHeight > 500) {
    check('skill labels remain inside viewport', [...document.querySelectorAll('.sk .lbl')].every(el => el.getBoundingClientRect().bottom <= innerHeight));
  }
  G.enemies = [];
  const bag = spawn('randoseru', 0, .5);
  bag.ph = 0; bag.t = .2; bag.appear = 1; screenOf(bag);
  ptr.x = bag.sx; ptr.y = bag.sy - bag.sr * .35;
  fire();
  check('open bag weak point defeats in one shot', bag.dead);

  G.enemies = [];
  const closed = spawn('randoseru', 0, .5);
  closed.ph = 0; closed.t = 2; closed.appear = 1; screenOf(closed);
  ptr.x = closed.sx; ptr.y = closed.sy; fire();
  check('closed bag still takes normal damage', closed.hp === 1 && !closed.dead);

  const pair = () => {
    G.enemies = [];
    const desk = spawn('tsukue', 0, .5), chair = spawn('isu', .1, .52);
    desk.t = 3; updateMerges(.1);
    return [desk, chair];
  };
  let [desk, chair] = pair();
  check('nearby desk and chair announce merge', desk.merge > 0);
  kill(chair);
  check('shooting chair interrupts merge', desk.merge === 0 && desk.hp === 1);
  [desk, chair] = pair(); kill(desk);
  check('shooting desk gives chain defeat', desk.dead && chair.dead);
  [desk, chair] = pair(); updateMerges(3); updEnemies(.01, true);
  check('uninterrupted pair becomes tower', desk.tower && chair.mergeOwner === desk);
  kill(desk);
  check('tower defeat releases surviving chair', chair.mergeOwner === null && chair.h === 0);
  [desk, chair] = pair(); updateMerges(3); bite(desk);
  check('tower arrival cannot cause a second chair hit', chair.dead);

  for (const index of [0, 4]) {
    startWave(index); state = 'play'; G.enemies = [];
    spawn('isu', .2, .5); G.ammo = 1;
    const target = trickScreen(); ptr.x = target.x; ptr.y = target.y;
    const shots = G.shotN, hits = G.hitShotN;
    fire();
    check(`stage ${index}: scene trick activates and counts as hit`, G.gimmick.used && G.shotN === shots + 1 && G.hitShotN === hits + 1);
    check(`stage ${index}: empty gun still reloads`, G.reload > 0);
    const oldScore = G.score; G.ammo = 30; G.reload = 0; fire();
    check(`stage ${index}: trick reward cannot be farmed`, G.score === oldScore);
  }
  for (const music of [false, true]) {
    newGame(false); startWave(1); state = 'clear'; G.clearT = 0;
    update(.1); check('route choice opens after hallway', state === 'route');
    const time = G.time; update(1);
    check('route choice does not consume time', G.time === time);
    chooseRoute(music);
    check('route has distinct room and enemy set', G.wave.place === (music ? 'gym' : 'science'));
    state = 'play'; waveClear(); startWave(3);
    check('route reward survives stage transition', G.pow.kind === (music ? 'wide' : 'jumbo') && G.pow.t === 10);
  }
  newGame(false); startWave(7); state = 'play';
  state = 'route'; ptr.x = W * .75; remoteData({ t: 'f', d: true });
  check('TV controller selects music route without stuck firing', G.route === 'music' && !ptr.down && !REMOTE.fire);
  state = 'route'; dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
  check('keyboard selects science route', G.route === 'science');
  state = 'route';
  cv.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse', clientX: W * .75, clientY: H * .5, button: 0 }));
  check('pointer selects music route', G.route === 'music');
  startWave(7); state = 'play';
  const boss = spawn('kousha'); boss.h = 0; boss.hT = 0;
  boss.mode = 'idle'; boss.mt = 0; boss.mouthOpen = 0; boss.tongue = 0;
  kAI(boss, .01, true);
  check('boss announces attack before emitting hazards', !!boss.nextAttack && G.enemies.length === 1);
  kAI(boss, 1.3, true);
  check('announced boss attack executes', !boss.nextAttack && !!boss.last);
  for (const [index, type] of [[6, 'locker'], [7, 'kousha']]) {
    startWave(index); state = 'play'; G.enemies = [];
    const guarded = spawn(type); guarded.armor = 2; G.sp = 100;
    const hp = guarded.hp; skillSp();
    check(`${type}: special breaks guard and deals guaranteed damage`, guarded.armor === 0 && guarded.hp <= hp - Math.ceil(guarded.max * .12) && G.sp < 100);
    guarded.armor = 2; G.bellCd = 0; const after = guarded.hp; skillBell();
    check(`${type}: bell opens guard and damages boss`, guarded.armor === 0 && guarded.hp < after && guarded.stun > 0);
    guarded.armor = .4; guarded.stun = 1;
    bossAI(guarded, .5, true);
    check(`${type}: stun does not prolong guard`, guarded.armor === 0);
    guarded.armor = .4;
    bossAI(guarded, .5, false);
    check(`${type}: non-live frames do not consume guard`, guarded.armor === .4);
  }
  startWave(2); state = 'play'; G.enemies = []; ptr.down = false;
  for (let i = 0; i < G.wave.max; i++) spawn('globe', -.7 + i * .18, .8);
  G.kills = Math.floor(G.goal * .5); G.rushed = 0; G.spawnT = 99;
  update(.01);
  check('rush waits when active enemy cap is reached', alive() === G.wave.max && G.rushLeft > 0);
  const remaining = G.rushLeft;
  G.enemies[0].dead = true; updateRush(.3);
  check('rush fills one free slot without exceeding cap', alive() === G.wave.max && G.rushLeft === remaining - 1);
  startWave(3);
  check('new wave resets pending rush', G.rushLeft === 0);
  for (const [difficulty, warning] of [['easy', 1], ['normal', .75], ['hard', .55]]) {
    G.diff = DIFFS[difficulty]; startWave(1); state = 'play'; G.enemies = [];
    const charger = spawn('isu', 0, .5); charger.appear = 1; charger.charger = true;
    updEnemies(.01, true);
    check(`${difficulty}: charger warning matches difficulty`, Math.abs(charger.chg - (warning - .01)) < .001);
  }
  const originalEffects = gentleEffects;
  $('bEffects').click();
  check('effects button updates setting and accessible state', gentleEffects !== originalEffects && $('bEffects').getAttribute('aria-pressed') === String(gentleEffects));
  $('bEffects').click();
  check('effects setting can be restored', gentleEffects === originalEffects);
  G.maxCombo = 123; G.shotN = 123; G.hitShotN = 121;
  finish(false, 'やられた');
  check('accuracy appears separately from combo', $('rCombo').textContent === '123' && $('rAccuracy').textContent === 'めいちゅう 98%');
  check('accuracy label stays on one line', $('rAccuracy').scrollWidth <= $('rAccuracy').clientWidth);
  state = 'pause'; ptr.down = false;
  return { count: passed.length, passed };
};
