import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { BowlingGame, DifficultyProfiles } from './game.js';
import { BallTypes } from './balls.js';
import { buildEnvironment } from './environment.js';
import { AudioManager } from './audio.js';

let renderer, scene, camera, game, audio;
let envUI; // object returned from buildEnvironment (score canvas/texture)
let controller1, controller2;
const controllerState = new WeakMap(); // { history: [{pos, time}], grabbingBall:boolean }
let lastTime = 0;
let debugGroup; let debugEnabled = false;
// Picking helpers
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

init();

function init() {
  renderer = new THREE.WebGLRenderer({ antialias:true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);
  document.body.appendChild(VRButton.createButton(renderer));

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101820);

  // Audio manager (placeholder sound assets, can be replaced with real files later)
  audio = new AudioManager();
  try {
    const soundMap = {
      throw: 'assets/sounds/throw.mp3',
      roll: 'assets/sounds/roll.mp3',
      pinFall: 'assets/sounds/pinfall.mp3',
      strike: 'assets/sounds/strike.mp3',
      spare: 'assets/sounds/spare.mp3'
    };
    for (const [id, url] of Object.entries(soundMap)) audio.load(id, url);
  } catch(e){ console.warn('Audio load skipped', e); }

  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 50);
  camera.position.set(0, 1.5, 2.2);
  scene.add(camera);
  camera.lookAt(0,1,-6);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x222233, 1.0);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(3,5,2);
  scene.add(dir);

  envUI = buildEnvironment(renderer, scene);
  removeResidualTestCubes();

  game = new BowlingGame(scene);
  game.applyDifficulty('normal');
  setupScoreboard(game);

  // Position the 3D scoreboard once above the ball spawn (start of the lane).
  try {
    if (envUI && envUI.scorePanel && game && game.ball && game.ball.mesh) {
      const bp = game.ball.mesh.position;
      envUI.scorePanel.position.x = bp.x;
      // place slightly toward the player in front of the ball spawn so it's readable
      envUI.scorePanel.position.z = bp.z + 0.6;
      // keep fixed height (defined in environment)
      envUI.scorePanel.position.y = envUI.scorePanel.position.y || 2.5;
      // ensure a slight tilt downward
      envUI.scorePanel.rotation.x = -0.25;
    }
  } catch(e) { /* ignore */ }

  // UI wiring
  const scoreEl = document.getElementById('score');
  const throwsEl = document.getElementById('throwsLeft');
  const diffEl = document.getElementById('difficulty');
  const resetBtn = document.getElementById('resetBtn');
  const msgEl = document.getElementById('message');

  game.onScoreChange = (s)=> scoreEl.textContent = s;
  game.onThrowsLeftChange = (n)=> throwsEl.textContent = n;
  const showMsg = (t)=> { if (!msgEl) return; msgEl.textContent = t; setTimeout(()=>{ if (msgEl.textContent===t) msgEl.textContent=''; }, 2500); };
  game.onStrike = ()=> { audio && audio.play('strike'); showMsg('STRIKE! 🎯'); };
  game.onSpare = ()=> { audio && audio.play('spare'); showMsg('Spare ✔'); };
  game.onPinFall = ()=> audio && audio.play('pinFall');
  game.onBallRoll = ()=> { audio && audio.play('roll'); showMsg('Boule lancée'); };
  game.onGutter = ()=> showMsg('Gouttière...');
  game.onReset = ()=> showMsg('Nouveau frame');
  game.onScoreboardChange = (frames, current, total)=> renderScoreboard(frames, current, total);
  game.onGameFinished = (total)=> {
    renderScoreboard(game.frames, game.currentFrameIndex, total);
    console.log('Partie terminée - Score total:', total);
  };

  diffEl.addEventListener('change', e=> game.applyDifficulty(e.target.value));
  resetBtn.addEventListener('click', ()=> { game.resetFrame(); game.applyDifficulty(diffEl.value); scoreEl.textContent=game.score; throwsEl.textContent=game.throwsLeft; });

  ensureBallSelector();

  // Desktop: cliquer directement sur la boule pour la lancer
  window.addEventListener('pointerdown', onPointerDownLaunchBall);

  // Setup VR controllers after scene init
  setupVRControllers();

  // Resize listener & initial size sync
  window.addEventListener('resize', onResize);
  onResize();

  // Optional debug group (axes/grid/test cube) toggle with F1
  initDebugHelpers();
  window.addEventListener('keydown', (e)=> { if (e.key === 'F1') { e.preventDefault(); toggleDebug(); } });

  console.log('[Init] Pins:', game.pins?.length, 'Ball pos:', game.ball?.mesh.position.toArray());

  // Start render loop
  renderer.setAnimationLoop(onXRFrame);
}

