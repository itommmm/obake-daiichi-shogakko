/* おばけ第一小学校 - editable hand-drawn pixel assets for pixelfx.html.
 * 48x48 enemy sprites + 32/64/128 pixel scenery textures.
 * All art consists of integer rectangles and Bresenham lines (no scaling filter).
 * This file deliberately does not depend on the game state or import new libraries.
 */
(function(){
"use strict";
const SZ=48;
const C={
 ink:"#151428",shadow:"#36304d",white:"#f6e7da",shine:"#ffffff",
 lilac:"#b49bcc",purple:"#6c559b",rose:"#ec88ab",pink:"#de628e",
 darkBlue:"#273959",blue:"#4379ad",sky:"#77bdd0",aqua:"#a4e5da",
 red:"#c44c60",ruby:"#91354d",gold:"#f4cf77",amber:"#c99a55",
 brown:"#7b4e51",wood:"#b58066",tan:"#e2b58c",green:"#668f6d",
 mint:"#a0c999",grey:"#8a899b",lightGrey:"#d2ccce",black:"#181627"
};
const images=new Map(),textures=new Map();
function surface(w,h){
 const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
 const g=canvas.getContext("2d",{alpha:true});
 if(!g)return null;
 g.imageSmoothingEnabled=false;
 return {canvas,g};
}
function painter(g){
 function rect(x,y,w,h,color){
   if(w<=0||h<=0)return;
   g.fillStyle=color;
   g.fillRect(Math.round(x),Math.round(y),Math.ceil(w),Math.ceil(h));
 }
 function box(x,y,w,h,fill,edge=C.ink,thick=2){
   rect(x,y,w,h,edge);rect(x+thick,y+thick,w-2*thick,h-2*thick,fill);
 }
 function ell(x,y,rx,ry,fill,edge){
   for(let dy=-ry;dy<=ry;dy++){
     const v=1-dy*dy/(ry*ry||1),span=Math.floor(rx*Math.sqrt(Math.max(0,v)));
     if(edge)rect(x-span-1,y+dy,2*span+3,1,edge);
     else rect(x-span,y+dy,2*span+1,1,fill);
   }
   if(edge)for(let dy=-ry+2;dy<=ry-2;dy++){
     const span=Math.floor((rx-2)*Math.sqrt(Math.max(0,1-dy*dy/((ry-2)*(ry-2)||1))));
     rect(x-span,y+dy,2*span+1,1,fill);
   }
 }
 function line(x0,y0,x1,y1,color,size=2){
   x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);
   let dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1,err=dx+dy;
   while(true){rect(x0,y0,size,size,color);if(x0===x1&&y0===y1)break;
     const e=err*2;if(e>=dy){err+=dy;x0+=sx;}if(e<=dx){err+=dx;y0+=sy;}
   }
 }
 function face(x=24,y=21,frame=0,wide=5){
   for(const sd of[-1,1]){
     const ex=x+sd*wide-2;
     rect(ex,y,4,frame?2:5,C.ink);
     if(!frame)rect(ex+1,y+1,1,1,C.shine);
     rect(ex+sd*2,y+7,3,2,C.rose);
   }
   if(frame)rect(x-2,y+10,5,3,C.ink);
   else{rect(x-3,y+10,7,2,C.ink);rect(x-1,y+12,3,1,C.pink);}
 }
 return {rect,box,ell,line,face};
}
function drawEnemy(kind,frame=0){
 const s=surface(SZ,SZ);
 if(!s)return null;
 const {canvas,g}=s,{rect:r,box:b,ell:e,line:l,face:f}=painter(g);
 const y=frame?1:0;
 const face=(x=24,yy=20,wide=6)=>f(x,yy,frame,wide);
 switch(kind){
 case "randoseru":
   b(10,8+y,28,34,C.red);b(14,4+y,20,9,C.ruby);
   b(13,14+y,22,18,C.ruby);r(15,16+y,18,4,C.red);r(16,22+y,16,7,C.red);
   b(19,29+y,10,8,C.tan);r(23,30+y,3,4,C.gold);
   r(6,18+y,4,20,C.brown);r(38,18+y,4,20,C.brown);
   face(24,18+y,6);break;
 case "isu":
   b(10,3+y,28,25,C.wood);r(13,7+y,22,3,C.tan);
   b(8,28+y,32,8,C.wood);r(10,36+y,5,9,C.brown);r(33,36+y,5,9,C.brown);
   r(17,31+y,14,2,C.gold);face(24,12+y,6);break;
 case "tsukue":
   b(4,17+y,40,11,C.wood);r(6,20+y,36,3,C.tan);
   b(9,28+y,7,17,C.brown);b(32,28+y,7,17,C.brown);
   b(14,8+y,18,9,C.lightGrey);r(18,11+y,10,2,C.sky);
   face(24,20+y,7);break;
 case "keshigomu":
   b(8,12+y,32,24,C.white);r(9,12+y,30,7,C.sky);
   b(11,20+y,26,14,C.blue);r(13,22+y,22,3,C.sky);
   face(24,23+y,6);break;
 case "pencup":
   for(let k=0;k<5;k++){const cc=[C.gold,C.red,C.sky,C.green,C.pink][k];
     b(12+k*6,4+(k%2)*4+y,5,27,cc,C.ink,1);r(13+k*6,5+(k%2)*4+y,2,3,C.shine);}
   b(9,19+y,30,24,C.purple);r(12,22+y,24,5,C.lilac);face(24,28+y,7);break;
 case "pen":
   b(20,5+y,10,34,C.sky);b(19,8+y,12,13,C.blue);r(22,10+y,4,7,C.shine);
   l(21,39+y,25,46+y,C.ink,3);r(23,4+y,4,3,C.gold);face(25,21+y,3);break;
 case "scissors":
   e(14,34+y,8,8,C.sky,C.ink);e(34,34+y,8,8,C.rose,C.ink);
   e(14,34+y,3,3,C.ink);e(34,34+y,3,3,C.ink);
   l(21,29+y,32,7+y,C.lightGrey,4);l(28,29+y,14,7+y,C.grey,4);
   e(24,25+y,4,4,C.gold,C.ink);face(24,13+y,4);break;
 case "globe":
   e(24,20+y,18,18,C.blue,C.ink);
   r(12,10+y,10,5,C.green);r(16,15+y,9,6,C.mint);r(27,9+y,10,7,C.green);
   r(28,23+y,9,8,C.green);r(9,28+y,11,5,C.green);
   r(22,38+y,4,6,C.grey);b(14,43+y,20,4,C.tan);
   face(24,18+y,7);break;
 case "sheet":
   e(24,16+y,17,14,C.white,C.ink);r(7,18+y,34,19,C.ink);r(9,18+y,30,22,C.white);
   for(let j=0;j<4;j++)b(9+j*8,36+y+(j%2)*3,9,6,C.white,C.ink,1);
   r(13,17+y,22,2,C.shine);face(24,18+y,6);break;
 case "flask":
   b(19,5+y,10,17,C.lightGrey);r(21,7+y,6,8,C.aqua);
   for(let j=0;j<19;j++){
     const h=19-j,half=4+Math.floor(j*.65);
     r(24-half,19+j+y,half*2,1,j>10?C.green:C.aqua);
     r(24-half-2,19+j+y,2,1,C.ink);r(24+half,19+j+y,2,1,C.ink);
   }
   r(12,38+y,24,3,C.ink);r(17,28+y,7,3,C.mint);r(28,33+y,5,3,C.mint);
   face(24,25+y,6);break;
 case "ball":
   e(24,24+y,19,19,C.amber,C.ink);
   l(24,7+y,24,42+y,C.ink,2);l(7,24+y,41,24+y,C.ink,2);
   l(10,13+y,18,19+y,C.brown,2);l(38,13+y,30,19+y,C.brown,2);
   face(24,14+y,7);break;
 case "tobibako":
   for(let j=0;j<4;j++){const w=33+j*2,bx=Math.floor((48-w)/2);
     b(bx,9+j*9+y,w,10,j%2?C.wood:C.tan);
     r(bx+3,11+j*9+y,w-6,2,C.white);}
   b(6,6+y,36,9,C.lightGrey);face(24,18+y,7);break;
 case "paper":
   b(8,3+y,32,42,C.white);r(12,8+y,22,3,C.sky);
   for(let j=0;j<4;j++)r(13,13+j*5+y,17,2,C.grey);
   l(27,16+y,31,19+y,C.red,3);l(31,19+y,36,9+y,C.red,3);
   face(24,31+y,6);break;
 case "uwabaki":
   b(3,25+y,42,14,C.white);b(7,17+y,28,15,C.lightGrey);
   r(7,18+y,28,5,C.sky);r(7,26+y,26,4,C.blue);
   r(4,37+y,40,4,C.grey);face(27,26+y,7);break;
 case "taiko":
   b(5,12+y,38,27,C.red);r(9,14+y,30,3,C.rose);
   b(5,9+y,38,6,C.gold);b(5,36+y,38,6,C.gold);
   r(10,18+y,4,18,C.amber);r(34,18+y,4,18,C.amber);
   l(9,12+y,21,3+y,C.tan,3);l(37,12+y,27,2+y,C.tan,3);
   face(24,22+y,6);break;
 case "cymbal":
   e(24,25+y,20,15,C.gold,C.ink);
   r(9,21+y,30,4,C.amber);r(13,30+y,22,4,C.amber);
   e(24,22+y,6,5,C.tan,C.ink);
   face(24,22+y,6);break;
 case "triangle":
   l(24,6+y,6,38+y,C.grey,5);l(6,38+y,41,38+y,C.grey,5);
   l(41,38+y,24,6+y,C.lightGrey,5);l(24,6+y,6,38+y,C.gold,2);
   l(8,38+y,39,38+y,C.gold,2);l(39,38+y,24,6+y,C.gold,2);
   l(37,8+y,41,26+y,C.tan,3);
   face(24,27+y,5);break;
 case "recorder":
   b(18,4+y,13,39,C.tan);b(19,3+y,11,9,C.brown);
   for(let j=0;j<5;j++)r(23,18+j*5+y,4,3,C.ink);
   r(21,7+y,7,3,C.white);face(25,12+y,3);break;
 case "tambourine":
   e(24,24+y,19,19,C.amber,C.ink);e(24,24+y,13,13,C.tan,C.brown);
   for(const [x0,y0] of [[4,21],[38,21],[20,3],[20,39],[8,8],[36,8],[8,36],[36,36]])
     b(x0,y0+y,6,6,C.gold,C.ink,1);
   face(24,19+y,6);break;
 case "kenhamo":
   b(4,17+y,40,24,C.blue);r(8,20+y,32,5,C.sky);
   b(8,27+y,32,10,C.white);for(let j=0;j<7;j++)if(j!==2&&j!==5)r(9+j*4,27+y,3,6,C.ink);
   l(8,19+y,4,9+y,C.lightGrey,3);face(24,17+y,6);break;
 case "locker":
   b(8,3+y,32,43,C.grey);r(12,6+y,24,4,C.lightGrey);
   for(let j=0;j<3;j++)r(14,12+j*3+y,20,1,C.shadow);
   face(24,18+y,7);b(14,32+y,20,9,C.ink);r(17,33+y,14,3,C.rose);break;
 case "kousha":
   b(4,14+y,40,31,C.grey);b(18,4+y,12,13,C.lightGrey);
   for(let j=0;j<2;j++)for(let k=0;k<6;k++)b(8+k*6,17+j*9+y,5,6,(k+j)%4?C.blue:C.gold,C.ink,1);
   b(16,35+y,16,9,C.ink);r(18,38+y,12,3,C.rose);face(24,20+y,7);break;
 default:
   e(24,24+y,16,17,C.lilac,C.ink);face(24,20+y,6);
 }
 // One-pixel grounded highlight avoids the soft 3D "plastic" look.
 r(9,45,30,2,C.shadow);
 return canvas;
}
function getCanvas(type,frame=0){
 const k=type+":"+(frame?1:0);
 if(!images.has(k))images.set(k,drawEnemy(type,frame));
 return images.get(k);
}
function getSpriteTexture(THREE,type,frame=0){
 const k=type+":"+(frame?1:0);
 if(textures.has(k))return textures.get(k);
 const canvas=getCanvas(type,frame);
 if(!canvas)return null;
 const texture=new THREE.CanvasTexture(canvas);
 texture.encoding=THREE.sRGBEncoding;
 texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;
 texture.generateMipmaps=false;
 texture.needsUpdate=true;textures.set(k,texture);return texture;
}
function redrawTextures(TEX,ctex){
 // All replacements are drawn pixel-by-pixel on small native canvases.
 // Replace only repeatable scenery; important game-signage text is preserved.
 function install(name,w,h,draw,repeat=false){
   const original=TEX[name];
   const texture=ctex(w,h,(g,W,H)=>{
     g.imageSmoothingEnabled=false;draw(g,painter(g),W,H);
   },repeat?{rep:1}:undefined);
   TEX[name]=texture;if(original)original.dispose();
 }
 install("floorWood",64,64,(g,p)=>{
   const {rect:r,box:b}=p;
   r(0,0,64,64,"#382940");
   for(let row=0;row<8;row++){const y=row*8;for(let col=0;col<4;col++){
     const x=col*16+(row%2?-8:0);
     r(x,y,15,7,["#694356","#80565b","#915d5e","#705062"][(row*3+col)%4]);
     r(x+1,y+1,12,1,"#b58278");r(x+2,y+4,9,1,"#573b51");
   }}
 },true);
 install("woodS",32,32,(g,p)=>{
   const {rect:r}=p;r(0,0,32,32,"#9d6862");
   for(let y=0;y<32;y+=8){r(0,y,32,1,"#50354a");r(0,y+2,32,1,"#bd8975");r((y*3)%22,y+5,9,1,"#6e4853");}
 },true);
 install("plaster",64,64,(g,p)=>{
   const {rect:r}=p;r(0,0,64,64,"#817e99");
   for(let j=0;j<64;j+=8)for(let i=0;i<64;i+=8){
     const k=(i*3+j*7)%5;if(k===0)r(i,j,8,4,"#9991a8");
     if(k===2)r(i+2,j+5,5,2,"#6a6584");
   }
 },true);
 install("lino",64,64,(g,p)=>{
   const {rect:r}=p;r(0,0,64,64,"#345e61");
   for(let y=0;y<64;y+=16)for(let x=0;x<64;x+=16){
     r(x,y,16,2,"#263e55");r(x,y,2,16,"#263e55");
     if((x+y)%3!==0)r(x+3,y+4,5,3,"#446c6d");
   }
 },true);
 install("tiles",64,64,(g,p)=>{
   const {rect:r}=p;
   for(let y=0;y<64;y+=16)for(let x=0;x<64;x+=16){
     r(x,y,16,16,"#30324f");
     r(x+2,y+2,12,12,(x+y)%32===0?"#8d9a9d":"#57647b");
     r(x+2,y+2,12,2,"#b5b5b7");
   }
 },true);
 install("locker",32,64,(g,p)=>{
   const {rect:r}=p;r(0,0,32,64,"#818496");
   for(let y=0;y<64;y+=16){r(0,y,32,2,"#434658");r(2,y+2,28,3,"#a2a4b1");
     for(let i=0;i<4;i++)r(12,y+6+i*2,9,1,"#434658");}
 },true);
 install("yard",64,64,(g,p)=>{
   const {rect:r}=p;r(0,0,64,64,"#705d58");
   for(let y=0;y<64;y+=8)for(let x=0;x<64;x+=8){
     if((x+y)%24===0)r(x+1,y+2,4,3,"#8c765f");
     else if((x*3+y)%17===0)r(x+3,y+4,3,2,"#534958");
   }
   r(0,29,64,2,"#bba9a0");r(30,0,2,64,"#bba9a0");
 },true);
 install("gymFloor",64,64,(g,p)=>{
   const {rect:r}=p;r(0,0,64,64,"#a87664");
   for(let y=0;y<64;y+=8){r(0,y,64,1,"#624553");r(0,y+2,64,1,"#c28a72");}
   r(4,4,56,2,"#eee0b7");r(4,58,56,2,"#eee0b7");
   r(4,4,2,56,"#eee0b7");r(58,4,2,56,"#eee0b7");
   r(5,31,54,2,"#eee0b7");
 },true);
 install("sky",128,64,(g,p)=>{
   const {rect:r}=p;
   const bands=["#080e25","#141936","#1d2447","#2d325c","#393d65","#494771","#57517b","#5e557d"];
   for(let j=0;j<8;j++)r(0,j*8,128,8,bands[j]);
   for(let i=0;i<70;i++){
     const x=(i*47+3)%128,y=(i*23+5)%41;
     r(x,y,i%5===0?2:1,1,i%3===0?"#b9dbea":"#8c95b7");
   }
   r(0,52,128,12,"#1b2139");
   for(let x=0;x<128;x+=14){const h=3+(x*7)%12;r(x,52-h,8,h,"#1b2139");}
   r(64,41,37,19,"#22253a");r(77,35,8,18,"#22253a");
   for(let x=68;x<99;x+=7)r(x,48,3,4,"#e1b87f");
 });
 install("morning",128,64,(g,p)=>{
   const {rect:r}=p;const bands=["#7399c0","#8dafd0","#abc5d0","#c9cfd0","#e3cec0","#f2c6aa","#e0ae91","#b48c80"];
   for(let j=0;j<8;j++)r(0,j*8,128,8,bands[j]);
   for(let k=0;k<7;k++){const x=(k*29+9)%128,y=(k*11+5)%27;
     r(x,y,12,3,"#f8e9d5");r(x-4,y+3,20,3,"#f8e9d5");}
   r(0,54,128,10,"#668c70");for(let x=0;x<128;x+=16)r(x,48-(x%5),11,9,"#668c70");
 });
 install("blob",32,32,(g,p)=>{
   const {rect:r}=p;const levels=["rgba(0,0,0,.12)","rgba(0,0,0,.26)","rgba(0,0,0,.4)","rgba(0,0,0,.55)"];
   for(let j=0;j<4;j++)r(j*2,9+j*2,32-j*4,14-j*4,levels[j]);
 });
}
function applyTitleIcons(){
 const chars=[["randoseru","randoseru"],["isu","isu"],["tsukue","tsukue"],["locker","locker"],["kousha","kousha"]];
 for(const [name,type]of chars){
   const img=document.querySelector('.ghosts img[src$="chara_'+name+'.webp"]');
   const canvas=getCanvas(type,0);
   if(img&&canvas){img.src=canvas.toDataURL("image/png");img.style.imageRendering="pixelated";}
 }
}
window.ObakePixelArt=Object.freeze({getCanvas,getSpriteTexture,redrawTextures,applyTitleIcons});
})();
