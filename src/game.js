import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x182018);
scene.fog = new THREE.Fog(0x182018, 25, 150);
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 300);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x39412d, 1.5));
const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(20, 35, 10); sun.castShadow = true; scene.add(sun);

const player = {
  pos: new THREE.Vector3(0, 1.2, 4), vel: new THREE.Vector3(), hp: 100, stamina: 100,
  baseWeight: 0, grounded: false, dead: false, climbing: false, carrying: null,
  pullTarget: null, attackCooldown: 0, shelter: false, checkpoint: 4
};
const keys = {}, mouse = { right: false };
const inventory = [null, null, null, null];
let selected = 0, chaos = 0, weather = 'CLEAR', weatherTimer = 8, runTime = 0;
let ammo = 6, weapon = 'pistol';
const blocks = [], items = [], creatures = [], corpses = [], physics = [], shelters = [], checkpoints = [];

const itemInfo = {
  basic: { label: 'BASIC', weight: 1 },
  medkit: { label: 'MEDKIT', weight: 1.5 },
  ammo: { label: 'AMMO', weight: 1 },
  shotgun: { label: 'SHOTGUN', weight: 4 },
  rifle: { label: 'RIFLE', weight: 5 }
};
const weapons = {
  pistol: { damage: 2, range: 35, cooldown: .22, magazine: 6, knockback: 7 },
  shotgun: { damage: 7, range: 14, cooldown: .8, magazine: 2, knockback: 15 },
  rifle: { damage: 4, range: 55, cooldown: .12, magazine: 12, knockback: 6 }
};

function box(name, x, y, z, sx, sy, sz, color = 0x68705f, physical = false, mass = 1) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), new THREE.MeshStandardMaterial({ color }));
  m.name = name; m.position.set(x, y, z); m.userData.size = { x: sx, y: sy, z: sz };
  m.userData.mass = mass; m.userData.vel = new THREE.Vector3();
  m.castShadow = true; m.receiveShadow = true; scene.add(m); blocks.push(m);
  if (physical) physics.push(m); return m;
}
function sphere(x, y, z, r, color) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), new THREE.MeshStandardMaterial({ color }));
  m.position.set(x, y, z); m.castShadow = true; scene.add(m); return m;
}

// Ana rota sabit; platform konumları her koşuda küçük miktarda değişir.
box('ground', 0, -.3, -18, 18, .6, 90, 0x3d4438);
for (let i = 0; i < 18; i++) {
  const z = -5 - i * 5, x = (Math.random() - .5) * 3.5;
  box('platform', x, 0, z, 5 + Math.random() * 3, .8, 4, 0x5c6655);
  if (i % 3 === 1) box('climbWall', x + (Math.random() > .5 ? 2.7 : -2.7), 1.4, z, .7, 2.8, 4, 0x4c5649);
  if (i === 4 || i === 10 || i === 15) {
    const cp = box('checkpoint', x, .45, z, 1.2, .15, 1.2, 0x92783b);
    checkpoints.push({ z, pos: new THREE.Vector3(x, 1.2, z + 2), mesh: cp });
  }
}
box('finish', 0, 1, -105, 10, 2, 2, 0x8d6b35);

// Fizik objeleri.
box('crate', -2, .55, -8, 1.1, 1.1, 1.1, 0x7a6040, true, 8);
box('crate', 2, .55, -20, 1.1, 1.1, 1.1, 0x7a6040, true, 8);
box('rock', 1, .35, -30, .7, .7, .7, 0x555555, true, 18);

function shelter(x, y, z, sx, sz) {
  const s = box('shelter', x, y, z, sx, 2.8, sz, 0x394338);
  shelters.push({ mesh: s, x, z, sx, sz });
}
shelter(-2, 1.4, -18, 5, 3);
shelter(2, 1.4, -48, 5, 3);
shelter(-1, 1.4, -78, 6, 3);

