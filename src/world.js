export const LIMITS = Object.freeze({ min: -24, max: 24, bottom: -3, top: 28 });

export const BLOCKS = Object.freeze([
  { id: 'grass', name: 'Grass', top: '#8ebe55', side: '#93704a', bottom: '#7a583c' },
  { id: 'dirt', name: 'Earth', top: '#b08b63', side: '#95714f', bottom: '#785539' },
  { id: 'stone', name: 'Stone', top: '#bcc4c2', side: '#949f9b', bottom: '#788881' },
  { id: 'wood', name: 'Wood', top: '#e7c88b', side: '#c59d60', bottom: '#a77b45' },
  { id: 'leaves', name: 'Leaves', top: '#a2c761', side: '#78a345', bottom: '#587e34' },
  { id: 'sand', name: 'Sand', top: '#f0dfac', side: '#d9c491', bottom: '#bda776' },
  { id: 'brick', name: 'Brick', top: '#df9b77', side: '#bf795b', bottom: '#a96348' },
  { id: 'glass', name: 'Glass', top: '#c8e9ec', side: '#9cccd4', bottom: '#7db1bd' },
]);

// Extra colors belong to Quick Builds; keep the familiar eight-slot hotbar.
export const ALL_BLOCKS = Object.freeze([...BLOCKS,
  { id: 'blue-wool', name: 'Blue wool', top: '#5c84ec', side: '#3564ce', bottom: '#234694' },
  { id: 'cyan-wool', name: 'Blue bow tie', top: '#7ed8e3', side: '#57bed6', bottom: '#399cae' },
  { id: 'yellow-wool', name: 'Yellow wool', top: '#ffe071', side: '#f3c64c', bottom: '#cda332' },
  { id: 'red-wool', name: 'Red wool', top: '#eb6b64', side: '#d34a45', bottom: '#a73035' },
  { id: 'white-wool', name: 'White wool', top: '#fffdf1', side: '#f3f0e2', bottom: '#d5dbc9' },
  { id: 'black-wool', name: 'Black wool', top: '#263548', side: '#182536', bottom: '#122031' },
]);

export const keyOf = (x, y, z) => `${x},${y},${z}`;

export const overlapsPlayer = ({ x, y, z }, player) => player &&
  x < player.x + 0.28 && x + 1 > player.x - 0.28 &&
  y < player.y + 1.7 && y + 1 > player.y + 0.01 &&
  z < player.z + 0.28 && z + 1 > player.z - 0.28;

const validPosition = ({ x, y, z }) => [x, y, z].every(Number.isInteger) &&
  x >= LIMITS.min && x < LIMITS.max && z >= LIMITS.min && z < LIMITS.max &&
  y > LIMITS.bottom && y <= LIMITS.top;

