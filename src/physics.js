// Simple bowling physics utilities (placeholder / simplified)
import * as THREE from 'three';

export class PhysicsWorld {
  constructor(params = {}) {
    this.gravity = new THREE.Vector3(0, -9.81, 0);
    this.objects = []; // { mesh, velocity:THREE.Vector3, radius?, isPin?, fallen? }
    this.frictionCoeff = params.frictionCoeff ?? 0.02; // lane rolling friction
  }

  addObject(obj) { this.objects.push(obj); }

  step(dt) {
    for (const o of this.objects) {
      if (o.isPin) continue; // pins static except collision detection (simplified)
      // gravity not applied strongly to rolling ball to keep it on lane (y almost fixed)
      // Apply simple forward friction reducing velocity magnitude
      const v = o.velocity;
      const speed = v.length();
      if (speed > 0) {
        const frictionDecel = this.frictionCoeff * 9.81;
        const newSpeed = Math.max(0, speed - frictionDecel * dt);
        if (newSpeed === 0) v.set(0,0,0); else v.multiplyScalar(newSpeed / speed);
      }
      // Integrate position
      o.mesh.position.addScaledVector(v, dt);
    }
    this.handleCollisions();
  }

  handleCollisions() {
    // Ball vs pins simplistic collision
    const ball = this.objects.find(o => o.isBall);
    if (!ball) return;
    for (const pin of this.objects.filter(o => o.isPin && !o.fallen)) {
      const dist = pin.mesh.position.distanceTo(ball.mesh.position);
      const combined = (pin.radius ?? 0.12) + (ball.radius ?? 0.11);
      if (dist < combined) {
        pin.fallen = true;
        pin.mesh.rotation.z = Math.PI * 0.5 * (Math.random() > 0.5 ? 1 : -1);
        pin.mesh.position.y -= 0.3; // visually drop
        if (this.onPinFall) this.onPinFall(pin);
      }
    }
  }
}