function pickup(x, y, z, type, amount = 1, guaranteed = false) {
  const colors = { basic: 0xd6a735, medkit: 0xe6e6e6, ammo: 0x5d8bd3, shotgun: 0x8c5b39, rifle: 0x3d6f49 };
  const m = new THREE.Mesh(new THREE.BoxGeometry(.45, .45, .45), new THREE.MeshStandardMaterial({ color: colors[type] || 0xffffff }));
  m.position.set(x, y, z); m.userData = { type, amount, guaranteed, weight: itemInfo[type]?.weight || 1 };
  scene.add(m); items.push(m); return m;
}
// Başlangıç temel ekipmanı %100 garanti.
pickup(1, .5, 1, 'basic', 1, true);
pickup(-1, .5, -3, 'medkit', 1, true);
pickup(0, .5, -12, 'ammo', 8, true);
if (Math.random() < .65) pickup(-1, .5, -25, 'shotgun');
if (Math.random() < .45) pickup(1, .5, -55, 'rifle');
if (Math.random() < .7) pickup(-2, .5, -68, 'ammo', 10);
if (Math.random() < .5) pickup(2, .5, -88, 'medkit');

const gun = new THREE.Mesh(new THREE.BoxGeometry(.18, .18, .65), new THREE.MeshStandardMaterial({ color: 0x222222 }));
gun.position.set(.32, -.25, -.6); camera.add(gun); scene.add(camera);

function spawnFlying(kind = 'scout', early = false) {
  const data = { scout:{r:.7,hp:3,mass:2,speed:2.2,color:0x705050,damage:4}, bat:{r:.5,hp:2,mass:1,speed:3.5,color:0x4b3d65,damage:5}, stinger:{r:.45,hp:5,mass:3,speed:1.7,color:0x80652f,damage:8} }[kind];
  const c = sphere((Math.random()-.5)*12, 3+Math.random()*5, early ? -8-Math.random()*15 : -20-Math.random()*70, data.r, data.color);
  c.userData = { type:'flying', subtype:kind, hp:data.hp, mass:data.mass, speed:data.speed, damage:data.damage, vel:new THREE.Vector3(), phase:Math.random()*10 };
  creatures.push(c);
}
function spawnClimber(kind = 'crawler') {
  const data = { crawler:{r:.65,hp:4,mass:3,speed:1.8,color:0x465f70,damage:4}, brute:{r:.9,hp:9,mass:9,speed:.8,color:0x5d463d,damage:7} }[kind];
  const c = sphere((Math.random()>.5?1:-1)*(3+Math.random()*3), .9, -25-Math.random()*60, data.r, data.color);
  c.userData = { type:'climber', subtype:kind, hp:data.hp, mass:data.mass, speed:data.speed, damage:data.damage, vel:new THREE.Vector3() };
  creatures.push(c);
}
for (let i=0;i<2;i++) spawnFlying('scout');
spawnFlying('bat'); spawnClimber('crawler'); spawnClimber('brute');