export function randomAt(x, z, seed = 42) {
  let n = Math.imul(x + seed, 374761393) + Math.imul(z, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export class World {
  constructor(seed = 42) {
    this.seed = seed;
    this.blocks = new Map();
    this.spawn = { x: 10.5, y: 4, z: 15.5 };
    this.trees = [];
    this.generate();
    this.original = new Map(this.blocks);
    this.changes = new Map();
    this.history = [];
  }

  get(x, y, z) { return this.blocks.get(keyOf(x, y, z)) ?? null; }
  isSolid(x, y, z) { const block = this.get(x, y, z); return block !== null && block !== 'water'; }
  set(x, y, z, type) {
    if (type === null) this.blocks.delete(keyOf(x, y, z));
    else this.blocks.set(keyOf(x, y, z), type);
  }

  validateEdit(position, type, player = null) {
    if (!validPosition(position)) return { ok: false, reason: 'That is the edge of your meadow.' };
    if (type !== null && !ALL_BLOCKS.some(block => block.id === type)) return { ok: false, reason: 'Choose a block from your palette.' };
    const { x, y, z } = position;
    const before = this.get(x, y, z);
    if (before === 'bedrock') return { ok: false, reason: 'This is the bottom of your meadow.' };
    if (type !== null && before !== null && before !== 'water') return { ok: false, reason: 'There is already a block here.' };
    if (before === type) return { ok: false, reason: 'Aim at a block first.' };
    if (type && overlapsPlayer(position, player)) return { ok: false, reason: 'Take a little step back to build here.' };
    return { ok: true, position: { ...position }, before, after: type };
  }

  edit(position, type, player = null) {
    const result = this.validateEdit(position, type, player);
    if (!result.ok) return result;
    this.apply(position, type);
    this.history.push(result);
    if (this.history.length > 100) this.history.shift();
    return result;
  }

  editBatch(entries, player = null) {
    if (!Array.isArray(entries) || entries.length === 0 || entries.length > 1000) return { ok: false, reason: 'Choose a valid quick build.' };
    const edits = [];
    const seen = new Set();
    for (const entry of entries) {
      if (!entry?.position) return { ok: false, reason: 'Choose a valid quick build.' };
      const result = this.validateEdit(entry.position, entry.type, player);
      if (!result.ok) return result;
      const { x, y, z } = entry.position;
      const key = keyOf(x, y, z);
      if (seen.has(key)) return { ok: false, reason: 'This quick build has overlapping blocks.' };
      seen.add(key);
      edits.push(result);
    }
    // Preflight every voxel before touching the world or its undo history.
    for (const edit of edits) this.apply(edit.position, edit.after);
    this.history.push({ edits });
    if (this.history.length > 100) this.history.shift();
    return { ok: true, edits };
  }

  apply({ x, y, z }, type) {
    this.set(x, y, z, type);
    const key = keyOf(x, y, z);
    if ((this.original.get(key) ?? null) === type) this.changes.delete(key);
    else this.changes.set(key, type);
  }

  undo(player = null) {
    const last = this.history.at(-1);
    if (!last) return { ok: false, reason: 'Nothing to undo yet.' };
    const edits = last.edits ?? [last];
    if (edits.some(edit => edit.before && edit.before !== 'water' && overlapsPlayer(edit.position, player))) {
      return { ok: false, reason: 'Take a little step back to undo.' };
    }
    this.history.pop();
    for (const edit of edits) this.apply(edit.position, edit.before);
    if (last.edits) return { ok: true, edits: edits.map(edit => ({ position: edit.position, before: edit.after, after: edit.before })) };
    return { ok: true, position: last.position, before: last.after, after: last.before };
  }

  surface(x, z) {
    for (let y = LIMITS.top; y >= LIMITS.bottom; y--) {
      if (this.isSolid(x, y, z)) return y + 1;
    }
    return LIMITS.bottom;
  }

  serialize() {
    return JSON.stringify({ version: 1, seed: this.seed, changes: [...this.changes] });
  }

  restore(text) {
    try {
      if (typeof text !== 'string' || text.length > 2_000_000) return false;
      const data = JSON.parse(text);
      if (!data || data.version !== 1 || data.seed !== this.seed || !Array.isArray(data.changes) || data.changes.length > 80_000) return false;
      const seen = new Set();
      for (const entry of data.changes) {
        if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string') return false;
        const [key, type] = entry;
        const [x, y, z] = key.split(',').map(Number);
        if (keyOf(x, y, z) !== key || !validPosition({ x, y, z }) || seen.has(key)) return false;
        if (type !== null && type !== 'water' && !ALL_BLOCKS.some(block => block.id === type)) return false;
        seen.add(key);
      }
      // Validate the entire payload before changing a single voxel.
      this.blocks = new Map(this.original);
      this.changes.clear();
      this.history.length = 0;
      for (const [key, type] of data.changes) {
        const [x, y, z] = key.split(',').map(Number);
        this.apply({ x, y, z }, type);
      }
      return true;
    } catch {
      return false;
    }
  }

  terrainHeight(x, z) {
    const edge = Math.max(Math.abs(x + 0.5), Math.abs(z + 0.5));
    if (edge > 22) return 0;
    if (edge > 20) return 1;
    if (edge > 18) return 2;
    if (x < -10 && z < -5) return 3 + Math.floor(Math.max(0, (-x - 10) * 0.17 + (-z - 5) * 0.12));
    return 3;
  }

  generate() {
    for (let x = LIMITS.min; x < LIMITS.max; x++) {
      for (let z = LIMITS.min; z < LIMITS.max; z++) {
        const pond = ((x - 8) / 5) ** 2 + ((z + 6) / 6) ** 2 < 1;
        const height = pond ? 1 : this.terrainHeight(x, z);
        for (let y = LIMITS.bottom; y <= height; y++) {
          const type = y === LIMITS.bottom ? 'bedrock' : y < height - 2 ? 'stone' : y === height ? (pond || height < 2 ? 'sand' : 'grass') : 'dirt';
          this.set(x, y, z, type);
        }
        if (pond) this.set(x, 2, z, 'water');
      }
    }
    // A little starter cottage: an open door and windows, not a quest.
    for (let x = -8; x <= -2; x++) {
      for (let z = -7; z <= -1; z++) {
        this.set(x, 3, z, 'wood');
        for (let y = 4; y <= 6; y++) {
          const wall = x === -8 || x === -2 || z === -7 || z === -1;
          const door = z === -1 && x === -5 && y <= 5;
          const window = y === 5 && ((z === -1 && (x === -7 || x === -3)) || (x === -2 && (z === -5 || z === -3)));
          if (wall && !door) this.set(x, y, z, window ? 'glass' : 'wood');
        }
      }
    }
    for (let x = -9; x <= -1; x++) {
      const roof = 7 + Math.min(x + 9, -1 - x);
      for (let z = -8; z <= 0; z++) this.set(x, roof, z, 'brick');
      for (let y = 7; y < roof; y++) {
        this.set(x, y, -1, 'wood');
        this.set(x, y, -7, 'wood');
      }
    }
    for (let y = 8; y <= 11; y++) this.set(-7, y, -5, 'stone');
    // Curved stepping-stone path and a small pond-side pier.
    for (let z = 0; z < 14; z++) {
      const x = Math.round(-5 + Math.sin(z * 0.2) * 3 + z * 0.35);
      for (let dx = -1; dx <= 1; dx++) this.set(x + dx, 3, z, 'sand');
    }
    for (let x = 6; x <= 8; x++) for (let z = -1; z <= 3; z++) this.set(x, 3, z, 'wood');
    for (const [x, z, tall] of [[-14, 3, 5], [-14, -10, 5], [-18, -3, 4], [-3, -15, 5], [5, -16, 4], [15, -9, 5], [16, 3, 4], [-8, 12, 4], [0, 17, 4], [17, 13, 4]]) {
      const base = this.surface(x, z);
      this.trees.push({ x, y: base, z });
      for (let y = base; y < base + tall; y++) this.set(x, y, z, 'wood');
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
        for (let dy = 0; dy < 3; dy++) {
          if (dy === 2 && (Math.abs(dx) > 1 || Math.abs(dz) > 1)) continue;
          if (dy === 0 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
          this.set(x + dx, base + tall - 1 + dy, z + dz, 'leaves');
        }
      }
    }
    this.spawn.y = this.surface(Math.floor(this.spawn.x), Math.floor(this.spawn.z));
  }
}
