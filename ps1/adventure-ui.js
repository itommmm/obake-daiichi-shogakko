/* PS1版 かんたん探索UI：タップ対象／自動で近づく／拡大して調べる
 * Three.js の既存固定カメラと衝突判定をそのまま利用する。
 * 自動移動が失敗したら手動移動に戻せる。セーブ形式は変更しない。
 */
'use strict';
const AdventureUI = (() => {
  let bound = false, navigation = null, refreshTimer = 0;
  const markers = new Map();
  let currentInspect = null;

  function targets() {
    if (!activeRoom) return [];
    const R = activeRoom;
    const items = R.items.filter(it => !it.taken && it.group.visible).map(it => ({
      key: 'item:' + it.id, type: 'item', ref: it,
      x: it.def.x, z: it.def.z, y: (it.def.y || 0) + .65, reach: 1.17,
      label: it.def.label || 'ものを とる'
    }));
    const spots = R.spots.filter(sp => SPOTS[sp.id]).map(sp => ({
      key: 'spot:' + sp.id, type: 'spot', ref: sp,
      x: sp.x, z: sp.z, y: sp.id === 'board' || sp.id === 'clock' ? 1.45 : 1.05,
      reach: Math.max(.65, sp.r - .14), label: SPOTS[sp.id].label()
    }));
    const doors = R.doors.map((door, i) => ({
      key: 'door:' + i, type: 'door', ref: door,
      x: door.x, z: door.z, y: 1.18, reach: 1.32, label: door.label
    }));
    return [...items, ...spots, ...doors];
  }

  function cleanNav() { navigation = null; const status = $('tapStatus'); if (status) status.hidden = true; }
  function cancel() { cleanNav(); }
  function suspend() {
    cleanNav();
    const layer=$('poiLayer'),bar=$('quickBar');
    if(layer)layer.hidden=true;
    if(bar)bar.hidden=true;
  }

  function lineFree(ax, az, bx, bz) {
    const d = Math.hypot(bx-ax, bz-az);
    const count = Math.max(1, Math.ceil(d / .12));
    for (let i = 1; i <= count; i++) {
      const t = i / count;
      if (blocked(ax + (bx-ax)*t, az + (bz-az)*t)) return false;
    }
    return true;
  }

  // BFSで、対象を調べられる距離の安全な床まで移動する。
  // 家具の中にあるものにも近づけるよう、対象の中心ではなく「近くの床」を終点とする。
  function routeTo(entry) {
    const p = G.p, distance = Math.hypot(p.x-entry.x, p.z-entry.z);
    if (distance < entry.reach) return [];
    const bounds = activeRoom.bounds, step = .32;
    const minX = bounds.x0 + .26, minZ = bounds.z0 + .26;
    const nx = Math.floor((bounds.x1 - .26 - minX) / step) + 1;
    const nz = Math.floor((bounds.z1 - .26 - minZ) / step) + 1;
    if (nx < 1 || nz < 1 || nx * nz > 12000) return null;
    const coord = k => ({x:minX + (k % nx)*step, z:minZ + Math.floor(k/nx)*step});
    const valid = k => {
      const c = coord(k); return !blocked(c.x, c.z);
    };
    const startI = Math.round((p.x-minX)/step), startJ = Math.round((p.z-minZ)/step);
    let start = -1, best = Infinity;
    for (let dj=-2; dj<=2; dj++) for (let di=-2; di<=2; di++) {
      const i=startI+di,j=startJ+dj;
      if (i<0||i>=nx||j<0||j>=nz) continue;
      const k=j*nx+i,c=coord(k),ds=(c.x-p.x)**2+(c.z-p.z)**2;
      if (ds<best && valid(k) && lineFree(p.x,p.z,c.x,c.z)) {start=k;best=ds;}
    }
    if (start<0) return null;
    const count=nx*nz, prev=new Int32Array(count);prev.fill(-1);
    const seen=new Uint8Array(count), queue=new Int32Array(count);
    let head=0,tail=1,goal=-1;seen[start]=1;queue[0]=start;
    const closeEnough = entry.reach - .08;
    while(head<tail) {
      const k=queue[head++],c=coord(k);
      if (Math.hypot(c.x-entry.x,c.z-entry.z)<=closeEnough) {goal=k;break;}
      const i=k%nx,j=Math.floor(k/nx);
      const next=[[i+1,j],[i-1,j],[i,j+1],[i,j-1]];
      for (const [a,b] of next) {
        if(a<0||b<0||a>=nx||b>=nz)continue;
        const nk=b*nx+a;
        if(seen[nk]||!valid(nk))continue;
        seen[nk]=1;prev[nk]=k;queue[tail++]=nk;
      }
    }
    if(goal<0)return null;
    const route=[];
    for(let k=goal;k!==start;k=prev[k]) {
      if(k<0)return null;
      route.push(coord(k));
    }
    route.reverse();
    // 余分な折れ線は取り除き、障害物を貫通しない範囲で滑らかに歩く
    const smooth=[],raw=[{x:p.x,z:p.z},...route];
    let at=0;
    while(at<raw.length-1) {
      let far=at+1;
      for(let n=far+1;n<raw.length;n++) {
        if(lineFree(raw[at].x,raw[at].z,raw[n].x,raw[n].z))far=n;
      }
      smooth.push(raw[far]);at=far;
    }
    return smooth;
  }

  function act(entry) {
    if(G.state!=='play'||!activeRoom)return;
    if(entry.type==='item') {
      if(!entry.ref.taken && entry.ref.group.visible)pickupItem(entry.ref);
    } else if(entry.type==='spot') {
      inspectSpot(entry.ref);
    } else if(entry.type==='door') {
      tryDoor(entry.ref);
    }
  }

  function choose(entry) {
    if(G.state!=='play'||!activeRoom)return false;
    cancel();
    const distance=Math.hypot(G.p.x-entry.x,G.p.z-entry.z);
    if(distance<entry.reach) {act(entry);return true;}
    const route=routeTo(entry);
    if(!route) {
      say('ここからは いけないよ。すこし ちかづいてみよう。',3.3);
      return false;
    }
    navigation={entry,route,index:0,room:G.room,still:0,replanned:false};
    const status=$('tapStatus');
    if(status){status.hidden=false;status.textContent='あるいています…（スティックで やめる）';}
    return true;
  }

  function autoStep(dt) {
    const nav=navigation;
    if(!nav||G.state!=='play')return false;
    if(nav.room!==G.room) {cancel();return false;}
    if(G.keys.up||G.keys.down||G.keys.left||G.keys.right||
       Math.hypot(G.touch.joyX||0,G.touch.joyY||0)>.12) {
      cancel();return false;
    }
    const entry=nav.entry;
    if(entry.type==='item' && (entry.ref.taken||!entry.ref.group.visible)){cancel();return false;}
    if(Math.hypot(G.p.x-entry.x,G.p.z-entry.z)<entry.reach-.03){
      cancel();act(entry);return false;
    }
    const point=nav.route[nav.index];
    if(!point) {cancel();say('もうすこし ちかくに いこう。',2);return false;}
    const dx=point.x-G.p.x,dz=point.z-G.p.z,d=Math.hypot(dx,dz);
    if(d<.12){nav.index++;return false;}
    const length=Math.min(d,2.4*dt);
    const beforeX=G.p.x,beforeZ=G.p.z;
    tryMove(dx/d*length,dz/d*length);
    const moved=Math.hypot(G.p.x-beforeX,G.p.z-beforeZ);
    if(moved>.0005){
      G.p.a=Math.atan2(dx,dz);
      nav.still=0;
      return true;
    }
    nav.still+=dt;
    if(nav.still>.45){
      if(!nav.replanned){
        nav.replanned=true;nav.still=0;
        const route=routeTo(entry);
        if(route){nav.route=route;nav.index=0;return false;}
      }
      cancel();say('ものが あって すすめないよ。',2.6);
    }
    return false;
  }

  function inspectSpot(sp) {
    if(G.state!=='play'||!SPOTS[sp.id])return false;
    const id=sp.id, hasItem=k=>G.bag.includes(k),fixed=k=>G.fixed.includes(k);
    const info={
      board:{
        title:'こくばんを しらべる',
        text:fixed('classroom')?'きれいな こくばんに「1ばんめ＝5」と かいてある。':
          (hasItem('eraser')?'らくがきが いっぱい！ こくばんけしで けしてみよう。':'らくがきで いっぱい。こくばんけしが あれば…'),
        action:fixed('classroom')?'ばんごうを よむ':hasItem('eraser')?'こくばんけしを つかう':'よく しらべる'
      },
      clock:{
        title:'とけいを しらべる',
        text:fixed('staff')?'とけいが うごいている。うらに「2ばんめ＝1」。':
          (hasItem('battery')?'でんちが はいる ところが ある！':'とまっている。でんちが ぬかれているみたい。'),
        action:fixed('staff')?'ばんごうを よむ':hasItem('battery')?'でんちを いれる':'よく しらべる'
      },
      stage:{
        title:'ステージを しらべる',
        text:fixed('gym')?'おばけたちは しずかになった。':
          (hasItem('whistle')?'ふえの おとで おばけたちが とまりそう！':'おばけたちが さわいでいる。なにか ひつようだ。'),
        action:hasItem('whistle')?'ふえを ふく':'よく しらべる'
      },
      homework:{
        title:'ぼくの つくえ',text:'つくえの なかに なにか あるよ。',action:'しゅくだいを みる'
      },
      gate:{
        title:'げんかんの ドア',text:fixed('classroom')&&fixed('staff')&&fixed('gym')?
          'やった！ ドアが ひらきそう！':'おばけの ちからで とじられている。',action:'ドアを しらべる'
      }
    }[id];
    if(!info)return false;
    showPanel(info.title,info.text,info.action,id,()=>SPOTS[id].act());
    return true;
  }

  function showPanel(title,description,action,type,callback) {
    cancel();
    G.state='inspect';
    ModernControls.release();
    G.keys=Object.create(null);
    const panel=$('inspectPanel');
    $('inspectTitle').textContent=title;
    $('inspectDescription').textContent=description;
    $('inspectIllustration').dataset.kind=type;
    $('inspectArtText').textContent=type==='board'?'こくばん':type==='clock'?'12  ◷  3':
      type==='stage'?'♪  ♪  ♪':type==='homework'?'ノート':'?';
    const btn=$('inspectAction');
    btn.textContent=action||'しらべる';
    btn.hidden=!callback;
    currentInspect=callback||null;
    panel.hidden=false;
    $('poiLayer').hidden=true;
    $('quickBar').hidden=true;
    (callback ? btn : $('inspectClose')).focus();
  }
  function closePanel(run) {
    if(G.state!=='inspect')return;
    const fn=run?currentInspect:null;
    currentInspect=null;
    $('inspectPanel').hidden=true;
    G.state='play';
    if(fn) fn();
  }
  function showHintPanel() {
    if(G.state!=='play')return;
    const hint=showHint();
    showPanel('ヒント','こまったら これを やってみよう！\n'+hint,'','hint',null);
  }

  function updateQuick() {
    const tray=$('quickItems');
    if(!tray)return;
    const codes=G.bag.slice();
    if(G.herbs>0)codes.push('leaf');
    const key=codes.join(',')+':'+G.herbs;
    if(tray.dataset.value===key)return;
    tray.dataset.value=key;
    tray.replaceChildren();
    const names={eraser:'けしゴム',key_staff:'かぎ',battery:'でんち',whistle:'ふえ',leaf:'はっぱ'};
    if(!codes.length){const empty=document.createElement('span');empty.textContent='もちもの なし';tray.append(empty);}
    else for(const id of codes){
      const chip=document.createElement('span');
      chip.className='quick-item';
      chip.textContent=(names[id]||id)+(id==='leaf'?' '+G.herbs:'');
      tray.append(chip);
    }
  }

  function refresh(dt) {
    refreshTimer-=dt;
    if(refreshTimer>0)return;
    refreshTimer=.15;
    const play=G.state==='play'&&!!activeRoom;
    $('poiLayer').hidden=!play;
    $('quickBar').hidden=!play;
    if(!play)return;
    updateQuick();
    const visible=new Set();
    for(const entry of targets()){
      const distance=Math.hypot(G.p.x-entry.x,G.p.z-entry.z);
      if(distance>12)continue;
      const v=new THREE.Vector3(entry.x,entry.y,entry.z);
      const delta=v.clone().sub(activeCam.position);
      const forward=new THREE.Vector3();
      activeCam.getWorldDirection(forward);
      if(forward.dot(delta)<=.1)continue;
      const p=projectToScreen(entry.x,entry.y,entry.z);
      if(!p.ok||p.x<17||p.x>303||p.y<37||p.y>200)continue;
      visible.add(entry.key);
      let button=markers.get(entry.key);
      if(!button){
        button=document.createElement('button');
        button.type='button';button.className='poi-marker';
        button.textContent='✦';
        button.addEventListener('click',ev=>{ev.preventDefault();ev.stopPropagation();choose(button.targetEntry);});
        $('poiLayer').append(button);
        markers.set(entry.key,button);
      }
      button.targetEntry=entry;
      button.title=entry.label;
      button.dataset.short=Array.from(entry.label).slice(0,9).join('');
      button.setAttribute('aria-label',entry.label+'まで いって しらべる');
      button.style.left=(p.x/320*100).toFixed(2)+'%';
      button.style.top=(p.y/240*100).toFixed(2)+'%';
      button.classList.toggle('near',distance<=entry.reach);
      button.classList.toggle('spot',entry.type==='spot');
      button.classList.toggle('selected',!!navigation && navigation.entry.key===entry.key);
    }
    for(const [key,button] of markers)if(!visible.has(key)){button.remove();markers.delete(key);}
  }

  function bind() {
    if(bound)return;bound=true;
    $('quickHint').addEventListener('click',showHintPanel);
    $('quickBag').addEventListener('click',()=>{if(G.state==='play')openInventory();});
    $('inspectAction').addEventListener('click',()=>closePanel(true));
    $('inspectClose').addEventListener('click',()=>closePanel(false));
    // 拡大画面のEscape処理はlogic.jsの既存キーハンドラに集約。
    // 画面が閉じたら自動移動も解除（pointer入力の離し忘れ防止）
    addEventListener('blur',cancel);
  }
  return {bind,targets,choose,routeTo,autoStep,refresh,cancel,suspend,showHintPanel,
    inspectSpot,closePanel,inspectStatus:()=>({active:!!navigation,room:navigation&&navigation.room})};
})();
