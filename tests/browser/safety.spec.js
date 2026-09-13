import { test, expect } from '@playwright/test';

const key = 'block-meadow.world.v1';

test('an unreadable existing save is preserved, never overwritten by autosave', async ({ page }) => {
  await page.addInitScript(storageKey => localStorage.setItem(storageKey, '{an incomplete save'), key);
  await page.goto('/');
  await expect(page.locator('#save-text')).toHaveText('Not saving · see help');
  await page.getByRole('button', { name: /Let.s play/ }).click();
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(1000);
  await page.keyboard.up('ArrowDown');
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(400);
  expect(await page.evaluate(storageKey => localStorage.getItem(storageKey), key)).toBe('{an incomplete save');
  await expect(page.locator('#save-state')).toHaveClass(/error/);
});

test('storage failure is visible and does not stop play or pretend the world was saved', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Storage quota exceeded', 'QuotaExceededError'); };
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#save-text')).toHaveText('Not saved · browser storage');
  await page.getByRole('button', { name: /Let.s play/ }).click();
  await expect(page.locator('body')).toHaveClass(/playing/);
  await expect(page.locator('#save-state')).toHaveClass(/error/);
  expect(errors).toEqual([]);
});

test('pause clears held movement and resume does not drift', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Let.s play/ }).click();
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(350);
  await page.keyboard.press('Escape');
  const paused = await page.evaluate(() => window.meadow.snapshot().position);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.meadow.snapshot().position)).toEqual(paused);
  await page.keyboard.up('KeyW');
  await page.getByRole('button', { name: 'Back to playing' }).click();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.meadow.snapshot().position)).toEqual(paused);
});
