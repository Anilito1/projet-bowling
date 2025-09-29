import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { getBallType } from './balls.js';

export const DifficultyProfiles = {
  easy:   { laneFriction: 0.08, gutterWidth: 0.18, ballStability: 0.9 },
  normal: { laneFriction: 0.045, gutterWidth: 0.30, ballStability: 0.6 },
  hard:   { laneFriction: 0.02, gutterWidth: 0.48, ballStability: 0.3 }
};

export class BowlingGame {
  constructor(scene) {
    this.scene = scene;
    this.resetFrame();
    this.difficulty = 'normal';
  }

  applyDifficulty(diff) {
    this.difficulty = diff;
    const profile = DifficultyProfiles[diff];
    // Adjust gutter colliders spacing (narrower playable width in easier modes)
    if (this.gutterLeft && this.gutterRight) {
      const halfLane = 0.6; // visual half width
      const inward = profile.gutterWidth * 0.5; // amount gutters move inward from edges
      this.gutterLeft.position.x = -(halfLane - inward);
      this.gutterRight.position.x = (halfLane - inward);
      this.gutterLeft.quaternion.set(0,0,0,1);
      this.gutterRight.quaternion.set(0,0,0,1);
      this.gutterLeft.velocity?.set?.(0,0,0);
      this.gutterRight.velocity?.set?.(0,0,0);
    }
  }

  resetFrame() {
    // remove existing
    if (this.pins) for (const p of this.pins) this.scene.remove(p.mesh);
    if (this.ball?.mesh) this.scene.remove(this.ball.mesh);

  // Physics world configuration
  this.world = new CANNON.World({ gravity: new CANNON.Vec3(0,-9.82,0) });
  this.world.allowSleep = true;
  this.world.defaultContactMaterial.friction = 0.3;
  this.world.defaultContactMaterial.restitution = 0.05;
  this.world.broadphase = new CANNON.SAPBroadphase(this.world);

  this.materialLane = new CANNON.Material('lane');
  this.materialBall = new CANNON.Material('ball');
  this.materialPin = new CANNON.Material('pin');
  // Contact materials tuned for bowling feel
  this.world.addContactMaterial(new CANNON.ContactMaterial(this.materialBall, this.materialLane, { friction:0.015, restitution:0.02 }));
  this.world.addContactMaterial(new CANNON.ContactMaterial(this.materialBall, this.materialPin, { friction:0.08, restitution:0.28 }));
  this.world.addContactMaterial(new CANNON.ContactMaterial(this.materialPin, this.materialPin, { friction:0.15, restitution:0.25 }));
    this.throwsLeft = 2;
    this.score = 0;
    this.spawnLaneColliders();
    this.pins = this.spawnPins();
    this.ball = this.spawnBall();
    this.activeBallType = 'standard';
  }

  spawnPins() {
    const pins = [];
    // Visual geometry (capsule look)
    const geo = new THREE.CapsuleGeometry(0.06, 0.25, 6, 12);
    const mat = new THREE.MeshStandardMaterial({ color:0xffffff, roughness:0.35, metalness:0.05 });
    const startZ = -8;
    const rows = [1,2,3,4];
    let z = startZ;
    for (const r of rows) {
      const offset = (r-1)*0.16*0.5;
      for (let i=0;i<r;i++) {
        const mesh = new THREE.Mesh(geo, mat.clone());
  mesh.position.set((i*0.16)-offset, 0.40, z);
        this.scene.add(mesh);
        // Compound body: base wider for stability, mid slender, top slight mass
        const body = new CANNON.Body({ mass:1.5, material:this.materialPin });
        body.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
        body.angularDamping = 0.35;
        body.linearDamping = 0.01;
        body.sleepSpeedLimit = 0.35;
        body.sleepTimeLimit = 1.2;
        // Base (slightly wider)
        body.addShape(new CANNON.Cylinder(0.07,0.07,0.08,12), new CANNON.Vec3(0,-0.15,0));
        // Mid section
        body.addShape(new CANNON.Cylinder(0.06,0.06,0.22,12), new CANNON.Vec3(0,0.0,0));
        // Neck / top (narrower) + cap (sphere)
        body.addShape(new CANNON.Cylinder(0.045,0.045,0.08,12), new CANNON.Vec3(0,0.17,0));
        body.addShape(new CANNON.Sphere(0.05), new CANNON.Vec3(0,0.26,0));
        this.world.addBody(body);
        pins.push({ mesh, body, fallen:false });
      }
      z -= 0.32;
    }
    return pins;
  }

  spawnLaneColliders() {
    // Lane floor
    const laneShape = new CANNON.Box(new CANNON.Vec3(0.6,0.025,6));
    const laneBody = new CANNON.Body({ mass:0, material:this.materialLane, shape:laneShape });
    laneBody.position.set(0,0,-6);
    this.world.addBody(laneBody);
    // Gutters as walls on sides
    this.gutterLeft = new CANNON.Body({ mass:0, shape: new CANNON.Box(new CANNON.Vec3(0.02,0.2,6)), position: new CANNON.Vec3(-0.61,0.1,-6)});
    this.gutterRight = new CANNON.Body({ mass:0, shape: new CANNON.Box(new CANNON.Vec3(0.02,0.2,6)), position: new CANNON.Vec3(0.61,0.1,-6)});
    this.world.addBody(this.gutterLeft);
    this.world.addBody(this.gutterRight);
  }

