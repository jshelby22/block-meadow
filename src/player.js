import { LIMITS } from './world.js';

const RADIUS = 0.28;
const HEIGHT = 1.7;
const EPSILON = 1e-8;

export class Player {
  constructor(world) {
    this.world = world;
    // Position is feet; the camera eye belongs 1.55 units above it.
    this.position = { ...world.spawn };
    this.yaw = 0.62;
    this.pitch = -0.10;
    this.grounded = false;
    this.flying = false;
    this.velocityY = 0;
  }

  // Sweep the whole body to the nearest voxel face, not just its destination.
  #move(axis, distance) {
    if (axis !== 'y') {
      const target = Math.max(LIMITS.min + RADIUS, Math.min(LIMITS.max - RADIUS, this.position[axis] + distance));
      distance = target - this.position[axis];
    }
    if (distance === 0) return false;
    const { x, y, z } = this.position;
    const min = { x: x - RADIUS, y, z: z - RADIUS };
    const max = { x: x + RADIUS, y: y + HEIGHT, z: z + RADIUS };
    const positive = distance > 0;
    const leading = positive ? max[axis] : min[axis];
    if (positive) max[axis] += distance;
    else min[axis] += distance;
    let allowed = distance;
    for (let bx = Math.floor(min.x + EPSILON); bx <= Math.floor(max.x - EPSILON); bx++) {
      for (let by = Math.floor(min.y + EPSILON); by <= Math.floor(max.y - EPSILON); by++) {
        for (let bz = Math.floor(min.z + EPSILON); bz <= Math.floor(max.z - EPSILON); bz++) {
          if (!this.world.isSolid(bx, by, bz)) continue;
          const block = axis === 'x' ? bx : axis === 'y' ? by : bz;
          const gap = (positive ? block : block + 1) - leading;
          allowed = positive ? Math.min(allowed, gap) : Math.max(allowed, gap);
        }
      }
    }
    this.position[axis] += allowed;
    return allowed !== distance;
  }

  respawn() {
    const { x, y, z } = this.world.spawn;
    let safeY = y;
    for (let bx = Math.floor(x - RADIUS + EPSILON); bx <= Math.floor(x + RADIUS - EPSILON); bx++) {
      for (let bz = Math.floor(z - RADIUS + EPSILON); bz <= Math.floor(z + RADIUS - EPSILON); bz++) {
        safeY = Math.max(safeY, this.world.surface(bx, bz));
      }
    }
    this.position = { x, y: safeY, z };
    this.velocityY = 0;
    this.flying = false;
    this.grounded = this.#supported();
  }

  look(dx, dy) {
    this.yaw -= dx * 0.0022;
    this.pitch = Math.max(-1.4, Math.min(1.4, this.pitch - dy * 0.0022));
  }

  toggleFly() {
    this.flying = !this.flying;
    this.velocityY = 0;
    this.grounded = !this.flying && this.#supported();
  }

  #supported() {
    const { x, y, z } = this.position;
    const below = Math.floor(y - EPSILON);
    if (Math.abs(y - below - 1) > EPSILON) return false;
    for (let bx = Math.floor(x - RADIUS + EPSILON); bx <= Math.floor(x + RADIUS - EPSILON); bx++) {
      for (let bz = Math.floor(z - RADIUS + EPSILON); bz <= Math.floor(z + RADIUS - EPSILON); bz++) {
        if (this.world.isSolid(bx, below, bz)) return true;
      }
    }
    return false;
  }

  update(dt, { forward = 0, right = 0, sprint = false, jump = false, down = false } = {}) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.1);
    this.grounded = !this.flying && this.#supported();
    if (jump && this.grounded) this.velocityY = 8;
    const speed = sprint ? 7 : 4.5;
    const length = Math.max(1, Math.hypot(forward, right));
    forward /= length;
    right /= length;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const steps = Math.ceil(dt / (1 / 120));
    const step = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.#move('x', (-sin * forward + cos * right) * speed * step);
      this.#move('z', (-cos * forward - sin * right) * speed * step);
      if (this.flying) this.velocityY = (Number(jump) - Number(down)) * speed;
      else this.velocityY -= 22 * step;
      const blocked = this.#move('y', this.velocityY * step);
      this.grounded = !this.flying && blocked && this.velocityY < 0;
      if (blocked) this.velocityY = 0;
    }
  }
}
