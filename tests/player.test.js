import test from 'node:test';
import assert from 'node:assert/strict';
import { World, LIMITS } from '../src/world.js';
import { Player } from '../src/player.js';

function flatWorld() {
  const world = new World();
  world.blocks.clear();
  for (let x = LIMITS.min; x < LIMITS.max; x++) {
    for (let z = LIMITS.min; z < LIMITS.max; z++) world.set(x, 0, z, 'stone');
  }
  world.spawn = { x: 0.5, y: 1, z: 0.5 };
  return world;
}

function run(player, seconds, input = {}, dt = 1 / 60) {
  for (let left = seconds; left > 1e-10; left -= dt) player.update(Math.min(dt, left), input);
}

function near(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be near ${expected}`);
}

function assertClear(player) {
  const { x, y, z } = player.position;
  for (let bx = Math.floor(x - 0.28 + 1e-7); bx <= Math.floor(x + 0.28 - 1e-7); bx++) {
    for (let by = Math.floor(y + 1e-7); by <= Math.floor(y + 1.7 - 1e-7); by++) {
      for (let bz = Math.floor(z - 0.28 + 1e-7); bz <= Math.floor(z + 0.28 - 1e-7); bz++) {
        assert.equal(player.world.isSolid(bx, by, bz), false, `body overlaps ${bx},${by},${bz}`);
      }
    }
  }
}

test('normalizes diagonal walking without speeding up analog input', () => {
  const world = flatWorld();
  for (const [forward, right] of [[1, 1], [-1, -1], [0.3, 0.4]]) {
    const player = new Player(world);
    const start = { ...player.position };
    run(player, 1, { forward, right });
    near(Math.hypot(player.position.x - start.x, player.position.z - start.z),
      4.5 * Math.min(1, Math.hypot(forward, right)));
  }
});

test('sprinting covers 7 units per second', () => {
  const player = new Player(flatWorld());
  player.yaw = 0;
  run(player, 1, { right: 1, sprint: true });
  near(player.position.x, 0.5 + 7);
  near(player.position.z, 0.5);
});

test('the 0.28-radius body stops flush against tall walls from every horizontal direction', () => {
  for (const axis of ['x', 'z']) {
    for (const direction of [-1, 1]) {
      const world = flatWorld();
      const wall = direction > 0 ? 2 : -2;
      for (let across = -2; across <= 2; across++) {
        for (let y = 1; y <= 3; y++) {
          world.set(axis === 'x' ? wall : across, y, axis === 'z' ? wall : across, 'brick');
        }
      }
      const player = new Player(world);
      player.yaw = 0;
      run(player, 1, axis === 'x' ? { right: direction, sprint: true } : { forward: -direction, sprint: true });
      near(player.position[axis], direction > 0 ? wall - 0.28 : wall + 1 + 0.28);
      near(player.position.y, 1);
    }
  }
});

test('gravity lands feet on real solid ground with no residual downward velocity', () => {
  const player = new Player(flatWorld());
  player.position.y = 8;
  run(player, 0.2);
  assert.ok(player.position.y < 8 && player.position.y > 1);
  assert.ok(player.velocityY < 0);
  assert.equal(player.grounded, false);
  run(player, 2);
  near(player.position.y, 1);
  assert.equal(player.velocityY, 0);
  assert.equal(player.grounded, true);
  run(player, 1);
  near(player.position.y, 1);
});

test('a grounded jump rises over one block before returning to the floor', () => {
  const player = new Player(flatWorld());
  player.update(1 / 60, { jump: true });
  assert.ok(player.position.y > 1, 'jump works immediately at spawn');
  assert.ok(player.velocityY > 0);
  assert.equal(player.grounded, false);
  let highest = player.position.y;
  for (let i = 0; i < 90; i++) {
    player.update(1 / 60, {});
    highest = Math.max(highest, player.position.y);
  }
  assert.ok(highest > 2.1, `jump apex was ${highest}`);
  near(player.position.y, 1);
  assert.equal(player.velocityY, 0);
  assert.equal(player.grounded, true);
});

test('fly mode rises, hovers and descends without gravity until toggled off', () => {
  const player = new Player(flatWorld());
  player.velocityY = -12;
  player.toggleFly();
  assert.equal(player.flying, true);
  assert.equal(player.velocityY, 0);
  run(player, 0.5, { jump: true });
  near(player.position.y, 1 + 4.5 * 0.5);
  assert.equal(player.grounded, false);
  const top = player.position.y;
  run(player, 1);
  near(player.position.y, top);
  assert.equal(player.velocityY, 0);
  run(player, 0.25, { down: true });
  near(player.position.y, top - 4.5 * 0.25);
  const middle = player.position.y;
  run(player, 0.5, { jump: true, down: true });
  near(player.position.y, middle);
  player.toggleFly();
  assert.equal(player.flying, false);
  assert.equal(player.velocityY, 0);
  run(player, 2);
  near(player.position.y, 1);
  assert.equal(player.grounded, true);
});

test('zero, negative and non-finite frame times are complete no-ops', () => {
  const player = new Player(flatWorld());
  player.update(1 / 60, {});
  const position = { ...player.position };
  const grounded = player.grounded;
  for (const dt of [0, -1, NaN, Infinity, -Infinity]) {
    player.update(dt, { forward: 1, jump: true, sprint: true });
    assert.deepEqual(player.position, position);
    assert.equal(player.velocityY, 0);
    assert.equal(player.grounded, grounded);
  }
});

test('resuming after a long pause advances at most a tenth of a second with no backlog', () => {
  const world = flatWorld();
  const resumed = new Player(world);
  const normal = new Player(world);
  for (const player of [resumed, normal]) player.position.y = 12;
  const input = { forward: 1, right: 1, sprint: true };
  resumed.update(120, input);
  normal.update(0.1, input);
  assert.deepEqual(resumed.position, normal.position);
  assert.equal(resumed.velocityY, normal.velocityY);
  run(resumed, 0.2, input);
  run(normal, 0.2, input);
  assert.deepEqual(resumed.position, normal.position);
});

test('substeps keep falling and jumping trajectories stable across frame rates', () => {
  const world = flatWorld();
  for (const jumping of [false, true]) {
    const reference = new Player(world);
    if (!jumping) reference.position.y = 12;
    run(reference, 0.4, { right: 1, jump: jumping }, 1 / 120);
    for (const dt of [0.1, 1 / 30, 1 / 60, 1 / 144]) {
      const player = new Player(world);
      if (!jumping) player.position.y = 12;
      run(player, 0.4, { right: 1, jump: jumping }, dt);
      near(player.position.x, reference.position.x);
      near(player.position.z, reference.position.z);
      near(player.position.y, reference.position.y, 0.01);
      near(player.velocityY, reference.velocityY);
    }
  }
});

test('the entire body stays within all meadow edges when walking or flying', () => {
  const world = flatWorld();
  for (const flying of [false, true]) {
    for (const axis of ['x', 'z']) {
      for (const direction of [-1, 1]) {
        const player = new Player(world);
        player.yaw = 0;
        if (flying) {
          player.toggleFly();
          player.position.y = 6;
        }
        run(player, 8, axis === 'x' ? { right: direction, sprint: true } : { forward: -direction, sprint: true }, 0.1);
        near(player.position[axis], direction > 0 ? LIMITS.max - 0.28 : LIMITS.min + 0.28);
        near(player.position.y, flying ? 6 : 1);
      }
    }
  }
});

test('mouse look uses the camera signs and clamps pitch before it can flip', () => {
  const player = new Player(flatWorld());
  player.look(50, -30);
  near(player.yaw, 0.62 - 50 * 0.0022);
  near(player.pitch, -0.10 + 30 * 0.0022);
  player.look(-50, 100000);
  near(player.yaw, 0.62);
  near(player.pitch, -1.4);
  player.look(0, -100000);
  near(player.pitch, 1.4);
});

test('respawn clears momentum and returns above the current spawn-column builds', () => {
  const world = flatWorld();
  const player = new Player(world);
  world.spawn = { x: 2.5, y: 1, z: -3.5 };
  for (let y = 1; y <= LIMITS.top; y++) world.set(2, y, -4, 'brick');
  const spawn = { ...world.spawn };
  player.position = { x: -10, y: 14, z: 5 };
  player.toggleFly();
  player.velocityY = -30;
  player.respawn();
  near(player.position.x, spawn.x);
  near(player.position.z, spawn.z);
  near(player.position.y, LIMITS.top + 1);
  assert.equal(player.velocityY, 0);
  assert.equal(player.flying, false);
  assert.equal(player.grounded, true);
  assert.deepEqual(world.spawn, spawn);
  run(player, 0.2);
  near(player.position.y, LIMITS.top + 1);
});

test('respawn clears the whole footprint including diagonal builds, but ignores water', () => {
  const world = flatWorld();
  world.spawn = { x: 0.9, y: 1, z: 0.9 };
  world.set(1, 4, 0, 'wood');
  world.set(0, 5, 1, 'brick');
  world.set(1, 6, 1, 'glass');
  world.set(0, LIMITS.top, 0, 'water');
  const player = new Player(world);
  player.respawn();
  near(player.position.y, 7);
  near(player.position.x, 0.9);
  near(player.position.z, 0.9);
  run(player, 0.2);
  near(player.position.y, 7);
});

test('jumping and flying stop the 1.7-high body below ceilings', () => {
  const world = flatWorld();
  world.set(0, 3, 0, 'glass');
  for (const flying of [false, true]) {
    const player = new Player(world);
    if (flying) player.toggleFly();
    player.update(1 / 60, { jump: true, sprint: true });
    assert.ok(player.position.y > 1);
    for (let i = 0; i < 30; i++) {
      player.update(0.1, { jump: flying, sprint: true });
      assert.ok(player.position.y <= 3 - 1.7 + 1e-7);
      assertClear(player);
    }
    near(player.position.y, flying ? 3 - 1.7 : 1);
    assert.equal(player.velocityY, 0);
  }
});

test('sweeps catch single-block floors and ceilings even at extreme vertical momentum', () => {
  for (const direction of [-1, 1]) {
    const world = flatWorld();
    world.set(0, direction > 0 ? 3 : 10, 0, 'glass');
    const player = new Player(world);
    player.position.y = direction > 0 ? 1 : 20;
    player.velocityY = direction * 1000;
    player.update(10, {});
    assertClear(player);
    if (direction > 0) {
      assert.ok(player.position.y >= 1 && player.position.y <= 3 - 1.7 + 1e-7);
      assert.ok(player.velocityY <= 0);
    } else {
      near(player.position.y, 11);
      assert.equal(player.velocityY, 0);
      assert.equal(player.grounded, true);
    }
  }
});

test('flying cannot cross a wall that touches only the upper body after a paused frame', () => {
  const world = flatWorld();
  world.set(1, 2, 0, 'brick');
  const player = new Player(world);
  player.yaw = 0;
  player.toggleFly();
  for (let i = 0; i < 5; i++) {
    player.update(10, { right: 1, sprint: true });
    near(player.position.x, 1 - 0.28);
    assertClear(player);
  }
  run(player, 0.5, { down: true });
  near(player.position.y, 1);
  assert.equal(player.velocityY, 0);
});

test('water never blocks horizontal travel or supports the player', () => {
  const world = flatWorld();
  for (let y = 1; y <= 3; y++) world.set(1, y, 0, 'water');
  world.set(0, 1, 0, 'water');
  const player = new Player(world);
  player.position.y = 3;
  run(player, 1);
  near(player.position.y, 1);
  player.yaw = 0;
  run(player, 1, { right: 1 });
  near(player.position.x, 0.5 + 4.5);
  near(player.position.y, 1);
  assertClear(player);
});

test('jump input cannot create a midair jump or use ground that was removed', () => {
  const world = flatWorld();
  const player = new Player(world);
  const reference = new Player(world);
  player.position.y = reference.position.y = 5;
  run(player, 0.4, { jump: true });
  run(reference, 0.4);
  assert.deepEqual(player.position, reference.position);
  assert.equal(player.velocityY, reference.velocityY);
  player.respawn();
  assert.equal(player.grounded, true);
  world.set(0, 0, 0, null);
  player.update(1 / 60, { jump: true });
  assert.ok(player.position.y < 1);
  assert.ok(player.velocityY < 0);
  assert.equal(player.grounded, false);
});

test('starts with its feet at an independent copy of the world spawn', () => {
  assert.equal(typeof Player, 'function', 'Player is available');
  const world = new World();
  const player = new Player(world);
  assert.deepEqual(player.position, world.spawn);
  assert.notEqual(player.position, world.spawn);
  assert.equal(player.yaw, 0.62);
  assert.equal(player.pitch, -0.10);
  assert.equal(typeof player.grounded, 'boolean');
  assert.equal(player.flying, false);
  assert.equal(player.velocityY, 0);
});

test('walks at 4.5 units per second in the camera yaw basis, independent of pitch', () => {
  const world = flatWorld();
  for (const [forward, right] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const player = new Player(world);
    player.pitch = 1.3;
    const { x, y, z } = player.position;
    run(player, 0.4, { forward, right });
    near(player.position.x - x, (-Math.sin(player.yaw) * forward + Math.cos(player.yaw) * right) * 4.5 * 0.4);
    near(player.position.z - z, (-Math.cos(player.yaw) * forward - Math.sin(player.yaw) * right) * 4.5 * 0.4);
    near(player.position.y, y);
  }
});