function initDebugHelpers() {
  debugGroup = new THREE.Group();
  const axes = new THREE.AxesHelper(1.2);
  const grid = new THREE.GridHelper(20, 40, 0x334455, 0x223033);
  grid.position.y = 0.001;
  debugGroup.add(axes, grid);
  debugGroup.visible = debugEnabled;
  scene.add(debugGroup);
}

function toggleDebug() {
  debugEnabled = !debugEnabled;
  if (debugGroup) debugGroup.visible = debugEnabled;
  console.log('[Debug] toggled', debugEnabled);
}

function removeResidualTestCubes() {
  // Sécurité: si un ancien cube rouge (0xff2244) traîne (cache/HMR), on le purge.
  scene.traverse(obj => {
    if (obj.isMesh && obj.material && obj.material.color && obj.material.color.getHex() === 0xff2244) {
      if (!debugGroup || !debugGroup.children.includes(obj)) {
        obj.parent && obj.parent.remove(obj);
      }
    }
  });
}

function onPointerDownLaunchBall(event) {
  if (renderer.xr.isPresenting) return; // en VR: gestion via contrôleurs
  if (!game || game.ballRolled) return;
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObject(game.ball.mesh, false);
  if (intersects.length) {
    // Lancement dans l'axe -Z (caméra regarde déjà la piste)
    game.rollBall(new THREE.Vector3(0,0,-1), 8);
    audio && audio.play('throw');
  }
}

function addControllerModel(controller) {
  const geom = new THREE.ConeGeometry(0.008,0.06,12);
  const mat = new THREE.MeshStandardMaterial({ color:0x66ffcc, emissive:0x113322 });
  const cone = new THREE.Mesh(geom, mat); cone.position.z = -0.03; cone.rotation.x = Math.PI/2;
  controller.add(cone);
  controllerState.set(controller, { history:[], grabbingBall:false });
}

function setupVRControllers() {
  controller1 = renderer.xr.getController(0);
  controller2 = renderer.xr.getController(1);
  scene.add(controller1); scene.add(controller2);
  addControllerModel(controller1);
  addControllerModel(controller2);
  function attachEvents(c) {
    c.addEventListener('selectstart', ()=> tryGrabBall(c));
    c.addEventListener('selectend', ()=> releaseBall(c));
  }
  attachEvents(controller1); attachEvents(controller2);
}

function tryGrabBall(controller) {
  if (game.ballRolled) return;
  const st = controllerState.get(controller);
  const dist = controller.position.distanceTo(game.ball.mesh.position);
  if (dist < game.ball.type.radius + 0.14) {
    game.ballGrabbed = controller;
    st.grabbingBall = true;
    st.history.length = 0;
    game.ball.body.velocity.set(0,0,0);
    game.ball.body.angularVelocity.set(0,0,0);
  }
}

function releaseBall(controller) {
  if (game.ballGrabbed !== controller) return;
  const st = controllerState.get(controller);
  st.grabbingBall = false;
  game.ballGrabbed = null;
  const hist = st.history;
  let releaseVel = new THREE.Vector3(0,0,-6);
  if (hist.length >= 2) {
    const nowSample = hist[hist.length-1];
    const windowMs = 140;
    let baseIdx = hist.length-2;
    for (let i=hist.length-2;i>=0;i--) {
      if (nowSample.time - hist[i].time > windowMs) break;
      baseIdx = i;
    }
    const first = hist[baseIdx];
    const dt = (nowSample.time - first.time)/1000;
    if (dt > 0.0001) releaseVel = nowSample.pos.clone().sub(first.pos).divideScalar(dt);
  }
  game.launchBallVelocity(releaseVel);
  audio && audio.play('throw');
}

