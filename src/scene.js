import * as THREE from 'three';
import { ALL_BLOCKS, randomAt } from './world.js';

const NEIGHBORS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const cube = new THREE.BoxGeometry(1, 1, 1);
const dummy = new THREE.Object3D();
const palette = [...ALL_BLOCKS,
  { id: 'water', top: '#7fc6cc', side: '#70b9c5', bottom: '#5ba9b7' },
  { id: 'bedrock', top: '#71817a', side: '#617169', bottom: '#56635e' },
];

function pixelTexture(block, face) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 16;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = block[face];
  ctx.fillRect(0, 0, 16, 16);
  for (let i = 0; i < 60; i++) {
    const x = Math.floor(randomAt(i, 2) * 16);
    const y = Math.floor(randomAt(i, 3) * 16);
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,.075)' : 'rgba(40,45,20,.065)';
    ctx.fillRect(x, y, 1 + (i % 3), 1);
  }
  if (block.id === 'grass' && face === 'side') {
    ctx.fillStyle = '#83ab51'; ctx.fillRect(0, 0, 16, 4);
    for (let x = 0; x < 16; x++) ctx.fillRect(x, 4, 1, Math.floor(randomAt(x, 9) * 4));
  }
  if (block.id === 'wood') {
    ctx.fillStyle = 'rgba(94,63,26,.18)';
    if (face === 'side') for (let y = 3; y < 16; y += 4) ctx.fillRect(0, y, 16, 1);
    else { ctx.strokeStyle = 'rgba(110,76,28,.2)'; ctx.strokeRect(3, 3, 10, 10); ctx.strokeRect(6, 6, 4, 4); }
  }
  if (block.id === 'brick') {
    ctx.fillStyle = 'rgba(255,227,183,.35)';
    for (let y = 3; y < 16; y += 4) {
      ctx.fillRect(0, y, 16, 1);
      for (let x = (y % 8 === 3 ? 4 : 0); x < 16; x += 8) ctx.fillRect(x, y - 3, 1, 3);
    }
  }
  if (block.id === 'glass') {
    ctx.strokeStyle = '#d9f0eb'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, 14, 14);
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(4, 4, 2, 4); ctx.fillRect(6, 2, 2, 3);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapLinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class MeadowScene {
  constructor(world, canvas) {
    this.world = world;
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#bddde0');
    this.scene.fog = new THREE.Fog('#bddde0', 46, 125);
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.05, 180);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(new THREE.HemisphereLight('#eff9ff', '#a09e66', 2.1));
    const sun = new THREE.DirectionalLight('#fff2d3', 2.6);
    sun.position.set(-24, 42, 22);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38, near: 1, far: 105 });
    sun.shadow.normalBias = 0.035;
    sun.shadow.bias = -0.0002;
    this.scene.add(sun);
    this.materials = new Map(palette.map(block => {
      const material = face => new THREE.MeshLambertMaterial({
        map: pixelTexture(block, face),
        transparent: block.id === 'water' || block.id === 'glass',
        opacity: block.id === 'water' ? 0.72 : block.id === 'glass' ? 0.64 : 1,
        depthWrite: block.id !== 'water' && block.id !== 'glass',
      });
      const side = material('side');
      return [block.id, [side, side, material('top'), material('bottom'), side, side]];
    }));
    this.terrain = new THREE.Group();
    this.scene.add(this.terrain);
    this.targets = [];
    this.clouds = [];
    this.sheep = [];
    this.flowers = [];
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 7;
    this.center = new THREE.Vector2(0, 0);
    this.outline = new THREE.LineSegments(new THREE.EdgesGeometry(cube), new THREE.LineBasicMaterial({ color: '#fffbed', transparent: true, opacity: 0.9 }));
    this.outline.scale.setScalar(1.008);
    this.outline.visible = false;
    this.scene.add(this.outline);
    this.rebuild();
    this.addScenery();
    this.addSheep(-1, 6, 0.4);
    this.addSheep(5, 10, -0.5);
    this.addSheep(-11, -1, 2.2);
    this.resize();
    this.overlook();
    this.render(0);
    canvas.dataset.ready = 'true';
  }

  rebuild() {
    this.renderer.shadowMap.needsUpdate = true;
    for (const mesh of [...this.terrain.children]) { this.terrain.remove(mesh); mesh.dispose(); }
    this.targets = [];
    const grouped = new Map(palette.map(block => [block.id, []]));
    for (const [key, type] of this.world.blocks) {
      const [x, y, z] = key.split(',').map(Number);
      if (!NEIGHBORS.some(([dx, dy, dz]) => {
        const neighbor = this.world.get(x + dx, y + dy, z + dz);
        return !neighbor || (neighbor !== type && (neighbor === 'water' || neighbor === 'glass'));
      })) continue;
      grouped.get(type)?.push({ x, y, z });
    }
    for (const [type, positions] of grouped) {
      if (!positions.length) continue;
      const mesh = new THREE.InstancedMesh(cube, this.materials.get(type), positions.length);
      mesh.userData = { positions, type };
      mesh.castShadow = type !== 'water' && type !== 'glass';
      mesh.receiveShadow = true;
      const color = new THREE.Color();
      positions.forEach(({ x, y, z }, i) => {
        dummy.position.set(x + 0.5, y + 0.5, z + 0.5);
        dummy.scale.set(1, type === 'water' ? 0.82 : 1, 1);
        dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
        const tint = 0.9 + randomAt(x + y, z) * 0.1;
        color.setRGB(tint, tint, tint); mesh.setColorAt(i, color);
      });
      mesh.computeBoundingSphere();
      this.terrain.add(mesh);
      if (type !== 'water') this.targets.push(mesh);
    }
    for (const flower of this.flowers ?? []) {
      const { x, y, z } = flower.userData;
      flower.visible = this.world.get(x, y - 1, z) === 'grass' && !this.world.get(x, y, z);
    }
  }

  box(parent, x, y, z, width, height, depth, color, shadow = false) {
    const mesh = new THREE.Mesh(cube, new THREE.MeshLambertMaterial({ color }));
    mesh.position.set(x, y, z); mesh.scale.set(width, height, depth);
    mesh.castShadow = shadow; mesh.receiveShadow = true; parent.add(mesh);
    return mesh;
  }

  addScenery() {
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshLambertMaterial({ color: '#99c9ca' }));
    sea.rotation.x = -Math.PI / 2; sea.position.y = 0.25; sea.receiveShadow = true;
    this.scene.add(sea);
    for (let i = 0; i < 12; i++) {
      const cloud = new THREE.Group();
      const x = randomAt(i, 3, 72) * 160 - 80;
      const z = randomAt(i, 4, 72) * 140 - 90;
      cloud.position.set(x, 24 + randomAt(i, 5, 72) * 12, z);
      for (let j = 0; j < 5; j++) this.box(cloud, j * 2.4 - 4.8, (j % 2) * 0.6, (j % 3) * 1.4, 4.5, 1.4 + (j % 2), 3.2, '#fffdf2');
      this.scene.add(cloud); this.clouds.push(cloud);
    }
    for (let i = 0; i < 13; i++) {
      const x = -100 + i * 16;
      this.box(this.scene, x, -1, -72 - randomAt(i, 1) * 12, 18, 7 + randomAt(i, 2) * 12, 15, '#a0bfa7');
    }
    const stemMaterial = new THREE.MeshLambertMaterial({ color: '#698f44' });
    const colors = ['#fff4bd', '#edb189', '#eee9db', '#c7b8cd'];
    for (let x = -18; x <= 18; x++) for (let z = -18; z <= 18; z++) {
      if (randomAt(x, z, 17) > 0.1) continue;
      const y = this.world.surface(x, z);
      if (this.world.get(x, y - 1, z) !== 'grass') continue;
      const flower = new THREE.Group();
      flower.position.set(x + 0.5, y, z + 0.5);
      flower.userData = { x, y, z };
      const stem = new THREE.Mesh(cube, stemMaterial);
      stem.scale.set(0.055, 0.35, 0.055); stem.position.y = 0.17; flower.add(stem);
      this.box(flower, 0, 0.36, 0, 0.24, 0.14, 0.24, colors[Math.floor(randomAt(x, z, 32) * colors.length)]);
      this.box(flower, 0.10, 0.12, 0, 0.18, 0.07, 0.10, '#86a850');
      this.scene.add(flower); this.flowers.push(flower);
    }
    // Small lily pads sit on the pond; they are scenery, never obstacles.
    for (const [x, z] of [[6, -5], [10, -8], [7, -9]]) {
      this.box(this.scene, x + 0.3, 2.92, z + 0.5, 0.65, 0.035, 0.6, '#85ae63');
      this.box(this.scene, x + 0.2, 3.01, z + 0.5, 0.18, 0.14, 0.18, '#f1cdcd');
    }
  }

  addSheep(x, z, rotation) {
    const sheep = new THREE.Group();
    sheep.position.set(x + 0.5, this.world.surface(x, z), z + 0.5);
    sheep.rotation.y = rotation;
    this.box(sheep, 0, 0.67, 0, 0.76, 0.7, 1.05, '#f6f2de', true);
    this.box(sheep, 0, 0.96, -0.63, 0.43, 0.46, 0.48, '#ddd1b4', true);
    this.box(sheep, 0, 1.17, -0.57, 0.48, 0.16, 0.41, '#f7f3e4', true);
    for (const side of [-1, 1]) {
      this.box(sheep, side * 0.17, 1.0, -0.877, 0.055, 0.075, 0.015, '#343e30');
      this.box(sheep, side * 0.29, 1.04, -0.60, 0.16, 0.11, 0.21, '#d5bba0');
    }
    const legs = [];
    for (const dx of [-0.23, 0.23]) for (const dz of [-0.32, 0.32]) legs.push(this.box(sheep, dx, 0.20, dz, 0.16, 0.40, 0.17, '#a39172', true));
    sheep.userData = { x: x + 0.5, z: z + 0.5, phase: rotation, legs };
    this.scene.add(sheep); this.sheep.push(sheep);
  }

  resize() {
    const { clientWidth: width, clientHeight: height } = this.canvas;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  overlook() {
    const portrait = this.camera.aspect < 1;
    this.camera.position.set(portrait ? 31 : 30, portrait ? 27 : 23, portrait ? 38 : 32);
    this.camera.lookAt(portrait ? -1 : -6, 3.5, portrait ? -1 : 0);
  }

  aim() {
    this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(this.center, this.camera);
    const hit = this.raycaster.intersectObjects(this.targets, false)[0];
    this.outline.visible = Boolean(hit);
    if (!hit) return null;
    const position = hit.object.userData.positions[hit.instanceId];
    this.outline.position.set(position.x + 0.5, position.y + 0.5, position.z + 0.5);
    const normal = hit.face.normal;
    return {
      position: { ...position },
      place: { x: position.x + Math.round(normal.x), y: position.y + Math.round(normal.y), z: position.z + Math.round(normal.z) },
      type: this.world.get(position.x, position.y, position.z),
      distance: hit.distance,
    };
  }

  follow(player) {
    const { x, y, z } = player.position;
    this.camera.position.set(x, y + 1.55, z);
    this.camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  }

  render(time, reducedMotion = false) {
    if (!reducedMotion && time - (this.lastShadowUpdate ?? 0) > 1) {
      this.renderer.shadowMap.needsUpdate = true;
      this.lastShadowUpdate = time;
    }
    if (!reducedMotion) {
      for (let i = 0; i < this.clouds.length; i++) this.clouds[i].position.x += 0.0012;
    }
    for (const sheep of this.sheep) {
      const data = sheep.userData;
      const walk = reducedMotion ? 0 : Math.sin(time * 0.3 + data.phase) * 0.65;
      const x = data.x + walk;
      const z = data.z + walk * 0.5;
      const y = this.world.surface(Math.floor(x), Math.floor(z));
      const ground = this.world.get(Math.floor(x), y - 1, Math.floor(z));
      // Hide a sheep if its patch was built over or dug away; never let it clip into a build.
      sheep.visible = (ground === 'grass' || ground === 'sand') && y >= 2 && y <= 7;
      if (sheep.visible) {
        sheep.position.set(x, y, z);
        data.legs.forEach((leg, i) => { leg.rotation.x = reducedMotion ? 0 : Math.sin(time * 2.2 + i * Math.PI) * 0.10; });
      }
    }
    this.renderer.render(this.scene, this.camera);
  }
}
