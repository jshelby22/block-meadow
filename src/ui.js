import { BLOCKS, ALL_BLOCKS } from './world.js';
import { BLUE_BUDDY, BUDDY_GLYPHS } from './blueprints.js';

const paths = {
  leaf: '<path d="M20 4c-9-1-16 2-16 9a6 6 0 0 0 6 6c7 0 10-7 10-15Z"/><path d="m4 20 10-10"/>',
  sound: '<path d="m11 5-6 4H2v6h3l6 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  muted: '<path d="m11 5-6 4H2v6h3l6 4V5Z"/><path d="m16 9 6 6m0-6-6 6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .5-1.5 1-1.5 2m0 3h.01"/>',
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  undo: '<path d="m9 4-6 6 6 6M3 10h11a6 6 0 0 1 0 12"/>',
  fly: '<path d="m3 14 18-9-7 17-3-8-8-3 18-6m-10 9 10-9"/>',
  home: '<path d="m3 10 9-7 9 7v11h-6v-7H9v7H3V10Z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  mouse: '<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 2v7m-6 1h12"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
};

export const icon = name => `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] ?? paths.leaf}</svg>`;
export const blockIcon = block => `<svg class="block-icon" viewBox="0 0 48 52" aria-hidden="true"><path d="m3 14 21-12 21 12-21 12Z" fill="${block.top}"/><path d="m3 14 21 12v24L3 38Z" fill="${block.side}"/><path d="m24 26 21-12v24L24 50Z" fill="${block.bottom}"/>${block.id === 'grass' ? '<path d="m3 14 21 12v7L3 21Z" fill="#7da749"/><path d="m24 26 21-12v7L24 33Z" fill="#648e39"/>' : ''}${block.id === 'wood' ? '<path d="m4 24 19 11m-19-3 19 11m3-8 18-10m-18 18 18-10" stroke="#8f683b" opacity=".35"/>' : ''}${block.id === 'glass' ? '<path d="m8 24 5 3v9l-5-3m21 0 6-3v8l-6 4" fill="white" opacity=".5"/>' : ''}</svg>`;

