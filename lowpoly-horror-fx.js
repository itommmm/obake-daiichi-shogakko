/* おばけ第一小学校 — low-poly horror visual effects.
 * Small faceted meshes in Three.js world space. No pixel/canvas sprites.
 * Optional presentation layer; no collision, score, or gameplay changes.
 */
(function(){
"use strict";
if(typeof THREE==="undefined"||typeof scene==="undefined"||!THREE.InstancedMesh)return;
const meshGeo=new THREE.TetrahedronGeometry(1,0);
const config={
 hit:{color:0xa7b9a5,velocity:1.8,count:6,life:.38,size:.048},
 poof:{color:0x85877a,velocity:1.45,count:11,life:.72,size:.078},
 pickup:{color:0xc0b38e,velocity:1.8,count:8,life:.63,size:.058}
};
const pools={};
const dummy=new THREE.Object3D();
for(const [key,c]of Object.entries(config)){
 const material=new THREE.MeshBasicMaterial({
  color:c.color,transparent:false,depthWrite:true,depthTest:true,side:THREE.DoubleSide
 });
 const mesh=new THREE.InstancedMesh(meshGeo,material,24);
 mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
 mesh.count=0;mesh.frustumCulled=false;mesh.renderOrder=2;scene.add(mesh);
 pools[key]={mesh,list:[],c};
}
function emit(name,pos){
 const pool=pools[name];
 if(!pool||!pos||!Number.isFinite(pos.x)||!Number.isFinite(pos.y)||!Number.isFinite(pos.z))return;
 for(let i=0;i<pool.c.count;i++){
  // Limit the pool to 24 instances even on rapid multi-hit events.
  if(pool.list.length>=24)pool.list.shift();
  const k=i/pool.c.count*Math.PI*2,
   speed=pool.c.velocity*(.6+Math.random()*.5);
  pool.list.push({
   x:pos.x+(Math.random()-.5)*.17,
   y:pos.y+(Math.random()-.5)*.2,
   z:pos.z+(Math.random()-.5)*.17,
   vx:Math.cos(k)*speed*(.45+Math.random()*.4),
   vy:(Math.random()*.8+.5)*speed,
   vz:Math.sin(k)*speed*(.45+Math.random()*.4),
   spin:Math.random()*3,
   age:0,
   ttl:pool.c.life*(.7+Math.random()*.6),
   size:pool.c.size*(.7+Math.random()*.65)
  });
 }
}
function draw(dt,opts){
 if(opts?.enabled===false){
  for(const pool of Object.values(pools)){pool.list.length=0;pool.mesh.count=0;}
  return;
 }
 if(opts?.paused)return;
 const step=Math.min(.05,Math.max(0,Number(dt)||0));
 for(const pool of Object.values(pools)){
  const list=pool.list;
  for(let i=list.length-1;i>=0;i--){
   const p=list[i];
   p.age+=step;
   if(p.age>=p.ttl){list.splice(i,1);continue;}
   p.x+=p.vx*step;p.y+=p.vy*step;p.z+=p.vz*step;
   p.vy-=3.8*step;
  }
  for(let i=0;i<list.length;i++){
   const p=list[i],remaining=Math.max(.001,1-p.age/p.ttl);
   dummy.position.set(p.x,p.y,p.z);
   dummy.rotation.set(p.age*6,p.age*4+p.spin,p.age*3);
   const sc=p.size*remaining;
   dummy.scale.set(sc,sc*(.65+remaining*.45),sc);
   dummy.updateMatrix();
   pool.mesh.setMatrixAt(i,dummy.matrix);
  }
  pool.mesh.count=list.length;
  pool.mesh.instanceMatrix.needsUpdate=true;
 }
}
window.ObakeLowPolyFX=Object.freeze({emit,draw});
})();