  spawnBall() {
    const type = getBallType(this.activeBallType || 'standard');
    const geo = new THREE.SphereGeometry(type.radius, 32,16);
    const mat = new THREE.MeshStandardMaterial({ color: type.color });
    const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, type.radius + 0.02, 0); // align with lane relevée
    this.scene.add(mesh);
    const shape = new CANNON.Sphere(type.radius);
    const body = new CANNON.Body({ mass:type.mass, shape, material:this.materialBall });
    body.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
    body.linearDamping = 0.03;
    body.angularDamping = 0.15;
    this.world.addBody(body);
    return { mesh, body, type };
  }

  rollBall(direction, power) {
    if (this.throwsLeft <= 0 || this.ballRolled) return;
    const stability = DifficultyProfiles[this.difficulty].ballStability;
    const lateralJitter = (1 - stability) * (Math.random()*2 -1) * 0.15; // reduce curve
    const dir = direction.clone().normalize();
    dir.x += lateralJitter;
    // Target realistic initial speed ~ 6-8 m/s (not scaled by mass)
    const targetSpeed = 6 + (power*0.3); // power expected ~5-10
    const vel = dir.multiplyScalar(targetSpeed);
    this.ball.body.velocity.set(vel.x, 0, vel.z);
    this.ballRolled = true;
    if (this.onBallRoll) this.onBallRoll();
  }

  /**
   * Launch the ball with a pre-computed world velocity (used for VR controller release).
   * Expects a THREE.Vector3 in world coordinates. Y component is ignored (flattened) for lane roll.
   */
  launchBallVelocity(velocity) {
    if (this.throwsLeft <= 0 || this.ballRolled) return;
    const v = velocity.clone();
    // Flatten Y (simulate immediate settle on lane) but keep tiny upward if negative
    v.y = 0;
    // Clamp speed to a realistic range (2 m/s to 11 m/s)
    const speed = v.length();
    const clamped = Math.min(11, Math.max(2, speed));
    if (speed > 0) v.multiplyScalar(clamped / speed);
    this.ball.body.velocity.set(v.x, 0, v.z);
    this.ballRolled = true;
    if (this.onBallRoll) this.onBallRoll();
  }

  update(dt) {
    this.world.step(1/120, dt, 3);
    // Sync meshes
    for (const pin of this.pins) {
      pin.mesh.position.copy(pin.body.position);
      pin.mesh.quaternion.copy(pin.body.quaternion);
      if (!pin.fallen) {
        // Compute up vector from quaternion
        const up = new THREE.Vector3(0,1,0).applyQuaternion(pin.mesh.quaternion);
        const dot = up.dot(new THREE.Vector3(0,1,0));
        if (dot < Math.cos(THREE.MathUtils.degToRad(65))) { // > ~65° tilt
          pin.fallen = true; if (this.onPinFall) this.onPinFall(pin);
        }
      }
    }
    this.ball.mesh.position.copy(this.ball.body.position);
    this.ball.mesh.quaternion.copy(this.ball.body.quaternion);

    if (this.ballRolled) {
      const v = this.ball.body.velocity;
      const profile = DifficultyProfiles[this.difficulty];
      const playHalfWidth = 0.6 - (profile.gutterWidth * 0.5);
      if (Math.abs(this.ball.body.position.x) > playHalfWidth + 0.03) {
        this.ballInGutter = true;
      }
      if (v.length() < 0.15 || this.ball.body.position.z < -12 || this.ballInGutter) {
        this.endThrow();
      }
    }
  }

  endThrow() {
    if (!this.ballRolled) return;
    this.ballRolled = false;
  const fallen = this.pins.filter(p=>p.fallen).length;
  this.score = fallen;
    if (this.onScoreChange) this.onScoreChange(this.score);
    if (this.ballInGutter && this.onGutter) this.onGutter();

    // Strike condition (all 10 on first throw)
    if (this.throwsLeft === 2 && fallen === 10) {
      this.throwsLeft = 0;
      if (this.onThrowsLeftChange) this.onThrowsLeftChange(this.throwsLeft);
      if (this.onStrike) this.onStrike();
      this.autoResetSoon();
      return;
    }

    this.throwsLeft -= 1;
    if (this.onThrowsLeftChange) this.onThrowsLeftChange(this.throwsLeft);

    // Frame ends after second throw or all pins down (spare)
    if (this.throwsLeft === 0 || this.pins.every(p=>p.fallen)) {
      if (this.score === 10 && fallen !== 10 && this.onSpare) this.onSpare();
      this.autoResetSoon();
      return;
    }

    // Prepare next throw: fresh ball
    this.world.removeBody(this.ball.body);
    this.scene.remove(this.ball.mesh);
    this.ball = this.spawnBall();
    this.ballRolled = false;
    this.ballInGutter = false;
  }

  autoResetSoon() {
    setTimeout(()=>{
      this.resetFrame();
      this.applyDifficulty(this.difficulty);
      if (this.onScoreChange) this.onScoreChange(this.score);
      if (this.onThrowsLeftChange) this.onThrowsLeftChange(this.throwsLeft);
      if (this.onReset) this.onReset();
    }, 3000);
  }
}
