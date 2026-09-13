# Block Meadow

A small, peaceful, Minecraft-inspired creative building game for kids. Original voxel scenery, textures, sheep, interface, and synthesized sound effects; no Minecraft assets or branding.

**[Play on GitHub Pages](https://jshelby22.github.io/block-meadow/)**

## Play locally

Requires Node.js 22.12+ or 24+, npm, and a browser with WebGL 2 support.

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5173/block-meadow/** and select **Let’s play**.

## Controls

| Action | Desktop |
| --- | --- |
| Move | W, A, S, D |
| Look | Mouse; arrow keys also work |
| Jump | Space |
| Break a block | Left click or Q |
| Place a block | Right click or E |
| Choose material | 1–8, mouse wheel, or block palette |
| Toggle flying | F |
| Fly up / down | Space / Shift |
| Walk faster | Shift |
| Undo the last change | Z (up to 100 changes this session) |
| Return to a safe starting spot | H |
| Quick build Blue Buddy | B |
| Pause / release mouse | Esc or Tab |

**Touch:** arrow buttons move; drag the world to look; Build and Break buttons edit the block under the crosshair. Fly enables Up and Down controls. The block palette can be swiped on especially narrow screens.

The mouse is captured for first-person play on supported desktop browsers. If pointer lock is unavailable (for example, a restrictive embedded preview), drag the world or use arrow keys to look. Esc, the pause button, and switching away pause the game and clear held movement.

## What is included

- A bounded sunny meadow with a starter cottage, pond, trees, flowers, and sheep.
- Eight unlimited materials: grass, earth, stone, wood, leaves, sand, brick, glass.
- One-click **Blue Buddy** statue, inspired by a blue toy reference: long blue arms, yellow hands/feet, big eyes, and a red toothy grin. Press **B** or tap **Quick build**. Safe placement preserves the meadow and existing builds; one Undo removes the entire statue. Its individual blocks can also be edited.
- Walking, jumping, collision-preserving flight, and home recovery.
- Nearby-block targeting, placement/removal, safe undo, and a protected foundation.
- Automatic local saves, validated restores, and confirmation before starting over.
- Responsive phone/tablet controls, keyboard alternatives, reduced-motion support.
- Optional quiet sound effects (muted by default), fullscreen, and help.

This is a single-player creative sandbox, not a full Minecraft clone. There is no survival mode, crafting, combat, multiplayer, or infinite terrain. Sheep and flowers are scenery, not collectible resources.

## Saves and privacy

World changes are stored in `localStorage` under `block-meadow.world.v1`. The world autosaves shortly after an edit and when pausing/leaving. A save is labeled successful only after reading it back. Invalid existing saves are preserved rather than overwritten, and storage failures show an explicit warning.

Saves belong to **this browser profile and origin**. Changing the host/port, clearing site data, or ending some private-browsing sessions can make a save unavailable. There is no cloud sync or account recovery. Player position, undo history, and sound preference do not persist between reloads; the game returns to a safe spawn above any saved builds.

No accounts, ads, chat, purchases, analytics, or external runtime requests. Fonts and the 3D library are bundled locally. Downloads from npm are needed only to set up development/build tooling.

## Build and serve

```sh
npm run build
npm run preview
```

The production site is in `dist/`; preview runs at **http://127.0.0.1:4173/block-meadow/**. Serve these files through HTTP(S), rather than double-clicking `index.html`. No backend is required.

The **Deploy game to GitHub Pages** workflow runs unit/browser tests, builds, validates production asset paths, and deploys after pushes to `main` or a manual workflow dispatch. Pages uses **GitHub Actions**, not legacy branch publishing. For another repository name, update `base` in `vite.config.js` and the matching assertion in `scripts/verify-build.mjs`.

## Verify

```sh
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Unit tests cover generation, edits, undo, save validation, movement, collisions, jumping, flight, and safe respawn. Browser tests exercise actual keyboard/touch input, placement/removal, persistence, pause, help, reset confirmation, sound, fullscreen, storage failures, responsive layouts, and 44px touch targets. Touch tests use Chromium device emulation, not a physical phone.

Browser screenshots are written to the ignored `qa/screenshots/` directory. With a production preview running, `node scripts/verify-production.mjs` exercises real builds, Blue Buddy, undo, and reload persistence. Pass a public URL and an optional evidence label to run the same check against deployment.

## Structure

- `src/world.js` — deterministic voxel data, editing, validation, persistence.
- `src/player.js` — rendering-independent movement and swept collision.
- `src/scene.js` — Three.js renderer, local pixel textures, scenery, picking.
- `src/game.js` — input, UI state, saves, pause/reset flow.
- `src/ui.js`, `src/style.css` — accessible controls and responsive layout.
- `src/audio.js` — locally synthesized sound effects.
- `src/blueprints.js` — shared voxel character/thumbnail data and safe placement search.

This is a standalone web project. It has no dependency on any iOS project.
