import test from 'node:test';
import assert from 'node:assert/strict';
import { World, LIMITS } from '../src/world.js';

const entries = [
  { position: { x: 11, y: 7, z: 12 }, type: 'wood' },
  { position: { x: 12, y: 7, z: 12 }, type: 'brick' },
];

test('a quick build is all-or-nothing and undoes as one action', () => {
  const world = new World();
  assert.equal(typeof world.editBatch, 'function');
  const original = world.serialize();
  for (const bad of [
    [...entries, { position: { x: 0, y: LIMITS.bottom, z: 0 }, type: null }],
    [...entries, { position: { x: LIMITS.max, y: 7, z: 12 }, type: 'wood' }],
    [...entries, { position: { x: 13, y: 7, z: 12 }, type: 'invalid' }],
    [entries[0], entries[0]],
  ]) {
    assert.equal(world.editBatch(bad).ok, false);
    assert.equal(world.serialize(), original);
    assert.equal(world.history.length, 0);
  }
  assert.equal(world.editBatch(entries, { x: 12.5, y: 7, z: 12.5 }).ok, false);
  assert.equal(world.serialize(), original);
  assert.equal(world.editBatch(entries).ok, true);
  assert.equal(world.history.length, 1);
  assert.equal(world.changes.size, entries.length);
  assert.equal(world.get(11, 7, 12), 'wood');
  assert.equal(world.get(12, 7, 12), 'brick');
  assert.equal(world.undo().ok, true);
  assert.equal(world.serialize(), original);
  assert.equal(world.history.length, 0);
});
