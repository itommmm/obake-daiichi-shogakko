/* PS1版 コミカルホラー演出・音響ディレクター
 * Web Audioのみで全音を合成。画像・音声ファイルの追加なし。
 * おどかしはダメージを与えず、探索と謎解きを止めない。 */
'use strict';

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
  // その場に行くだけで起こる短いイベント。謎解きの操作には割り込まない。
  const BEATS = [
    {id:'entrance-knock', room:'entrance', kind:'knock', when:(p,t)=>t>3.2 && p.z<.3},
    {id:'entrance-bell', room:'entrance', kind:'bell', when:(p,t)=>t>14 && p.x>1.3},
    {id:'classroom-book', room:'classroom', kind:'book', when:(p,t)=>t>2 && p.x>1.0 && p.z>-.5},
    {id:'classroom-chair', room:'classroom', kind:'chair', when:(p,t)=>t>4 && p.x<-.8 && p.z<0},
    {id:'corridor-step', room:'corridor', kind:'knock', when:(p,t)=>t>2.5 && p.z>3.5},
    {id:'corridor-bell', room:'corridor', kind:'bell', when:(p,t)=>t>5 && p.z< -4},
    {id:'staff-clock', room:'staff', kind:'clock', when:(p,t)=>t>3 && p.x<-.8},
    {id:'staff-chalk', room:'staff', kind:'chalk', when:(p,t)=>t>4 && p.x>1.0},
    {id:'gym-curtain', room:'gym', kind:'curtain', when:(p,t)=>t>2.5 && p.z<2},
    {id:'gym-locker', room:'gym', kind:'locker', when:(p,t)=>t>8 && p.z>3}
  ];
  let sinceRoom=0, cooldown=0, visible=0, safe=0, nextAmbience=4, room='', lastMix='';
  const div = () => $('booOverlay');

  function clearVisual() {
    visible=0;
    const el=div();
    if(el) el.classList.remove('active');
  }
  function reset() {
    sinceRoom=0; cooldown=1.5; visible=0; safe=0; nextAmbience=4; room=''; lastMix='';
    G.scareSeen=[];
    clearVisual();
  }
  function enter(id) {
    if(room===id) return;
    room=id; sinceRoom=0; nextAmbience=2.5; cooldown=Math.max(cooldown,1.8); lastMix='';
    clearVisual();
    if(G.sound) SFX.roomCue(id);
  }
  function scare(kind, id) {
    if(G.state!=='play' || cooldown>0 || safe>0 || (id && G.scareSeen.includes(id))) return false;
    const a=ACTS[kind] || ACTS.ghost;
    if(id) G.scareSeen.push(id);
    G.damage++; // 旧セーブとの互換性：damage は「びっくり回数」として継続利用
    cooldown=5.5; visible=1.45;
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
  function tick(dt) {
    if(G.state!=='play') return;
    sinceRoom+=dt;
    cooldown=Math.max(0,cooldown-dt);
    safe=Math.max(0,safe-dt);
    if(visible>0 && (visible-=dt)<=0) clearVisual();
    const a=AudioSys;
    if(a.ctx && a.ambient && a.rain) {
      const fixed=G.fixed.includes(G.room) || G.fixed.length>=3;
      const mix=G.room+':'+(fixed?'calm':'spooky');
      // 毎フレームAudioParamを登録せず、部屋と状態が変わった時だけ更新
      if(mix!==lastMix) {
        lastMix=mix;
        a.ambient.gg.gain.setTargetAtTime(fixed?.009:.021,a.ctx.currentTime,.18);
        a.rain.rg.gain.setTargetAtTime(fixed?.035:.078,a.ctx.currentTime,.3);
      }
    }
    nextAmbience-=dt;
    if(nextAmbience<=0) {
      nextAmbience=(G.fixed.includes(G.room)?10:5.5)+Math.random()*4.5;
      if(G.sound) SFX.roomAmbience(G.room,G.fixed.includes(G.room));
    }
    if(cooldown>0 || safe>0 || G.msgT>1.4 || sinceRoom<2) return;
    const p=G.p;
    for(const beat of BEATS) {
      if(beat.room!==G.room || G.scareSeen.includes(beat.id)) continue;
      if(G.fixed.includes(G.room) && G.room!=='entrance') continue;
      if(beat.when(p,sinceRoom)) {scare(beat.kind,beat.id);break;}
    }
  }
  function status() {return {cooldown,safe,visible,room,seen:G.scareSeen.slice(),count:G.damage};}
  return {ACTS,BEATS,reset,enter,scare,calm,solve,tick,clearVisual,status};
})();

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
  roomAmbience(room,calm) {
    if(calm) {tone(587,.22,'sine',.015,-28);return;}
    const n=Math.random();
    switch(room) {
      case 'entrance': if(n<.65)this.roomCue('entrance');else noiseHit(.21,.08,280,'lowpass');break;
      case 'classroom': if(n<.5)this.comicScare('paper');else tone(500,.25,'sine',.028,-180);break;
      case 'corridor': if(n<.5)this.clockTick();else this.brokenChime();break;
      case 'staff': if(n<.5)this.clockTick();else tone(310,.28,'sine',.037,130);break;
      case 'gym': if(n<.5) {tone(330,.21,'triangle',.035,-70);tone(440,.18,'sine',.04,0,.15);} else noiseHit(.18,.09,450,'bandpass');break;
    }
  }
});