function totalWeight() {
  return player.baseWeight + (player.carrying ? Math.max(1, player.baseWeight * .30) : 0);
}
function updateSlots() {
  const r = document.querySelector('#slots'); if (!r) return;
  r.innerHTML = inventory.map((v,i)=>`<div class="slot ${i===selected?'selected':''}">${i+1}<br>${v ? (itemInfo[v]?.label || v.toUpperCase()) : '—'}</div>`).join('');
}
function message(t) { const m=document.querySelector('#message'); if(m)m.textContent=t; }
function nearestItem() { let best=null,d0=2.5; for(const it of items){const d=it.position.distanceTo(player.pos);if(d<d0){best=it;d0=d;}} return best; }
function addInventory(type) {
  const empty = inventory.findIndex(v=>v===null); if(empty<0){message('Envanter dolu');return false;}
  inventory[empty]=type; player.baseWeight += itemInfo[type]?.weight || 1; selected=empty; updateSlots(); return true;
}
function interact() {
  const it=nearestItem(); if(!it)return;
  if(!addInventory(it.userData.type))return;
  if(it.userData.type==='ammo') ammo += it.userData.amount || 1;
  scene.remove(it); items.splice(items.indexOf(it),1);
  message(`Alındı: ${itemInfo[it.userData.type]?.label || it.userData.type.toUpperCase()}`);
}
function useSelected() {
  const v=inventory[selected]; if(!v)return;
  if(v==='medkit'){player.hp=Math.min(100,player.hp+35);player.baseWeight-=itemInfo[v].weight;inventory[selected]=null;message('İlk yardım kullanıldı');}
  else if(v==='shotgun'||v==='rifle'){weapon=v;message(`Silah: ${v.toUpperCase()}`);}
  else if(v==='ammo'){ammo+=6;player.baseWeight-=itemInfo[v].weight;inventory[selected]=null;message('Cephane +6');}
  updateSlots();
}
function nearCorpse(){let best=null,d0=2;for(const c of corpses){const d=c.position.distanceTo(player.pos);if(d<d0){best=c;d0=d;}}return best;}
function toggleCarry(){
  if(player.carrying){player.carrying.userData.carrier=null;player.carrying.userData.vel.set(player.vel.x,0,player.vel.z);player.carrying=null;message('Ceset bırakıldı');return;}
  const c=nearCorpse(); if(c){player.carrying=c;c.userData.carrier=player;message('Ceset taşınıyor: +30% ağırlık');}
}
function forwardVector(){return new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion).normalize();}
function targetPhysicsObject(max=3.2){const ray=new THREE.Raycaster(camera.position,forwardVector(),0,max);const hits=ray.intersectObjects(physics,false);return hits.length?hits[0].object:null;}
function pullObject(){if(player.carrying)return;const o=targetPhysicsObject();if(!o)return;player.pullTarget=player.pullTarget===o?null:o;message(player.pullTarget?'Nesne çekiliyor':'Çekme bırakıldı');}

function dropInventory() {
  for(let i=0;i<inventory.length;i++) {
    const type=inventory[i]; if(!type)continue;
    const drop=pickup(player.pos.x+(Math.random()-.5)*1.2,.5,player.pos.z+(Math.random()-.5)*1.2,type,type==='ammo'?6:1);
    drop.userData.dropped=true;
    player.baseWeight-=itemInfo[type]?.weight || 1;
    inventory[i]=null;
  }
  updateSlots();
}
function die() {
  if(player.dead)return; player.dead=true; player.hp=0; dropInventory();
  const c=box('corpse',player.pos.x,.65,player.pos.z,.8,1.3,.45,0x9b7770,true,70);
  c.userData.vel=new THREE.Vector3(); corpses.push(c); message('ÖLDÜN — R ile yeni koşu');
}
function restart(){location.reload();}

addEventListener('keydown',e=>{
  keys[e.code]=true;
  if(e.code.startsWith('Digit')){const n=Number(e.code.slice(-1));if(n>=1&&n<=4){selected=n-1;updateSlots();}}
  if(e.code==='KeyE'){if(nearestItem())interact();else if(nearCorpse()||player.carrying)toggleCarry();else useSelected();}
  if(e.code==='KeyQ')pullObject();
  if(e.code==='KeyR'&&player.dead)restart();
});
addEventListener('keyup',e=>keys[e.code]=false);
addEventListener('mousedown',e=>{if(e.button===0)shootOrMelee();if(e.button===2){mouse.right=true;document.body.requestPointerLock();}});
addEventListener('mouseup',e=>{if(e.button===2)mouse.right=false;});
addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('mousemove',e=>{if(document.pointerLockElement===document.body){camera.rotation.y-=e.movementX*.002;camera.rotation.x-=e.movementY*.002;camera.rotation.x=Math.max(-1.45,Math.min(1.45,camera.rotation.x));}});

