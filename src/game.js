import { BLOCKS, ALL_BLOCKS } from './world.js';
import { BLUE_BUDDY, findQuickBuildSpot } from './blueprints.js';
import { icon } from './ui.js';
import { SoundEffects } from './audio.js';

export const SAVE_KEY = 'block-meadow.world.v1';
const $ = selector => document.querySelector(selector);

export function loadWorld(world) {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    return !saved || world.restore(saved);
  } catch { return false; }
}

export function createGameplay(world, view, player, canSave) {
  const canvas = view.canvas;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const keys = new Set();
  const sound = new SoundEffects();
  let started = false;
  let active = false;
  let selected = 0;
  let saveTimer;
  let toastTimer;
  let drag = null;
  let lastAim = 0;
  let target = null;
  let lastAction = 0;
  let lastTime = performance.now();
  let elapsed = 0;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  function toast(message, duration = 2600) {
    clearTimeout(toastTimer);
    $('#toast').textContent = message;
    $('#toast').classList.add('visible');
    toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), duration);
  }

  function save() {
    clearTimeout(saveTimer);
    if (!canSave) {
      $('#save-text').textContent = 'Not saving · see help';
      $('#save-state').classList.add('error');
      return false;
    }
    try {
      const data = world.serialize();
      localStorage.setItem(SAVE_KEY, data);
      if (localStorage.getItem(SAVE_KEY) !== data) throw new Error('Save did not persist');
      $('#save-text').textContent = 'Saved on this device';
      $('#save-state').classList.remove('error');
      return true;
    } catch {
      $('#save-text').textContent = 'Not saved · browser storage';
      $('#save-state').classList.add('error');
      toast('Your browser could not save. Keep this tab open.', 6000);
      return false;
    }
  }

  function scheduleSave() {
    $('#save-text').textContent = 'Saving…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 200);
  }

  function select(index) {
    selected = (index + BLOCKS.length) % BLOCKS.length;
    document.querySelectorAll('.block-slot').forEach((slot, i) => {
      slot.classList.toggle('selected', i === selected);
      slot.setAttribute('aria-pressed', String(i === selected));
    });
    $('#selected-name').textContent = BLOCKS[selected].name;
  }

  function aim() {
    view.follow(player);
    target = view.aim();
    $('#target-label').textContent = target ? ALL_BLOCKS.find(block => block.id === target.type)?.name ?? 'Meadow foundation' : '';
    return target;
  }

  function changed(result, undo = false) {
    if (!result.ok) { toast(result.reason); return; }
    view.rebuild();
    aim();
    $('#undo-button').disabled = world.history.length === 0;
    scheduleSave();
    sound.play(undo ? 'undo' : (result.edits ?? [result]).some(edit => edit.after) ? 'build' : 'break');
    if (undo) toast('Last change undone.');
  }

  function edit(build) {
    if (!active || performance.now() - lastAction < 130) return;
    lastAction = performance.now();
    const hit = aim();
    if (!hit) { toast('Move closer and aim at a block.'); return; }
    changed(world.edit(build ? hit.place : hit.position, build ? BLOCKS[selected].id : null, player.position));
  }

  function undo() {
    if (!active) return;
    changed(world.undo(player.position), true);
  }

  function quickBuild() {
    if (!active || performance.now() - lastAction < 400) return;
    lastAction = performance.now();
    const spot = findQuickBuildSpot(world, BLUE_BUDDY, player.position, player.yaw);
    if (!spot) { toast('Blue Buddy needs a flat, open space. Try another part of the meadow.', 5000); return; }
    const result = world.editBatch(spot.entries, player.position);
    if (!result.ok) { toast(result.reason); return; }
    releaseInput();
    // Face the finished statue without moving the player or altering terrain.
    const dx = spot.origin.x + 0.5 - player.position.x;
    const dz = spot.origin.z + 0.5 - player.position.z;
    const distance = Math.hypot(dx, dz);
    view.follow(player);
    const bottom = spot.origin.y - view.camera.position.y;
    player.yaw = Math.atan2(-dx, -dz);
    player.pitch = (Math.atan2(bottom, distance) + Math.atan2(bottom + BLUE_BUDDY.height, distance)) / 2;
    changed(result);
    canvas.focus({ preventScroll: true });
    toast('Blue Buddy is built! Undo removes the whole statue.', 4500);
  }

  function releaseInput() { keys.clear(); drag = null; }

  function lockMouse() {
    if (coarse || document.pointerLockElement === canvas) return;
    try {
      const request = canvas.requestPointerLock?.();
      request?.catch(() => {
        if (active) toast('Drag to look around, or use the arrow keys.', 4500);
      });
    } catch { toast('Drag to look around, or use the arrow keys.', 4500); }
  }

  function start() {
    started = true;
    active = true;
    releaseInput();
    document.body.classList.add('playing');
    $('#welcome').hidden = true;
    canvas.focus({ preventScroll: true });
    view.follow(player);
    lockMouse();
    toast(coarse ? 'Drag to look. Tap Build to place your first block.' : 'Make yourself at home. Press Esc whenever you need your cursor.', 5000);
  }

  function pause() {
    if (!started || !active) return;
    active = false;
    releaseInput();
    save();
    if (document.pointerLockElement) document.exitPointerLock();
    if (!document.querySelector('dialog[open]')) $('#pause-dialog').showModal();
  }

  function resume() {
    for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
    if (!started) return;
    active = true;
    releaseInput();
    canvas.focus({ preventScroll: true });
    lockMouse();
  }

  function showHelp() {
    active = false;
    releaseInput();
    save();
    if (document.pointerLockElement) document.exitPointerLock();
    for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
    $('#help-dialog').showModal();
  }

  function updateFlyControls() {
    $('#fly-button').setAttribute('aria-pressed', String(player.flying));
    $('#jump-label').textContent = player.flying ? 'Up · Shift down' : 'Jump';
    $('#touch-jump span').textContent = player.flying ? 'Up' : 'Jump';
    $('#touch-down').hidden = !player.flying;
  }

  function fly() {
    if (!active) return;
    player.toggleFly();
    updateFlyControls();
    toast(player.flying ? (coarse ? 'Flying! Use Up and Down to change height.' : 'Flying! Space to rise, Shift to come down.') : 'Back on your feet.');
  }

  function home() {
    if (!active) return;
    player.respawn();
    player.yaw = 0.62;
    player.pitch = -0.10;
    updateFlyControls();
    view.follow(player);
    toast('Back to your sunny starting spot.');
  }

  $('#play-button').innerHTML = `Let’s play ${icon('arrow')}`;
  $('#play-button').disabled = false;
  $('#play-button').addEventListener('click', start);
  $('#pause-button').addEventListener('click', pause);
  $('#resume-button').addEventListener('click', resume);
  $('#help-button').addEventListener('click', showHelp);
  $('#pause-help').addEventListener('click', showHelp);
  document.querySelectorAll('.dialog-close').forEach(button => button.addEventListener('click', () => { $('#help-dialog').close(); resume(); }));
  $('#fly-button').addEventListener('click', fly);
  $('#undo-button').addEventListener('click', undo);
  $('#home-button').addEventListener('click', home);
  $('#quick-build-button').addEventListener('click', quickBuild);
  $('#sound-button').addEventListener('click', async () => {
    const button = $('#sound-button');
    button.disabled = true;
    try {
      const enabled = await sound.toggle();
      button.innerHTML = icon(enabled ? 'sound' : 'muted');
      button.setAttribute('aria-pressed', String(enabled));
      button.setAttribute('aria-label', enabled ? 'Turn sound off' : 'Turn sound on');
      button.title = enabled ? 'Sound on' : 'Sound off';
    } catch { toast('Sound is not available in this browser. You can still play.'); }
    button.disabled = false;
  });
  $('#fullscreen-button').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else toast('Full screen is not available here.');
    } catch { toast('Full screen is not available here. Try opening the game in its own tab.'); }
  });
  document.addEventListener('fullscreenchange', () => {
    $('#fullscreen-button').setAttribute('aria-label', document.fullscreenElement ? 'Exit full screen' : 'Enter full screen');
    view.resize();
  });
  for (const dialog of [$('#help-dialog'), $('#pause-dialog')]) {
    dialog.addEventListener('cancel', event => { event.preventDefault(); dialog.close(); resume(); });
  }
  $('#reset-button').addEventListener('click', () => {
    $('#help-dialog').close();
    $('#reset-dialog').showModal();
  });
  function cancelReset() { $('#reset-dialog').close(); $('#help-dialog').showModal(); }
  $('#cancel-reset').addEventListener('click', cancelReset);
  $('#reset-dialog').addEventListener('cancel', event => { event.preventDefault(); cancelReset(); });
  $('#confirm-reset').addEventListener('click', () => {
    clearTimeout(saveTimer);
    world.restore(JSON.stringify({ version: 1, seed: world.seed, changes: [] }));
    player.respawn();
    player.yaw = 0.62;
    player.pitch = -0.10;
    updateFlyControls();
    releaseInput();
    started = active = false;
    elapsed = 0;
    target = null;
    view.rebuild();
    view.outline.visible = false;
    view.overlook();
    select(0);
    $('#undo-button').disabled = true;
    $('#reset-dialog').close();
    document.body.classList.remove('playing');
    $('#welcome').hidden = false;
    canSave = true;
    if (save()) {
      $('.privacy-note span').textContent = 'Your world saves automatically in this browser. No accounts, chat, ads, or purchases.';
      toast('A fresh meadow, ready for you.');
    }
    $('#play-button').focus();
  });
  $('.brand').addEventListener('click', event => { event.preventDefault(); if (started) pause(); });
  document.querySelectorAll('.block-slot').forEach((button, i) => button.addEventListener('click', () => select(i)));

  document.addEventListener('keydown', event => {
    if (event.code === 'Escape') { if (active) { event.preventDefault(); pause(); } return; }
    if (document.querySelector('dialog[open]')) return;
    if (/^Digit[1-8]$/.test(event.code)) { select(Number(event.code.slice(-1)) - 1); return; }
    if (!active) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(event.code)) event.preventDefault();
    if (event.code === 'Tab') { pause(); return; }
    keys.add(event.code);
    if (event.repeat) return;
    if (event.code === 'KeyF') fly();
    if (event.code === 'KeyZ') undo();
    if (event.code === 'KeyH') home();
    if (event.code === 'KeyB') quickBuild();
    if (event.code === 'KeyQ') edit(false);
    if (event.code === 'KeyE') edit(true);
  });
  document.addEventListener('keyup', event => keys.delete(event.code));
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && active) pause(); });
  document.addEventListener('pointerlockerror', () => { if (active) toast('Drag to look, or use the arrow keys.', 4500); });
  document.addEventListener('mousemove', event => {
    if (active && document.pointerLockElement === canvas) player.look(event.movementX, event.movementY);
  });
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  canvas.addEventListener('pointerdown', event => {
    if (!active) return;
    if (document.pointerLockElement === canvas) { if (event.button === 0 || event.button === 2) edit(event.button === 2); return; }
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: 0, type: event.pointerType, button: event.button };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!active || !drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x; const dy = event.clientY - drag.y;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    player.look(dx * (coarse ? 1.7 : 1), dy * (coarse ? 1.7 : 1));
    drag.x = event.clientX; drag.y = event.clientY;
  });
  canvas.addEventListener('pointerup', event => {
    if (drag?.id !== event.pointerId) return;
    const click = drag.moved < 5 && drag.type === 'mouse';
    const button = drag.button;
    drag = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (click && (button === 0 || button === 2)) edit(button === 2);
  });
  canvas.addEventListener('pointercancel', () => { drag = null; });
  window.addEventListener('wheel', event => {
    if (!active || event.target.closest('dialog')) return;
    event.preventDefault();
    if (Math.abs(event.deltaY) > 2) select(selected + Math.sign(event.deltaY));
  }, { passive: false });
  window.addEventListener('blur', pause);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('pagehide', () => { if (saveTimer) save(); });
  window.addEventListener('resize', () => { view.resize(); if (!started) view.overlook(); });

  const movementCodes = { forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD' };
  function hold(button, key) {
    button.addEventListener('pointerdown', event => {
      if (!active) return;
      event.preventDefault();
      keys.add(key);
      button.setPointerCapture(event.pointerId);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, () => keys.delete(key));
  }
  document.querySelectorAll('[data-move]').forEach(button => hold(button, movementCodes[button.dataset.move]));
  hold($('#touch-jump'), 'Space');
  hold($('#touch-down'), 'ShiftLeft');
  $('#touch-build').addEventListener('click', () => edit(true));
  $('#touch-break').addEventListener('click', () => edit(false));

  function animate(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    if (active) {
      elapsed += dt;
      const arrowX = Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft'));
      const arrowY = Number(keys.has('ArrowDown')) - Number(keys.has('ArrowUp'));
      player.look(arrowX * dt * 650, arrowY * dt * 650);
      player.update(dt, {
        forward: Number(keys.has('KeyW')) - Number(keys.has('KeyS')),
        right: Number(keys.has('KeyD')) - Number(keys.has('KeyA')),
        jump: keys.has('Space'), down: keys.has('ShiftLeft') || keys.has('ShiftRight'),
        sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'),
      });
      view.follow(player);
      if (now - lastAim > 75) { aim(); lastAim = now; }
    }
    view.render(elapsed, reducedMotion.matches || (started && !active));
    requestAnimationFrame(animate);
  }

  if (!canSave) {
    $('.privacy-note span').textContent = 'Saving is unavailable or an existing save could not be read. That save has not been changed. Keep this tab open; a fresh meadow can be started below.';
  }
  save();
  requestAnimationFrame(animate);
  // Read-only diagnostics for browser QA. No hidden gameplay shortcuts.
  if (import.meta.env.DEV) {
    window.meadow = Object.freeze({ snapshot: () => ({
      started, active, selected: BLOCKS[selected].id, position: { ...player.position },
      flying: player.flying, grounded: player.grounded, target,
      changes: [...world.changes], undoCount: world.history.length,
      audioState: sound.context?.state ?? 'uninitialized',
      drawCalls: view.renderer.info.render.calls,
    }) });
  }
  return { toast, save, pause, resume, showHelp, get active() { return active; }, get started() { return started; } };
}