export function markup() {
  const buddyIcon = `<svg class="buddy-icon" viewBox="0 0 9 7" aria-hidden="true" shape-rendering="crispEdges">${BLUE_BUDDY.front.slice(0, 7).map((row, y) => [...row].map((glyph, x) => glyph === '.' ? '' : `<rect x="${x}" y="${y}" width="1" height="1" fill="${ALL_BLOCKS.find(block => block.id === BUDDY_GLYPHS[glyph]).side}"/>`).join('')).join('')}</svg>`;
  return `
    <canvas id="game-canvas" aria-label="Interactive 3D block meadow. Use WASD to move and mouse or arrow keys to look." tabindex="0"></canvas>
    <div class="vignette" aria-hidden="true"></div>
    <header class="topbar">
      <a class="brand" href="#" aria-label="Block Meadow home">${blockIcon(BLOCKS[0])}<span>block<span class="brand-bottom">meadow<span class="brand-dot">.</span></span></span></a>
      <div class="mode-badge">${icon('leaf')}<span>CREATIVE MODE</span></div>
      <div class="top-actions">
        <span id="save-state" class="save-state" role="status"><span class="status-dot"></span><span id="save-text">Saves on this device</span></span>
        <button id="sound-button" class="icon-button" aria-label="Turn sound on" title="Sound off" aria-pressed="false">${icon('muted')}</button>
        <button id="fullscreen-button" class="icon-button" aria-label="Enter full screen" title="Full screen">${icon('expand')}</button>
        <button id="help-button" class="icon-button" aria-label="How to play" title="How to play">${icon('help')}</button>
        <button id="pause-button" class="icon-button playing-only" aria-label="Pause game" title="Pause (Esc)">${icon('pause')}</button>
      </div>
    </header>
    <section id="welcome" class="welcome-panel">
      <div class="eyebrow"><span class="little-sun">${icon('sun')}</span>A SMALL WORLD. ALL YOURS.</div>
      <h1>Your own<br>little world<span>.</span></h1>
      <p>A sunny meadow, a pocket full of blocks, and whatever you can imagine.</p>
      <button id="play-button" class="primary-button" disabled>Growing your meadow…</button>
      <div class="welcome-note">${icon('leaf')}No monsters. No rush. Just play.</div>
    </section>
    <div id="crosshair" class="crosshair playing-only" aria-hidden="true"><i></i><i></i></div>
    <div id="target-label" class="target-label playing-only"></div>
    <aside class="world-label"><span class="sun-symbol">${icon('sun')}</span><span><strong>Sunny Meadow</strong><small>A peaceful place to create</small></span></aside>
    <nav class="build-tools playing-only" aria-label="Building tools">
      <button id="fly-button" class="tool-button" aria-pressed="false">${icon('fly')}<span>Fly</span><kbd>F</kbd></button>
      <button id="undo-button" class="tool-button" disabled>${icon('undo')}<span>Undo</span><kbd>Z</kbd></button>
      <button id="home-button" class="tool-button" title="Return to a safe spot">${icon('home')}<span>Go home</span><kbd>H</kbd></button>
    </nav>
    <button id="quick-build-button" class="tool-button quick-build-button playing-only" aria-label="Quick build Blue Buddy" title="Build a Blue Buddy statue in a clear spot (B)">${buddyIcon}<span><strong>Quick build</strong><small>Blue Buddy</small></span><kbd>B</kbd></button>
    <div class="desktop-controls"><div><span class="key-cluster"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><span>Move</span><kbd>SPACE</kbd><span id="jump-label">Jump</span></div><div>${icon('mouse')}<span><b>Left</b> break</span><span class="control-dot">·</span><span><b>Right</b> build</span><kbd>ESC</kbd><span>Pause</span></div></div>
    <section class="inventory" aria-label="Unlimited building blocks">
      <div class="inventory-caption"><span>YOUR BUILDING BLOCKS</span><span class="infinite">∞ <span>unlimited</span></span></div>
      <div class="hotbar" role="toolbar" aria-label="Choose a building block">${BLOCKS.map((block, i) => `<button class="block-slot ${i === 0 ? 'selected' : ''}" data-block="${block.id}" aria-label="${block.name}, block ${i + 1}" aria-pressed="${i === 0}"><span class="slot-number">${i + 1}</span>${blockIcon(block)}<span class="slot-name">${block.name}</span></button>`).join('')}</div>
      <div class="inventory-hint"><span id="selected-name">Grass</span><span>Scroll or press 1–8 to choose</span></div>
    </section>
    <div id="toast" class="toast" role="status" aria-live="polite"></div>
    <div id="touch-controls" class="touch-controls playing-only">
      <div class="dpad" aria-label="Movement controls"><button data-move="forward" aria-label="Move forward">↑</button><button data-move="left" aria-label="Move left">←</button><button data-move="back" aria-label="Move backward">↓</button><button data-move="right" aria-label="Move right">→</button></div>
      <div class="touch-actions"><button id="touch-jump" aria-label="Jump or fly up">↑<span>Jump</span></button><button id="touch-down" aria-label="Fly down" hidden>↓<span>Down</span></button><button id="touch-break" aria-label="Break block">${icon('minus')}<span>Break</span></button><button id="touch-build" class="build-action" aria-label="Place block">${icon('plus')}<span>Build</span></button></div>
      <span class="touch-look-tip">Drag the world to look around</span>
    </div>
    <dialog id="help-dialog" aria-labelledby="help-title">
      <button class="dialog-close icon-button" aria-label="Close help">${icon('close')}</button>
      <span class="dialog-eyebrow">A LITTLE HELP</span><h2 id="help-title">Let’s make something.</h2>
      <p>Everything in your block palette is unlimited. Aim at a nearby block to build or break.</p>
      <dl class="help-controls"><div><dt>Move around</dt><dd><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></dd></div><div><dt>Look around</dt><dd>Mouse / arrow keys</dd></div><div><dt>Jump</dt><dd><kbd>SPACE</kbd></dd></div><div><dt>Break / place a block</dt><dd>Left / right click<br><small>or <kbd>Q</kbd> / <kbd>E</kbd></small></dd></div><div><dt>Choose a block</dt><dd><kbd>1</kbd>–<kbd>8</kbd> or scroll</dd></div><div><dt>Fly on / off</dt><dd><kbd>F</kbd></dd></div><div><dt>Fly up / down</dt><dd><kbd>SPACE</kbd> / <kbd>SHIFT</kbd></dd></div><div><dt>Undo / go home / pause</dt><dd><kbd>Z</kbd> / <kbd>H</kbd> / <kbd>ESC</kbd></dd></div></dl>
      <p><strong>Quick build:</strong> press <kbd>B</kbd> or tap the Blue Buddy button to place a blue character statue nearby. It finds a clear spot without removing your builds. Undo removes the whole statue in one step. It never chases or attacks.</p>
      <p class="touch-help">On a touch screen, use the arrow buttons to move, drag the world to look, and tap Build or Break.</p>
      <div class="privacy-note">${icon('check')}<span>Your world saves automatically in this browser. No accounts, chat, ads, or purchases.</span></div>
      <button class="primary-button dialog-close">Got it ${icon('check')}</button>
      <button id="reset-button" class="text-button">Start a fresh meadow</button>
    </dialog>
    <dialog id="pause-dialog" aria-labelledby="pause-title"><span class="dialog-eyebrow">TAKE YOUR TIME</span><h2 id="pause-title">Your meadow can wait.</h2><p>Your world stays right here while you take a break.</p><button id="resume-button" class="primary-button">Back to playing ${icon('arrow')}</button><button id="pause-help" class="secondary-button">How to play</button></dialog>
    <dialog id="reset-dialog" aria-labelledby="reset-title"><span class="dialog-eyebrow">A FRESH START</span><h2 id="reset-title">Start over?</h2><p>This will remove your building changes and bring back the original meadow. It cannot be undone.</p><button id="cancel-reset" class="primary-button">Keep my world</button><button id="confirm-reset" class="text-button danger">Yes, start a fresh meadow</button></dialog>
    <noscript>This game needs JavaScript and WebGL. Please enable JavaScript in your browser.</noscript>
  `;
}
