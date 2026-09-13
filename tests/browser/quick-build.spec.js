import { test, expect } from '@playwright/test';
import { BLUE_BUDDY } from '../../src/blueprints.js';

const countSaved = page => page.evaluate(() => JSON.parse(localStorage.getItem('block-meadow.world.v1')).changes.length);

test('Quick Build creates Blue Buddy with one click, undoes as one action, and survives reload', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Exercise the real button in drag-to-look mode, also used by embedded browsers.
  await page.addInitScript(() => { HTMLCanvasElement.prototype.requestPointerLock = undefined; });
  await page.goto('/');
  await page.getByRole('button', { name: /Let.s play/ }).click();
  const quickBuild = page.getByRole('button', { name: 'Quick build Blue Buddy' });
  await expect(quickBuild).toBeVisible();
  await quickBuild.click();
  await expect(page.locator('#toast')).toContainText('Blue Buddy');
  await expect.poll(() => countSaved(page)).toBe(BLUE_BUDDY.blocks.length);
  expect(await page.evaluate(() => window.meadow.snapshot().undoCount)).toBe(1);
  await page.screenshot({ path: 'qa/screenshots/blue-buddy-desktop.png' });
  await page.getByRole('button', { name: /Undo/ }).click();
  await expect.poll(() => countSaved(page)).toBe(0);
  await page.keyboard.press('KeyB');
  await expect.poll(() => countSaved(page)).toBe(BLUE_BUDDY.blocks.length);
  const saved = await page.evaluate(() => localStorage.getItem('block-meadow.world.v1'));
  await page.reload();
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-ready', 'true');
  expect(await page.evaluate(() => localStorage.getItem('block-meadow.world.v1'))).toBe(saved);
  expect(await page.evaluate(() => window.meadow.snapshot().changes.length)).toBe(BLUE_BUDDY.blocks.length);
  expect(errors).toEqual([]);
});

test.describe('Touch Quick Build', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  test('a child can tap to build and undo in portrait and landscape', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Let.s play/ }).tap();
    const button = page.getByRole('button', { name: 'Quick build Blue Buddy' });
    const box = await button.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    await button.tap();
    await expect.poll(() => countSaved(page)).toBe(BLUE_BUDDY.blocks.length);
    await page.screenshot({ path: 'qa/screenshots/blue-buddy-mobile.png' });
    await page.getByRole('button', { name: /Undo/ }).tap();
    await expect.poll(() => countSaved(page)).toBe(0);
    await page.setViewportSize({ width: 844, height: 390 });
    await button.tap();
    await expect.poll(() => countSaved(page)).toBe(BLUE_BUDDY.blocks.length);
    await page.screenshot({ path: 'qa/screenshots/blue-buddy-landscape.png' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(844);
  });
});
