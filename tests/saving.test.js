import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/world.js';

test('browser-save data round-trips placed and removed blocks without trusting malformed saves', () => {
  const world = new World();
  assert.equal(typeof world.serialize, 'function', 'save serialization is available');
  world.edit({ x: 12, y: 7, z: 12 }, 'glass');
  world.edit({ x: 10, y: 3, z: 10 }, null);
  const saved = world.serialize();
  const loaded = new World();
  assert.equal(loaded.restore(saved), true);
  assert.deepEqual([...loaded.changes], [...world.changes]);
  assert.equal(loaded.get(12, 7, 12), 'glass');
  assert.equal(loaded.get(10, 3, 10), null);
  const unchanged = [...loaded.blocks];
  for (const invalid of ['bad json', '{}', 'null', JSON.stringify({ version: 900, seed: 42, changes: [] }),
    JSON.stringify({ version: 1, seed: 42, changes: [['12,7,12', 'lava']] }),
    JSON.stringify({ version: 1, seed: 42, changes: [['0,-3,0', null]] }),
    JSON.stringify({ version: 1, seed: 42, changes: [['12.5,7,12', 'wood']] }),
    JSON.stringify({ version: 1, seed: 42, changes: [['1,7,1', 'wood'], ['24,7,1', 'stone']] }),
    JSON.stringify({ version: 1, seed: 42, changes: [['1,7,1', 'wood'], ['1,7,1', 'glass']] })]) {
    assert.equal(loaded.restore(invalid), false);
    assert.deepEqual([...loaded.blocks], unchanged, 'invalid saves do not partially modify the world');
  }
  assert.equal(loaded.history.length, 0, 'reload does not invent undo history');
});