// Rough velocity estimator (frame diff). In a real implementation keep a history.
// Record controller pose history each frame for velocity on release
function recordControllerHistory() {
  const t = performance.now();
  [controller1, controller2].forEach(c=> {
    if (!c) return;
    const st = controllerState.get(c); if (!st) return;
    // Push sample
    st.history.push({ pos: c.position.clone(), time: t });
    // Trim older than 250ms
    while (st.history.length && (t - st.history[0].time) > 250) st.history.shift();
    // If grabbing ball, move the ball with controller (kinematic behavior)
    if (st.grabbingBall && game.ball && !game.ballRolled) {
      game.ball.body.position.set(c.position.x, game.ball.type.radius, c.position.z);
      game.ball.body.velocity.set(0,0,0);
      game.ball.body.angularVelocity.set(0,0,0);
    }
  });
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onXRFrame(time) {
  const dt = (time - lastTime) / 1000;
  lastTime = time;
  recordControllerHistory();
  game.update(dt);
  renderer.render(scene, camera);
}

function ensureBallSelector() {
  let existing = document.getElementById('ballType');
  if (existing) return;
  const wrap = document.getElementById('uiOverlay');
  if (!wrap) return;
  const label = document.createElement('div');
  label.textContent = 'Boule:';
  const sel = document.createElement('select');
  sel.id = 'ballType';
  for (const b of BallTypes) {
    const opt = document.createElement('option');
    opt.value = b.id; opt.textContent = b.label; if (b.id==='standard') opt.selected = true; sel.appendChild(opt);
  }
  sel.addEventListener('change', ()=> {
    game.activeBallType = sel.value;
    if (!game.ballRolled) {
      if (game.ball) { game.world.removeBody(game.ball.body); scene.remove(game.ball.mesh); }
      game.ball = game.spawnBall();
    }
  });
  wrap.appendChild(label);
  wrap.appendChild(sel);
}

// ---------------- Scoreboard UI ----------------
function setupScoreboard(game){
  const el = document.getElementById('scoreboard');
  if(!el) return;
  renderScoreboard(game.frames, game.currentFrameIndex, game.totalScore);
}

function renderScoreboard(frames, currentIndex, total){
  const el = document.getElementById('scoreboard'); if(!el) return;
  el.innerHTML='';
  frames.forEach((f,idx)=>{
    const frame = document.createElement('div'); frame.className='frame'+(idx===currentIndex && !f.locked?' current':'');
    const header = document.createElement('div'); header.className='frame-header'; header.textContent = (idx+1);
    frame.appendChild(header);
    const throwsDiv = document.createElement('div'); throwsDiv.className='throws';
    const isTenth = idx===9;
    const maxBoxes = isTenth?3:2;
    for(let i=0;i<maxBoxes;i++){
      const box = document.createElement('div'); box.className='throw-box'+(isTenth && i===2?' bonus':'');
      const t = f.throws[i];
      if(t){ box.textContent = t.symbol; if(t.symbol==='0') box.style.opacity='0.45'; }
      frame.appendChild(throwsDiv); throwsDiv.appendChild(box);
    }
    const cum = document.createElement('div'); cum.className='cumulative';
    // Show cumulative only when the frame is closed (played)
    let closed = false;
    try { closed = (idx < currentIndex) || (idx === currentIndex && game._isCurrentFrameClosed()); } catch(e) { closed = (f.cumulative>0); }
    if (closed) {
      if (typeof f.cumulative === 'number') cum.textContent = String(f.cumulative);
      else cum.textContent = '';
    }
    frame.appendChild(cum);
    el.appendChild(frame);
  });
  // Total overlay (optional)
  el.setAttribute('data-total', total);
  // Also render to 3D panel canvas (if available) so it's visible in VR
  if (envUI && envUI.scoreCtx && envUI.scoreTex) {
    const ctx = envUI.scoreCtx;
    const canvas = envUI.scoreCanvas;
    // Table layout: 11 cols (10 frames + TOTAL), 3 rows
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0,0,w,h);
    // Background
    ctx.fillStyle = '#222831'; ctx.fillRect(0,0,w,h);
    // Grid metrics
    const cols = 11;
    const colW = Math.floor(w / cols);
    const headerH = Math.floor(h * 0.18);
    const middleH = Math.floor(h * 0.44);
    const bottomH = h - headerH - middleH;
    const pad = 8;
    // Draw vertical separators and headers
    ctx.strokeStyle = '#334155'; ctx.lineWidth = 2;
    for (let c=0;c<cols;c++) {
      const x = c * colW;
      ctx.strokeRect(x+1, 1, colW-2, h-2);
    }
    // Header row: frame numbers 1..10 and TOTAL
    ctx.fillStyle = '#e6f0ff'; ctx.font = `${Math.floor(headerH*0.45)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let c=0;c<10;c++) {
      const cx = c*colW + colW/2;
      ctx.fillText(String(c+1), cx, headerH/2);
    }
    ctx.fillText('TOTAL', 10*colW + colW/2, headerH/2);
    // Middle row: throws (two small cells per frame; 10th frame can have 3)
    const throwFont = `${Math.floor(middleH*0.35)}px monospace`;
    ctx.font = throwFont; ctx.textBaseline = 'middle';
    for (let c=0;c<10;c++){
      const f = frames[c] || { throws: [] };
      const x0 = c*colW;
      const midTop = headerH;
      const midBottom = headerH + middleH;
      // For frames 0..8 => 2 cells; frame 9 => 3 cells
      const cells = (c===9) ? 3 : 2;
      const cellW = Math.floor((colW - pad*2) / cells);
      for (let i=0;i<cells;i++){
        const cx = x0 + pad + i*cellW + cellW/2;
        // draw small rect
        ctx.fillStyle = '#11161b';
        ctx.fillRect(x0 + pad + i*cellW, midTop + pad/2, cellW - 2, middleH - pad);
        ctx.strokeStyle = '#3b5166'; ctx.strokeRect(x0 + pad + i*cellW, midTop + pad/2, cellW - 2, middleH - pad);
        // content
        const symbol = f.throws[i] ? f.throws[i].symbol : '';
        ctx.fillStyle = (i===0 && symbol==='X') ? '#ffcc66' : '#cfe4ff';
        ctx.fillText(symbol || '', cx, midTop + middleH/2);
      }
    }
    // 11th column middle+bottom is a single tall cell for total
    const totalX0 = 10*colW;
    ctx.fillStyle = '#11161b'; ctx.fillRect(totalX0 + pad, headerH + pad/2, colW - pad*2, middleH + bottomH - pad);
    ctx.strokeStyle = '#3b5166'; ctx.strokeRect(totalX0 + pad, headerH + pad/2, colW - pad*2, middleH + bottomH - pad);
    ctx.fillStyle = '#ffffff'; ctx.font = `${Math.floor((middleH+bottomH)*0.45)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(total || 0), totalX0 + colW/2, headerH + (middleH+bottomH)/2);
    // Bottom row: cumulative per frame
    ctx.font = `${Math.floor(bottomH*0.45)}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let c=0;c<10;c++){
      const f = frames[c] || {};
      const cx = c*colW + colW/2;
      // Determine if frame is closed
      let closed = false;
      try { closed = (c < currentIndex) || (c === currentIndex && game._isCurrentFrameClosed()); } catch(e) { closed = (f.cumulative && f.cumulative>0); }
  const cum = closed && (typeof f.cumulative === 'number') ? String(f.cumulative) : '';
      ctx.fillStyle = (c===currentIndex) ? '#ffd27a' : '#cfe4ff';
      ctx.fillText(cum, cx, headerH + middleH + bottomH/2);
    }
    // Small improvement: if 10th frame has 3 throws, populate them accordingly
    // (we already drew 3 cells for frame 10). For spare/strike symbols the game provides 'X' and '/'.

    // Panel position remains fixed (defined in environment). Do not recenter here.

    // mark texture needs update
    envUI.scoreTex.needsUpdate = true;
  }
}
