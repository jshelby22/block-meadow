import { LIMITS } from './world.js';

// A hand-authored voxel statue inspired by the supplied blue toy reference.
// Front elevation, top to bottom. The thumbnail and real build share this data.
export const BUDDY_GLYPHS = Object.freeze({
  B: 'blue-wool', C: 'cyan-wool', Y: 'yellow-wool',
  R: 'red-wool', W: 'white-wool', K: 'black-wool',
});
const front = Object.freeze([
  'B.......B',
  'BBBBBBBBB',
  'BWWBBBWWB',
  'BWKBBBKWB',
  'BRRRRRRRB',
  '.RWKWKWR.',
  '..RRWRR..',
  '...BBB...',
  'BBBBBBBBB',
  'B..CBC..B',
  'B..BBB..B',
  'B.BBBBB.B',
  'B.B...B.B',
  'B.B...B.B',
  'Y.B...B.Y',
  'Y.B...B.Y',
  '..B...B..',
  '.YYY.YYY.',
]);
const blocks = [];
front.forEach((row, rowIndex) => {
  if (row.length !== 9) throw new Error('Blue Buddy rows must be nine blocks wide');
  const y = front.length - rowIndex - 1;
  [...row].forEach((glyph, column) => {
    if (glyph === '.') return;
    const x = column - 4;
    const type = BUDDY_GLYPHS[glyph];
    blocks.push(Object.freeze({ x, y, z: 1, type }));
    const backing = glyph === 'Y' ? type : 'blue-wool';
    blocks.push(Object.freeze({ x, y, z: 0, type: backing }));
    if (y >= 11 || y === 0) blocks.push(Object.freeze({ x, y, z: -1, type: backing }));
  });
});

export const BLUE_BUDDY = Object.freeze({
  id: 'blue-buddy', name: 'Blue Buddy', width: 9, height: front.length, depth: 3,
  front, blocks: Object.freeze(blocks),
});

export function blueprintEntries(blueprint, origin, rotation = 0) {
  if (!Number.isInteger(rotation)) throw new RangeError('Rotation must be a quarter turn');
  const turn = ((rotation % 4) + 4) % 4;
  return blueprint.blocks.map(({ x, y, z, type }) => {
    const [rx, rz] = [[x, z], [z, -x], [-x, -z], [-z, x]][turn];
    return { position: { x: origin.x + rx, y: origin.y + y, z: origin.z + rz }, type };
  });
}

export function findQuickBuildSpot(world, blueprint, player, yaw) {
  const offsets = [0, 0.25, -0.25, 0.5, -0.5, 0.85, -0.85, 1.2, -1.2, Math.PI / 2, -Math.PI / 2, 2, -2, 2.5, -2.5, Math.PI];
  const checked = new Set();
  for (const distance of [21, 19, 23, 17, 15, 13]) {
    for (const offset of offsets) {
      const x = Math.round(player.x - Math.sin(yaw + offset) * distance);
      const z = Math.round(player.z - Math.cos(yaw + offset) * distance);
      const key = `${x},${z}`;
      if (checked.has(key) || x < LIMITS.min || x >= LIMITS.max || z < LIMITS.min || z >= LIMITS.max) continue;
      checked.add(key);
      const y = world.surface(x, z);
      if (y + blueprint.height - 1 > LIMITS.top) continue;
      const dx = player.x - x; const dz = player.z - z;
      const rotation = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 1 : 3) : (dz > 0 ? 0 : 2);
      const origin = { x, y, z };
      const entries = blueprintEntries(blueprint, origin, rotation);
      const supported = entries.filter(entry => entry.position.y === y).every(({ position }) => {
        const ground = world.get(position.x, y - 1, position.z);
        return ['grass', 'sand', 'dirt', 'stone', 'wood', 'brick', 'bedrock'].includes(ground);
      });
      if (!supported) continue;
      // Never replace even water, foliage, or another build to make a prefab fit.
      const clear = entries.every(({ position, type }) =>
        world.get(position.x, position.y, position.z) === null && world.validateEdit(position, type, player).ok);
      if (clear) return { origin, rotation, entries };
    }
  }
  return null;
}
