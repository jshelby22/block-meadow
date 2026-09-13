import test from 'node:test';
import assert from 'node:assert/strict';
import { World, LIMITS } from '../src/world.js';

const emptySpot = { x: 12, y: 7, z: 12 };
const player = { x: 12.5, y: 7, z: 12.5 };

test('creative edits protect the player, bedrock and boundaries, and undo exactly', () => {
  const world = new World();
  assert.equal(typeof world.edit, 'function', 'creative block editing is available');
  const before = [...world.blocks];
  assert.equal(world.edit({ x: 0, y: LIMITS.bottom, z: 0 }, null).ok, false);
  assert.equal(world.edit({ ...emptySpot, x: LIMITS.max }, 'wood').ok, false);
  assert.equal(world.edit({ ...emptySpot, y: LIMITS.top + 1 }, 'wood').ok, false);
  assert.equal(world.edit({ ...emptySpot, x: 1.5 }, 'wood').ok, false);
  assert.equal(world.edit(emptySpot, 'lava').ok, false);
  assert.equal(world.edit(emptySpot, 'wood', player).ok, false);
  assert.deepEqual([...world.blocks], before);
  assert.equal(world.edit(emptySpot, 'brick').ok, true);
  assert.equal(world.get(12, 7, 12), 'brick');
  assert.equal(world.edit(emptySpot, 'glass').ok, false, 'cannot replace an occupied block');
  assert.equal(world.edit(emptySpot, null).ok, true);
  assert.equal(world.get(12, 7, 12), null);
  assert.equal(world.undo().ok, true);
  assert.equal(world.get(12, 7, 12), 'brick');
  assert.equal(world.undo().ok, true);
  assert.equal(world.get(12, 7, 12), null);
  assert.equal(world.undo().ok, false);
});
