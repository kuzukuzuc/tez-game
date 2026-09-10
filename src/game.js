import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x182018);
scene.fog = new THREE.Fog(0x182018, 25, 130);
const camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, .05, 300);
camera.position.set(0,1.7,4);
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight); renderer.shadowMap.enabled=true; document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xbfd8ff,0x39412d,1.5));
const sun=new THREE.DirectionalLight(0xffffff,2); sun.position.set(20,35,10); sun.castShadow=true; scene.add(sun);

const player={pos:new THREE.Vector3(0,1.2,4), vel:new THREE.Vector3(), hp:100, stamina:100, weight:0, grounded:false, dead:false};
const keys={}; const inventory=[null,null,null,null]; let selected=0; let run=1; let chaos=0;
const blocks=[], items=[], creatures=[], corpses=[];

function box(name,x,y,z,sx,sy,sz,color=0x68705f){
 const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),new THREE.MeshStandardMaterial({color})); m.name=name; m.position.set(x,y,z); m.castShadow=true;m.receiveShadow=true;scene.add(m); blocks.push(m);return m;
}
function sphere(x,y,z,r,color){const m=new THREE.Mesh(new THREE.SphereGeometry(r,12,8),new THREE.MeshStandardMaterial({color}));m.position.set(x,y,z);m.castShadow=true;scene.add(m);return m}

// Handcrafted route with small random offsets each run.
box('ground',0,-.3,-18,18,.6,90,0x3d4438);
for(let i=0;i<18;i++){
 const z=-5-i*5;
 const x=(Math.random()-.5)*3.5;
 box('platform',x,0,z,5+Math.random()*3,.8,4,0x5c6655);
 if(i%3===1) box('wall',x+(Math.random()>.5?2.7:-2.7),1.4,z,0.7,2.8,4,0x4c5649);
}
box('finish',0,1,-105,10,2,2,0x8d6b35);

function pickup(x,y,z,type='basic'){
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(.45,.45,.45),new THREE.MeshStandardMaterial({color:type==='medkit'?0xe6e6e6:0xd6a735}));mesh.position.set(x,y,z);mesh.userData={type};scene.add(mesh);items.push(mesh);
}
pickup(1,0.5,1,'basic'); pickup(-1,0.5,-3,'medkit'); pickup(0,0.5,-12,'ammo');

const gun=new THREE.Mesh(new THREE.BoxGeometry(.18,.18,.65),new THREE.MeshStandardMaterial({color:0x222222}));gun.position.set(.32,-.25,-.6);camera.add(gun);scene.add(camera);

function spawnFlying(){
 const x=(Math.random()-.5)*12,z=-20-Math.random()*70,y=3+Math.random()*5;
 const c=sphere(x,y,z,.7,0x705050);c.userData={type:'flying',hp:3,baseY:y};creatures.push(c);
}
function spawnClimber(){
 const x=(Math.random()>.5?1:-1)*(3+Math.random()*3),z=-25-Math.random()*60;
 const c=sphere(x,.9,z,.65,0x465f70);c.userData={type:'climber',hp:4};creatures.push(c);
}
for(let i=0;i<3;i++)spawnFlying(); for(let i=0;i<2;i++)spawnClimber();

function shoot(){
 if(player.dead)return;
 const ray=new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(0,0),camera);
 const hits=ray.intersectObjects(creatures,false);
 if(hits.length && hits[0].distance<35){const c=hits[0].object;c.userData.hp--; c.scale.multiplyScalar(.92); if(c.userData.hp<=0){scene.remove(c);creatures.splice(creatures.indexOf(c),1);}}
}
function interact(){
 let best=null,dist=2.5;
 for(const it of items){const d=it.position.distanceTo(player.pos);if(d<dist){best=it;dist=d;}}
 if(best){inventory[selected]=best.userData.type; player.weight+=1;scene.remove(best);items.splice(items.indexOf(best),1);}
}
function die(){
 if(player.dead)return; player.dead=true; player.hp=0;
 const corpse=box('corpse',player.pos.x,.65,player.pos.z,.8,1.3,.45,0x9b7770); corpses.push(corpse); player.vel.set(0,0,0);
 document.querySelector('#message').textContent='ÖLDÜN — R ile yeni koşu';
}
function restart(){location.reload()}

