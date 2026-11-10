/* True bitmap GUI: layout & controls remain DOM for a11y, only sprite pixels visible. */
(function(){
"use strict";
const FONT=window.ObakeBitmap,ART=window.ObakePixelUI;
if(!FONT||!ART){console.warn("Bitmap UI unavailable; original controls retained");return;}
const IDS=["title","pause","result","zukan","tv","tools","skills","toast","rotate","calT"];
const canvas=document.createElement("canvas"),virtualH=480,ctx=canvas.getContext("2d");
canvas.id="bitmapUIOverlay";canvas.setAttribute("aria-hidden","true");
canvas.style.cssText="position:fixed;inset:0;width:100vw;height:100dvh;image-rendering:pixelated;pointer-events:none;z-index:1000";
document.body.appendChild(canvas);
const $=id=>document.getElementById(id);
const colors={text:"#f5eefb",gold:"#ffe28e",muted:"#c0b4db",dark:"#1a1b35",cyan:"#9fe6f1"};
function bounds(el){
 if(!el||el.hidden||el.closest("[hidden]")||!el.getClientRects().length)return null;
 const r=el.getBoundingClientRect();
 if(r.width<2||r.height<2||r.right<=0||r.bottom<=0||r.left>=innerWidth||r.top>=innerHeight)return null;
 return r;
}
function scaled(el,sx,sy){
 const r=bounds(el);
 return r&&[Math.round(r.left*sx),Math.round(r.top*sy),Math.round(r.width*sx),Math.round(r.height*sy)];
}
// Native 20x20 raster border drawn as nine-slice image, not a CSS border.
function nine(img,x,y,w,h){
 if(!img||w<8||h<8)return;
 const p=Math.min(7,Math.floor(w/3),Math.floor(h/3));
 const old=ctx.imageSmoothingEnabled;ctx.imageSmoothingEnabled=false;
 const d=(a,b,c,e,dx,dy,dw,dh)=>{if(dw>0&&dh>0)ctx.drawImage(img,a,b,c,e,x+dx,y+dy,dw,dh)};
 d(0,0,7,7,0,0,p,p);d(7,0,6,7,p,0,w-2*p,p);d(13,0,7,7,w-p,0,p,p);
 d(0,7,7,6,0,p,p,h-2*p);d(7,7,6,6,p,p,w-2*p,h-2*p);d(13,7,7,6,w-p,p,p,h-2*p);
 d(0,13,7,7,0,h-p,p,p);d(7,13,6,7,p,h-p,w-2*p,p);d(13,13,7,7,w-p,h-p,p,p);
 ctx.imageSmoothingEnabled=old;
}
function parts(sx,sy){
 const sections=[
  ["#title .menu","--px-panel"],["#pause .result","--px-panel"],["#result .result","--px-panel"],
  ["#zukan .zbox","--px-panel"],["#tv .tvbox","--px-panel"],
  ["#title .logo .sub","--px-panel"],["#title .pixel-edition","--px-panel"],
  ["#result .stats div","--px-panel"],["#zukan .zc","--px-panel"],["#toast","--px-panel"],
  ["#title .mode","--px-btn"],["#title .sub2","--px-btn"],
  ["#title .go","--px-primary"],["#pause .sub2","--px-btn"],["#pause .go","--px-primary"],
  ["#result .sub2","--px-btn"],["#result .go","--px-primary"],
  ["#zukan .sub2","--px-btn"],["#tv .sub2","--px-btn"],
  ["#tools .tb","--px-btn"],["#skills .hex","--px-btn"]
 ];
 for(const [selector,id]of sections){
  const image=ART.getSprite?.(id);if(!image)continue;
  for(const el of document.querySelectorAll(selector)){
   const r=scaled(el,sx,sy);if(!r)continue;
   const pic=el.matches(".mode[aria-pressed='true'],:focus-visible")?ART.getSprite("--px-btn-active")||image:image;
   nine(pic,...r);
   if(el.disabled){ctx.fillStyle="rgba(16,18,35,.55)";ctx.fillRect(...r);}
  }
 }
}
function pictures(sx,sy){
 for(const selector of ["#title .ghosts img","#zukan .zc img","#zukan .zc canvas","#tvQR","#skills .pixel-icon"]){
  for(const el of document.querySelectorAll(selector)){
   const r=scaled(el,sx,sy);if(!r)continue;
   if(el.tagName==="IMG"&&(!el.complete||!el.naturalWidth))continue;
   try{ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(el,...r);ctx.restore();}catch(_){}
  }
 }
 for(const [id,symbol]of [["bPause","pause"],["bMute","sound"],["bReload","reload"],["bCenter","target"]]){
  const el=$(id),r=scaled(el,sx,sy);if(!r)continue;
  const name=symbol==="sound"&&el.getAttribute("aria-pressed")==="true"?"silent":symbol;
  ART.drawIcon(ctx,name,r[0]+r[2]/2,r[1]+r[3]/2,Math.min(25,r[3]*.58));
 }
}
function color(el){
 if(el.closest(".go,.sk .key"))return colors.dark;
 if(el.closest(".mode[aria-pressed='true'],.rank,.rstars,.best,.pixel-edition,.logo .sub,.tvcode,#toast"))return colors.gold;
 if(el.closest("#tvStat"))return colors.cyan;
 if(el.closest(".mode small,.zc.no"))return colors.muted;
 return colors.text;
}
function visible(el){
 if(!el||el.closest("[hidden]"))return false;
 const st=getComputedStyle(el);
 if(st.display==="none"||st.visibility==="hidden")return false;
 if(el.closest("#toast")&&parseFloat(getComputedStyle($("toast")).opacity)<.02)return false;
 return true;
}
const range=document.createRange();
function texts(sx,sy){
 for(const id of IDS){
  const root=$(id);if(!root||!visible(root))continue;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  let node;
  while((node=walker.nextNode())){
   if(!node.nodeValue?.trim()||!visible(node.parentElement))continue;
   const ink=color(node.parentElement);
   let pos=0;
   for(const ch of node.nodeValue){
    const length=ch.length;
    if(ch.trim()){
     range.setStart(node,pos);range.setEnd(node,pos+length);
     const r=range.getBoundingClientRect();
     if(r.width>0&&r.height>0&&r.right>0&&r.bottom>0&&r.left<innerWidth&&r.top<innerHeight){
      const x=r.left*sx,y=r.top*sy,w=r.width*sx,h=r.height*sy;
      const narrow=ch.charCodeAt(0)<128;
      const size=Math.min(h*.80,Math.max(5,w*(narrow?1.55:1.05)));
      const cw=Math.max(1,Math.min(w*1.03,size*(narrow?.72:1)));
      FONT.drawGlyph(ctx,ch,x+(w-cw)/2,y+(h-size)/2,cw,size,ink);
     }
    }
    pos+=length;
   }
  }
 }
}
function paint(){
 const w=Math.max(1,Math.round(innerWidth/Math.max(1,innerHeight)*virtualH));
 if(canvas.width!==w||canvas.height!==virtualH){canvas.width=w;canvas.height=virtualH;}
 ctx.clearRect(0,0,canvas.width,canvas.height);
 const sx=w/innerWidth,sy=virtualH/innerHeight;
 parts(sx,sy);pictures(sx,sy);texts(sx,sy);
}
const css=[
 ".pixel-bitmap-ui #cv{image-rendering:pixelated!important}",
 ".pixel-bitmap-ui :is(#title,#pause,#result,#zukan,#tv,#tools,#skills,#toast,#rotate,#calT) :not(canvas):not(img):not(svg){color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}",
 ".pixel-bitmap-ui :is(.menu,.tvbox,.result,.zbox,.mode,.sub2,.zbtn,.altlink,.go,.tb,.stats div,.zc,.pixel-edition,.logo .sub,#toast,.sk .hex){background:transparent!important;background-image:none!important;border-color:transparent!important;border-image:none!important;box-shadow:none!important;text-shadow:none!important;backdrop-filter:none!important;filter:none!important}",
 ".pixel-bitmap-ui :is(.mode,.sub2,.go,.tb,.zbtn,.altlink,.sk):focus-visible{outline:3px solid #ffe28e!important;outline-offset:3px!important}",
 ".pixel-bitmap-ui .tb::before,.pixel-bitmap-ui .sk .hex::before,.pixel-bitmap-ui .sk .pixel-icon,.pixel-bitmap-ui :is(.zc img,.zc canvas,.ghosts img,#tvQR){opacity:0!important}",
 ".pixel-bitmap-ui .logo h1{-webkit-text-stroke:0!important}"
 ].join("\n");
const style=document.createElement("style");style.textContent=css;document.head.appendChild(style);
document.documentElement.classList.add("pixel-bitmap-ui");
let last=-1,active=true;
function tick(time){
 if(!active)return;
 if(time-last>120){
  last=time;
  if(!document.hidden)try{paint();}catch(e){
   console.error("Bitmap UI reverted to accessible HTML fallback",e);
   document.documentElement.classList.remove("pixel-bitmap-ui");
   canvas.remove();active=false;return;
  }
 }
 requestAnimationFrame(tick);
}
document.addEventListener("visibilitychange",()=>{if(!document.hidden)last=-1;});
requestAnimationFrame(tick);
window.ObakeBitmapUI=Object.freeze({paint,canvas,virtualHeight:virtualH});
})();