function shootOrMelee(){
  if(player.dead||player.attackCooldown>0)return;
  const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(0,0),camera);const w=weapons[weapon];
  if(ammo>0){const hits=ray.intersectObjects(creatures,false).filter(h=>h.distance<=w.range);if(hits.length){const c=hits[0].object;c.userData.hp-=w.damage;c.userData.vel.addScaledVector(ray.ray.direction,w.knockback/Math.max(1,c.userData.mass));if(c.userData.hp<=0){scene.remove(c);creatures.splice(creatures.indexOf(c),1);}}
ammo--;player.attackCooldown=w.cooldown;message(`${weapon.toUpperCase()}  ${ammo}`);return;}
  const hits=ray.intersectObjects(creatures,false);if(hits.length&&hits[0].distance<3){const c=hits[0].object;c.userData.hp-=1;c.userData.vel.addScaledVector(ray.ray.direction,5/Math.max(1,c.userData.mass));player.attackCooldown=.35;}else message('Mermi yok');
}
function tryClimb(dt){
  const hit=new THREE.Raycaster(camera.position,forwardVector(),0,1.5).intersectObjects(blocks,false).find(h=>h.object.name==='climbWall');
  if(mouse.right&&hit){player.climbing=true;player.vel.set(0,0,0);player.pos.y+=((keys.KeyW?1:0)-(keys.KeyS?1:0))*3.2*dt;player.pos.y=Math.min(5.5,player.pos.y);return true;}
  player.climbing=false;return false;
}
function playerCollision(){
  player.grounded=false;
  for(const b of blocks){if(!['platform','climbWall','crate','rock','checkpoint'].includes(b.name))continue;const s=b.userData.size,dx=player.pos.x-b.position.x,dz=player.pos.z-b.position.z,top=b.position.y+s.y/2;
    if(Math.abs(dx)<s.x/2+.35&&Math.abs(dz)<s.z/2+.35&&player.pos.y>=top-.3&&player.pos.y<=top+1.3&&player.vel.y<=0){player.pos.y=top+1.2;player.vel.y=0;player.grounded=true;}
    else if(Math.abs(dx)<s.x/2+.35&&Math.abs(dz)<s.z/2+.35&&player.pos.y<top+1.0){if(Math.abs(dx)>Math.abs(dz))player.pos.x=b.position.x+(dx>=0?s.x/2+.36:-s.x/2-.36);else player.pos.z=b.position.z+(dz>=0?s.z/2+.36:-s.z/2-.36);}
  }
}
function updatePhysics(dt){
  for(const o of physics){if(o===player.carrying)continue;const v=o.userData.vel;v.y-=18*dt;o.position.addScaledVector(v,dt);if(o.position.y<.35){o.position.y=.35;v.y*=-.25;v.x*=.86;v.z*=.86;}else{v.x*=.995;v.z*=.995;}}
  if(player.pullTarget){const o=player.pullTarget;if(!o.parent){player.pullTarget=null;return;}const dir=new THREE.Vector3().subVectors(player.pos,o.position);const d=dir.length();if(d<1.5)player.pullTarget=null;else{o.userData.vel.addScaledVector(dir.normalize(),18*dt/Math.max(1,o.userData.mass));}}
  if(player.carrying){const c=player.carrying;c.position.copy(player.pos).add(new THREE.Vector3(0,.7,-.35));c.rotation.copy(camera.rotation);}
}
function updateCreatures(dt){
  for(const c of [...creatures]){
    const d=c.position.distanceTo(player.pos);if(d>30)continue;
    const dir=new THREE.Vector3().subVectors(player.pos,c.position).normalize();
    if(c.userData.type==='flying'){c.position.y+=Math.sin(runTime*3+c.userData.phase)*.8*dt;dir.y*=.4;} 
    c.userData.vel.addScaledVector(dir,c.userData.speed*dt*4);c.userData.vel.multiplyScalar(.94);c.position.addScaledVector(c.userData.vel,dt);
    if(d<1.35&&!player.dead&&!player.shelter){player.hp-=c.userData.damage*dt;if(player.hp<=0)die();}
  }
}
function updateWeather(dt){
  weatherTimer-=dt;if(weatherTimer>0)return;weatherTimer=8+Math.random()*10;
  const roll=Math.random();weather=roll<.55?'CLEAR':roll<.75?'RAIN':roll<.9?'ACID RAIN':'STORM';chaos=Math.min(100,chaos+4);
  message(weather==='ACID RAIN'?'ASİT YAĞMURU — BARINAK BUL':weather==='STORM'?'FIRTINA — ŞİMŞEKTEN KAÇ':weather==='RAIN'?'YAĞMUR BAŞLADI':'HAVA AÇILDI');
}
function updateHazards(dt){
  player.shelter=shelters.some(s=>Math.abs(player.pos.x-s.x)<s.sx/2&&Math.abs(player.pos.z-s.z)<s.sz/2&&player.pos.y<3.2);
  if(!player.shelter&&!player.dead){if(weather==='ACID RAIN')player.hp-=4*dt;if(weather==='STORM'&&Math.random()<.012)player.hp-=18;if(player.hp<=0)die();}
}
function updateCheckpoint(){
  for(let i=0;i<checkpoints.length;i++){if(player.pos.z<=checkpoints[i].z&&player.checkpoint<i+1){player.checkpoint=i+1;message(`KONTROL NOKTASI ${i+1}`);}}}
