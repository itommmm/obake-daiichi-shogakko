/* PS1版 コミカルホラー演出・音響ディレクター
 * Web Audioのみで全音を合成。画像・音声ファイルの追加なし。
 * おどかしはダメージを与えず、探索と謎解きを止めない。
 *
 * 怖さのリズム：しずかな探索 → 物音の予兆（まわりの音が止まる）→ 短い驚かし／小さな怪奇現象
 *   → コミカルなオチ → ほっとする間 → しずかな探索。
 *  ・full（small なし）… 顔と音の驚かし。びっくり回数に数える。
 *  ・small:true … 音と小物の動きだけの怪奇現象。回数に数えず、無敵時間も使わない。
 *  ・どちらも予兆（omen）のあとで起こる。予兆中に文章・拡大画面・部屋移動が入ったら取り消し、起こさない。 */
'use strict';

// 右下の「しらべる」ボタンに文字が隠れないよう、ことば（スペース区切り）の切れ目で1行19文字以内に折り返す
function foldMsg(text, n) {
  n = n || 19;
  const out = []; let cur = '';
  for (const w of String(text).split(' ')) {
    if (cur && (cur + ' ' + w).length > n) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
  }
  if (cur) out.push(cur);
  return out.join('\n');
}

const ComicHorror = (() => {
  const ACTS = {
    uwabaki: {word:'ピョコン！', line:'うわばきが くしゃみ！？', face:'びっくり！', tone:'squeak'},
    randoseru: {word:'バイ〜ン！', line:'ランドセルが とびはねた！', face:'おっと！', tone:'boing'},
    chalk: {word:'キュキュッ！', line:'チョークが へんな おとを たてた！', face:'へんなおと！', tone:'chalk'},
    ghost: {word:'ばぁ〜！', line:'おばけだ！ ……わらってる？', face:'ばぁ！', tone:'ghost'},
    locker: {word:'ガタガタン！', line:'ロッカーだいおうが おどってる！？', face:'でっかい！', tone:'locker'},
    knock: {word:'コン！ コン！', line:'だれも いないのに ノックの おと！', face:'だれ？', tone:'knock'},
    bell: {word:'キーン コーン！', line:'とまった はずの チャイムが なった！', face:'チャイム！', tone:'bell'},
    chair: {word:'ギギーッ！', line:'いすが ひとりでに うごいた！', face:'えっ！？', tone:'chair'},
    book: {word:'パラパラ！', line:'ほんが かってに めくれてる！', face:'どきっ！', tone:'paper'},
    clock: {word:'カチッ… ポン！', line:'とけいが くしゃみした！？', face:'なんだ！？', tone:'clock'},
    curtain: {word:'バサーッ！', line:'まくの うしろに だれか いる！？', face:'みーつけた！', tone:'curtain'}
  };
  // その場に行くだけで起こるイベント。謎解きの操作には割り込まない。
  //  when   … 起こる条件（部屋に入ってからの秒数 t と、いまの位置 p）
  //  src    … 音の出どころ。左右の定位と「近い／遠い」を決める
  //  omen   … 予兆の音（s）と長さ（dur 秒）
  //  chance … 部屋に入るたびに一度だけ ふる。何も起こらない訪問もある
  //  prop   … 動かす小物（rooms.js の props）。演出軽減のときは動かさず音だけ
  //  hot    … 気になる場所（discoveries.js）。マーカーを目立たせる
  const BEATS = [
    {id:'entrance-knock', room:'entrance', kind:'knock', chance:1, src:{x:0,z:-3.3}, omen:{s:'tap',dur:1.5},
      when:(p,t)=>t>3.2 && p.z<.3},
    {id:'entrance-bell', room:'entrance', kind:'bell', chance:.8, src:{x:4.5,z:-3}, omen:{s:'hum',dur:1.8},
      when:(p,t)=>t>14 && p.x>1.3},
    {id:'entrance-farewell', room:'entrance', small:true, fx:'farewell', chance:1, src:{x:0,z:-3.3}, omen:{s:'tap',dur:1.4},
      line:'ドアの むこうから「またね〜」って きこえた…？',
      when:(p,t)=>t>2.5 && G.fixed.length>=3},
    {id:'classroom-book', room:'classroom', kind:'book', chance:.85, src:{x:1.7,z:.75}, omen:{s:'rustle',dur:1.5},
      when:(p,t)=>t>2 && p.x>1.0 && p.z>-.5},
    {id:'classroom-chair', room:'classroom', small:true, fx:'chair', chance:.8, src:{x:-1.7,z:1.4}, omen:{s:'creak',dur:1.7},
      prop:'chair', line:'いすが ひとりでに ギギッ…！',
      when:(p,t)=>t>4 && p.x<-.8 && p.z<0},
    {id:'classroom-desk', room:'classroom', small:true, fx:'rustle', chance:.75, src:{x:-3.3,z:-1.6}, omen:{s:'rustle',dur:1.8},
      hot:'paper', line:'かさかさ… あっちの すみから おとが する。',
      when:(p,t)=>t>7 && p.z<-.3 && p.x>-2},
    {id:'corridor-step', room:'corridor', small:true, fx:'steps', chance:.8, src:{x:0,z:-8}, far:true, omen:{s:'dull',dur:1.8},
      line:'ひたひた… あしおと？ でも だれも いない。',
      when:(p,t)=>t>2.5 && p.z>3.5},
    {id:'corridor-locker', room:'corridor', small:true, fx:'rattle', chance:.8, src:{x:1.42,z:-1.55}, omen:{s:'dull',dur:1.6},
      prop:'locker', hot:'locker', flag:'lockerHeard', line:'ロッカーが カタカタ ゆれてる！',
      when:(p,t)=>t>3 && p.z<.6 && p.z>-5},
    {id:'corridor-bell', room:'corridor', kind:'bell', chance:.8, src:{x:0,z:8}, far:true, omen:{s:'hum',dur:1.8},
      when:(p,t)=>t>5 && p.z< -4},
    {id:'staff-clock', room:'staff', small:true, fx:'tick', chance:.9, src:{x:-2.1,z:-2.9}, omen:{s:'tap',dur:1.6},
      prop:'hand', flag:'clockMoved', line:'とけいの はりが ピクッと うごいた！',
      when:(p,t)=>t>3 && p.x<-.8},
    {id:'staff-phone', room:'staff', small:true, fx:'phone', chance:.75, src:{x:0,z:.3}, omen:{s:'hum',dur:1.4},
      hot:'drawer', line:'プルルッ… でんわが いっしゅん なった！',
      when:(p,t)=>t>7 && p.x>-.4},
    {id:'gym-ball', room:'gym', small:true, fx:'ball', chance:.7, src:{x:4.8,z:5.5}, omen:{s:'tap',dur:1.5},
      hot:'balls', line:'ポン… ポン… ボールの はねる おと。',
      when:(p,t)=>t>5 && p.z>0},
    {id:'gym-curtain', room:'gym', kind:'curtain', chance:.9, src:{x:0,z:-8.5}, far:true, omen:{s:'rustle',dur:1.8}, prop:'curtain',
      when:(p,t)=>t>2.5 && p.z<2},
    // ロッカーだいおうが めざめる ほんの すこし まえの よかん（長めの予兆）
    {id:'gym-locker', room:'gym', kind:'locker', chance:1, src:{x:0,z:-6.2}, far:true, omen:{s:'dull',dur:2.4},
      when:(p,t)=>t>8 && p.z>3}
  ];
  let sinceRoom=0, cooldown=0, visible=0, safe=0, nextAmbience=4, room='', lastMix='';
  let pending=null, relief=0, reliefSafe=0, ducked=false, rolled={}, smallCount=0;
  const nudges=[];
  const div = () => $('booOverlay');

  function clearVisual() {
    visible=0;
    const el=div();
    if(el) el.classList.remove('active');
  }
  // 音が止まる瞬間：予兆のあいだ、雨とうなりをほとんど消す。終わったら少しずつ戻す
  function duck() {
    const a=AudioSys;
    if(ducked || !a.ctx || !a.ambient || !a.rain) return;
    ducked=true;
    const t=a.ctx.currentTime;
    a.ambient.gg.gain.setTargetAtTime(.004,t,.2);
    a.rain.rg.gain.setTargetAtTime(.012,t,.2);
  }
  function unduck() { if(ducked) {ducked=false; lastMix='';} }
  function abortPending() { pending=null; unduck(); }
  function endNudges() {
    for(const n of nudges) {n.m.position.x=n.x; n.m.position.z=n.z; n.m.rotation.z=n.rz; n.m.rotation.y=n.ry;}
    nudges.length=0;
  }
  function reset() {
    sinceRoom=0; cooldown=1.5; visible=0; safe=0; nextAmbience=4; room=''; lastMix='';
    pending=null; relief=0; reliefSafe=0; ducked=false; rolled={}; smallCount=0; endNudges();
    G.scareSeen=[];
    clearVisual();
  }
  function enter(id) {
    if(room===id) return;
    room=id; sinceRoom=0; nextAmbience=2.5; cooldown=Math.max(cooldown,1.8); lastMix='';
    pending=null; relief=0; ducked=false; endNudges();
    // 部屋に入るたび、この部屋の出来事を起こすかどうかを一度だけ決める（何も起こらない訪問もある）
    rolled={};
    for(const b of BEATS) if(b.room===id) rolled[b.id]=Math.random()<(b.chance==null?1:b.chance);
    clearVisual();
    if(G.sound) SFX.roomCue(id);
  }
  // 小物をゆらす。演出軽減（ゆれオフ）のときは動かさず、音だけにする
  function nudge(kind) {
    if(!G.fx || !activeRoom) return;
    const P=activeRoom.props||{};
    let list=[];
    if(kind==='chair' && P.chairs && P.chairs[3]) list=P.chairs[3];
    else if(kind==='locker' && P.lockers) {const l=P.lockers.find(o=>Math.abs(o.z+1.55)<.05); if(l) list=[l.mesh];}
    else if(kind==='curtain' && P.curtains) list=P.curtains;
    else if(kind==='hand' && activeRoom.clockHands) list=[activeRoom.clockHands[0]];
    for(const m of list) {
      if(nudges.some(n=>n.m===m)) continue;
      nudges.push({m,kind,t:0,dur:kind==='hand'?.8:1.1,x:m.position.x,z:m.position.z,rz:m.rotation.z,ry:m.rotation.y});
    }
  }
  function updateNudges(dt) {
    for(let i=nudges.length-1;i>=0;i--) {
      const n=nudges[i], m=n.m; n.t+=dt;
      if(n.t>=n.dur) {m.position.x=n.x; m.position.z=n.z; m.rotation.z=n.rz; m.rotation.y=n.ry; nudges.splice(i,1); continue;}
      const k=1-n.t/n.dur, s=Math.sin(Math.min(1,n.t/n.dur)*Math.PI);
      if(n.kind==='chair') {m.position.z=n.z+.14*s; m.rotation.y=n.ry+.3*s;}
      else if(n.kind==='locker') {m.rotation.z=n.rz+Math.sin(n.t*28)*.045*k; m.position.x=n.x+Math.sin(n.t*31)*.012*k;}
      else if(n.kind==='curtain') {m.rotation.z=n.rz+Math.sin(n.t*5)*.05*k;}
      else if(n.kind==='hand') {m.rotation.z=n.rz-.55*(n.t<.45?Math.min(1,n.t/.12):1-(n.t-.45)/.35);}
    }
  }
  // 音の出どころから、左右の定位と「近い／遠い」を決める
  function soundOpts(b) {
    const src=b.src||{x:G.p.x,z:G.p.z};
    const dx=src.x-G.p.x, dz=src.z-G.p.z;
    return {pan:Math.max(-1,Math.min(1,dx/2.5))*.85, far:!!b.far || Math.hypot(dx,dz)>5.5};
  }
  function scare(kind, id) {
    if(G.state!=='play' || cooldown>0 || safe>0 || (id && G.scareSeen.includes(id))) return false;
    const a=ACTS[kind] || ACTS.ghost;
    if(id) G.scareSeen.push(id);
    G.damage++; // 旧セーブとの互換性：damage は「びっくり回数」として継続利用
    cooldown=5.5; visible=1.45; relief=2.1; reliefSafe=4;
    G.invuln=Math.max(G.invuln,2.5);
    if(G.msgT<.8) { G.msg=a.line; G.msgT=2.2; }
    const el=div();
    if(el) {
      el.dataset.kind=kind;
      $('booWord').textContent=a.word;
      $('booFaceLabel').textContent=a.face;
      el.classList.remove('active');
      // アニメーションの再生し直し。画面のゆれオフなら静止表示に近づける。
      void el.offsetWidth;
      el.classList.toggle('gentle',!G.fx);
      el.classList.add('active');
    }
    SFX.comicScare(a.tone);
    if(G.fx && activeRoom) addSparks(G.p.x,1.15,G.p.z,0xffe6a4,7);
    return true;
  }
  function calm() {
    safe=12;
    cooldown=Math.max(cooldown,3);
    clearVisual();
    SFX.calm();
  }
  function solve(id) {
    calm();
    if(G.sound) SFX.puzzleFanfare(id);
  }
  // 予兆をはじめる。音が止まり、小さな物音だけが聞こえる
  function startOmen(b) {
    const o=soundOpts(b);
    pending={beat:b,t:b.omen&&b.omen.dur||1.6};
    duck();
    if(G.sound) SFX.omen(b.omen&&b.omen.s||'tap',o);
  }
  function fireSmall(b) {
    const o=soundOpts(b);
    G.scareSeen.push(b.id); smallCount++;
    cooldown=Math.max(cooldown,5);
    relief=1.7; reliefSafe=3;
    if(b.flag) G.flags[b.flag]=1;
    if(b.hot && typeof Discoveries!=='undefined') Discoveries.setHot(b.hot);
    if(G.sound) SFX.small(b.fx,o);
    if(b.prop) nudge(b.prop);
    if(G.msgT<.8) {G.msg=foldMsg(b.line); G.msgT=2.6;}
  }
  function fireBeat(b) {
    if(b.small) {
      if(cooldown>0 || safe>0) return;
      fireSmall(b);
    } else {
      if(scare(b.kind,b.id)) {
        if(b.prop) nudge(b.prop);
        if(b.hot && typeof Discoveries!=='undefined') Discoveries.setHot(b.hot);
      }
    }
  }
  function tick(dt) {
    if(G.state!=='play') {if(pending) abortPending(); return;}
    sinceRoom+=dt;
    cooldown=Math.max(0,cooldown-dt);
    safe=Math.max(0,safe-dt);
    if(visible>0 && (visible-=dt)<=0) clearVisual();
    updateNudges(dt);
    // 驚かしのあとの「ほっ」。コミカルなオチのあとで、しばらく何も起こさない
    if(relief>0 && (relief-=dt)<=0) {
      relief=0; safe=Math.max(safe,reliefSafe); unduck();
      if(G.sound) SFX.relief();
    }
    const a=AudioSys;
    if(a.ctx && a.ambient && a.rain) {
      const fixed=G.fixed.includes(G.room) || G.fixed.length>=3;
      const mix=G.room+':'+(fixed?'calm':'spooky');
      // 毎フレームAudioParamを登録せず、部屋と状態が変わった時だけ更新
      if(!ducked && mix!==lastMix) {
        lastMix=mix;
        a.ambient.gg.gain.setTargetAtTime(fixed?.009:.021,a.ctx.currentTime,.18);
        a.rain.rg.gain.setTargetAtTime(fixed?.035:.078,a.ctx.currentTime,.3);
      }
    }
    // 予兆の最中：文章を読んでいる・驚かしの直後などで状況が変わったら、起こさずに取り消す
    if(pending) {
      if(G.msgT>1.4 || safe>0) {abortPending(); return;}
      if((pending.t-=dt)<=0) {const b=pending.beat; pending=null; unduck(); fireBeat(b);}
      return;
    }
    // 環境音：まばら。ときどき長い静けさ。驚かしの直後は鳴らさない。遠い音・近い音・左右の違いをつける
    nextAmbience-=dt;
    if(nextAmbience<=0) {
      const fixedHere=G.fixed.includes(G.room);
      nextAmbience=(fixedHere?11:6)+Math.random()*6+(Math.random()<.3?7:0);
      if(G.sound && relief<=0 && cooldown<3 && Math.random()<.75) {
        SFX.roomAmbience(G.room,fixedHere,{far:Math.random()<.4,pan:(Math.random()*2-1)*.8});
      }
    }
    if(cooldown>0 || safe>0 || G.msgT>1.4 || sinceRoom<2) return;
    const p=G.p;
    for(const beat of BEATS) {
      if(beat.room!==G.room || G.scareSeen.includes(beat.id) || !rolled[beat.id]) continue;
      if(G.fixed.includes(G.room) && G.room!=='entrance') continue;
      if(beat.when(p,sinceRoom)) {startOmen(beat);break;}
    }
  }
  function status() {return {cooldown,safe,visible,room,seen:G.scareSeen.slice(),count:G.damage,pending:pending?pending.beat.id:null,small:smallCount,nudging:nudges.length};}
  return {ACTS,BEATS,reset,enter,scare,calm,solve,tick,clearVisual,status,nudge,abortPending};
})();


