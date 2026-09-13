import { test, expect } from '@playwright/test';

const simulationTimeout = process.env.CI ? 45_000 : 10_000;

test('the meadow renders a real 3D world and invites a child to play', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle('Block Meadow — Your little world');
  await expect(page.getByRole('heading', { name: 'Your own little world.' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Let.s play/ })).toBeEnabled();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('button', { name: 'Grass, block 1' })).toBeVisible();
  await page.screenshot({ path: 'qa/screenshots/desktop-welcome.png' });
  expect(errors).toEqual([]);
});

test('a child can enter the meadow, choose wood, build, undo, and keep the world after reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Let.s play/ }).click();
  await expect(page.locator('body')).toHaveClass(/playing/);
  await page.keyboard.press('Digit4');
  await expect(page.getByRole('button', { name: 'Wood, block 4' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.down('ArrowDown');
  await expect(page.locator('#target-label')).not.toBeEmpty({ timeout: simulationTimeout });
  await page.keyboard.up('ArrowDown');
  await expect(page.locator('#target-label')).not.toBeEmpty();
  await page.keyboard.press('KeyE');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('block-meadow.world.v1')).changes.length)).toBe(1);
  const saved = await page.evaluate(() => localStorage.getItem('block-meadow.world.v1'));
  expect(JSON.parse(saved).changes[0][1]).toBe('wood');
  await page.keyboard.press('KeyZ');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('block-meadow.world.v1')).changes.length)).toBe(0);
  await page.keyboard.press('KeyE');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('block-meadow.world.v1')).changes.length)).toBe(1);
  await page.reload();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-ready', 'true');
  expect(await page.evaluate(() => localStorage.getItem('block-meadow.world.v1'))).toBe(saved);
});

test('sound and fullscreen controls work, and Escape safely returns from help', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Turn sound on' }).click();
  await expect(page.locator('#sound-button')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => window.meadow.snapshot().audioState)).toBe('running');
  await page.getByRole('button', { name: 'Turn sound off' }).click();
  await expect(page.locator('#sound-button')).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Enter full screen' }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await page.getByRole('button', { name: 'Exit full screen' }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
  await page.getByRole('button', { name: /Let.s play/ }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Your meadow can wait.' })).toBeVisible();
  await page.locator('#pause-help').click();
  await expect(page.getByRole('dialog', { name: 'Let’s make something.' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.meadow.snapshot().active)).toBe(true);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
});

test('starting fresh requires confirmation and cancelling preserves every saved edit', async ({ page }) => {
  const saved = JSON.stringify({ version: 1, seed: 42, changes: [['12,7,12', 'wood']] });
  await page.addInitScript(value => localStorage.setItem('block-meadow.world.v1', value), saved);
  await page.goto('/');
  await page.getByRole('button', { name: 'How to play' }).click();
  await page.getByRole('button', { name: 'Start a fresh meadow', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Start over?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep my world' }).click();
  expect(await page.evaluate(() => localStorage.getItem('block-meadow.world.v1'))).toBe(saved);
  await page.getByRole('button', { name: 'Start a fresh meadow', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, start a fresh meadow' }).click();
  await expect(page.getByRole('heading', { name: 'Your own little world.' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('block-meadow.world.v1')).changes.length)).toBe(0);
  expect(await page.evaluate(() => window.meadow.snapshot().changes)).toEqual([]);
});

test('desktop mouse clicks build and break blocks, and keyboard movement and flight are live', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: /Let.s play/ }).click();
  const start = await page.evaluate(() => window.meadow.snapshot().position);
  await page.keyboard.down('KeyW');
  // Wait for simulation progress, not GPU shader warm-up wall time.
  await expect.poll(() => page.evaluate(origin => {
    const position = window.meadow.snapshot().position;
    return Math.hypot(position.x - origin.x, position.z - origin.z);
  }, start), { timeout: simulationTimeout }).toBeGreaterThan(0.5);
  await page.keyboard.up('KeyW');
  const moved = await page.evaluate(() => window.meadow.snapshot().position);
  expect(Math.hypot(moved.x - start.x, moved.z - start.z)).toBeGreaterThan(0.5);
  await page.keyboard.down('ArrowDown');
  await expect(page.locator('#target-label')).not.toBeEmpty({ timeout: simulationTimeout });
  await page.keyboard.up('ArrowDown');
  await expect(page.locator('#target-label')).not.toBeEmpty();
  // In pointer lock, click() also moves the mouse and can change the aim.
  // Press/release at the current cursor so we edit the block we just targeted.
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });
  await expect.poll(() => page.evaluate(() => window.meadow.snapshot().changes.length)).toBe(1);
  // The 200ms save completes beyond the game's 130ms click guard.
  await expect(page.locator('#save-text')).toHaveText('Saved on this device');
  await page.mouse.down({ button: 'left' });
  await page.mouse.up({ button: 'left' });
  await expect.poll(() => page.evaluate(() => window.meadow.snapshot().changes.length)).toBe(0);
  await page.keyboard.press('KeyF');
  await page.keyboard.down('Space');
  await expect.poll(() => page.evaluate(() => window.meadow.snapshot().position.y), { timeout: simulationTimeout }).toBeGreaterThan(moved.y + 0.5);
  await page.keyboard.up('Space');
  expect(await page.evaluate(() => window.meadow.snapshot().position.y)).toBeGreaterThan(moved.y + 0.5);
  await page.keyboard.press('KeyH');
  expect(await page.evaluate(() => window.meadow.snapshot().position)).toEqual(start);
  await expect(page.locator('#fly-button')).toHaveAttribute('aria-pressed', 'false');
  await page.screenshot({ path: 'qa/screenshots/desktop-playing.png' });
  expect(errors).toEqual([]);
});
