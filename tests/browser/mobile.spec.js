import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });

async function holdTouch(page, locator, milliseconds) {
  const bounds = await locator.boundingBox();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }] });
  await page.waitForTimeout(milliseconds);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

test('touch movement, drag-look, building, breaking, flight and home work in portrait and landscape', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#game-canvas')).toHaveAttribute('data-ready', 'true');
  await page.screenshot({ path: 'qa/screenshots/mobile-welcome.png' });
  await page.getByRole('button', { name: /Let.s play/ }).tap();
  const start = await page.evaluate(() => window.meadow.snapshot().position);
  await holdTouch(page, page.getByRole('button', { name: 'Move forward' }), 850);
  const moved = await page.evaluate(() => window.meadow.snapshot().position);
  expect(Math.hypot(moved.x - start.x, moved.z - start.z)).toBeGreaterThan(0.5);
  // Native touch input, not a direct mutation of the camera or world.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 225, y: 300 }] });
  for (let y = 320; y <= 440; y += 20) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 225, y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await expect(page.locator('#target-label')).not.toBeEmpty();
  await page.getByRole('button', { name: 'Wood, block 4' }).tap();
  await page.getByRole('button', { name: 'Place block' }).tap();
  await expect.poll(() => page.evaluate(() => window.meadow.snapshot().changes.length)).toBe(1);
  // Wait for the real save, not incidental touch/rendering latency.
  await expect(page.locator('#save-text')).toHaveText('Saved on this device');
  await page.getByRole('button', { name: 'Break block' }).tap();
  await expect.poll(() => page.evaluate(() => window.meadow.snapshot().changes.length)).toBe(0);
  await page.locator('#fly-button').tap();
  await expect(page.locator('#touch-down')).toBeVisible();
  await holdTouch(page, page.getByRole('button', { name: 'Jump or fly up' }), 750);
  const higher = await page.evaluate(() => window.meadow.snapshot().position.y);
  expect(higher).toBeGreaterThan(moved.y + 0.5);
  await page.locator('#home-button').tap();
  await expect(page.locator('#touch-jump span')).toHaveText('Jump');
  await expect(page.locator('#touch-down')).toBeHidden();
  await page.screenshot({ path: 'qa/screenshots/mobile-playing.png' });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.screenshot({ path: 'qa/screenshots/mobile-landscape.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

for (const width of [360, 390]) {
  test(`touch targets remain reachable at ${width}px wide`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: /Let.s play/ }).tap();
    for (const selector of ['#sound-button', '#help-button', '#pause-button', '#fly-button', '.block-slot', '[data-move]', '#touch-build']) {
      const sizes = await page.locator(selector).evaluateAll(elements => elements.map(element => {
        const box = element.getBoundingClientRect(); return { width: box.width, height: box.height };
      }));
      for (const size of sizes) {
        expect(size.width, `${selector} width`).toBeGreaterThanOrEqual(44);
        expect(size.height, `${selector} height`).toBeGreaterThanOrEqual(44);
      }
    }
  });
}