addEventListener('keydown',e=>{keys[e.code]=true;if(['Digit1','Digit2','Digit3','Digit4'].includes(e.code))selected=Number(e.code.slice(-1))-1;if(e.code==='KeyE')interact();if(e.code==='KeyR'&&player.dead)restart()});
addEventListener('keyup',e=>keys[e.code]=false);
addEventListener('mousedown',e=>{if(e.button===0)shoot();if(e.button===2){document.body.requestPointerLock();}});
addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('mousemove',e=>{if(document.pointerLockElement===document.body){camera.rotation.y-=e.movementX*.002;camera.rotation.x-=e.movementY*.002;camera.rotation.x=Math.max(-1.45,Math.min(1.45,camera.rotation.x));}});

let last=performance.now();
function tick(now){
 const dt=Math.min((now-last)/1000,.033);last=now;
 if(!player.dead){
  const dir=new THREE.Vector3((keys.KeyD?1:0)-(keys.KeyA?1:0),0,(keys.KeyS?1:0)-(keys.KeyW?1:0));
  if(dir.lengthSq())dir.normalize().applyAxisAngle(new THREE.Vector3(0,1,0),camera.rotation.y);
  const sprint=keys.ShiftLeft||keys.ShiftRight; const speed=sprint&&player.stamina>1?7:4;
  player.vel.x=THREE.MathUtils.lerp(player.vel.x,dir.x*speed,.18); player.vel.z=THREE.MathUtils.lerp(player.vel.z,dir.z*speed,.18);
  if(sprint&&dir.lengthSq())player.stamina=Math.max(0,player.stamina-24*dt);else player.stamina=Math.min(100,player.stamina+38*dt);
  if(keys.Space&&player.grounded){player.vel.y=7;player.grounded=false}
  player.vel.y-=18*dt; player.pos.addScaledVector(player.vel,dt);
  if(player.pos.y<1.2){player.pos.y=1.2;player.vel.y=0;player.grounded=true}
  // Simple solid collision with route pieces.
  for(const b of blocks){if(b.name==='ground'||b.name==='finish')continue;const half=b.scale;const dx=Math.abs(player.pos.x-b.position.x),dz=Math.abs(player.pos.z-b.position.z);if(dx<half.x/2+.35&&dz<half.z/2+.35&&player.pos.y<b.position.y+half.y/2+1){player.pos.x+=(player.pos.x-b.position.x>=0?1:-1)*.08;}}
  camera.position.lerp(new THREE.Vector3(player.pos.x,player.pos.y+0.45,player.pos.z),.5);
  // Weather/event pressure only after leaving start.
  if(player.pos.z<-12){chaos=Math.min(100,chaos+dt*2);if(Math.random()<dt*.04)player.hp=Math.max(0,player.hp-5);}
  if(player.hp<=0)die();
  if(Math.random()<dt*.035&&creatures.length<9&&player.pos.z<-15)(Math.random()<.6?spawnFlying():spawnClimber());
  for(const c of creatures){if(c.userData.type==='flying'){c.position.y=c.userData.baseY+Math.sin(now*.002+c.position.x)*.8;c.position.x+=Math.sin(now*.001)*dt;}const d=c.position.distanceTo(player.pos);if(d<1.3&&Math.random()<dt*.8)player.hp=Math.max(0,player.hp-4);}
  if(player.pos.z<-102){document.querySelector('#message').textContent='BİTİŞ! Koşuyu tamamladın — R ile yeniden';player.dead=true;}
 }
 document.querySelector('#hp').textContent=Math.round(player.hp);document.querySelector('#stamina').textContent=Math.round(player.stamina);document.querySelector('#weight').textContent=player.weight;document.querySelector('#chaos').textContent=chaos<25?'LOW':chaos<60?'MEDIUM':'HIGH';
 renderer.render(scene,camera);requestAnimationFrame(tick);
}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
requestAnimationFrame(tick);
