/* Load this file in a local index.html browser tab, then run runGameplayTests().
   Uses real gameplay functions and Three.js, without changing production globals. */
window.runGameplayTests = function () {
  const passed = [];
  const check = (name, ok) => { if (!ok) throw new Error(name); passed.push(name); };
  newGame(false);
  $('title').hidden = true;
  state = 'play';
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
  state = 'pause'; ptr.down = false;
  return { count: passed.length, passed };
};
