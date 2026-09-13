import './style.css';
import { World } from './world.js';
import { MeadowScene } from './scene.js';
import { Player } from './player.js';
import { createGameplay, loadWorld } from './game.js';
import { markup } from './ui.js';

const app = document.querySelector('#app');
app.innerHTML = markup();
const world = new World();
const canSave = loadWorld(world);
const canvas = document.querySelector('#game-canvas');

try {
  const view = new MeadowScene(world, canvas);
  const player = new Player(world);
  player.respawn();
  createGameplay(world, view, player, canSave);
} catch (error) {
  console.error(error);
  const message = document.createElement('section');
  message.id = 'fatal-error';
  message.innerHTML = '<h2>Your meadow needs WebGL.</h2><p>Try a current version of Chrome, Safari, Firefox, or Edge with hardware acceleration enabled.</p>';
  app.append(message);
  document.querySelector('#welcome').hidden = true;
}
