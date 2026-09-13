import test from 'node:test';
import assert from 'node:assert/strict';
import { World, BLOCKS, LIMITS } from '../src/world.js';

test('a seeded meadow has solid ground, trees, a pond, and a safe spawn', () => {
  const world = new World(42);
  const same = new World(42);
  assert.deepEqual([...world.blocks], [...same.blocks]);
  for (const type of ['grass', 'dirt', 'stone', 'sand', 'wood', 'leaves', 'water', 'brick', 'glass']) {
    assert.ok([...world.blocks.values()].includes(type), `missing ${type}`);
  }
  assert.equal(BLOCKS.length, 8);
  assert.ok(world.blocks.size > 3000);
  const spawn = world.spawn;
  assert.ok(world.isSolid(Math.floor(spawn.x), Math.floor(spawn.y - 0.05), Math.floor(spawn.z)));
  assert.equal(world.isSolid(Math.floor(spawn.x), Math.floor(spawn.y), Math.floor(spawn.z)), false);
  assert.equal(world.isSolid(Math.floor(spawn.x), Math.floor(spawn.y + 1), Math.floor(spawn.z)), false);
  assert.equal(world.get(0, LIMITS.bottom, 0), 'bedrock');
  assert.equal(world.isSolid(0, LIMITS.top + 1, 0), false);
});
