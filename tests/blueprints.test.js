import test from 'node:test';
import assert from 'node:assert/strict';
import { World, BLOCKS, ALL_BLOCKS } from '../src/world.js';
import { BLUE_BUDDY, blueprintEntries } from '../src/blueprints.js';
import * as blueprints from '../src/blueprints.js';

test('Blue Buddy is a connected, colored voxel character that saves and undoes without altering terrain', () => {
  assert.equal(BLOCKS.length, 8, 'the existing material hotbar is preserved');
  const blocks = BLUE_BUDDY.blocks;
  assert.ok(blocks.length > 100 && blocks.length < 1000);
  assert.equal(new Set(blocks.map(b => `${b.x},${b.y},${b.z}`)).size, blocks.length);
  for (const type of ['blue-wool', 'yellow-wool', 'red-wool', 'white-wool', 'black-wool']) {
    assert.ok(blocks.some(b => b.type === type), `missing ${type}`);
    assert.ok(ALL_BLOCKS.some(b => b.id === type), `unregistered ${type}`);
  }
  const remaining = new Set(blocks.map(b => `${b.x},${b.y},${b.z}`));
  const queue = [blocks[0]];
  remaining.delete(`${blocks[0].x},${blocks[0].y},${blocks[0].z}`);
  while (queue.length) {
    const { x, y, z } = queue.pop();
    for (const [dx, dy, dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) {
      const key = `${x+dx},${y+dy},${z+dz}`;
      if (remaining.delete(key)) queue.push({ x:x+dx, y:y+dy, z:z+dz });
    }
  }
  assert.equal(remaining.size, 0, 'no disconnected hands, feet, or head');
  const world = new World();
  const before = new Map(world.blocks);
  const entries = blueprintEntries(BLUE_BUDDY, { x: 10, y: 4, z: 6 });
  assert.equal(world.editBatch(entries, world.spawn).ok, true);
  assert.equal(world.changes.size, blocks.length);
  for (const [key, type] of before) assert.equal(world.blocks.get(key), type, 'existing terrain is preserved');
  const restored = new World();
  assert.equal(restored.restore(world.serialize()), true);
  assert.deepEqual([...restored.changes], [...world.changes]);
  assert.equal(world.undo(world.spawn).ok, true);
  assert.equal(world.changes.size, 0);
  for (let rotation = 0; rotation < 4; rotation++) {
    const rotated = blueprintEntries(BLUE_BUDDY, { x: 0, y: 4, z: 0 }, rotation);
    assert.equal(new Set(rotated.map(e => JSON.stringify(e.position))).size, blocks.length);
    assert.ok(rotated.every(e => Object.values(e.position).every(Number.isInteger)));
  }
});

test('quick build finds supported space near the player without clearing scenery or earlier builds', () => {
  assert.equal(typeof blueprints.findQuickBuildSpot, 'function');
  for (const yaw of [0, 0.62, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const world = new World();
    const original = world.serialize();
    const spot = blueprints.findQuickBuildSpot(world, BLUE_BUDDY, world.spawn, yaw);
    assert.ok(spot, `no safe starting spot at yaw ${yaw}`);
    assert.equal(world.serialize(), original, 'search does not mutate anything');
    for (const entry of spot.entries) {
      assert.equal(world.get(entry.position.x, entry.position.y, entry.position.z), null);
      if (entry.position.y === spot.origin.y) assert.ok(world.isSolid(entry.position.x, entry.position.y - 1, entry.position.z));
    }
    assert.equal(world.editBatch(spot.entries, world.spawn).ok, true);
    const next = blueprints.findQuickBuildSpot(world, BLUE_BUDDY, world.spawn, yaw);
    if (next) {
      const before = [...world.changes];
      assert.equal(world.editBatch(next.entries, world.spawn).ok, true);
      for (const [key, type] of before) assert.equal(world.blocks.get(key), type);
    }
  }
  const full = new World();
  for (let x = -24; x < 24; x++) for (let z = -24; z < 24; z++) {
    for (let y = 4; y <= 28; y++) full.set(x, y, z, 'stone');
  }
  assert.equal(blueprints.findQuickBuildSpot(full, BLUE_BUDDY, full.spawn, 0), null);
  assert.equal(full.history.length, 0);
});