function maybeSpawn(){
  if(player.pos.z>-30)return;
  const chance=Math.min(.012,.002+Math.abs(player.pos.z)/70000+chaos/12000);
  if(Math.random()<chance){if(Math.random()<.65)spawnFlying(Math.random()<.55?'bat':'stinger');else spawnClimber(Math.random()<.75?'crawler':'brute');}
}
function updateHUD(){
  const hp=document.querySelector('#hp'),st=document.querySelector('#stamina'),wt=document.querySelector('#weight'),hb=document.querySelector('#hpbar'),sb=document.querySelector('#stambar'),ch=document.querySelector('#chaos'),we=document.querySelector('#weather');
  if(hp)hp.textContent=Math.max(0,Math.ceil(player.hp));if(st)st.textContent=Math.ceil(player.stamina);if(wt)wt.textContent=totalWeight().toFixed(1);if(hb)hb.style.width=`${Math.max(0,player.hp)}%`;if(sb)sb.style.width=`${Math.max(0,player.stamina)}%`;if(ch)ch.textContent=chaos<25?'LOW':chaos<60?'MEDIUM':'HIGH';if(we)we.textContent=weather+(player.shelter?' · SHELTER':'');
}

let last=performance.now();
function loop(now){
  const dt=Math.min(.033,(now-last)/1000);last=now;runTime+=dt;player.attackCooldown=Math.max(0,player.attackCooldown-dt);
  if(!player.dead){
    const sprint=keys.ShiftLeft||keys.ShiftRight, move=new THREE.Vector3((keys.KeyD?1:0)-(keys.KeyA?1:0),0,(keys.KeyS?1:0)-(keys.KeyW?1:0));
    if(move.lengthSq())move.normalize();const speed=sprint&&player.stamina>0?7.2:4.2;
    if(sprint&&move.lengthSq())player.stamina=Math.max(0,player.stamina-25*dt);else player.stamina=Math.min(100,player.stamina+35*dt);
    const burden=Math.max(.55,1-totalWeight()*.018);move.applyAxisAngle(new THREE.Vector3(0,1,0),camera.rotation.y);player.vel.x=move.x*speed*burden;player.vel.z=move.z*speed*burden;
    if(keys.Space&&player.grounded){player.vel.y=7.5;player.grounded=false;}
    if(!tryClimb(dt)){player.vel.y-=18*dt;player.pos.addScaledVector(player.vel,dt);}
    playerCollision();
    if(player.pos.y<-8)die();
    if(player.pos.z<-102){message('BİTİŞE ULAŞTIN — KOŞU TAMAMLANDI');player.dead=true;}
    updateCheckpoint();updateWeather(dt);updateHazards(dt);maybeSpawn();
  }
  updatePhysics(dt);updateCreatures(dt);updateHUD();
  camera.position.copy(player.pos);camera.position.y+=.15;renderer.render(scene,camera);requestAnimationFrame(loop);
}
updateSlots();requestAnimationFrame(loop);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
