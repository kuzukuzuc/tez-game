import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const scene=new THREE.Scene(); scene.background=new THREE.Color(0x182018); scene.fog=new THREE.Fog(0x182018,25,130);
const camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.05,300); camera.position.set(0,1.7,4);
const renderer=new THREE.WebGLRenderer({antialias:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.setSize(innerWidth,innerHeight); renderer.shadowMap.enabled=true; document.body.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xbfd8ff,0x39412d,1.5)); const sun=new THREE.DirectionalLight(0xffffff,2); sun.position.set(20,35,10); sun.castShadow=true; scene.add(sun);

const player={pos:new THREE.Vector3(0,1.2,4),vel:new THREE.Vector3(),hp:100,stamina:100,weight:0,grounded:false,dead:false,climbing:false,carrying:null};
const keys={}; const mouse={left:false,right:false}; const inventory=[null,null,null,null]; let selected=0,chaos=0,weather='CLEAR',weatherTimer=0;
const blocks=[],items=[],creatures=[],corpses=[];
function box(name,x,y,z,sx,sy,sz,color=0x68705f){const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),new THREE.MeshStandardMaterial({color}));m.name=name;m.position.set(x,y,z);m.userData.size={x:sx,y:sy,z:sz};m.castShadow=true;m.receiveShadow=true;scene.add(m);blocks.push(m);return m}
function sphere(x,y,z,r,color){const m=new THREE.Mesh(new THREE.SphereGeometry(r,12,8),new THREE.MeshStandardMaterial({color}));m.position.set(x,y,z);m.castShadow=true;scene.add(m);return m}

// Fixed route + small randomized offsets. Start area remains intentionally quiet.
box('ground',0,-.3,-18,18,.6,90,0x3d4438);
for(let i=0;i<18;i++){const z=-5-i*5,x=(Math.random()-.5)*3.5;box('platform',x,0,z,5+Math.random()*3,.8,4,0x5c6655);if(i%3===1)box('climbWall',x+(Math.random()>.5?2.7:-2.7),1.4,z,.7,2.8,4,0x4c5649)}
box('finish',0,1,-105,10,2,2,0x8d6b35);

function pickup(x,y,z,type='basic'){const m=new THREE.Mesh(new THREE.BoxGeometry(.45,.45,.45),new THREE.MeshStandardMaterial({color:type==='medkit'?0xe6e6e6:type==='ammo'?0x5d8bd3:0xd6a735}));m.position.set(x,y,z);m.userData={type};scene.add(m);items.push(m)}
pickup(1,.5,1,'basic');pickup(-1,.5,-3,'medkit');pickup(0,.5,-12,'ammo');
const gun=new THREE.Mesh(new THREE.BoxGeometry(.18,.18,.65),new THREE.MeshStandardMaterial({color:0x222222}));gun.position.set(.32,-.25,-.6);camera.add(gun);scene.add(camera);

function spawnFlying(){const c=sphere((Math.random()-.5)*12,3+Math.random()*5,-20-Math.random()*70,.7,0x705050);c.userData={type:'flying',hp:3,baseY:c.position.y};creatures.push(c)}
function spawnClimber(){const c=sphere((Math.random()>.5?1:-1)*(3+Math.random()*3),.9,-25-Math.random()*60,.65,0x465f70);c.userData={type:'climber',hp:4};creatures.push(c)}
for(let i=0;i<3;i++)spawnFlying();for(let i=0;i<2;i++)spawnClimber();

function shoot(){if(player.dead)return;const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(0,0),camera);const hits=ray.intersectObjects(creatures,false);if(hits.length&&hits[0].distance<35){const c=hits[0].object;c.userData.hp--;c.scale.multiplyScalar(.92);if(c.userData.hp<=0){scene.remove(c);creatures.splice(creatures.indexOf(c),1)}}}
function nearestItem(){let best=null,dist=2.5;for(const it of items){const d=it.position.distanceTo(player.pos);if(d<dist){best=it;dist=d}}return best}
function useSelected(){const type=inventory[selected];if(type==='medkit'){player.hp=Math.min(100,player.hp+35);inventory[selected]=null}else if(type==='ammo'){inventory[selected]=null}updateSlots()}
function interact(){const it=nearestItem();if(!it)return;inventory[selected]=it.userData.type;player.weight+=1;scene.remove(it);items.splice(items.indexOf(it),1);updateSlots()}
function nearCorpse(){let best=null,dist=2;for(const c of corpses){const d=c.position.distanceTo(player.pos);if(d<dist){best=c;dist=d}}return best}
function toggleCarry(){if(player.carrying){player.carrying.userData.carrier=null;player.carrying=null;return}const c=nearCorpse();if(c){player.carrying=c;c.userData.carrier=player;}}
function die(){if(player.dead)return;player.dead=true;player.hp=0;const corpse=box('corpse',player.pos.x,.65,player.pos.z,.8,1.3,.45,0x9b7770);corpse.userData.weight=1;corpses.push(corpse);document.querySelector('#message').textContent='ÖLDÜN — R ile yeni koşu'}
function restart(){location.reload()}
function updateSlots(){const root=document.querySelector('#slots');root.innerHTML=inventory.map((v,i)=>`<div class="slot ${i===selected?'selected':''}">${i+1}<br>${v||'—'}</div>`).join('')}
updateSlots();

