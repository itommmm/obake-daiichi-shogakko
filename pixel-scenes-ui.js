/* おばけ第一小学校 - pixel backgrounds and pixel-drawn UI (pixelfx edition).
 * 100% Canvas rectangle art at native low resolution. No external images/fonts.
 * Interface labels and hit areas deliberately stay as accessible HTML controls.
 */
(function(){
"use strict";
const P={
 sky0:"#0a1027",sky1:"#121936",sky2:"#212747",sky3:"#303457",
 deep:"#10172f",ink:"#131629",panel:"#1e2647",panel2:"#303459",
 purple:"#6e608d",lilac:"#ae9cc7",light:"#dcd1e5",white:"#f6eedd",
 cyan:"#75c9d5",blue:"#49729b",gold:"#f1c477",warm:"#d99465",
 brown:"#684b5b",brick:"#625b75",brick2:"#84778b",wood:"#826177",
 green:"#4d746b",sea:"#3c6875",pink:"#df80aa",rose:"#a85e80"
};
const $=id=>document.getElementById(id);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const step=(n)=>Math.round(n);
function r(g,x,y,w,h,c){
 if(w<=0||h<=0)return;
 g.fillStyle=c;g.fillRect(step(x),step(y),Math.ceil(w),Math.ceil(h));
}
function pixelCircle(g,x,y,rx,ry,color){
 for(let row=-ry;row<=ry;row++){
  const k=1-row*row/(ry*ry),dx=Math.floor(rx*Math.sqrt(Math.max(0,k)));
  r(g,x-dx,y+row,dx*2+1,1,color);
 }
}
function line(g,x0,y0,x1,y1,c,width=1){
 x0=step(x0);y0=step(y0);x1=step(x1);y1=step(y1);
 const dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1;
 let err=dx+dy;
 for(let i=0;i<700;i++){
  r(g,x0,y0,width,width,c);
  if(x0===x1&&y0===y1)break;
  const e=err*2;
  if(e>=dy){err+=dy;x0+=sx;}
  if(e<=dx){err+=dx;y0+=sy;}
 }
}
function stripes(g,W,H,colors){
 const rows=colors.length;
 for(let i=0;i<rows;i++)r(g,0,Math.floor(H*i/rows),W,Math.ceil(H/rows)+1,colors[i]);
}
function stars(g,W,night,t){
 if(!night)return;
 const blink=Math.floor(t*2);
 for(let i=0;i<56;i++){
  const x=(i*71+19)%W,y=(i*29+i*i*3+9)%89;
  const show=(i+blink)%7!==0;
  if(show)r(g,x,y,i%11===0?2:1,1,i%4===0?P.cyan:P.lilac);
 }
}
function tree(g,x,y,night){
 const leaf=night?"#242b42":"#466a61",high=night?"#38405a":"#71947b";
 r(g,x-2,y+14,5,22,P.brown);
 r(g,x-13,y+1,27,19,leaf);
 r(g,x-8,y-7,18,17,leaf);
 r(g,x-3,y-12,9,13,high);
 r(g,x-9,y+3,8,3,high);
}
function school(g,cx,night,t){
 const x=cx-110,lit=night?P.gold:P.cyan;
 r(g,x,90,220,61,night?"#565269":"#9c9da9");
 r(g,x+4,94,212,52,night?"#71677e":"#b0adb5");
 r(g,x-6,83,232,8,P.ink);
 r(g,x-11,78,242,6,night?"#453d61":"#6a7187");
 r(g,x+3,72,216,6,night?"#60536f":"#9295a4");
 // clock tower with a tiered pixel roof
 r(g,cx-23,51,46,40,night?"#72677d":"#b2aeb5");
 r(g,cx-28,45,56,6,P.ink);
 r(g,cx-20,37,40,8,night?"#584767":"#64718b");
 r(g,cx-13,31,26,6,night?"#67506f":"#8090a2");
 r(g,cx-4,26,8,5,P.gold);
 r(g,cx-13,57,26,26,P.ink);r(g,cx-10,60,20,20,night?P.light:P.white);
 r(g,cx-1,61,2,12,P.ink);r(g,cx-1,70,8,2,P.ink);
 // three floor window rows, with outlined mullions
 for(let j=0;j<3;j++)for(let k=0;k<9;k++){
  const wx=x+10+k*24,wy=96+j*16,glow=night&&((j*9+k+Math.floor(t*1.3))%5===0);
  r(g,wx-1,wy-1,17,14,P.ink);
  r(g,wx+1,wy+1,13,10,night?(glow?P.gold:"#354864"):(j===2?P.blue:"#5684a3"));
  r(g,wx+6,wy+1,2,10,night?P.brick:P.light);
  r(g,wx+1,wy+5,13,1,night?P.brick:P.light);
  if(glow)r(g,wx+3,wy+2,2,2,P.white);
 }
 // center entrance + stairs + tile detail
 r(g,cx-17,129,34,24,P.ink);r(g,cx-13,133,26,20,night?"#303044":"#586d80");
 r(g,cx-1,133,2,20,P.brick2);r(g,cx-14,151,28,3,P.light);
 r(g,cx-24,155,48,4,night?P.brick:P.brick2);
 r(g,cx-30,159,60,4,night?P.brown:P.brick2);
 for(let i=0;i<4;i++)r(g,x+2+i*51,89,3,58,night?"#41445a":"#8d8798");
}
function outerSchool(g,W,H,night,t){
 const nightSky=[P.sky0,P.sky0,P.sky1,P.sky1,P.sky2,P.sky2,P.sky3,"#3b3b5c"];
 const daySky=["#527eaa","#648eae","#709fb8","#8eb1bf","#b5c0bd","#d6c2b2","#d8b4a7","#b78e90"];
 stripes(g,W,H,night?nightSky:daySky);stars(g,W,night,t);
 const cx=Math.floor(W/2);
 pixelCircle(g,cx+126,29,17,17,night?P.light:P.gold);
 if(night){pixelCircle(g,cx+133,22,14,14,P.sky0);}
 else{
  r(g,cx+126,0,2,8,P.gold);r(g,cx+126,52,2,8,P.gold);
  r(g,cx+97,29,8,2,P.gold);r(g,cx+151,29,8,2,P.gold);
 }
 for(let x=0;x<W;x+=15){
  const h=(x*11%27)+9;
  r(g,x,108-h,16,h,night?"#1e2b40":"#72928b");
 }
 r(g,0,140,W,40,night?"#29243c":"#7f837d");
 school(g,cx,night,t);
 for(let x=0;x<W;x+=46){if(Math.abs(x-cx)>112)tree(g,x+18,117,night);}
 // pixel steps and vanishing-point path, no antialias or gradients
 for(let k=0;k<7;k++){
  const y=159+k*3,w=36+k*18;
  r(g,cx-w/2,y,w,3,night?(k%2?P.brick:"#52526b"):(k%2?"#b5a998":"#d0b7a3"));
 }
 // iron gate / foreground rails
 for(let edge of[-1,1]){
  const start=cx+edge*142;
  r(g,start-2,136,4,44,P.ink);
  r(g,start-8,137,16,4,P.brick2);
  for(let j=0;j<4;j++){
   const x=start+edge*(12+j*14);
   r(g,x,148,2,32,P.ink);r(g,x-2,146,6,4,P.brick2);
  }
  r(g,start+(edge>0?0:-60),158,62,3,P.ink);
 }
 if(night){
  // Pixel rain / floating lights in front of the school.
  for(let i=0;i<22;i++){
   const x=(i*43+Math.floor(t*5)*2)%W,y=(i*47+Math.floor(t*9))%180;
   if(i%3===0)r(g,x,y,1,4,P.cyan);
   else if(i%4===0)r(g,x,y,2,2,P.gold);
  }
 }else{
  for(let i=0;i<24;i++){
   const x=(i*73+Math.floor(t*12))%W,y=(i*41+i*i*7+20)%162;
   r(g,x,y,2,3,[P.gold,P.pink,P.white,P.cyan][i%4]);
  }
 }
 // Neutral shadow behind the central title/menu ensures text contrast.
 r(g,0,H-7,W,7,night?"#0c1023":"#5b6070");
}
function ghost(g,x,y,color,eyes=true){
 pixelCircle(g,x,y,17,14,P.ink);
 pixelCircle(g,x,y-1,15,13,color);
 r(g,x-15,y,30,23,color);
 for(let k=0;k<3;k++)r(g,x-15+k*11,y+21+(k%2?0:3),11,4,color);
 if(eyes){r(g,x-9,y-2,5,7,P.ink);r(g,x+5,y-2,5,7,P.ink);
  r(g,x-7,y,2,2,P.white);r(g,x+7,y,2,2,P.white);
  r(g,x-8,y+10,5,2,P.pink);r(g,x+7,y+10,5,2,P.pink);}
}
function classroom(g,W,H,t){
 const cx=Math.floor(W/2);
 stripes(g,W,H,[P.sky0,P.sky1,P.sky2,P.sky2,P.brick,P.brick,P.brown,P.ink]);
 r(g,0,0,W,14,P.deep);r(g,0,15,W,3,P.brick2);
 for(let y=26;y<140;y+=18)r(g,0,y,W,1,P.brick);
 // Far window
 r(g,cx-130,32,61,74,P.ink);r(g,cx-125,37,51,64,P.blue);
 r(g,cx-101,37,3,64,P.brick2);r(g,cx-125,67,51,3,P.brick2);
 for(let i=0;i<12;i++)r(g,cx-121+i*7,44+(i*19)%47,1,2,P.light);
 // Blackboard and school graffiti all as pixel shapes, no browser text rendered into the art
 r(g,cx-57,33,142,71,P.wood);
 r(g,cx-53,36,134,65,"#2d514a");
 for(let j=0;j<7;j++){
  r(g,cx-38+j*16,50+(j%2)*4,9,2,P.cyan);
  r(g,cx-39+j*16,59+(j%3)*4,5,2,P.white);
 }
 r(g,cx-55,105,142,4,P.wood);
 // School desks and chairs in foreground
 for(let j=0;j<4;j++){
  const x=cx-154+j*88,y=126+(j%2)*7;
  r(g,x,y,61,7,P.ink);r(g,x+2,y+1,57,4,P.wood);
  r(g,x+7,y+7,4,30,P.ink);r(g,x+51,y+7,4,30,P.ink);
  r(g,x+8,y+19,45,2,P.brick2);
 }
 r(g,0,161,W,19,P.ink);
 // Foreground enemies as true 48x48 pixel drawings, through the separate artist module.
 const art=window.ObakePixelArt;
 if(art&&typeof art.getCanvas==="function"){
  const left=art.getCanvas("randoseru",Math.floor(t*3)%2);
  const right=art.getCanvas("isu",Math.floor(t*2)%2);
  g.imageSmoothingEnabled=false;
  if(left)g.drawImage(left,cx-153,95,63,63);
  if(right)g.drawImage(right,cx+105,99,57,57);
 }
 ghost(g,cx-96,74,P.lilac);
 ghost(g,cx+113,72,P.pink);
 if(Math.floor(t*2)%4===0)r(g,cx+80,45,6,3,P.gold);
}
function paintBackdrop(canvas,kind,t){
 if(!canvas)return;
 const cssW=Math.max(1,window.innerWidth),cssH=Math.max(1,window.innerHeight);
 const w=clamp(Math.round(cssW/cssH*180),200,650);
 if(canvas.width!==w)canvas.width=w;
 if(canvas.height!==180)canvas.height=180;
 const g=canvas.getContext("2d",{alpha:false});if(!g)return;
 g.imageSmoothingEnabled=false;
 if(kind==="title")outerSchool(g,w,180,true,t);
 else if(kind==="win")outerSchool(g,w,180,false,t);
 else classroom(g,w,180,t);
}
function makeCanvas(w,h,paint){
 const c=document.createElement("canvas");c.width=w;c.height=h;
 const g=c.getContext("2d");g.imageSmoothingEnabled=false;paint(g);
 return c;
}
function patternTexture(c0,c1){
 return makeCanvas(24,24,g=>{
  r(g,0,0,24,24,c0);
  for(let y=0;y<24;y+=8)for(let x=0;x<24;x+=8){
    if((x+y)%3===0)r(g,x+3,y+3,2,2,c1);
  }
 });
}
function frameTexture(fill,mid,highlight){
 return makeCanvas(20,20,g=>{
  // 20x20 real pixel 9-slice sprite: inset corners, 2px highlight, inner stepped corners.
  r(g,5,0,10,2,highlight);r(g,3,2,14,2,highlight);
  r(g,2,4,16,12,mid);r(g,0,6,20,8,mid);
  r(g,3,4,14,12,fill);r(g,4,3,12,14,fill);
  r(g,6,2,8,16,fill);
  r(g,3,3,3,3,highlight);r(g,14,3,3,3,mid);
  r(g,3,14,3,3,mid);r(g,14,14,3,3,mid);
  r(g,5,5,10,1,highlight);r(g,5,14,10,1,P.ink);
 });
}
function iconSprite(name,color="#f6eedd"){
 return makeCanvas(16,16,g=>{
  const v=(x,y,w,h,c=color)=>r(g,x,y,w,h,c);
  switch(name){
  case "light":
   v(0,6,5,5);v(4,4,4,9);v(8,6,3,5);v(11,3,3,2);
   v(12,7,4,2);v(11,12,3,2);break;
  case "bell":
   v(7,1,3,2);v(5,3,7,2);v(3,5,11,8);v(2,12,13,2);v(6,14,5,2);break;
  case "spark":
   v(7,0,2,16);v(0,7,16,2);
   v(3,3,3,3);v(10,3,3,3);v(3,10,3,3);v(10,10,3,3);
   r(g,7,7,2,2,P.gold);break;
  case "pause":
   v(3,2,3,12);v(10,2,3,12);break;
  case "sound":
   v(1,6,4,5);v(5,4,3,9);v(10,5,2,7);v(13,3,2,11);break;
  case "silent":
   v(1,6,4,5);v(5,4,3,9);line(g,10,5,15,11,P.pink,2);line(g,15,5,10,11,P.pink,2);break;
  case "reload":
   v(5,1,8,2);v(2,3,3,8);v(4,12,10,2);
   v(11,0,3,6);v(9,4,6,4);break;
  case "target":
   v(2,2,4,2);v(10,2,4,2);v(2,12,4,2);v(10,12,4,2);
   v(2,3,2,3);v(12,3,2,3);v(2,10,2,3);v(12,10,2,3);
   v(7,7,2,2,P.cyan);break;
  case "ghost":
   pixelCircle(g,8,7,6,6,color);
   v(2,7,12,6);v(2,12,3,3);v(6,12,4,3);v(11,12,3,3);
   r(g,5,7,2,3,P.ink);r(g,10,7,2,3,P.ink);break;
  case "star":
   v(7,1,2,13);v(2,5,12,3);v(3,11,3,3);v(10,11,3,3);break;
  }
 });
}
const icons=new Map();
function drawIcon(ctx,name,x,y,size,color){
 if(!ctx||size<=0)return;
 const key=name+"-"+(color||P.white);
 let image=icons.get(key);
 if(!image){image=iconSprite(name,color||P.white);icons.set(key,image);}
 ctx.save();ctx.imageSmoothingEnabled=false;
 ctx.drawImage(image,Math.round(x-size/2),Math.round(y-size/2),Math.round(size),Math.round(size));
 ctx.restore();
}
function drawPanel(ctx,x,y,w,h,color,u=1){
 if(!ctx||w<=0||h<=0)return;
 const p=Math.max(2,Math.round(u*3));
 const X=Math.round(x),Y=Math.round(y),W=Math.round(w),H=Math.round(h);
 r(ctx,X+4,Y+4,W,H,P.ink);
 r(ctx,X+p,Y,W-2*p,H,"rgba(10,14,34,.95)");
 r(ctx,X,Y+p,W,H-2*p,"rgba(10,14,34,.95)");
 r(ctx,X+2*p,Y,W-4*p,p,color);
 r(ctx,X+2*p,Y+H-p,W-4*p,p,P.purple);
 r(ctx,X,Y+2*p,p,H-4*p,color);
 r(ctx,X+W-p,Y+2*p,p,H-4*p,P.purple);
 r(ctx,X+p,Y+p,p,p,P.light);r(ctx,X+W-2*p,Y+p,p,p,color);
 r(ctx,X+p,Y+H-2*p,p,p,P.purple);
 r(ctx,X+2*p,Y+2*p,Math.min(W*.23,48*u),p,P.cyan);
}
const spriteAtlas=new Map();
function setAsset(name,canvas){
 spriteAtlas.set(name,canvas);
 document.documentElement.style.setProperty(name,'url("'+canvas.toDataURL("image/png")+'")');
}
function installStyle(){
 setAsset("--px-panel",frameTexture(P.panel,P.purple,P.lilac));
 setAsset("--px-btn",frameTexture(P.panel,P.blue,P.cyan));
 setAsset("--px-btn-active",frameTexture("#30294f",P.purple,P.gold));
 setAsset("--px-primary",frameTexture("#b27a39","#765033",P.white));
 setAsset("--px-menu-texture",patternTexture("#171d36","#293451"));
 setAsset("--px-controls-texture",patternTexture("#1c2842","#303a58"));
 setAsset("--px-dialog-texture",patternTexture("#131a32","#24314b"));
 setAsset("--px-star-texture",makeCanvas(24,24,g=>{
  r(g,0,0,24,24,P.sky0);r(g,6,4,2,2,P.lilac);r(g,17,12,1,2,P.gold);
  r(g,2,21,2,1,P.blue);r(g,21,2,1,1,P.cyan);
 }));
 for(const name of ["pause","sound","silent","reload","target"])
  setAsset("--px-icon-"+name,iconSprite(name));
 const skills=[["sLight","light"],["sBell","bell"],["sSp","spark"]];
 for(const [id,name] of skills){
  const button=$(id);if(!button)continue;
  const hex=button.querySelector(".hex");if(!hex)continue;
  if(hex.querySelector(".pixel-icon"))continue;
  const canvas=iconSprite(name);
  canvas.className="pixel-icon";
  canvas.setAttribute("aria-hidden","true");
  hex.appendChild(canvas);
 }
 document.documentElement.classList.add("pixel-ui-ready");
}
let last=0,lastView="";
function renderAll(t=0){
 if($("title")&&!$("title").hidden)paintBackdrop($("titlePixelBg"),"title",t);
 const result=$("result");
 if(result&&!result.hidden)paintBackdrop($("resultPixelBg"),result.dataset.r==="win"?"win":"lose",t);
}
function loop(now){
 if(now-last>=100){
  last=now;
  if(!document.hidden)renderAll(now/1000);
 }
 requestAnimationFrame(loop);
}
installStyle();
renderAll(0);
requestAnimationFrame(loop);
window.ObakePixelUI=Object.freeze({drawPanel,drawIcon,renderAll,getSprite:name=>spriteAtlas.get(name)});
})();