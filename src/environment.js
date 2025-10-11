import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Construit le décor: piste détaillée, gouttières visuelles, murs latéraux, éclairage décoratif, panneau score.
 * Purement visuel (pas de colliders ici). Les colliders restent gérés côté logique / game.
 */
export function buildEnvironment(renderer, scene) {
  // Environment map (PBR feel)
  const pmremGen = new THREE.PMREMGenerator(renderer);
  const envTex = pmremGen.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;

  // Fog légère pour la profondeur
  scene.fog = new THREE.Fog(0x101820, 14, 36);

  const group = new THREE.Group();
  scene.add(group);

  // Sol global (approche + zone derrière joueur)
  const floorTex = makeFloorTexture();
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(8, 16);
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness:0.9, metalness:0.0 });
  const floorGeo = new THREE.PlaneGeometry(40, 60);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI/2;
  floor.position.set(0,0,-10);
  group.add(floor);

  // Piste (visuelle) en plusieurs segments pour nuance
  const laneGroup = new THREE.Group();
  group.add(laneGroup);
  const laneWood = makeWoodTexture();
  laneWood.wrapS = laneWood.wrapT = THREE.RepeatWrapping;
  laneWood.repeat.set(1, 6);
  const laneMat = new THREE.MeshStandardMaterial({ map: laneWood, roughness:0.35, metalness:0.05 });
  const laneGeo = new THREE.BoxGeometry(1.2, 0.04, 12);
  const lane = new THREE.Mesh(laneGeo, laneMat);
  lane.position.set(0,0.02,-6); // léger offset pour éviter z-fighting
  laneGroup.add(lane);

  // Marques (repères de visée: flèches / dots)
  const markersTex = makeLaneMarkersTexture();
  markersTex.transparent = true;
  const markersMat = new THREE.MeshBasicMaterial({ map: markersTex, transparent:true });
  const markersGeo = new THREE.PlaneGeometry(1.15, 12);
  const markers = new THREE.Mesh(markersGeo, markersMat);
  markers.rotation.x = -Math.PI/2;
  markers.position.set(0,0.061,-6); // surélevé en cohérence avec la piste
  laneGroup.add(markers);

  // Gouttières visuelles
  const gutterMat = new THREE.MeshStandardMaterial({ color:0x22262b, roughness:0.7 });
  const gutterGeo = new THREE.CylinderGeometry(0.18,0.18,12,24,1,true,0,Math.PI);
  const gutterLeft = new THREE.Mesh(gutterGeo, gutterMat);
  gutterLeft.rotation.z = Math.PI/2;
  gutterLeft.position.set(-0.75, -0.05, -6);
  const gutterRight = gutterLeft.clone();
  gutterRight.position.x = 0.75;
  laneGroup.add(gutterLeft, gutterRight);

  // Murs latéraux
  const wallMat = new THREE.MeshStandardMaterial({ color:0x1b1f24, roughness:0.85 });
  const wallGeo = new THREE.BoxGeometry(0.2, 2.4, 16);
  const wallLeft = new THREE.Mesh(wallGeo, wallMat);
  wallLeft.position.set(-1.3,1.2,-6);
  const wallRight = wallLeft.clone(); wallRight.position.x = 1.3;
  laneGroup.add(wallLeft, wallRight);

  // Panneau décor fond (derrière quilles)
  const backPanelGeo = new THREE.PlaneGeometry(3,2);
  const backPanelMat = new THREE.MeshStandardMaterial({ color:0x242b33, emissive:0x0c1114, roughness:0.8 });
  const backPanel = new THREE.Mesh(backPanelGeo, backPanelMat);
  backPanel.position.set(0,1.0,-13.2);
  laneGroup.add(backPanel);

  // Panneau score décoratif au-dessus du joueur
  // Restore horizontal length to original (2.4) while keeping the reduced vertical height.
  const scorePanelGeo = new THREE.PlaneGeometry(2.4,0.4666667);
  // Create a canvas that will be used both for the on-screen DOM scoreboard (via main) and as a texture
  // Use resolution matching the plane aspect ratio to avoid visual stretching
  const scoreCanvas = document.createElement('canvas');
  // New aspect = 2.4 / 0.4666667 ~= 5.142857 -> choose 1024x200 to keep horizontal resolution and match aspect (~5.12)
  scoreCanvas.width = 1024; scoreCanvas.height = 200; // 1024/200 = 5.12
  const scoreCtx = scoreCanvas.getContext('2d');
  // initial clear
  scoreCtx.fillStyle = '#29323b'; scoreCtx.fillRect(0,0,scoreCanvas.width, scoreCanvas.height);
  // Create texture from canvas and use it on the panel
  const scoreTex = new THREE.CanvasTexture(scoreCanvas);
  scoreTex.encoding = THREE.sRGBEncoding;
  scoreTex.anisotropy = 4;
  const scorePanelMat = new THREE.MeshStandardMaterial({ map: scoreTex, emissive:0x11181f, roughness:0.6, metalness:0.1 });
  const scorePanel = new THREE.Mesh(scorePanelGeo, scorePanelMat);
  scorePanel.name = 'scorePanel';
  // Position slightly above the top of the side walls (walls are 2.4 high); default set to 2.5m
  scorePanel.position.set(0,2.5,1.4);
  scorePanel.rotation.x = -0.25;
  group.add(scorePanel);

  // Spots directionnels au-dessus de la piste
  const spot1 = new THREE.SpotLight(0xfff2dc, 1.0, 20, Math.PI/5, 0.4, 1.5);
  spot1.position.set(0,4,-4);
  spot1.target.position.set(0,0,-8);
  scene.add(spot1, spot1.target);
  const spot2 = spot1.clone();
  spot2.position.set(0,4,-10);
  spot2.target.position.set(0,0,-8);
  scene.add(spot2, spot2.target);

  // Liseré lumineux (edge emissive) sur les côtés de la piste
  const edgeMat = new THREE.MeshBasicMaterial({ color:0x335577 });
  const edgeGeo = new THREE.BoxGeometry(0.02,0.01,12.01);
  const edgeLeft = new THREE.Mesh(edgeGeo, edgeMat); edgeLeft.position.set(-0.6,0.021,-6);
  const edgeRight = edgeLeft.clone(); edgeRight.position.x = 0.6;
  laneGroup.add(edgeLeft, edgeRight);

  return { group, laneGroup, scorePanel, scoreCanvas, scoreCtx, scoreTex };
}

function makeWoodTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8a6032'; ctx.fillRect(0,0,256,256);
  for (let y=0; y<256; y+=8) {
    const variation = Math.floor(Math.random()*12)-6;
    ctx.fillStyle = `rgb(${138+variation},${96+variation},${50+variation})`;
    ctx.fillRect(0,y,256,8);
  }
  // Subtle rings
  ctx.globalAlpha = 0.08; ctx.strokeStyle = '#3e2814';
  for (let i=0;i<40;i++) {
    ctx.beginPath();
    ctx.arc(Math.random()*256, Math.random()*256, Math.random()*60, 0, Math.PI*2);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  return tex;
}

function makeLaneMarkersTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 1024;
  const ctx = c.getContext('2d');
  ctx.clearRect(0,0,c.width,c.height);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  const arrow = (x,y)=> {
    ctx.beginPath();
    ctx.moveTo(x,y);
    ctx.lineTo(x-10,y+40);
    ctx.lineTo(x+10,y+40);
    ctx.closePath();
    ctx.fill();
  };
  // Place 7 arrows across width near mid (arbitrary distances)
  const yStart = 620; // position along texture (maps to mid-lane)
  const positions = [0.15,0.3,0.45,0.5,0.55,0.7,0.85];
  positions.forEach(p=> arrow(p*256, yStart));
  // Dots (approach area) near player side
  for (let i=0;i<5;i++) {
    ctx.beginPath();
    ctx.arc( (0.2 + i*0.15) * 256, 180, 6, 0, Math.PI*2 );
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

function makeFloorTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#20272d'; ctx.fillRect(0,0,128,128);
  for (let i=0;i<140;i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random()*0.05})`;
    ctx.fillRect(Math.random()*128, Math.random()*128, 1,1);
  }
  return new THREE.CanvasTexture(c);
}