addEventListener('keydown',e=>{keys[e.code]=true;if(['Digit1','Digit2','Digit3','Digit4'].includes(e.code)){selected=Number(e.code.slice(-1))-1;updateSlots()}if(e.code==='KeyE'){if(nearestItem())interact();else useSelected()}if(e.code==='KeyR'&&player.dead)restart()});
addEventListener('keyup',e=>keys[e.code]=false);addEventListener('mousedown',e=>{if(e.button===0){mouse.left=true;shoot()}if(e.button===2){mouse.right=true;document.body.requestPointerLock()}});addEventListener('mouseup',e=>{if(e.button===0)mouse.left=false;if(e.button===2)mouse.right=false});addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('mousemove',e=>{if(document.pointerLockElement===document.body){camera.rotation.y-=e.movementX*.002;camera.rotation.x-=e.movementY*.002;camera.rotation.x=Math.max(-1.45,Math.min(1.45,camera.rotation.x))}});

function tryClimb(dt){const forward=new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(camera.rotation.x,camera.rotation.y,0,'YXZ'));const ray=new THREE.Raycaster(camera.position,forward.normalize(),0,1.4);const hit=ray.intersectObjects(blocks,false).find(h=>h.object.name==='climbWall');if(mouse.right&&hit){player.climbing=true;player.vel.set(0,0,0);player.pos.y+=((keys.KeyW?1:0)-(keys.KeyS?1:0))*3.2*dt;player.pos.y=Math.min(4.5,player.pos.y);return true}player.climbing=false;return false}
function collide(){for(const b of blocks){if(!['platform','climbWall'].includes(b.name))continue;const s=b.userData.size;const dx=player.pos.x-b.position.x,dz=player.pos.z-b.position.z;if(Math.abs(dx)<s.x/2+.35&&Math.abs(dz)<s.z/2+.35){const top=b.position.y+s.y/2;if(player.pos.y>=top-.2&&player.pos.y<=top+1.25&&player.vel.y<=0){player.pos.y=top+1.2;player.vel.y=0;player.grounded=true}}}}

let last=performance.now();function tick(now){const dt=Math.min((now-last)/1000,.033);last=now;
 if(!player.dead){
  const dir=new THREE.Vector3((keys.KeyD?1:0)-(keys.KeyA?1:0),0,(keys.KeyS?1:0)-(keys.KeyW?1:0));if(dir.lengthSq())dir.normalize().applyAxisAngle(new THREE.Vector3(0,1,0),camera.rotation.y);
  const sprint=(keys.ShiftLeft||keys.ShiftRight)&&player.stamina>1&&!player.climbing;const speed=sprint?7:4;const carryPenalty=player.carrying?.userData.weight?0.7:1;player.vel.x=THREE.MathUtils.lerp(player.vel.x,dir.x*speed*carryPenalty,.18);player.vel.z=THREE.MathUtils.lerp(player.vel.z,dir.z*speed*carryPenalty,.18);
  if(sprint&&dir.lengthSq())player.stamina=Math.max(0,player.stamina-24*dt);else player.stamina=Math.min(100,player.stamina+38*dt);
  if(keys.Space&&player.grounded){player.vel.y=7;player.grounded=false} const climbing=tryClimb(dt);if(!climbing){player.vel.y-=18*dt;player.pos.addScaledVector(player.vel,dt)}else player.grounded=false;
  if(player.pos.y<1.2){player.pos.y=1.2;player.vel.y=0;player.grounded=true}collide();
  if(player.carrying){player.carrying.position.copy(player.pos).add(new THREE.Vector3(0,.1,-.8));player.carrying.rotation.copy(camera.rotation)}
  camera.position.lerp(new THREE.Vector3(player.pos.x,player.pos.y+.45,player.pos.z),.5);
  if(player.pos.z<-12){chaos=Math.min(100,chaos+dt*2);weatherTimer-=dt;if(weatherTimer<=0){weatherTimer=12+Math.random()*15;weather=Math.random()<.45?'ACID RAIN':Math.random()<.5?'STORM':'CLEAR';document.querySelector('#weather').textContent=weather}}
  if(weather==='ACID RAIN'&&player.pos.z<-12&&Math.random()<dt*.8)player.hp=Math.max(0,player.hp-2);if(weather==='STORM'&&player.pos.z<-12&&Math.random()<dt*.12)player.hp=Math.max(0,player.hp-12);
  if(player.hp<=0)die();if(Math.random()<dt*.035&&creatures.length<9&&player.pos.z<-15)(Math.random()<.6?spawnFlying():spawnClimber());
  for(const c of creatures){if(c.userData.type==='flying'){c.position.y=c.userData.baseY+Math.sin(now*.002+c.position.x)*.8;c.position.x+=Math.sin(now*.001)*dt}const d=c.position.distanceTo(player.pos);if(d<1.3&&Math.random()<dt*.8)player.hp=Math.max(0,player.hp-4)}
  if(player.pos.z<-102){document.querySelector('#message').textContent='BİTİŞ! Koşuyu tamamladın — R ile yeniden';player.dead=true}
 }
 document.querySelector('#hp').textContent=Math.round(player.hp);document.querySelector('#stamina').textContent=Math.round(player.stamina);document.querySelector('#weight').textContent=player.weight+(player.carrying?30:0);document.querySelector('#chaos').textContent=chaos<25?'LOW':chaos<60?'MEDIUM':'HIGH';document.querySelector('#hpbar').style.width=Math.max(0,player.hp)+'%';document.querySelector('#stambar').style.width=Math.max(0,player.stamina)+'%';renderer.render(scene,camera);requestAnimationFrame(tick)}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});requestAnimationFrame(tick);