// 左右の定位（pan）と「遠い音」（far：小さく・こもらせる）をつけた音の部品。
// 既存の tone / noiseHit と同じ使い方。AudioContext が無い・ミュート時は何もしない。
function spatial(a, node, o) {
  let out = node;
  if (o && o.far) {const lp = a.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; out.connect(lp); out = lp;}
  if (o && o.pan && a.ctx.createStereoPanner) {
    const pn = a.ctx.createStereoPanner(); pn.pan.value = Math.max(-1, Math.min(1, o.pan)); out.connect(pn); out = pn;
  }
  out.connect(a.master);
}
function ptone(freq, dur, type, vol, slide, delay, o) {
  const a = AudioSys; if (!a.ctx || a.muted) return;
  const t = a.ctx.currentTime + (delay || 0), v = vol * (o && o.far ? .45 : 1);
  const osc = a.ctx.createOscillator(), g = a.ctx.createGain();
  osc.type = type || 'sine'; osc.frequency.setValueAtTime(Math.max(20, freq), t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  osc.connect(g); spatial(a, g, o); osc.start(t); osc.stop(t + dur + .03);
}
function pnoise(dur, vol, freq, type, delay, o) {
  const a = AudioSys; if (!a.ctx || a.muted || !a.noiseBuf) return;
  const t = a.ctx.currentTime + (delay || 0), v = vol * (o && o.far ? .45 : 1);
  const s = a.ctx.createBufferSource(); s.buffer = a.noiseBuf;
  const f = a.ctx.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq;
  const g = a.ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(f); f.connect(g); spatial(a, g, o); s.start(t); s.stop(t + dur + .02);
}

// びっくり音は短い・明るい音色で。音量はマスター側のリミッタも通す。
Object.assign(SFX,{
  comicScare(kind) {
    switch(kind) {
      case 'squeak':
        tone(710,.16,'triangle',.085,-390);tone(390,.14,'sine',.06,220,.12);break;
      case 'boing':
        tone(150,.30,'sine',.12,440);tone(550,.18,'triangle',.06,-180,.12);break;
      case 'chalk':
        noiseHit(.16,.14,1800,'highpass');tone(1300,.17,'square',.035,-780);break;
      case 'ghost':
        tone(460,.33,'sine',.10,-270);tone(230,.36,'triangle',.055,150,.1);break;
      case 'locker':
        noiseHit(.24,.16,260,'lowpass');tone(105,.32,'triangle',.095,280);tone(380,.16,'square',.035,-150,.22);break;
      case 'knock':
        tone(145,.075,'triangle',.12,-60);tone(158,.08,'triangle',.10,-65,.17);break;
      case 'bell':
        this.brokenChime();break;
      case 'chair':
        tone(420,.33,'sawtooth',.05,-230);tone(270,.14,'sine',.05,210,.16);break;
      case 'paper':
        noiseHit(.36,.11,3200,'highpass');tone(850,.09,'sine',.035,70,.17);break;
      case 'clock':
        this.clockTick();tone(550,.12,'sine',.06,180,.22);break;
      case 'curtain':
        noiseHit(.35,.14,720,'bandpass');tone(300,.18,'sine',.08,260,.15);break;
      default: this.ghost();
    }
  },
  brokenChime() {
    [784,659,698,392].forEach((f,i)=>tone(f,i===3?.6:.32,'sine',.065,0,i*.23));
    tone(185,.28,'triangle',.035,-35,1.0);
  },
  clockTick() {
    tone(720,.035,'square',.022);tone(590,.045,'square',.021,0,.23);
  },
  calm() {
    tone(392,.23,'sine',.05,0);
    tone(523,.25,'sine',.05,0,.12);
  },
  puzzleFanfare(room) {
    const notes=room==='classroom'?[523,659,784]:room==='staff'?[440,554,659]:[523,784,1046];
    notes.forEach((f,i)=>tone(f,.25,'triangle',.06,0,i*.12));
  },
  roomCue(room) {
    if(room==='gym') {tone(145,.40,'triangle',.048,15);tone(220,.23,'sine',.035,0,.20);}
    else if(room==='staff') {this.clockTick();}
    else if(room==='classroom') {tone(620,.28,'sine',.035,-145); }
    else if(room==='corridor') {noiseHit(.22,.055,560,'bandpass');}
    else {tone(310,.20,'triangle',.034,-45);}
  },
  // 部屋ごとのまばらな環境音。o={pan,far} があると、左右と遠近がつく（物音のする方向を探したくなる）
  roomAmbience(room,calm,o) {
    if(calm) {ptone(587,.22,'sine',.015,-28,0,o);return;}
    const n=Math.random();
    switch(room) {
      case 'entrance': if(n<.65)ptone(310,.20,'triangle',.034,-45,0,o);else pnoise(.21,.08,280,'lowpass',0,o);break;
      case 'classroom': if(n<.5)pnoise(.3,.07,3200,'highpass',0,o);else ptone(500,.25,'sine',.028,-180,0,o);break;
      case 'corridor': if(n<.5){ptone(720,.035,'square',.022,0,0,o);ptone(590,.045,'square',.021,0,.23,o);}else pnoise(.3,.06,560,'bandpass',0,o);break;
      case 'staff': if(n<.5){ptone(720,.035,'square',.022,0,0,o);ptone(590,.045,'square',.021,0,.23,o);}else ptone(310,.28,'sine',.037,130,0,o);break;
      case 'gym': if(n<.5) {ptone(330,.21,'triangle',.035,-70,0,o);ptone(440,.18,'sine',.04,0,.15,o);} else pnoise(.18,.09,450,'bandpass',0,o);break;
    }
  },
  // 予兆：まわりの音が止まったなかで聞こえる、小さな物音。驚かしの前の「なにかいる？」
  omen(kind,o) {
    switch(kind) {
      case 'rustle': pnoise(.45,.05,2600,'highpass',0,o);pnoise(.35,.04,2200,'highpass',.55,o);break;
      case 'creak': ptone(240,.5,'sawtooth',.03,-70,0,o);break;
      case 'dull': ptone(88,.3,'triangle',.07,-20,0,o);pnoise(.2,.05,220,'lowpass',0,o);break;
      case 'hum': ptone(330,.9,'sine',.035,60,0,o);break;
      default: ptone(160,.07,'triangle',.07,-40,0,o);ptone(170,.07,'triangle',.06,-40,.22,o);
    }
  },
  // 小さな怪奇現象の音。最後にコミカルなオチの音をつける
  small(kind,o) {
    switch(kind) {
      case 'knock': ptone(145,.075,'triangle',.12,-60,0,o);ptone(158,.08,'triangle',.10,-65,.17,o);break;
      case 'farewell':
        ptone(145,.075,'triangle',.10,-60,0,o);ptone(158,.08,'triangle',.09,-65,.17,o);
        ptone(660,.12,'sine',.045,90,.55,o);ptone(880,.16,'sine',.04,-60,.68,o);break;
      case 'chair': ptone(420,.33,'sawtooth',.05,-230,0,o);ptone(270,.14,'sine',.05,210,.36,o);break;
      case 'rustle': pnoise(.5,.08,3000,'highpass',0,o);ptone(900,.08,'sine',.03,100,.5,o);break;
      case 'steps':
        for(let i=0;i<5;i++) ptone(i%2?118:132,.06,'triangle',.07-i*.008,-40,i*.3,o);
        ptone(980,.07,'sine',.03,200,1.7,o);ptone(1240,.08,'sine',.028,-120,1.82,o);break; // くすくす
      case 'rattle':
        for(let i=0;i<4;i++) {pnoise(.07,.09,380,'bandpass',i*.09,o);ptone(110,.06,'square',.03,-30,i*.09,o);}
        ptone(480,.2,'sine',.05,260,.55,o);break; // ぽよん
      case 'tick': ptone(720,.035,'square',.022,0,0,o);ptone(590,.045,'square',.021,0,.23,o);ptone(550,.12,'sine',.055,180,.5,o);break;
      case 'phone':
        for(let i=0;i<2;i++) {ptone(880,.09,'square',.03,0,i*.26,o);ptone(660,.09,'square',.03,0,i*.26+.1,o);}
        ptone(330,.14,'sine',.05,-120,.75,o);break; // ぷつっ
      case 'ball':
        [[0,1],[.55,.75],[.97,.55],[1.28,.38],[1.5,.25],[1.64,.15]].forEach(([d,v])=>{
          ptone(200,.09,'sine',.09*v,-80,d,o);pnoise(.04,.04*v,700,'lowpass',d,o);});break;
      default: this.comicScare('knock');
    }
  },
  // 驚かしのあとの「ほっ」。短く明るい、やさしい音
  relief() {
    tone(523,.14,'triangle',.04,60);tone(784,.2,'sine',.035,-40,.1);
  }
});
