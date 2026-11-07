/* Local browser smoke playthrough, not a measurement of children's enjoyment.
   Load after index.html, then call simulateSchool('science' or 'music'). */
window.simulateSchool = function (route = 'science') {
  modeKey = 'normal';
  newGame(false); $('title').hidden = true;
  const stats = { route, frames: 0, playSeconds: 0, emptySeconds: 0, stages: [] };
  try {
    for (let frame = 0; frame < 30000; frame++) {
      stats.frames++;
      if (state === 'result' || state === 'ending') break;
      if (state === 'route') chooseRoute(route === 'music');
      if (!stats.stages.includes(G.waveIdx + 1)) stats.stages.push(G.waveIdx + 1);
      if (state === 'play') {
        stats.playSeconds += 1 / 30;
        if (!G.enemies.some(e => !e.dead)) stats.emptySeconds += 1 / 30;
        const targets = G.enemies.filter(e => !e.dead).sort((a, b) => a.z - b.z);
        const e = targets.find(o => !o.T.boss) || targets[0];
        if (e) {
          ptr.x = e.sx; ptr.y = e.sy;
          if (bagOpen(e)) ptr.y -= e.sr * .35;
          if (e.type === 'kousha' && e.wp) {
            const p = e.mode === 'tongueWarn' ? e.wp.mouth : e.wp.eyes[0];
            ptr.x = p[0]; ptr.y = p[1];
          }
        }
        const item = G.items.find(o => !o.gone);
        const soul = G.souls[0];
        if (item || soul) { ptr.x = (item || soul).sx; ptr.y = (item || soul).sy; }
        const trick = G.gimmick, p = trickScreen();
        if (trick && !trick.used && targets.length >= 3 && p) { ptr.x = p.x; ptr.y = p.y; }
        if (G.sp >= 100) skillSp();
        else if (G.black > 0 && G.lightCd <= 0) skillLight();
        else if (G.bellCd <= 0 && targets.some(o => o.z < .25)) skillBell();
        ptr.down = !!(e || item || soul);
      }
      update(1 / 30);
      // Keep real scene objects and boss weak-point projection current.
      if (frame % 6 === 0) { sync3D(.2); scene.updateMatrixWorld(true); }
    }
    stats.state = state;
    stats.hearts = G.hearts;
    stats.score = G.score;
    stats.accuracy = Math.round(100 * G.hitShotN / Math.max(1, G.shotN));
    stats.emptyPercent = Math.round(100 * stats.emptySeconds / Math.max(1, stats.playSeconds));
    return stats;
  } finally {
    ptr.down = false;
    if (state !== 'result' && state !== 'ending') state = 'pause';
  }
};
